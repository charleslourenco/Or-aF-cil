import jsPDF from 'jspdf'
import 'jspdf-autotable'
import autoTable from 'jspdf-autotable'
import type { PerfilEmpresa } from '@/services/empresa'
import type {
  Orcamento,
  OrcamentoBOMItem,
  OrcamentoDRE,
  AmbienteOrcamento,
} from '@/services/orcamentos'

// Interface estendida para suportar autoTable no jsPDF
interface JsPDFWithAutoTable extends jsPDF {
  lastAutoTable?: {
    finalY?: number
  }
  autoTable?: typeof autoTable
}

export interface PropostaComercialItem {
  nome: string
  descricao?: string
  quantidade?: number
  valorUnitario?: number
  valorTotal?: number
}

export interface PropostaComercialAmbienteGrupo {
  nome: string
  itens: PropostaComercialItem[]
  subtotal: number
}

export interface PropostaComercialAmbiente {
  nome: string
  descricao?: string
  quantidade?: number
  valorUnitario?: number
  valorTotal?: number
}

export interface PropostaComercialData {
  orcamentoId?: string
  numeroSequencial?: number | null
  codigo?: string
  data?: string
  cliente: {
    nome: string
    telefone?: string
    email?: string
    endereco?: string
  }
  empresa?: PerfilEmpresa | null
  ambientes: PropostaComercialAmbiente[]
  ambientesGrupos?: PropostaComercialAmbienteGrupo[]
  valorTotal: number
  formaPagamento?: string | null
  observacoes?: string | null
}

export interface AnaliseCustoData {
  orcamentoId?: string
  numeroSequencial?: number | null
  codigo?: string
  versaoSistema?: string
  data?: string
  cliente: {
    nome: string
  }
  moduloNome?: string
  ambienteNome?: string
  dimensoes?: {
    largura: number
    altura: number
    profundidade: number
  }
  empresa?: PerfilEmpresa | null
  dre?: OrcamentoDRE | null
  bom?: OrcamentoBOMItem[] | null
  ambientes_json?: AmbienteOrcamento[] | null
  valorTotalVenda?: number
  valorTotalCusto?: number
  indicadoresSeguranca?: {
    alertaFlutuacao?: string
    margemMinima?: string
  }
}

/**
 * Auxiliar para formatar moeda em pt-BR
 */
function formatMoeda(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return 'R$\u00A00,00'
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val)
  // Substitui espaços normais por non-breaking space para blindar contra qualquer quebra
  return formatted.replace(/\s+/g, '\u00A0')
}

/**
 * Retorna um nome amigável e comercial para o módulo evitando termos internos
 * brutos como "Módulo Personalizado (Análise IA)" para o cliente final.
 */
export interface MontarDescricaoNaturalParams {
  nome?: string | null
  dimensoes?: {
    largura?: number | null
    altura?: number | null
    profundidade?: number | null
  } | null
  quantidade?: number | null
  mdfExterno?: string | { cor?: string; espessura?: number } | null
  mdfInterno?: string | { cor?: string; espessura?: number } | null
  composicao?: {
    portas?: { qtd?: number | null; tipo?: string | null } | null
    gavetas?: { qtd?: number | null } | null
    prateleiras?: { qtd?: number | null } | null
    cabideiro?: boolean | number | null
    sapateira?: boolean | null
    iluminacaoLed?: boolean | null
  } | null
}

function parseMdfSpec(mdf?: string | { cor?: string; espessura?: number } | null): {
  cor: string
  espessura: string
} {
  if (!mdf) return { cor: '', espessura: '' }
  if (typeof mdf === 'object') {
    const rawCor = (mdf.cor || '').trim()
    const espessura = mdf.espessura ? `${mdf.espessura}mm` : ''
    const cor = rawCor
      .replace(/^mdf\s*\d*\s*mm\s*/i, '')
      .replace(/^mdf\s+/i, '')
      .trim()
    return { cor, espessura }
  }
  const str = String(mdf).trim()
  const espMatch = str.match(/\(?(\d+)\s*mm\)?/i)
  const espessura = espMatch ? `${espMatch[1]}mm` : ''
  const cor = str
    .replace(/\s*\(\d+\s*mm\)/gi, '')
    .replace(/\s+\d+\s*mm/gi, '')
    .replace(/^mdf\s*\d*\s*mm\s*/i, '')
    .replace(/^mdf\s+/i, '')
    .trim()
  return { cor, espessura }
}

/**
 * Monta descrição natural determinística para o módulo na Proposta Comercial do PDF e cards de ambiente.
 * Regras:
 * - Se quantidade > 1: prefixo com "${quantidade} unidades — "
 * - MDF externo: "em MDF cor X (Ymm)"
 * - Se mdfInterno presente e diferente do externo: "(interno em MDF cor Z (Wmm))"
 * - Composição: "X portas de abrir" / "X portas de correr" / "X portas basculantes", "X gavetas", "X prateleiras internas", "cabideiro", "sapateira", "iluminação LED integrada"
 * - Fim: dimensões " — 1800×2400×600mm"
 */
export function montarDescricaoNaturalModulo({
  nome,
  dimensoes,
  quantidade,
  mdfExterno,
  mdfInterno,
  composicao,
}: MontarDescricaoNaturalParams): string {
  const dimStr =
    dimensoes && dimensoes.largura && dimensoes.altura
      ? `${dimensoes.largura}×${dimensoes.altura}${dimensoes.profundidade ? `×${dimensoes.profundidade}` : ''}mm`
      : ''

  const nomeRaw = (nome || '').trim()
  const nomeLower = nomeRaw.toLowerCase()
  const isCustomOuIA =
    !nomeRaw ||
    nomeLower.includes('módulo personalizado') ||
    nomeLower.includes('modulo personalizado') ||
    nomeLower.includes('análise ia') ||
    nomeLower.includes('analise ia') ||
    nomeRaw === 'MODULO-CUSTOM' ||
    nomeLower === 'módulo planejado' ||
    nomeLower === 'modulo planejado'

  const tipoMovel = isCustomOuIA ? 'Móvel sob medida' : nomeRaw

  // Prefixo de quantidade se > 1
  const qtdNum = Number(quantidade) || 0
  const prefixoQtd = qtdNum > 1 ? `${qtdNum} unidades — ` : ''

  // MDF externo
  const ext = parseMdfSpec(mdfExterno)
  // MDF interno
  const int = parseMdfSpec(mdfInterno)

  // Composição
  const itensComposicao: string[] = []
  const portasQtd = Number(composicao?.portas?.qtd) || 0
  const portasTipo = (composicao?.portas?.tipo || 'abrir').toLowerCase()
  if (portasQtd > 0) {
    if (portasTipo === 'correr') {
      itensComposicao.push(
        `${portasQtd} ${portasQtd === 1 ? 'porta de correr' : 'portas de correr'}`,
      )
    } else if (portasTipo === 'batente' || portasTipo === 'basculante') {
      itensComposicao.push(
        `${portasQtd} ${portasQtd === 1 ? 'porta basculante' : 'portas basculantes'}`,
      )
    } else if (portasTipo !== 'nenhum') {
      itensComposicao.push(`${portasQtd} ${portasQtd === 1 ? 'porta de abrir' : 'portas de abrir'}`)
    }
  }

  const gavetasQtd = Number(composicao?.gavetas?.qtd) || 0
  if (gavetasQtd > 0) {
    itensComposicao.push(`${gavetasQtd} ${gavetasQtd === 1 ? 'gaveta' : 'gavetas'}`)
  }

  const prateleirasQtd = Number(composicao?.prateleiras?.qtd) || 0
  if (prateleirasQtd > 0 || (composicao?.prateleiras as unknown) === true) {
    if (prateleirasQtd > 0) {
      itensComposicao.push(
        `${prateleirasQtd} ${prateleirasQtd === 1 ? 'prateleira interna' : 'prateleiras internas'}`,
      )
    } else {
      itensComposicao.push('prateleiras internas')
    }
  }

  if (composicao?.cabideiro) {
    itensComposicao.push('cabideiro')
  }

  if (composicao?.sapateira) {
    itensComposicao.push('sapateira')
  }

  if (composicao?.iluminacaoLed) {
    itensComposicao.push('iluminação LED integrada')
  }

  // Fallback quando não há composição nem material
  if (itensComposicao.length === 0 && !ext.cor) {
    if (isCustomOuIA) {
      const fallbackDesc = dimStr ? `Móvel Sob Medida (${dimStr})` : 'Móvel Sob Medida'
      return `${prefixoQtd}${fallbackDesc}`
    }
    const fallbackDesc = dimStr ? `${tipoMovel} — ${dimStr}` : tipoMovel
    return `${prefixoQtd}${fallbackDesc}`
  }

  // Montagem natural
  let desc = tipoMovel
  if (ext.cor) {
    desc += ` em MDF cor ${ext.cor}${ext.espessura ? ` (${ext.espessura})` : ''}`
  }

  // Se mdfInterno presente e diferente, append
  const isInternalDifferent =
    int.cor &&
    (int.cor.toLowerCase() !== ext.cor.toLowerCase() ||
      (int.espessura && ext.espessura && int.espessura !== ext.espessura))

  if (int.cor && isInternalDifferent) {
    desc += ` (interno em MDF cor ${int.cor}${int.espessura ? ` (${int.espessura})` : ''})`
  }

  if (itensComposicao.length > 0) {
    let composicaoStr = ''
    if (itensComposicao.length === 1) {
      composicaoStr = itensComposicao[0]
    } else {
      const todosMenosUltimo = itensComposicao.slice(0, -1).join(', ')
      const ultimo = itensComposicao[itensComposicao.length - 1]
      composicaoStr = `${todosMenosUltimo} e ${ultimo}`
    }
    desc += `, com ${composicaoStr}`
  }

  if (dimStr) {
    desc += ` — ${dimStr}`
  }

  return `${prefixoQtd}${desc}`
}

function getNomeModuloAmigavel(
  nomeOriginal?: string | null,
  dimensoes?: { largura?: number; altura?: number; profundidade?: number } | null,
): string {
  const nome = (nomeOriginal || 'Módulo Planejado').trim()

  const isNomeCruOuIA =
    !nome ||
    nome.toLowerCase().includes('módulo personalizado') ||
    nome.toLowerCase().includes('modulo personalizado') ||
    nome.toLowerCase().includes('análise ia') ||
    nome.toLowerCase().includes('analise ia') ||
    nome === 'MODULO-CUSTOM' ||
    nome.toLowerCase() === 'módulo planejado' ||
    nome.toLowerCase() === 'modulo planejado'

  if (isNomeCruOuIA) {
    if (dimensoes && dimensoes.largura && dimensoes.altura) {
      const p = dimensoes.profundidade ? `×${dimensoes.profundidade}` : ''
      return `Móvel Sob Medida (${dimensoes.largura}×${dimensoes.altura}${p}mm)`
    }
    return 'Móvel Planejado Sob Medida'
  }

  return nome
}

/**
 * Auxiliar para formatar porcentagem em pt-BR
 */
function formatPercentual(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '0,00%'
  return (
    new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val) + '%'
  )
}

/**
 * Carrega uma imagem de URL como HTMLImageElement para inclusão segura no jsPDF
 */
async function carregarImagem(url: string): Promise<HTMLImageElement | null> {
  if (!url || typeof url !== 'string' || !url.trim()) return null
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => {
      console.warn('Não foi possível carregar o logo via URL:', url)
      resolve(null)
    }
    img.src = url
  })
}

/**
 * Formata data ISO para pt-BR (ex: "15/05/2026")
 */
function formatarData(dataIso?: string | null): string {
  if (!dataIso) {
    return new Intl.DateTimeFormat('pt-BR').format(new Date())
  }
  try {
    const d = new Date(dataIso)
    if (isNaN(d.getTime())) return dataIso
    return new Intl.DateTimeFormat('pt-BR').format(d)
  } catch {
    return dataIso
  }
}

/**
 * Invoca autoTable com segurança suportando chamada doc.autoTable ou autoTable(doc, ...)
 */
function invokeAutoTable(doc: JsPDFWithAutoTable, options: Record<string, unknown>) {
  if (typeof doc.autoTable === 'function') {
    // @ts-expect-error autoTable supports options as single parameter or doc, options
    doc.autoTable(options)
  } else if (typeof autoTable === 'function') {
    ;(autoTable as (d: jsPDF, opts: Record<string, unknown>) => void)(doc, options)
  }
}

/**
 * 📄 GERAR PROPOSTA COMERCIAL (PDF do Cliente)
 * Identidade Visual: BENDER HAUSSFORM
 * Cores: Grafite (#0F172A / #1E293B), Dourado/Âmbar (#B45309), Slate (#64748B, #94A3B8, #334155), Fundos claros (#F8FAFC, #E2E8F0)
 */
export async function gerarPropostaComercial(dados: PropostaComercialData): Promise<void> {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    }) as JsPDFWithAutoTable

    if (!doc.autoTable) {
      doc.autoTable = autoTable
    }

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 15
    const contentWidth = pageWidth - margin * 2

    let y = margin

    // 1. CABEÇALHO (2 colunas — grid visual)
    const empresa = dados.empresa
    const logoUrl = empresa?.logo_url

    let logoCarregada = false
    let logoRenderWidth = 0
    let logoRenderHeight = 0

    if (logoUrl) {
      try {
        const img = await carregarImagem(logoUrl)
        if (img) {
          const logoMaxHeight = 16
          const logoMaxWidth = 45
          let w = img.width
          let h = img.height
          const ratio = Math.min(logoMaxWidth / w, logoMaxHeight / h)
          logoRenderWidth = w * ratio
          logoRenderHeight = h * ratio
          doc.addImage(img, 'PNG', margin, y, logoRenderWidth, logoRenderHeight)
          logoCarregada = true
        }
      } catch (e) {
        console.warn('Falha ao adicionar imagem ao PDF:', e)
      }
    }

    // Cabeçalho mais leve: sem o badge escuro (#1E293B) no topo.
    // A coluna de dados da empresa ganha a largura total.
    const headerLeftMaxW = contentWidth

    // Código do orçamento formatado
    const numeroFormatado =
      dados.numeroSequencial !== undefined && dados.numeroSequencial !== null
        ? String(dados.numeroSequencial).padStart(3, '0')
        : dados.codigo
          ? dados.codigo.replace(/^#/, '')
          : (dados.orcamentoId || '000000')
              .replace(/[^a-zA-Z0-9]/g, '')
              .slice(-6)
              .toUpperCase() || '001'
    const textoNumeroOrcamento = `Orçamento Nº ${numeroFormatado}`
    const dataFormatada = formatarData(dados.data)
    const textoEmissao = `Emissão: ${dataFormatada}`

    let textStartY = y
    if (logoCarregada) {
      textStartY = y + logoRenderHeight + 3.5
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(15, 23, 42) // #0F172A
    doc.text('BENDER HAUSSFORM', margin, textStartY + 4)

    let subTextY = textStartY + 8.5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139) // Slate-500

    // Linha 1: CNPJ + IE
    const docFiscalParts: string[] = []
    if (empresa?.cnpj) docFiscalParts.push(`CNPJ: ${empresa.cnpj}`)
    if (empresa?.inscricao_estadual) docFiscalParts.push(`IE: ${empresa.inscricao_estadual}`)
    const linha1 =
      docFiscalParts.length > 0 ? docFiscalParts.join(' | ') : 'Móveis Sob Medida e Alta Marcenaria'
    const splitLinha1 = doc.splitTextToSize(linha1, headerLeftMaxW)
    doc.text(splitLinha1, margin, subTextY)
    subTextY += (Array.isArray(splitLinha1) ? splitLinha1.length : 1) * 3.6

    // Linha 2: Endereço completo
    const enderecoParts = [
      empresa?.logradouro
        ? `${empresa.logradouro}${empresa.numero ? ', ' + empresa.numero : ''}`
        : '',
      empresa?.bairro,
      empresa?.cidade && empresa?.estado ? `${empresa.cidade}/${empresa.estado}` : empresa?.cidade,
      empresa?.cep ? `CEP: ${empresa.cep}` : '',
    ].filter(Boolean)
    const linha2 = enderecoParts.join(', ')
    if (linha2) {
      const splitLinha2 = doc.splitTextToSize(linha2, headerLeftMaxW)
      doc.text(splitLinha2, margin, subTextY)
      subTextY += (Array.isArray(splitLinha2) ? splitLinha2.length : 1) * 3.6
    }

    // Linha 3: Telefone, Email, Site, Instagram
    const contatosParts = [
      empresa?.telefone ? `Tel: ${empresa.telefone}` : '',
      empresa?.email_comercial ? `Email: ${empresa.email_comercial}` : '',
      empresa?.site ? `Site: ${empresa.site}` : '',
      empresa?.instagram ? `Instagram: ${empresa.instagram}` : '',
    ].filter(Boolean)
    const linha3 = contatosParts.join(' | ')
    if (linha3) {
      const splitLinha3 = doc.splitTextToSize(linha3, headerLeftMaxW)
      doc.text(splitLinha3, margin, subTextY)
      subTextY += (Array.isArray(splitLinha3) ? splitLinha3.length : 1) * 3.6
    }

    y = subTextY + 2

    // Linha divisória após cabeçalho
    doc.setDrawColor(226, 232, 240) // #E2E8F0
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageWidth - margin, y)
    y += 6

    // 2. TÍTULO DA PROPOSTA
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(15, 23, 42) // #0F172A
    doc.text('PROPOSTA COMERCIAL', pageWidth / 2, y + 4, { align: 'center' })
    y += 8

    // 3. BOX DO CLIENTE (com "Orçamento Nº XXX" logo acima do nome do cliente e "Emissão: DD/MM/AAAA" à direita)
    const contatosClienteArr = [
      dados.cliente.telefone ? `Tel: ${dados.cliente.telefone}` : '',
      dados.cliente.email ? `Email: ${dados.cliente.email}` : '',
      dados.cliente.endereco ? `End: ${dados.cliente.endereco}` : '',
    ].filter(Boolean)

    const hasExtraClientData = contatosClienteArr.length > 0
    const clientBoxHeight = hasExtraClientData ? 24 : 18

    doc.setFillColor(248, 250, 252) // #F8FAFC
    doc.roundedRect(margin, y, contentWidth, clientBoxHeight, 2, 2, 'F')
    doc.setDrawColor(226, 232, 240) // #E2E8F0
    doc.setLineWidth(0.3)
    doc.roundedRect(margin, y, contentWidth, clientBoxHeight, 2, 2, 'S')

    // Linha superior do box: "Orçamento Nº 016" (helvetica bold, 10pt, #0F172A) à esquerda | "Emissão: DD/MM/AAAA" à direita
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42) // #0F172A
    doc.text(textoNumeroOrcamento, margin + 5, y + 5.5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139) // #64748B
    doc.text(textoEmissao, margin + contentWidth - 5, y + 5.5, { align: 'right' })

    // Linha inferior do box: "CLIENTE:" + Nome do cliente
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(51, 65, 85) // #334155
    doc.text('CLIENTE:', margin + 5, y + 11.5)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42) // #0F172A
    doc.text(dados.cliente.nome || 'Cliente não informado', margin + 24, y + 11.5)

    if (hasExtraClientData) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(100, 116, 139) // #64748B
      const splitClienteExtra = doc.splitTextToSize(
        contatosClienteArr.join('   |   '),
        contentWidth - 10,
      )
      doc.text(splitClienteExtra, margin + 5, y + 18.5)
    }

    y += clientBoxHeight + 7

    // 4. TÍTULO DA SEÇÃO DA TABELA
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42) // #0F172A
    doc.text('RELAÇÃO DE AMBIENTES E MÓVEIS PLANEJADOS', margin, y)
    y += 4

    // 5. TABELA DE ITENS (COM SUPORTE A MÚLTIPLOS AMBIENTES AGRUPADOS)
    if (dados.ambientesGrupos && dados.ambientesGrupos.length > 0) {
      // Renderiza bloco por ambiente
      let itemGlobalIndex = 1
      for (const grupo of dados.ambientesGrupos) {
        if (y + 25 > pageHeight - 35) {
          doc.addPage()
          y = margin
        }

        // Título do Ambiente
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(30, 41, 59)
        doc.setFillColor(241, 245, 249) // #F1F5F9
        doc.roundedRect(margin, y, contentWidth, 7, 1.5, 1.5, 'F')
        doc.text(`AMBIENTE: ${grupo.nome.toUpperCase()}`, margin + 3, y + 5)
        doc.setFont('helvetica', 'normal')
        doc.text(`Subtotal: ${formatMoeda(grupo.subtotal)}`, pageWidth - margin - 3, y + 5, {
          align: 'right',
        })
        y += 8.5

        const grupoBody = (grupo.itens || []).map((it) => {
          const qtd = it.quantidade ?? 1
          const vTot = it.valorTotal ?? (it.valorUnitario ? it.valorUnitario * qtd : 0)
          const vUnit = it.valorUnitario ?? (qtd > 0 ? vTot / qtd : vTot)
          const nomeApresentavel = getNomeModuloAmigavel(it.nome)
          const row = [
            String(itemGlobalIndex++),
            nomeApresentavel,
            it.descricao || 'Projeto sob medida conforme especificações técnicas aprovadas',
            String(qtd),
            formatMoeda(vUnit),
            formatMoeda(vTot),
          ]
          return row
        })

        invokeAutoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [['Item', 'Módulo', 'Descrição do Projeto', 'Qtd', 'Valor Unit.', 'Valor Total']],
          body:
            grupoBody.length > 0
              ? grupoBody
              : [['—', 'Sem módulos', '—', '0', 'R$\u00A00,00', 'R$\u00A00,00']],
          theme: 'grid',
          headStyles: {
            fillColor: [241, 245, 249],
            textColor: [51, 65, 85],
            fontStyle: 'bold',
            fontSize: 7.5,
            halign: 'left',
            lineWidth: { bottom: 0.5 },
            lineColor: [203, 213, 225],
            cellPadding: { top: 2.2, right: 3, bottom: 2.2, left: 3 },
          },
          bodyStyles: {
            textColor: [51, 65, 85],
            fontSize: 7.5,
            cellPadding: { top: 2.2, right: 3, bottom: 2.2, left: 3 },
            valign: 'middle',
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252],
          },
          columnStyles: {
            0: { cellWidth: contentWidth * 0.05, halign: 'center' },
            1: { cellWidth: contentWidth * 0.24, halign: 'left', fontStyle: 'bold' },
            2: { cellWidth: contentWidth * 0.38, halign: 'left', valign: 'middle' },
            3: { cellWidth: contentWidth * 0.07, halign: 'center' },
            4: {
              cellWidth: contentWidth * 0.13,
              halign: 'right',
              fontSize: 7.2,
              cellPadding: { top: 2.2, right: 2, bottom: 2.2, left: 2 },
            },
            5: {
              cellWidth: contentWidth * 0.13,
              halign: 'right',
              fontSize: 7.2,
              fontStyle: 'bold',
              cellPadding: { top: 2.2, right: 2, bottom: 2.2, left: 2 },
            },
          },
          styles: {
            lineColor: [226, 232, 240],
            lineWidth: 0.3,
            font: 'helvetica',
            overflow: 'linebreak',
          },
        })

        y = (doc.lastAutoTable?.finalY ?? y) + 6
      }
    } else {
      // Fallback: modo plano tradicional
      const tableBody = dados.ambientes.map((amb, index) => {
        const qtd = amb.quantidade ?? 1
        const vUnit =
          amb.valorUnitario ??
          (amb.valorTotal ? amb.valorTotal / qtd : dados.valorTotal / (dados.ambientes.length || 1))
        const vTot = amb.valorTotal ?? vUnit * qtd
        const nomeApresentavel = getNomeModuloAmigavel(amb.nome)
        return [
          String(index + 1),
          nomeApresentavel,
          amb.descricao || 'Projeto sob medida conforme especificações técnicas aprovadas',
          String(qtd),
          formatMoeda(vUnit),
          formatMoeda(vTot),
        ]
      })

      invokeAutoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [
          [
            'Item',
            'Ambiente / Módulo',
            'Descrição do Projeto',
            'Qtd',
            'Valor Unit.',
            'Valor Total',
          ],
        ],
        body: tableBody,
        theme: 'grid',
        headStyles: {
          fillColor: [241, 245, 249], // #F1F5F9 — cinza suave
          textColor: [51, 65, 85], // #334155 — slate escuro
          fontStyle: 'bold',
          fontSize: 7.5,
          halign: 'left',
          lineWidth: { bottom: 0.5 },
          lineColor: [203, 213, 225], // #CBD5E1
          cellPadding: { top: 2.2, right: 3, bottom: 2.2, left: 3 },
        },
        bodyStyles: {
          textColor: [51, 65, 85],
          fontSize: 7.5,
          cellPadding: { top: 2.2, right: 3, bottom: 2.2, left: 3 },
          valign: 'middle',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252], // #F8FAFC para linhas pares
        },
        columnStyles: {
          0: { cellWidth: contentWidth * 0.05, halign: 'center' },
          1: { cellWidth: contentWidth * 0.24, halign: 'left', fontStyle: 'bold' },
          2: { cellWidth: contentWidth * 0.38, halign: 'left', valign: 'middle' },
          3: { cellWidth: contentWidth * 0.07, halign: 'center' },
          4: {
            cellWidth: contentWidth * 0.13,
            halign: 'right',
            fontSize: 7.2,
            cellPadding: { top: 2.2, right: 2, bottom: 2.2, left: 2 },
          },
          5: {
            cellWidth: contentWidth * 0.13,
            halign: 'right',
            fontSize: 7.2,
            fontStyle: 'bold',
            cellPadding: { top: 2.2, right: 2, bottom: 2.2, left: 2 },
          },
        },
        styles: {
          lineColor: [226, 232, 240], // #E2E8F0
          lineWidth: 0.3,
          font: 'helvetica',
          overflow: 'linebreak',
        },
      })

      y = (doc.lastAutoTable?.finalY ?? y) + 7
    }

    // 6. BOX DE INVESTIMENTO TOTAL (100% da largura útil)
    const boxTotalHeight = 24

    // Se não houver espaço suficiente para o box de total, condições e assinaturas, adiciona página
    if (y + boxTotalHeight > pageHeight - 40) {
      doc.addPage()
      y = margin
    }

    doc.setFillColor(241, 245, 249) // #F1F5F9 — cinza suave
    doc.roundedRect(margin, y, contentWidth, boxTotalHeight, 2, 2, 'F')
    doc.setDrawColor(203, 213, 225) // #CBD5E1 — borda suave
    doc.setLineWidth(0.5)
    doc.roundedRect(margin, y, contentWidth, boxTotalHeight, 2, 2, 'S')

    // Título "INVESTIMENTO TOTAL" em slate-700 (#334155)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(51, 65, 85) // #334155
    doc.text('INVESTIMENTO TOTAL', pageWidth / 2, y + 7.5, { align: 'center' })

    // Valor Total em Grafite Escuro (#0F172A) bold 20px
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.setTextColor(15, 23, 42) // #0F172A
    doc.text(formatMoeda(dados.valorTotal), pageWidth / 2, y + 18, { align: 'center' })

    y += boxTotalHeight + 8

    // 7. FORMA DE PAGAMENTO E OBSERVAÇÕES (sem textos automáticos; se ambos vazios omite; se um só renderiza só esse)
    const formaPagamentoTexto = dados.formaPagamento?.trim() || ''
    const observacoesTexto = dados.observacoes?.trim() || ''
    const hasForma = Boolean(formaPagamentoTexto)
    const hasObs = Boolean(observacoesTexto)

    if (hasForma || hasObs) {
      // Medição e quebra de linhas para altura dinâmica do card
      const cardContentW = contentWidth - 10
      const labelW = 44
      const valueW = cardContentW - labelW

      const splitForma = hasForma ? doc.splitTextToSize(formaPagamentoTexto, valueW) : []
      const splitObs = hasObs ? doc.splitTextToSize(observacoesTexto, valueW) : []

      const formaH = hasForma ? (Array.isArray(splitForma) ? splitForma.length : 1) * 4 : 0
      const obsH = hasObs ? (Array.isArray(splitObs) ? splitObs.length : 1) * 4 : 0
      const spacingBetween = hasForma && hasObs ? 2.5 : 0
      const condCardHeight = Math.max(16, 7 + formaH + obsH + spacingBetween + 3)

      if (y + condCardHeight + 10 > pageHeight - 35) {
        doc.addPage()
        y = margin
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(15, 23, 42) // #0F172A
      doc.text('CONDIÇÕES COMERCIAIS', margin, y)
      y += 4

      doc.setFillColor(248, 250, 252) // #F8FAFC
      doc.roundedRect(margin, y, contentWidth, condCardHeight, 2, 2, 'F')
      doc.setDrawColor(226, 232, 240) // #E2E8F0
      doc.setLineWidth(0.3)
      doc.roundedRect(margin, y, contentWidth, condCardHeight, 2, 2, 'S')

      let condTextY = y + 6.5

      if (hasForma) {
        // Forma de Pagamento
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(51, 65, 85) // #334155
        doc.text('Forma de Pagamento:', margin + 5, condTextY)

        doc.setFont('helvetica', 'normal')
        doc.setTextColor(51, 65, 85)
        doc.text(splitForma, margin + 5 + labelW, condTextY)

        condTextY += formaH + 2.5
      }

      if (hasObs) {
        // Observações e Prazos
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(51, 65, 85)
        doc.text('Observações e Prazos:', margin + 5, condTextY)

        doc.setFont('helvetica', 'normal')
        doc.setTextColor(51, 65, 85)
        doc.text(splitObs, margin + 5 + labelW, condTextY)
      }

      y += condCardHeight + 10
    }

    // 8. ASSINATURAS (LADO A LADO)
    // Se espaço restante for < 45mm, pula para nova página
    const minSpace = 45
    if (pageHeight - y < minSpace) {
      doc.addPage()
      y = margin + 10
    }

    const sigWidth = 70
    const sigLeftX = margin + 5
    const sigRightX = pageWidth - margin - sigWidth - 5
    const sigY = y + 16

    // Linhas de assinatura
    doc.setDrawColor(148, 163, 184) // Slate-400
    doc.setLineWidth(0.4)
    doc.line(sigLeftX, sigY, sigLeftX + sigWidth, sigY)
    doc.line(sigRightX, sigY, sigRightX + sigWidth, sigY)

    // Textos centralizados acima da linha
    // Esquerda: "BENDER HAUSSFORM" (bold) / "Representante Comercial" (normal)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(15, 23, 42) // #0F172A
    doc.text('BENDER HAUSSFORM', sigLeftX + sigWidth / 2, sigY + 4.5, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(100, 116, 139) // Slate-500
    doc.text('Representante Comercial', sigLeftX + sigWidth / 2, sigY + 8.5, { align: 'center' })

    // Direita: nome do cliente (bold) / "De Acordo com a Proposta" (normal)
    const clienteAssinatura = dados.cliente.nome || 'Cliente Responsável'
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(15, 23, 42) // #0F172A
    doc.text(clienteAssinatura, sigRightX + sigWidth / 2, sigY + 4.5, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(100, 116, 139) // Slate-500
    doc.text('De Acordo com a Proposta', sigRightX + sigWidth / 2, sigY + 8.5, { align: 'center' })

    // 9. RODAPÉ FIXO EM TODAS AS PÁGINAS
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setDrawColor(226, 232, 240) // #E2E8F0
      doc.setLineWidth(0.3)
      doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(148, 163, 184) // Slate-400
      doc.text('BENDER HAUSSFORM • Móveis Sob Medida', margin, pageHeight - 6)
      doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 6, {
        align: 'right',
      })
    }

    // Download automático do PDF
    const sanitizedName = (dados.cliente.nome || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_')
    const codSugestivo =
      dados.numeroSequencial !== undefined && dados.numeroSequencial !== null
        ? String(dados.numeroSequencial).padStart(3, '0')
        : (dados.codigo || dados.orcamentoId || '000')
            .replace(/[^a-zA-Z0-9]/g, '')
            .slice(-6)
            .toUpperCase() || '000'
    doc.save(`Proposta_Comercial_${sanitizedName}_${codSugestivo}.pdf`)
  } catch (error) {
    console.error('Erro ao gerar proposta comercial em PDF:', error)
    throw error
  }
}

/**
 * 🛠️ GERAR ANÁLISE DE CUSTO (PDF Interno de Engenharia / Fábrica)
 * Contém DRE completa, BOM consolidada, detalhamento de peças, margens, markup e alertas de flutuação.
 * Identidade Visual BENDER HAUSSFORM: Cores Grafite (#0F172A / #1E293B), Dourado/Âmbar (#B45309), Slate e Neutros.
 */
export async function gerarAnaliseCusto(dados: AnaliseCustoData): Promise<void> {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    }) as JsPDFWithAutoTable

    if (!doc.autoTable) {
      doc.autoTable = autoTable
    }

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 15
    const contentWidth = pageWidth - margin * 2

    let y = margin

    // 1. CABEÇALHO TÉCNICO
    doc.setFillColor(15, 23, 42) // #0F172A — Grafite escuro
    doc.rect(margin, y, contentWidth, 16, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(255, 255, 255)
    doc.text('BENDER HAUSSFORM — RELATÓRIO DE ENGENHARIA FINANCEIRA', margin + 4, y + 7)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184) // Slate-400
    const codId =
      dados.numeroSequencial !== undefined && dados.numeroSequencial !== null
        ? String(dados.numeroSequencial).padStart(3, '0')
        : (dados.codigo || dados.orcamentoId || '000')
            .replace(/[^a-zA-Z0-9]/g, '')
            .slice(-8)
            .toUpperCase() || '000'
    const versao = dados.versaoSistema || 'OrçaFácil v3.0'
    doc.text(
      `ID: #${codId}   |   ${versao}   |   Emissão: ${formatarData(dados.data)}`,
      margin + 4,
      y + 12.5,
    )

    y += 20

    // Identificação do Módulo e Cliente
    doc.setFillColor(248, 250, 252) // #F8FAFC
    doc.setDrawColor(226, 232, 240) // #E2E8F0
    doc.roundedRect(margin, y, contentWidth, 14, 1.5, 1.5, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(15, 23, 42) // #0F172A
    doc.text(`Cliente: ${dados.cliente.nome || 'Não informado'}`, margin + 4, y + 5.5)

    const dimText = dados.dimensoes
      ? `Dimensões: ${dados.dimensoes.largura}L × ${dados.dimensoes.altura}A × ${dados.dimensoes.profundidade}P mm`
      : ''
    const modText = `Módulo: ${dados.moduloNome || 'Padrão'} (${dados.ambienteNome || 'Ambiente'})`

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139) // Slate-500
    doc.text(`${modText}   |   ${dimText}`, margin + 4, y + 10.5)

    y += 18

    // 2. DRE SINTÉTICA DO PROJETO
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(15, 23, 42) // #0F172A
    doc.text('1. DRE SINTÉTICA DO PROJETO', margin, y)
    y += 4

    const dre = dados.dre || {}
    const valorVenda = dados.valorTotalVenda ?? dre.preco_final ?? 0
    const custoMp = dre.custo_mp ?? dados.valorTotalCusto ?? 0

    const calcPercent = (val: number | undefined) => {
      if (!valorVenda || !val) return 0
      return (val / valorVenda) * 100
    }

    const impPercent = dre.impostos_percent ?? calcPercent(dre.impostos)
    const comPercent = dre.comissao_percent ?? calcPercent(dre.comissao)
    const fixoPercent = dre.custo_fixo_percent ?? calcPercent(dre.custo_fixo_rateado)
    const finPercent =
      typeof dre.custo_financeiro_percent === 'number'
        ? dre.custo_financeiro_percent
        : calcPercent(typeof dre.custo_financeiro === 'number' ? dre.custo_financeiro : undefined)
    const lucroPercent = dre.lucro_liquido_percent ?? calcPercent(dre.lucro_liquido)
    const mpPercent = calcPercent(custoMp)

    const markupEfetivo = dre.markup_efetivo ?? (custoMp > 0 ? valorVenda / custoMp : 2.5)

    // Valores reais da DRE persistida/calculada sem hardcoding arbitrário
    const impostosVal =
      typeof dre.impostos === 'number' ? dre.impostos : (valorVenda * (impPercent || 0)) / 100

    const comissaoVal =
      typeof dre.comissao === 'number' ? dre.comissao : (valorVenda * (comPercent || 0)) / 100

    const fixoVal =
      typeof dre.custo_fixo_rateado === 'number'
        ? dre.custo_fixo_rateado
        : (valorVenda * (fixoPercent || 0)) / 100

    const custoFinVal =
      typeof dre.custo_financeiro === 'number'
        ? dre.custo_financeiro
        : (valorVenda * (finPercent || 0)) / 100

    const lucroLiqVal =
      typeof dre.lucro_liquido === 'number'
        ? dre.lucro_liquido
        : valorVenda - custoMp - impostosVal - comissaoVal - fixoVal - custoFinVal

    const dreRows: string[][] = [
      ['Custo Direto de Matéria-Prima (BOM)', formatMoeda(custoMp), formatPercentual(mpPercent)],
      [
        'Impostos Estimados (NFe / Simples / Presumido)',
        formatMoeda(impostosVal),
        formatPercentual(impPercent),
      ],
      [
        'Comissão de Venda / Equipe Comercial',
        formatMoeda(comissaoVal),
        formatPercentual(comPercent),
      ],
      [
        'Custo da Empresa Rateado (Fixos + Variáveis)',
        formatMoeda(fixoVal),
        formatPercentual(fixoPercent),
      ],
    ]

    if (custoFinVal > 0 || finPercent > 0) {
      dreRows.push([
        'Custo Financeiro / Taxa Cartão',
        formatMoeda(custoFinVal),
        formatPercentual(finPercent),
      ])
    }

    dreRows.push([
      'Lucro Líquido Operacional Previsto',
      formatMoeda(lucroLiqVal),
      formatPercentual(lucroPercent),
    ])

    invokeAutoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Estrutura de Resultados (DRE)', 'Valor (R$)', '% da Venda']],
      body: dreRows,
      theme: 'grid',
      headStyles: {
        fillColor: [241, 245, 249], // #F1F5F9 — tom suave
        textColor: [51, 65, 85], // #334155
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      bodyStyles: {
        textColor: [51, 65, 85],
        fontSize: 8,
        cellPadding: 2.8,
      },
      columnStyles: {
        0: { cellWidth: 'auto', fontStyle: 'bold' },
        1: { cellWidth: 38, halign: 'right' },
        2: { cellWidth: 30, halign: 'right' },
      },
      styles: {
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
        font: 'helvetica',
      },
    })

    y = (doc.lastAutoTable?.finalY ?? y) + 4

    // Destaque de Markup e Preço Final (Cores: Fundo #F8FAFC, Borda #B45309 clareada para 0.4, Texto #B45309 e #0F172A)
    doc.setFillColor(248, 250, 252) // #F8FAFC
    doc.setDrawColor(180, 83, 9) // #B45309 — Dourado / Âmbar
    doc.setLineWidth(0.4)
    doc.roundedRect(margin, y, contentWidth, 10, 1.5, 1.5, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(180, 83, 9) // #B45309 — Dourado
    doc.text(`MARKUP EFETIVO: ${markupEfetivo.toFixed(2)}x`, margin + 6, y + 6.5)

    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42) // #0F172A — Grafite Escuro
    doc.text(`PREÇO FINAL SUGERIDO: ${formatMoeda(valorVenda)}`, pageWidth - margin - 6, y + 6.5, {
      align: 'right',
    })

    y += 15

    // 3. BOM GERAL (MATÉRIA-PRIMA CONSOLIDADA)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(15, 23, 42) // #0F172A
    doc.text('2. BOM GERAL — MATÉRIA-PRIMA E FERRAGENS (FÁBRICA)', margin, y)
    y += 4

    const hasMultiAmbientesBOM =
      dados.ambientes_json && Array.isArray(dados.ambientes_json) && dados.ambientes_json.length > 0

    if (hasMultiAmbientesBOM) {
      // BOM Consolidada com coluna de Ambiente / Módulo
      const multiBomRows: Array<[string, string, string, string, string, string, string, string]> =
        []

      dados.ambientes_json!.forEach((amb) => {
        ;(amb.modulos || []).forEach((mod) => {
          ;(mod.itens || []).forEach((item) => {
            const metragemFormatada = item.metragem
              ? `${item.metragem} ${item.unidade || ''}`
              : '1 un'
            multiBomRows.push([
              amb.nome,
              mod.nome,
              item.description || item.material || 'Peça MDF',
              item.material || 'MDF',
              item.espessura ? `${item.espessura} mm` : '—',
              metragemFormatada,
              formatMoeda(item.unitCost),
              formatMoeda(item.totalCost),
            ])
          })
        })
      })

      // Se nenhum item foi coletado dos ambientes_json, cai na BOM padrão
      if (multiBomRows.length > 0) {
        invokeAutoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [
            [
              'Ambiente',
              'Módulo',
              'Descrição / Insumo',
              'Material',
              'Esp.',
              'Consumo',
              'Custo Unit.',
              'Custo Total',
            ],
          ],
          body: multiBomRows,
          theme: 'grid',
          headStyles: {
            fillColor: [241, 245, 249],
            textColor: [51, 65, 85],
            fontStyle: 'bold',
            fontSize: 7.5,
            cellPadding: { top: 2.2, right: 2, bottom: 2.2, left: 2 },
          },
          bodyStyles: {
            textColor: [51, 65, 85],
            fontSize: 7,
            cellPadding: { top: 2.2, right: 2, bottom: 2.2, left: 2 },
            valign: 'middle',
          },
          columnStyles: {
            0: { cellWidth: 24, fontStyle: 'bold' },
            1: { cellWidth: 24 },
            2: { cellWidth: 'auto', fontStyle: 'bold' },
            3: { cellWidth: 18 },
            4: { cellWidth: 11, halign: 'center' },
            5: { cellWidth: 16, halign: 'center' },
            6: { cellWidth: 23, halign: 'right', fontSize: 6.8 },
            7: { cellWidth: 24, halign: 'right', fontStyle: 'bold', fontSize: 6.8 },
          },
          styles: {
            lineColor: [226, 232, 240],
            lineWidth: 0.2,
            font: 'helvetica',
            overflow: 'linebreak',
          },
        })
      } else {
        // Fallback BOM simples
        const bom = dados.bom || []
        const bomRows = bom.map((item) => {
          const metragemFormatada = item.metragem
            ? `${item.metragem} ${item.unidade || ''}`
            : '1 un'
          return [
            item.description || item.material || 'Peça MDF',
            item.material || 'MDF',
            item.espessura ? `${item.espessura} mm` : '—',
            metragemFormatada,
            formatMoeda(item.unitCost),
            formatMoeda(item.totalCost),
            formatMoeda(item.salePrice),
          ]
        })

        invokeAutoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [
            [
              'Descrição da Peça / Insumo',
              'Material',
              'Esp.',
              'Consumo (+20% Perda)',
              'Custo Unit.',
              'Custo Total',
              'Preço Venda',
            ],
          ],
          body:
            bomRows.length > 0
              ? bomRows
              : [
                  [
                    'Nenhum item na lista de materiais.',
                    '—',
                    '—',
                    '—',
                    'R$ 0,00',
                    'R$ 0,00',
                    'R$ 0,00',
                  ],
                ],
          theme: 'grid',
          headStyles: {
            fillColor: [241, 245, 249],
            textColor: [51, 65, 85],
            fontStyle: 'bold',
            fontSize: 7.5,
            cellPadding: { top: 2.2, right: 2, bottom: 2.2, left: 2 },
          },
          bodyStyles: {
            textColor: [51, 65, 85],
            fontSize: 7.2,
            cellPadding: { top: 2.2, right: 2, bottom: 2.2, left: 2 },
            valign: 'middle',
          },
          columnStyles: {
            0: { cellWidth: 'auto', fontStyle: 'bold' },
            1: { cellWidth: 24 },
            2: { cellWidth: 12, halign: 'center' },
            3: { cellWidth: 26, halign: 'center' },
            4: { cellWidth: 23, halign: 'right', fontSize: 6.8 },
            5: { cellWidth: 24, halign: 'right', fontStyle: 'bold', fontSize: 6.8 },
            6: { cellWidth: 24, halign: 'right', fontSize: 6.8 },
          },
          styles: {
            lineColor: [226, 232, 240],
            lineWidth: 0.2,
            font: 'helvetica',
            overflow: 'linebreak',
          },
        })
      }
    } else {
      // Formato padrão quando não há ambientes_json
      const bom = dados.bom || []
      const bomRows = bom.map((item) => {
        const metragemFormatada = item.metragem ? `${item.metragem} ${item.unidade || ''}` : '1 un'
        return [
          item.description || item.material || 'Peça MDF',
          item.material || 'MDF',
          item.espessura ? `${item.espessura} mm` : '—',
          metragemFormatada,
          formatMoeda(item.unitCost),
          formatMoeda(item.totalCost),
          formatMoeda(item.salePrice),
        ]
      })

      invokeAutoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [
          [
            'Descrição da Peça / Insumo',
            'Material',
            'Esp.',
            'Consumo (+20% Perda)',
            'Custo Unit.',
            'Custo Total',
            'Preço Venda',
          ],
        ],
        body:
          bomRows.length > 0
            ? bomRows
            : [
                [
                  'Nenhum item na lista de materiais.',
                  '—',
                  '—',
                  '—',
                  'R$ 0,00',
                  'R$ 0,00',
                  'R$ 0,00',
                ],
              ],
        theme: 'grid',
        headStyles: {
          fillColor: [241, 245, 249], // #F1F5F9 — tom suave
          textColor: [51, 65, 85], // #334155
          fontStyle: 'bold',
          fontSize: 7.5,
          cellPadding: { top: 2.2, right: 2, bottom: 2.2, left: 2 },
        },
        bodyStyles: {
          textColor: [51, 65, 85],
          fontSize: 7.2,
          cellPadding: { top: 2.2, right: 2, bottom: 2.2, left: 2 },
          valign: 'middle',
        },
        columnStyles: {
          0: { cellWidth: 'auto', fontStyle: 'bold' },
          1: { cellWidth: 24 },
          2: { cellWidth: 12, halign: 'center' },
          3: { cellWidth: 26, halign: 'center' },
          4: { cellWidth: 23, halign: 'right', fontSize: 6.8 },
          5: { cellWidth: 24, halign: 'right', fontStyle: 'bold', fontSize: 6.8 },
          6: { cellWidth: 24, halign: 'right', fontSize: 6.8 },
        },
        styles: {
          lineColor: [226, 232, 240],
          lineWidth: 0.2,
          font: 'helvetica',
          overflow: 'linebreak',
        },
      })
    }

    y = (doc.lastAutoTable?.finalY ?? y) + 8

    // Se o espaço até o final for curto, cria nova página para os Indicadores
    if (y > pageHeight - 55) {
      doc.addPage()
      y = margin
    }

    // 4. INDICADORES DE SEGURANÇA E FLUTUAÇÃO DE PREÇOS
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(15, 23, 42) // #0F172A
    doc.text('3. INDICADORES DE SEGURANÇA OPERACIONAL', margin, y)
    y += 4

    doc.setFillColor(254, 242, 242) // Red-50
    doc.setDrawColor(252, 165, 165) // Red-300
    doc.roundedRect(margin, y, contentWidth, 24, 1.5, 1.5, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(153, 27, 27) // Red-800
    doc.text('⚠️ ALERTA DE FLUTUAÇÃO DE PREÇOS DO CATÁLOGO:', margin + 4, y + 5.5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(127, 29, 29)
    const alertaTexto =
      dados.indicadoresSeguranca?.alertaFlutuacao ||
      'Os preços de MDF e ferragens são baseados no catálogo cadastrado. Recomenda-se validar a cotação junto aos fornecedores caso o pedido seja faturado após 15 dias da emissão.'
    const splitAlerta = doc.splitTextToSize(alertaTexto, contentWidth - 8)
    doc.text(splitAlerta, margin + 4, y + 10)

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 41, 59)
    const margemMinima =
      dados.indicadoresSeguranca?.margemMinima ||
      'Margem de Contribuição Mínima Recomendada: 38,00% sobre o faturamento líquido.'
    doc.text(`• ${margemMinima}`, margin + 4, y + 20)

    // 5. RODAPÉ FIXO
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setDrawColor(226, 232, 240) // #E2E8F0
      doc.setLineWidth(0.3)
      doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(148, 163, 184) // Slate-400
      doc.text('BENDER HAUSSFORM • Relatório de Engenharia e Produção', margin, pageHeight - 6)
      doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 6, {
        align: 'right',
      })
    }

    // Download automático
    const codSugestivo =
      dados.numeroSequencial !== undefined && dados.numeroSequencial !== null
        ? String(dados.numeroSequencial).padStart(3, '0')
        : (dados.codigo || dados.orcamentoId || '000')
            .replace(/[^a-zA-Z0-9]/g, '')
            .slice(-6)
            .toUpperCase() || '000'
    doc.save(`Analise_Custo_${codSugestivo}.pdf`)
  } catch (error) {
    console.error('Erro ao gerar análise de custo em PDF:', error)
    throw error
  }
}

/**
 * Auxiliar unificado para gerar Proposta Comercial a partir de um registro de Orcamento existente
 */
export async function downloadPropostaComercialFromOrcamento(
  orcamento: Orcamento,
  empresa?: PerfilEmpresa | null,
): Promise<void> {
  const valorTotal =
    typeof orcamento.valor_total === 'number'
      ? orcamento.valor_total
      : parseFloat(String(orcamento.valor_total || '0')) || 0

  const codigoFormatado =
    orcamento.numero_sequencial !== undefined && orcamento.numero_sequencial !== null
      ? String(orcamento.numero_sequencial).padStart(3, '0')
      : orcamento.id.slice(-6).toUpperCase()

  const temAmbientesMulti =
    orcamento.ambientes_json &&
    Array.isArray(orcamento.ambientes_json) &&
    orcamento.ambientes_json.length > 0

  if (temAmbientesMulti) {
    const grupos = orcamento.ambientes_json!.map((amb) => ({
      nome: amb.nome,
      subtotal: amb.subtotal ?? 0,
      itens: (amb.modulos || []).map((mod) => {
        const nomeApresentavel = getNomeModuloAmigavel(mod.nome, mod.dimensoes)
        const descNatural = montarDescricaoNaturalModulo({
          nome: mod.nome,
          dimensoes: mod.dimensoes,
          mdfExterno: mod.mdf_externo || orcamento.mdf_externo,
          mdfInterno: mod.mdf_interno || orcamento.mdf_interno,
          composicao: mod.composicao,
        })
        const descFinal =
          mod.descricao_manual?.trim() || descNatural || mod.adaptacoes || 'Móvel sob medida'
        return {
          nome: nomeApresentavel,
          descricao: descFinal,
          quantidade: 1,
          valorUnitario: mod.subtotal ?? 0,
          valorTotal: mod.subtotal ?? 0,
        }
      }),
    }))

    await gerarPropostaComercial({
      orcamentoId: orcamento.id,
      numeroSequencial: orcamento.numero_sequencial,
      codigo: codigoFormatado,
      data: orcamento.data || orcamento.created_at || new Date().toISOString(),
      cliente: {
        nome: orcamento.cliente_nome,
      },
      empresa: empresa ?? null,
      ambientes: [],
      ambientesGrupos: grupos,
      valorTotal: valorTotal,
      formaPagamento: orcamento.forma_pagamento,
      observacoes: orcamento.observacoes,
    })
  } else {
    const descNatural = montarDescricaoNaturalModulo({
      nome: orcamento.modulo,
      dimensoes: orcamento.dimensoes_json,
      mdfExterno: orcamento.mdf_externo,
      mdfInterno: orcamento.mdf_interno,
      composicao: null,
    })
    await gerarPropostaComercial({
      orcamentoId: orcamento.id,
      numeroSequencial: orcamento.numero_sequencial,
      codigo: codigoFormatado,
      data: orcamento.data || orcamento.created_at || new Date().toISOString(),
      cliente: {
        nome: orcamento.cliente_nome,
      },
      empresa: empresa ?? null,
      ambientes: [
        {
          nome: orcamento.ambiente || 'Ambiente Planejado',
          descricao: descNatural,
          quantidade: 1,
          valorUnitario: valorTotal,
          valorTotal: valorTotal,
        },
      ],
      valorTotal: valorTotal,
      formaPagamento: orcamento.forma_pagamento,
      observacoes: orcamento.observacoes,
    })
  }
}

/**
 * Auxiliar unificado para gerar Análise de Custo a partir de um registro de Orcamento existente
 */
export async function downloadAnaliseCustoFromOrcamento(
  orcamento: Orcamento,
  empresa?: PerfilEmpresa | null,
): Promise<void> {
  try {
    const valorTotalVenda =
      typeof orcamento.valor_total === 'number'
        ? orcamento.valor_total
        : parseFloat(String(orcamento.valor_total || '0')) || 0

    const bom = orcamento.bom_json ?? []
    const dre = orcamento.dre_json ?? null

    const valorTotalCusto = bom.reduce((acc, it) => acc + (Number(it.totalCost) || 0), 0)

    const codigoFormatado =
      orcamento.numero_sequencial !== undefined && orcamento.numero_sequencial !== null
        ? String(orcamento.numero_sequencial).padStart(3, '0')
        : orcamento.id.slice(-6).toUpperCase()

    await gerarAnaliseCusto({
      orcamentoId: orcamento.id,
      numeroSequencial: orcamento.numero_sequencial,
      codigo: codigoFormatado,
      data: orcamento.data || orcamento.created_at || new Date().toISOString(),
      cliente: {
        nome: orcamento.cliente_nome,
      },
      moduloNome: orcamento.modulo || 'Módulo Paramétrico',
      ambienteNome: orcamento.ambiente || 'Ambiente',
      dimensoes: orcamento.dimensoes_json
        ? {
            largura: Number(orcamento.dimensoes_json.largura) || 1800,
            altura: Number(orcamento.dimensoes_json.altura) || 2200,
            profundidade: Number(orcamento.dimensoes_json.profundidade) || 600,
          }
        : undefined,
      empresa: empresa ?? null,
      dre: dre,
      bom: bom,
      ambientes_json: orcamento.ambientes_json ?? null,
      valorTotalVenda: valorTotalVenda,
      valorTotalCusto: valorTotalCusto,
    })
  } catch (error) {
    console.error('Erro ao baixar análise de custo a partir do orçamento:', error)
    throw error
  }
}
