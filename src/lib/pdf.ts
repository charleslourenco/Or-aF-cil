import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { PerfilEmpresa } from '@/services/empresa'
import type { Orcamento, OrcamentoBOMItem, OrcamentoDRE } from '@/services/orcamentos'

// Interface estendida para suportar autoTable no jsPDF
interface JsPDFWithAutoTable extends jsPDF {
  lastAutoTable?: {
    finalY?: number
  }
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
  valorTotal: number
  formaPagamento?: string | null
  observacoes?: string | null
}

export interface AnaliseCustoData {
  orcamentoId?: string
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
  if (val === null || val === undefined || isNaN(val)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val)
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
 * Carrega uma imagem de URL como HTMLImageElement / Base64 para inclusão segura no jsPDF
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
 * Formata data ISO para pt-BR
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
 * 📄 GERAR PROPOSTA COMERCIAL (PDF do Cliente)
 * Visual limpo, comercial, elegante, sem custos fabris ou detalhes técnicos de engenharia.
 */
export async function gerarPropostaComercial(dados: PropostaComercialData): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  }) as JsPDFWithAutoTable

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - margin * 2

  let y = margin

  // 1. CABEÇALHO DA EMPRESA
  const empresa = dados.empresa
  const logoUrl = empresa?.logo_url

  let logoCarregada = false
  if (logoUrl) {
    try {
      const img = await carregarImagem(logoUrl)
      if (img) {
        // Renderiza o logo com dimensões proporcionais
        const logoMaxHeight = 18
        const logoMaxWidth = 45
        let w = img.width
        let h = img.height
        const ratio = Math.min(logoMaxWidth / w, logoMaxHeight / h)
        w = w * ratio
        h = h * ratio
        doc.addImage(img, 'PNG', margin, y, w, h)
        logoCarregada = true
      }
    } catch (e) {
      console.warn('Falha ao adicionar imagem ao PDF:', e)
    }
  }

  // Nome da Empresa e dados institucionais
  const empresaNome = empresa?.nome_fantasia || empresa?.razao_social || 'OrçaFácil 3.0'
  const startTextX = logoCarregada ? margin + 50 : margin

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(logoCarregada ? 14 : 16)
  doc.setTextColor(5, 150, 105) // Verde Esmeralda (#059669)
  doc.text(empresaNome, startTextX, y + (logoCarregada ? 4 : 0))

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139) // Slate-500

  const linhasContato: string[] = []
  if (empresa?.razao_social && empresa?.razao_social !== empresaNome) {
    linhasContato.push(empresa.razao_social)
  }
  const docFiscal = [
    empresa?.cnpj ? `CNPJ: ${empresa.cnpj}` : '',
    empresa?.inscricao_estadual ? `IE: ${empresa.inscricao_estadual}` : '',
  ]
    .filter(Boolean)
    .join(' | ')
  if (docFiscal) linhasContato.push(docFiscal)

  const endereco = [
    empresa?.logradouro
      ? `${empresa.logradouro}${empresa.numero ? ', ' + empresa.numero : ''}`
      : '',
    empresa?.bairro,
    empresa?.cidade && empresa?.estado ? `${empresa.cidade}/${empresa.estado}` : empresa?.cidade,
    empresa?.cep ? `CEP: ${empresa.cep}` : '',
  ]
    .filter(Boolean)
    .join(' - ')
  if (endereco) linhasContato.push(endereco)

  const contatos = [
    empresa?.telefone ? `Tel: ${empresa.telefone}` : '',
    empresa?.email_comercial ? `Email: ${empresa.email_comercial}` : '',
    empresa?.site ? `Site: ${empresa.site}` : '',
    empresa?.instagram ? `Instagram: ${empresa.instagram}` : '',
  ]
    .filter(Boolean)
    .join(' | ')
  if (contatos) linhasContato.push(contatos)

  let textY = y + (logoCarregada ? 9 : 6)
  linhasContato.forEach((linha) => {
    doc.text(linha, startTextX, textY)
    textY += 3.8
  })

  y = Math.max(y + (logoCarregada ? 22 : 18), textY + 2)

  // Linha divisória
  doc.setDrawColor(226, 232, 240) // Slate-200
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 7

  // 2. TÍTULO E DADOS DA PROPOSTA
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(30, 41, 59) // Slate-800
  doc.text('PROPOSTA COMERCIAL', margin, y)

  const codigoOrc =
    dados.codigo || dados.orcamentoId
      ? `#${(dados.codigo || dados.orcamentoId || '').slice(-8).toUpperCase()}`
      : 'ORC-2026'
  const dataFormatada = formatarData(dados.data)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text(`Data: ${dataFormatada}   |   Orçamento: ${codigoOrc}`, pageWidth - margin, y, {
    align: 'right',
  })
  y += 7

  // Box de Dados do Cliente
  doc.setFillColor(248, 250, 252) // Slate-50
  doc.roundedRect(margin, y, contentWidth, 16, 2, 2, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(margin, y, contentWidth, 16, 2, 2, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(51, 65, 85)
  doc.text('CLIENTE:', margin + 4, y + 6)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)
  doc.text(dados.cliente.nome || 'Cliente não informado', margin + 22, y + 6)

  const contatosCliente = [
    dados.cliente.telefone ? `Tel: ${dados.cliente.telefone}` : '',
    dados.cliente.email ? `Email: ${dados.cliente.email}` : '',
    dados.cliente.endereco ? `End: ${dados.cliente.endereco}` : '',
  ]
    .filter(Boolean)
    .join('   |   ')

  if (contatosCliente) {
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text(contatosCliente, margin + 4, y + 11)
  }

  y += 22

  // 3. TABELA DE AMBIENTES E ITENS COMERCIAIS
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30, 41, 59)
  doc.text('Relação de Ambientes e Móveis Planejados', margin, y)
  y += 4

  const tableBody = dados.ambientes.map((amb, index) => [
    String(index + 1),
    amb.nome || 'Módulo Planejado',
    amb.descricao || 'Projeto sob medida conforme projeto executivo aprovado',
    String(amb.quantidade ?? 1),
    formatMoeda(amb.valorUnitario ?? amb.valorTotal ?? dados.valorTotal),
    formatMoeda(amb.valorTotal ?? (amb.valorUnitario ?? dados.valorTotal) * (amb.quantidade ?? 1)),
  ])

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [
      ['Item', 'Ambiente / Módulo', 'Descrição do Projeto', 'Qtd', 'Valor Unit.', 'Valor Total'],
    ],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [5, 150, 105], // #059669
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left',
    },
    bodyStyles: {
      textColor: [51, 65, 85],
      fontSize: 8.5,
      cellPadding: 3.5,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 40, fontStyle: 'bold' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
    styles: {
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      font: 'helvetica',
    },
  })

  y = (doc.lastAutoTable?.finalY ?? y) + 8

  // 4. BOX DE VALOR TOTAL EM DESTAQUE
  const boxTotalWidth = 80
  const boxTotalX = pageWidth - margin - boxTotalWidth
  doc.setFillColor(240, 253, 244) // Emerald-50
  doc.setDrawColor(5, 150, 105)
  doc.setLineWidth(0.8)
  doc.roundedRect(boxTotalX, y, boxTotalWidth, 18, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(5, 150, 105)
  doc.text('INVESTIMENTO TOTAL', boxTotalX + boxTotalWidth / 2, y + 6, { align: 'center' })

  doc.setFontSize(14)
  doc.setTextColor(6, 78, 59) // Emerald-900
  doc.text(formatMoeda(dados.valorTotal), boxTotalX + boxTotalWidth / 2, y + 13.5, {
    align: 'center',
  })

  y += 24

  // Se o espaço até o final da página for pequeno, pula para nova página
  if (y > pageHeight - 65) {
    doc.addPage()
    y = margin
  }

  // 5. TERMOS COMERCIAIS E FORMA DE PAGAMENTO
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(30, 41, 59)
  doc.text('Condições Comerciais', margin, y)
  y += 5

  const formaPagamentoTexto =
    dados.formaPagamento?.trim() || 'A combinar com o consultor de vendas.'
  const observacoesTexto =
    dados.observacoes?.trim() ||
    'Proposta válida por 15 dias corridos. Montagem inclusa no local indicado. Garantia de 5 anos para caixaria de MDF e ferragens conforme manual de uso.'

  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.roundedRect(margin, y, contentWidth, 26, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(51, 65, 85)
  doc.text('• Forma de Pagamento:', margin + 4, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.text(formaPagamentoTexto, margin + 42, y + 6)

  doc.setFont('helvetica', 'bold')
  doc.text('• Observações e Prazos:', margin + 4, y + 13)
  doc.setFont('helvetica', 'normal')
  const splitObs = doc.splitTextToSize(observacoesTexto, contentWidth - 48)
  doc.text(splitObs, margin + 44, y + 13)

  y += 34

  // 6. LINHA DE ASSINATURA DO CLIENTE
  if (y > pageHeight - 45) {
    doc.addPage()
    y = margin + 15
  }

  const sigWidth = 70
  const sigLeftX = margin + 10
  const sigRightX = pageWidth - margin - sigWidth - 10

  doc.setDrawColor(148, 163, 184)
  doc.setLineWidth(0.4)
  doc.line(sigLeftX, y + 10, sigLeftX + sigWidth, y + 10)
  doc.line(sigRightX, y + 10, sigRightX + sigWidth, y + 10)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  doc.text(empresaNome, sigLeftX + sigWidth / 2, y + 14, { align: 'center' })
  doc.text('Representante Comercial', sigLeftX + sigWidth / 2, y + 17.5, { align: 'center' })

  doc.text(dados.cliente.nome || 'Assinatura do Cliente', sigRightX + sigWidth / 2, y + 14, {
    align: 'center',
  })
  doc.text('De Acordo com a Proposta', sigRightX + sigWidth / 2, y + 17.5, { align: 'center' })

  // 7. RODAPÉ FIXO EM TODAS AS PÁGINAS
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(148, 163, 184)
    const rodapeTexto = [
      empresaNome,
      empresa?.telefone ? `Tel: ${empresa.telefone}` : '',
      empresa?.site ? empresa.site : '',
    ]
      .filter(Boolean)
      .join(' • ')

    doc.text(
      rodapeTexto || 'OrçaFácil 3.0 - Sistema de Engenharia de Marcenaria',
      margin,
      pageHeight - 7,
    )
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' })
  }

  // Download automático
  const sanitizedName = (dados.cliente.nome || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_')
  const codSugestivo = (dados.codigo || dados.orcamentoId || '0000').slice(-6)
  doc.save(`Proposta_Comercial_Orcamento_${sanitizedName}_${codSugestivo}.pdf`)
}

/**
 * 🛠️ GERAR ANÁLISE DE CUSTO (PDF Interno de Engenharia / Fábrica)
 * Contém DRE completa, BOM consolidada, detalhamento de peças, margens, markup e alertas de flutuação.
 */
export async function gerarAnaliseCusto(dados: AnaliseCustoData): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  }) as JsPDFWithAutoTable

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - margin * 2

  let y = margin

  // 1. CABEÇALHO TÉCNICO
  doc.setFillColor(15, 23, 42) // Slate-900
  doc.rect(margin, y, contentWidth, 16, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(255, 255, 255)
  doc.text('RELATÓRIO DE ENGENHARIA FINANCEIRA DE PROJETO', margin + 4, y + 7)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184) // Slate-400
  const codId = (dados.codigo || dados.orcamentoId || 'ORC-000').slice(-8).toUpperCase()
  const versao = dados.versaoSistema || 'OrçaFácil v3.0'
  doc.text(
    `ID: #${codId}   |   ${versao}   |   Emissão: ${formatarData(dados.data)}`,
    margin + 4,
    y + 12.5,
  )

  y += 20

  // Identificação do Módulo e Cliente
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(203, 213, 225)
  doc.roundedRect(margin, y, contentWidth, 14, 1.5, 1.5, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(30, 41, 59)
  doc.text(`Cliente: ${dados.cliente.nome || 'Não informado'}`, margin + 4, y + 5.5)

  const dimText = dados.dimensoes
    ? `Dimensões: ${dados.dimensoes.largura}L × ${dados.dimensoes.altura}A × ${dados.dimensoes.profundidade}P mm`
    : ''
  const modText = `Módulo: ${dados.moduloNome || 'Padrão'} (${dados.ambienteNome || 'Ambiente'})`

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  doc.text(`${modText}   |   ${dimText}`, margin + 4, y + 10.5)

  y += 18

  // 2. DRE SINTÉTICA DO PROJETO
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(5, 150, 105) // #059669
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
  const lucroPercent = dre.lucro_liquido_percent ?? calcPercent(dre.lucro_liquido)
  const mpPercent = calcPercent(custoMp)

  const markupEfetivo = dre.markup_efetivo ?? (custoMp > 0 ? valorVenda / custoMp : 2.5)

  const dreRows = [
    ['Custo Direto de Matéria-Prima (BOM)', formatMoeda(custoMp), formatPercentual(mpPercent)],
    [
      'Impostos Estimados (NFe / Simples / Presumido)',
      formatMoeda(dre.impostos ?? valorVenda * 0.1),
      formatPercentual(impPercent || 10),
    ],
    [
      'Comissão de Venda / Equipe Comercial',
      formatMoeda(dre.comissao ?? valorVenda * 0.05),
      formatPercentual(comPercent || 5),
    ],
    [
      'Custo Fixo Rateado de Produção',
      formatMoeda(dre.custo_fixo_rateado ?? valorVenda * 0.08),
      formatPercentual(fixoPercent || 8),
    ],
    [
      'Lucro Líquido Operacional Previsto',
      formatMoeda(
        dre.lucro_liquido ??
          valorVenda -
            custoMp -
            (dre.impostos ?? valorVenda * 0.1) -
            (dre.comissao ?? valorVenda * 0.05) -
            (dre.custo_fixo_rateado ?? valorVenda * 0.08),
      ),
      formatPercentual(lucroPercent || 25),
    ],
  ]

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Estrutura de Resultados (DRE)', 'Valor (R$)', '% da Venda']],
    body: dreRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // Slate-800
      textColor: [255, 255, 255],
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

  // Destaque de Markup e Preço Final
  doc.setFillColor(240, 253, 244) // Emerald-50
  doc.setDrawColor(5, 150, 105)
  doc.setLineWidth(0.6)
  doc.roundedRect(margin, y, contentWidth, 10, 1.5, 1.5, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(5, 150, 105)
  doc.text(`MARKUP EFETIVO: ${markupEfetivo.toFixed(2)}x`, margin + 6, y + 6.5)

  doc.setFontSize(10)
  doc.setTextColor(6, 78, 59)
  doc.text(`PREÇO FINAL SUGERIDO: ${formatMoeda(valorVenda)}`, pageWidth - margin - 6, y + 6.5, {
    align: 'right',
  })

  y += 15

  // 3. BOM GERAL (MATÉRIA-PRIMA CONSOLIDADA)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(5, 150, 105)
  doc.text('2. BOM GERAL — MATÉRIA-PRIMA E FERRAGENS (FÁBRICA)', margin, y)
  y += 4

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

  autoTable(doc, {
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
        : [['Nenhum item na lista de materiais.', '—', '—', '—', 'R$ 0,00', 'R$ 0,00', 'R$ 0,00']],
    theme: 'grid',
    headStyles: {
      fillColor: [5, 150, 105],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      textColor: [51, 65, 85],
      fontSize: 7.5,
      cellPadding: 2.2,
    },
    columnStyles: {
      0: { cellWidth: 'auto', fontStyle: 'bold' },
      1: { cellWidth: 26 },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 28, halign: 'center' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 24, halign: 'right' },
    },
    styles: {
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      font: 'helvetica',
    },
  })

  y = (doc.lastAutoTable?.finalY ?? y) + 8

  // Se o espaço até o final for curto, cria nova página para os Indicadores
  if (y > pageHeight - 55) {
    doc.addPage()
    y = margin
  }

  // 4. INDICADORES DE SEGURANÇA E FLUTUAÇÃO DE PREÇOS
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(5, 150, 105)
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
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(148, 163, 184)
    doc.text('CONFIDENCIAL — USO INTERNO DE ENGENHARIA E PRODUÇÃO', margin, pageHeight - 7)
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' })
  }

  // Download automático
  const codSugestivo = (dados.codigo || dados.orcamentoId || '0000').slice(-6)
  doc.save(`Analise_Custo_Orcamento_${codSugestivo}.pdf`)
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

  await gerarPropostaComercial({
    orcamentoId: orcamento.id,
    codigo: orcamento.id.slice(-6).toUpperCase(),
    data: orcamento.data || orcamento.created_at || new Date().toISOString(),
    cliente: {
      nome: orcamento.cliente_nome,
    },
    empresa: empresa ?? null,
    ambientes: [
      {
        nome: orcamento.ambiente || 'Ambiente Planejado',
        descricao: orcamento.modulo
          ? `Módulo: ${orcamento.modulo}`
          : 'Projeto de Marcenaria sob medida',
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

/**
 * Auxiliar unificado para gerar Análise de Custo a partir de um registro de Orcamento existente
 */
export async function downloadAnaliseCustoFromOrcamento(
  orcamento: Orcamento,
  empresa?: PerfilEmpresa | null,
): Promise<void> {
  const valorTotalVenda =
    typeof orcamento.valor_total === 'number'
      ? orcamento.valor_total
      : parseFloat(String(orcamento.valor_total || '0')) || 0

  const bom = orcamento.bom_json ?? []
  const dre = orcamento.dre_json ?? null

  const valorTotalCusto = bom.reduce((acc, it) => acc + (Number(it.totalCost) || 0), 0)

  await gerarAnaliseCusto({
    orcamentoId: orcamento.id,
    codigo: orcamento.id.slice(-6).toUpperCase(),
    data: orcamento.data || orcamento.created_at || new Date().toISOString(),
    cliente: {
      nome: orcamento.cliente_nome,
    },
    moduloNome: orcamento.modulo || 'Módulo Paramétrico',
    ambienteNome: orcamento.ambiente || 'Ambiente',
    empresa: empresa ?? null,
    dre: dre,
    bom: bom,
    valorTotalVenda: valorTotalVenda,
    valorTotalCusto: valorTotalCusto,
  })
}
