import { BudgetItem } from '@/data/mockData'
import type { CatalogoMaterial } from '@/services/catalogo'

/**
 * Tipos de entrada para o motor de cálculo geométrico da BOM (Bill of Materials).
 */
export interface Dimensoes {
  largura: number
  altura: number
  profundidade: number
}

export interface MdfSpec {
  cor: string
  espessura: 15 | 18
}

export type PadraoProjeto = 'comercial' | 'premium'

/**
 * Tabela de custos unitários por material/espessura.
 * Valores em Reais (BRL) conforme especificação comercial.
 */
export const CUSTOS_UNITARIOS: Record<string, number> = {
  'MDF Externo 18': 55.0,
  'MDF Externo 15': 45.0,
  'MDF Interno 15': 45.0,
  'MDF Interno 18': 55.0,
  'MDF Fundo 6': 25.0,
  'Fita de Borda': 1.5,
  Ferragens: 35.0,
}

/** Markup multiplicador padrão aplicado sobre o custo total. */
export const MARKUP_PADRAO = 2.5

const PERDA = 1.2

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Mapa de categorias do catálogo → chaves de BOM (CUSTOS_UNITARIOS).
 * Usado para fazer o lookup dos preços vindo do banco.
 */
const CATEGORIA_POR_BOM_KEY: Record<string, string> = {
  'MDF Externo 18': 'MDF 18mm',
  'MDF Externo 15': 'MDF 15mm',
  'MDF Interno 15': 'MDF 15mm',
  'MDF Interno 18': 'MDF 18mm',
  'MDF Fundo 6': 'MDF 6mm',
  'Fita de Borda': 'Fita de Borda',
  Ferragens: 'Ferragem',
}

/** Converte o padrão do projeto (comercial/premium) para o nível do catálogo. */
function nivelCatalogoParaPadrao(padraoProjeto: PadraoProjeto): string {
  return padraoProjeto === 'premium' ? 'premium' : 'padrao'
}

/**
 * Faz lookup do preço de um material no catálogo.
 * Prioriza o `nivel_padrao` que bate com o `padraoProjeto`;
 * se não encontrar, usa o primeiro item da categoria.
 * Retorna `undefined` se a categoria não existir no catálogo.
 */
function lookupPrecoCatalogo(
  catalogo: CatalogoMaterial[],
  bomKey: string,
  padraoProjeto: PadraoProjeto,
): number | undefined {
  const categoria = CATEGORIA_POR_BOM_KEY[bomKey]
  if (!categoria) return undefined

  const daCategoria = catalogo.filter((m) => m.categoria === categoria)
  if (daCategoria.length === 0) return undefined

  const nivelDesejado = nivelCatalogoParaPadrao(padraoProjeto)
  const matchNivel = daCategoria.find((m) => m.nivel_padrao === nivelDesejado)
  const escolhido = matchNivel ?? daCategoria[0]
  return Number(escolhido.preco_custo)
}

/**
 * Resolve o custo unitário de um item da BOM: primeiro tenta o catálogo
 * (passado dinamicamente); se não encontrar, cai no fallback `CUSTOS_UNITARIOS`.
 */
function resolverCustoUnitario(
  bomKey: string,
  catalogoPrecos: CatalogoMaterial[] | undefined,
  padraoProjeto: PadraoProjeto,
): number {
  if (catalogoPrecos && catalogoPrecos.length > 0) {
    const preco = lookupPrecoCatalogo(catalogoPrecos, bomKey, padraoProjeto)
    if (typeof preco === 'number' && !Number.isNaN(preco)) return preco
  }
  return CUSTOS_UNITARIOS[bomKey] ?? 0
}

/**
 * Constrói um mapa simples `Record<string, number>` (chave de BOM → preço)
 * a partir do catálogo. Útil para cenários que preferem um lookup direto por
 * chave em vez do array completo. Prioriza o nível `padrao`.
 *
 * Exportado para que a tela de orçamento possa gerar o mapa de preços e
 * inspecioná-lo/depurá-lo se necessário.
 */
export function buildCatalogoPriceMap(catalogo: CatalogoMaterial[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const bomKey of Object.keys(CATEGORIA_POR_BOM_KEY)) {
    const daCategoria = catalogo.filter((m) => m.categoria === CATEGORIA_POR_BOM_KEY[bomKey])
    if (daCategoria.length === 0) continue
    const escolhido = daCategoria.find((m) => m.nivel_padrao === 'padrao') ?? daCategoria[0]
    map[bomKey] = Number(escolhido.preco_custo)
  }
  return map
}

/**
 * Cria uma peça (item) da BOM já precificada com o markup fornecido.
 */
function criarPeca(
  id: string,
  descricao: string,
  material: string,
  espessura: number,
  metragem: number,
  unidade: 'm²' | 'm' | 'jogo',
  custoUnitario: number,
  markup: number = MARKUP_PADRAO,
): BudgetItem {
  const effectiveMarkup = typeof markup === 'number' && markup > 0 ? markup : MARKUP_PADRAO
  const totalCost = round2(metragem * custoUnitario)
  const salePrice = round2(totalCost * effectiveMarkup)
  return {
    id,
    description: descricao,
    material,
    espessura,
    metragem: round2(metragem),
    unidade,
    unitCost: custoUnitario,
    totalCost,
    markup: effectiveMarkup,
    salePrice,
  }
}

/**
 * Motor de cálculo geométrico e precificação dinâmica.
 *
 * Gera a Bill of Materials (lista de peças) a partir das dimensões do módulo
 * e da especificação de materiais, aplicando fórmulas geométricas, fator de
 * perda (×1.20) e precificação com markup comercial.
 *
 * @param modulo     Objeto do módulo selecionado (apenas para contexto/label).
 * @param dimensoes  { largura (L), altura (A), profundidade (P) } em mm.
 * @param mdfExterno Espessura/cor do MDF externo.
 * @param mdfInterno Espessura/cor do MDF interno.
 * @param mdfFundo   Descrição do MDF de fundo (ex.: "MDF 6mm Branco TX").
 * @param padraoProjeto Padrão comercial/premium (reservado p/ ajustes futuros).
 * @param catalogoPrecos Lista de materiais do catálogo com preços reais.
 * @param markup     Markup multiplicador vindo das configurações de engenharia (fallback: 2.5).
 */
export function calcularBOM(
  modulo: { id: string; nome_template?: string } | null | undefined,
  dimensoes: Dimensoes,
  mdfExterno: MdfSpec,
  mdfInterno: MdfSpec,
  mdfFundo: string,
  padraoProjeto: PadraoProjeto,
  catalogoPrecos?: CatalogoMaterial[],
  markup?: number,
): BudgetItem[] {
  // Validação: dimensões e módulo obrigatórios.
  if (!modulo || !dimensoes.largura || !dimensoes.altura || !dimensoes.profundidade) {
    return []
  }

  const effectiveMarkup = typeof markup === 'number' && markup > 0 ? markup : MARKUP_PADRAO

  const L = dimensoes.largura
  const A = dimensoes.altura
  const P = dimensoes.profundidade
  const espExt = mdfExterno.espessura
  const espInt = mdfInterno.espessura

  const pecas: BudgetItem[] = []

  // 1. Laterais Externas: 2x (A × P)
  const areaLateral = ((A * P) / 1_000_000) * PERDA
  pecas.push(
    criarPeca(
      'bom-laterais-externas',
      `Laterais Externas (2x) — ${A}×${P}mm`,
      'MDF Externo',
      espExt,
      areaLateral * 2,
      'm²',
      resolverCustoUnitario(`MDF Externo ${espExt}`, catalogoPrecos, padraoProjeto),
      effectiveMarkup,
    ),
  )

  // 2. Base e Topo: 2x ((L - 2×espExt) × P)
  const larguraInterna = L - 2 * espExt
  const areaBaseTopo = ((larguraInterna * P) / 1_000_000) * PERDA
  pecas.push(
    criarPeca(
      'bom-base-topo',
      `Base e Topo (2x) — ${larguraInterna}×${P}mm`,
      'MDF Externo',
      espExt,
      areaBaseTopo * 2,
      'm²',
      resolverCustoUnitario(`MDF Externo ${espExt}`, catalogoPrecos, padraoProjeto),
      effectiveMarkup,
    ),
  )

  // 3. Prateleiras Internas: 2x ((L - 2×espExt) × (P - 20))
  const profPrateleira = P - 20
  const areaPrateleira = ((larguraInterna * profPrateleira) / 1_000_000) * PERDA
  pecas.push(
    criarPeca(
      'bom-prateleiras',
      `Prateleiras Internas (2x) — ${larguraInterna}×${profPrateleira}mm`,
      'MDF Interno',
      espInt,
      areaPrateleira * 2,
      'm²',
      resolverCustoUnitario(`MDF Interno ${espInt}`, catalogoPrecos, padraoProjeto),
      effectiveMarkup,
    ),
  )

  // 4. Fundo: 1x (L × A)
  const areaFundo = ((L * A) / 1_000_000) * PERDA
  pecas.push(
    criarPeca(
      'bom-fundo',
      `Fundo (1x) — ${L}×${A}mm`,
      'MDF Fundo',
      6,
      areaFundo,
      'm²',
      resolverCustoUnitario('MDF Fundo 6', catalogoPrecos, padraoProjeto),
      effectiveMarkup,
    ),
  )

  // 5. Fita de Borda — perímetro linear total das arestas visíveis.
  //    Laterais: 2×(A×2) (frente e trás de cada lateral)
  //    Base/Topo: 2×((L - 2×espExt)×2) (frente e trás de base e topo)
  //    Prateleiras: 2×(L - 2×espExt) (frente de cada prateleira)
  const perimetroFitaMm = 2 * (A * 2) + 2 * (larguraInterna * 2) + 2 * larguraInterna
  const perimetroFitaM = perimetroFitaMm / 1000
  pecas.push(
    criarPeca(
      'bom-fita-borda',
      `Fita de Borda — ${round2(perimetroFitaM)}m linear`,
      'Fita de Borda',
      0,
      perimetroFitaM,
      'm',
      resolverCustoUnitario('Fita de Borda', catalogoPrecos, padraoProjeto),
      effectiveMarkup,
    ),
  )

  // 6. Ferragens Base: 1 jogo de dobradiças/corrediças
  pecas.push(
    criarPeca(
      'bom-ferragens',
      'Ferragens Base (1 jogo) — dobradiças e corrediças',
      'Ferragens',
      0,
      1,
      'jogo',
      resolverCustoUnitario('Ferragens', catalogoPrecos, padraoProjeto),
      effectiveMarkup,
    ),
  )

  return pecas
}

/** Soma de todos os Custos Totais da BOM. */
export function custoConsolidado(itens: BudgetItem[]): number {
  return round2(itens.reduce((acc, it) => acc + (Number(it.totalCost) || 0), 0))
}

/** Soma de todos os Valores de Venda da BOM. */
export function valorConsolidado(itens: BudgetItem[]): number {
  return round2(itens.reduce((acc, it) => acc + (Number(it.salePrice) || 0), 0))
}
