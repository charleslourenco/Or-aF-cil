/**
 * Importação de projeto em PDF (prancha de detalhamento do arquiteto) para o orçamento.
 *
 * Fluxo:
 *  1. extrairTextoPdf + renderizarPaginasProjeto → texto e imagens das páginas do PDF
 *  2. analisarProjetoPdf → Edge Function `analisar-projeto-pdf` (gpt-4o) devolve ambientes,
 *     módulos (dimensões, MDF, composição) e itens extras (tomadas, passa-fios, vidro,
 *     pernas de metal...) casados com o catálogo ou marcados como não cadastrados
 *  3. converterModuloProjeto → monta um ModuloSalvoData completo (BOM via calcularBOM +
 *     itens extras como itens manuais) pronto para entrar no ambiente do orçamento v2
 */
import { supabase } from '@/lib/supabase/client'
import { loadPdfDocumentResilient } from '@/lib/pdfRenderer'
import type { CatalogoMaterial } from '@/services/catalogo'
import type { TemplateEngenharia, PerfilConstrutivo } from '@/services/templates'
import type { ConfigEngenharia } from '@/services/engenharia'
import type { OrcamentoBOMItem, ServicoAdicional } from '@/services/orcamentos'
import type {
  ModuloSalvoData,
  ComposicaoModuloSalva,
  AjustesBOMModulo,
} from '@/components/ModuleEditDrawer'
import {
  calcularBOM,
  MARKUP_PADRAO,
  PERDA_PERCENT_PADRAO,
  type ModuloComposicao,
  type MdfSpec,
  type Dimensoes,
} from '@/lib/pricing'
import { generateUniqueBudgetItemId } from '@/lib/budgetItemUtils'

// ---------------------------------------------------------------------------
// Tipos (espelham o retorno da Edge Function analisar-projeto-pdf)
// ---------------------------------------------------------------------------

export interface ItemExtraProjeto {
  descricao: string
  quantidade: number
  unidade: string
  categoria_sugerida: string
  catalogo_id: string | null
  catalogo_nome?: string | null
  item_nao_cadastrado: boolean
  preco_custo_estimado: number
  origem_texto?: string
  justificativa?: string
}

export interface ComposicaoProjeto {
  portas: { qtd: number; tipo: 'abrir' | 'correr' | 'batente' | 'nenhum' }
  gavetas: { qtd: number }
  prateleiras: { qtd: number }
  divisorias: { qtd: number }
  cabideiro: boolean
  iluminacao_led: boolean
  puxadores: { qtd: number; tipo: string }
  rodape_mm: number | null
  tampo: string | null
}

export interface ModuloProjeto {
  codigo: string
  nome: string
  descricao: string
  quantidade: number
  perfil_construtivo: PerfilConstrutivo
  template_id: string | null
  dimensoes_mm: { largura: number; altura: number; profundidade: number }
  mdf_externo: { cor: string; espessura: 15 | 18 }
  mdf_interno: { cor: string; espessura: 15 | 18 }
  mdf_fundo: string
  composicao: ComposicaoProjeto
  itens_extras: ItemExtraProjeto[]
  confianca: 'alta' | 'media' | 'baixa'
  observacoes: string[]
}

export interface AmbienteProjeto {
  nome: string
  modulos: ModuloProjeto[]
}

export interface ProjetoExtraido {
  projeto: {
    titulo: string
    cliente: string | null
    responsavel_tecnico: string | null
    observacoes: string[]
  }
  ambientes: AmbienteProjeto[]
  itens_extras_gerais: ItemExtraProjeto[]
  resumo: string
  /** Preenchido pela função quando nada foi identificado (resposta 200 com aviso). */
  error?: string
}

export type EtapaImportacao = 'lendo-pdf' | 'renderizando' | 'analisando-ia' | 'concluido'

// ---------------------------------------------------------------------------
// 1. Leitura do PDF no navegador (texto + imagens das páginas)
// ---------------------------------------------------------------------------

/** Extrai o texto de todas as páginas do PDF (até maxPages) usando o PDF.js já configurado. */
export async function extrairTextoPdf(file: File, maxPages = 8): Promise<string> {
  const buffer = await file.arrayBuffer()
  const doc = await loadPdfDocumentResilient(buffer)
  const total = Math.min(doc.numPages, maxPages)
  const partes: string[] = []

  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const linhas: string[] = []
    let linhaAtual = ''
    let ultimoY: number | null = null

    for (const item of content.items as any[]) {
      const str: string = typeof item?.str === 'string' ? item.str : ''
      const y: number | null = Array.isArray(item?.transform) ? item.transform[5] : null
      if (ultimoY !== null && y !== null && Math.abs(y - ultimoY) > 2) {
        if (linhaAtual.trim()) linhas.push(linhaAtual.trim())
        linhaAtual = ''
      }
      linhaAtual += (linhaAtual && !linhaAtual.endsWith(' ') ? ' ' : '') + str
      if (y !== null) ultimoY = y
    }
    if (linhaAtual.trim()) linhas.push(linhaAtual.trim())
    partes.push(`--- Página ${i} ---\n${linhas.join('\n')}`)
  }

  return partes.join('\n\n')
}

/**
 * Renderiza as páginas do PDF em JPEG (data URL) com lado máximo limitado,
 * para enviar à IA sem estourar o tamanho da requisição (pranchas A1/A0 são grandes).
 */
export async function renderizarPaginasProjeto(
  file: File,
  maxPages = 6,
  ladoMaximoPx = 2200,
): Promise<string[]> {
  const buffer = await file.arrayBuffer()
  const doc = await loadPdfDocumentResilient(buffer)
  const total = Math.min(doc.numPages, maxPages)
  const paginas: string[] = []

  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i)
    const base = page.getViewport({ scale: 1 })
    const escala = Math.min(ladoMaximoPx / Math.max(base.width, base.height), 4)
    const viewport = page.getViewport({ scale: escala })

    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Não foi possível criar o canvas para renderizar o PDF.')

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport }).promise
    paginas.push(canvas.toDataURL('image/jpeg', 0.85))
  }

  return paginas
}

// ---------------------------------------------------------------------------
// 2. Chamada da Edge Function
// ---------------------------------------------------------------------------

export interface AnalisarProjetoParams {
  file: File
  catalogo: CatalogoMaterial[]
  templates?: TemplateEngenharia[]
  aoMudarEtapa?: (etapa: EtapaImportacao) => void
}

export async function analisarProjetoPdf({
  file,
  catalogo,
  templates = [],
  aoMudarEtapa,
}: AnalisarProjetoParams): Promise<ProjetoExtraido> {
  aoMudarEtapa?.('lendo-pdf')
  let textoExtraido = ''
  try {
    textoExtraido = await extrairTextoPdf(file)
  } catch (err) {
    console.warn('Falha ao extrair texto do PDF (seguindo só com imagens):', err)
  }

  aoMudarEtapa?.('renderizando')
  const paginasBase64 = await renderizarPaginasProjeto(file)

  aoMudarEtapa?.('analisando-ia')
  const { data, error } = await supabase.functions.invoke('analisar-projeto-pdf', {
    body: {
      nomeArquivo: file.name,
      paginasBase64,
      textoExtraido,
      catalogoMateriais: catalogo.map((c) => ({
        id: c.id,
        nome_material: c.nome_material,
        categoria: c.categoria,
        unidade: c.unidade,
        preco_custo: Number(c.preco_custo) || 0,
      })),
      templates: templates.map((t) => ({
        id: t.id,
        nome_template: t.nome_template,
        categoria: t.categoria ?? null,
        perfil_construtivo: t.perfil_construtivo ?? null,
        dimensoes: t.dimensoes ?? null,
      })),
    },
  })

  if (error) {
    throw new Error(error.message || 'Erro ao chamar a função de análise do projeto.')
  }
  if (!data || typeof data !== 'object') {
    throw new Error('A função de análise não retornou dados.')
  }
  const resultado = data as ProjetoExtraido
  const totalModulos = (resultado.ambientes || []).reduce(
    (acc, a) => acc + (a.modulos?.length || 0),
    0,
  )
  if (resultado.error && totalModulos === 0 && (resultado.itens_extras_gerais || []).length === 0) {
    throw new Error(resultado.error)
  }

  aoMudarEtapa?.('concluido')
  return {
    ...resultado,
    ambientes: resultado.ambientes || [],
    itens_extras_gerais: resultado.itens_extras_gerais || [],
  }
}

// ---------------------------------------------------------------------------
// 3. Conversão para o orçamento v2
// ---------------------------------------------------------------------------

const round2 = (n: number) => Math.round(n * 100) / 100

export function markupPadraoEngenharia(config?: ConfigEngenharia | null): number {
  return typeof config?.markup_padrao === 'number' && config.markup_padrao > 0
    ? config.markup_padrao
    : MARKUP_PADRAO
}

export function perdaPadraoEngenharia(config?: ConfigEngenharia | null): number {
  return typeof config?.perda_material_percent === 'number' && config.perda_material_percent >= 0
    ? config.perda_material_percent
    : PERDA_PERCENT_PADRAO
}

/** Converte um item extra da prancha em item manual da BOM do módulo (com markup). */
export function converterItemExtraParaBOM(
  extra: ItemExtraProjeto,
  markup: number,
  catalogo: CatalogoMaterial[] = [],
): OrcamentoBOMItem {
  const doCatalogo = extra.catalogo_id
    ? catalogo.find((c) => c.id === extra.catalogo_id)
    : undefined
  const unitCost = round2(
    doCatalogo ? Number(doCatalogo.preco_custo) || 0 : Number(extra.preco_custo_estimado) || 0,
  )
  const metragem = Number(extra.quantidade) > 0 ? Number(extra.quantidade) : 1
  const totalCost = round2(unitCost * metragem)
  return {
    id: generateUniqueBudgetItemId('ia'),
    description: doCatalogo ? doCatalogo.nome_material : extra.descricao,
    material: extra.categoria_sugerida,
    metragem,
    unidade: extra.unidade || doCatalogo?.unidade || 'un',
    unitCost,
    totalCost,
    markup,
    salePrice: round2(totalCost * markup),
    item_nao_cadastrado: !doCatalogo,
    catalogo_id: doCatalogo ? doCatalogo.id : null,
  }
}

/** Converte um item extra "geral" (sem módulo) em serviço adicional do orçamento. */
export function converterItemExtraParaServico(
  extra: ItemExtraProjeto,
  markup: number,
): ServicoAdicional {
  const qtd = Number(extra.quantidade) > 0 ? Number(extra.quantidade) : 1
  const custo = round2((Number(extra.preco_custo_estimado) || 0) * qtd)
  return {
    id: `sv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    descricao: `${extra.descricao} (${qtd} ${extra.unidade || 'un'})`,
    custo,
    valor: round2(custo * markup),
  }
}

export interface ConverterModuloParams {
  modulo: ModuloProjeto
  catalogo: CatalogoMaterial[]
  configEngenharia?: ConfigEngenharia | null
  templates?: TemplateEngenharia[]
  /** Itens extras selecionados pelo usuário na revisão (default: todos do módulo). */
  extrasSelecionados?: ItemExtraProjeto[]
}

/**
 * Monta o ModuloSalvoData completo a partir de um módulo lido da prancha:
 * BOM geométrica via calcularBOM + itens extras como itens manuais, valor = soma das vendas.
 */
export function converterModuloProjeto({
  modulo,
  catalogo,
  configEngenharia,
  templates = [],
  extrasSelecionados,
}: ConverterModuloParams): ModuloSalvoData {
  const markup = markupPadraoEngenharia(configEngenharia)
  const perda = perdaPadraoEngenharia(configEngenharia)
  const perfil: PerfilConstrutivo = modulo.perfil_construtivo || 'Fechado Envelopado'
  const isPainel = perfil === 'Aberto / Painel'

  const dimensoes: Dimensoes = {
    largura: Math.max(100, Math.round(modulo.dimensoes_mm?.largura || 1000)),
    altura: Math.max(100, Math.round(modulo.dimensoes_mm?.altura || 700)),
    // Painel: o motor usa a profundidade como profundidade das prateleiras/nichos (mín. 120mm)
    profundidade: isPainel
      ? Math.max(120, Math.round(modulo.dimensoes_mm?.profundidade || 200))
      : Math.max(100, Math.round(modulo.dimensoes_mm?.profundidade || 500)),
  }

  const mdfExterno: MdfSpec = {
    cor: modulo.mdf_externo?.cor || 'Branco TX',
    espessura: modulo.mdf_externo?.espessura === 15 ? 15 : 18,
  }
  const mdfInterno: MdfSpec = {
    cor: modulo.mdf_interno?.cor || 'Branco TX',
    espessura: modulo.mdf_interno?.espessura === 18 ? 18 : 15,
  }
  const mdfFundo = modulo.mdf_fundo || 'MDF 6mm Branco TX'

  const comp = modulo.composicao
  const portasQtd = Math.max(0, comp?.portas?.qtd || 0)
  const gavetasQtd = Math.max(0, comp?.gavetas?.qtd || 0)
  const prateleirasQtd = Math.max(0, comp?.prateleiras?.qtd || 0)
  const divisoriasQtd = Math.max(0, comp?.divisorias?.qtd || 0)
  const cabideiro = Boolean(comp?.cabideiro)
  const iluminacaoLed = Boolean(comp?.iluminacao_led)
  const tipoPorta = portasQtd > 0 ? comp?.portas?.tipo || 'abrir' : 'nenhum'

  const composicao: ModuloComposicao = {
    perfilConstrutivo: perfil,
    semTamponamento: perfil === 'Caixa Simples',
    tampoPedra: perfil === 'Balcão (tampo por conta do cliente)',
    divisorias: { qtd: divisoriasQtd },
    portas: { qtd: portasQtd, tipo: tipoPorta === 'nenhum' ? 'nenhum' : tipoPorta },
    gavetas: { qtd: gavetasQtd },
    prateleiras: { qtd: prateleirasQtd },
    cabideiro,
    qtdCabideiros: cabideiro ? 1 : 0,
    iluminacaoLed,
    puxadores: comp?.puxadores?.qtd || undefined,
    rackPainel: null,
    ripado: null,
  }

  const template = modulo.template_id
    ? templates.find((t) => t.id === modulo.template_id)
    : undefined
  const moduloPayload = {
    id: template?.id || 'custom-v2',
    nome_template: modulo.nome || template?.nome_template || 'Módulo Sob Medida',
    perfil_construtivo: perfil,
  }

  const pecas = calcularBOM(
    moduloPayload,
    dimensoes,
    mdfExterno,
    mdfInterno,
    mdfFundo,
    'comercial',
    catalogo.length > 0 ? catalogo : undefined,
    markup,
    1.0,
    composicao,
    perda,
  )

  const extras = extrasSelecionados ?? modulo.itens_extras ?? []
  const itensExtras = extras.map((e) => converterItemExtraParaBOM(e, markup, catalogo))

  const itensBOM: OrcamentoBOMItem[] = [
    ...pecas.map((p) => ({
      id: p.id,
      description: p.description,
      material: p.material,
      espessura: p.espessura,
      metragem: p.metragem,
      unidade: p.unidade,
      unitCost: p.unitCost,
      totalCost: p.totalCost,
      markup: p.markup,
      salePrice: p.salePrice,
      item_nao_cadastrado: p.item_nao_cadastrado,
      catalogo_id: p.catalogo_id,
    })),
    ...itensExtras,
  ]

  const valorUnitario = round2(itensBOM.reduce((acc, it) => acc + (it.salePrice || 0), 0))
  const quantidade = Math.max(1, Math.round(modulo.quantidade || 1))

  const detalhes: string[] = [
    `${dimensoes.largura}×${dimensoes.altura}×${dimensoes.profundidade}mm`,
  ]
  if (portasQtd > 0) detalhes.push(`${portasQtd} ${portasQtd === 1 ? 'porta' : 'portas'}`)
  if (gavetasQtd > 0) detalhes.push(`${gavetasQtd} ${gavetasQtd === 1 ? 'gaveta' : 'gavetas'}`)
  if (prateleirasQtd > 0)
    detalhes.push(`${prateleirasQtd} ${prateleirasQtd === 1 ? 'prateleira' : 'prateleiras'}`)
  if (cabideiro) detalhes.push('1 cabideiro')
  if (iluminacaoLed) detalhes.push('LED')
  if (itensExtras.length > 0)
    detalhes.push(`${itensExtras.length} ${itensExtras.length === 1 ? 'acessório' : 'acessórios'}`)
  detalhes.push('importado do PDF')

  const composicaoSalva: ComposicaoModuloSalva = {
    portas: { qtd: portasQtd, tipo: tipoPorta },
    gavetas: { qtd: gavetasQtd },
    prateleiras: { qtd: prateleirasQtd },
    cabideiro,
    qtdCabideiros: cabideiro ? 1 : 0,
    iluminacaoLed,
    rackPainel: null,
    ripado: null,
  }

  const ajustesBOM: AjustesBOMModulo = { markupModulo: markup, valorUnitarioFixo: null }

  const descricaoPrancha = [modulo.descricao, ...(modulo.observacoes || [])]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join('. ')

  return {
    moduloId: template?.id,
    nome: modulo.codigo ? `${modulo.codigo} – ${modulo.nome}` : modulo.nome,
    descricaoTipo: `${perfil} • ${detalhes.join(' • ')}`,
    descricaoManual: descricaoPrancha || undefined,
    quantidade,
    valorUnitario,
    valorTotal: round2(valorUnitario * quantidade),
    dimensoes,
    perfilConstrutivo: perfil,
    padraoProjeto: 'comercial',
    mdfExterno,
    mdfInterno,
    mdfFundo,
    portas: portasQtd,
    gavetas: gavetasQtd,
    prateleiras: prateleirasQtd,
    cabideiros: cabideiro ? 1 : 0,
    iluminacaoLed,
    composicao: composicaoSalva,
    itensBOM,
    ajustesBOM,
  }
}
