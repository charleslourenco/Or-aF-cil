import { BudgetItem } from '@/data/mockData'

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
 * Cria uma peça (item) da BOM já precificada.
 */
function criarPeca(
  id: string,
  descricao: string,
  material: string,
  espessura: number,
  metragem: number,
  unidade: 'm²' | 'm' | 'jogo',
  custoUnitario: number,
): BudgetItem {
  const totalCost = round2(metragem * custoUnitario)
  const salePrice = round2(totalCost * MARKUP_PADRAO)
  return {
    id,
    description: descricao,
    material,
    espessura,
    metragem: round2(metragem),
    unidade,
    unitCost: custoUnitario,
    totalCost,
    markup: MARKUP_PADRAO,
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
 */
export function calcularBOM(
  modulo: { id: string; nome_template?: string } | null | undefined,
  dimensoes: Dimensoes,
  mdfExterno: MdfSpec,
  mdfInterno: MdfSpec,
  mdfFundo: string,
  padraoProjeto: PadraoProjeto,
): BudgetItem[] {
  // Validação: dimensões e módulo obrigatórios.
  if (!modulo || !dimensoes.largura || !dimensoes.altura || !dimensoes.profundidade) {
    return []
  }

  const L = dimensoes.largura
  const A = dimensoes.altura
  const P = dimensoes.profundidade
  const espExt = mdfExterno.espessura
  const espInt = mdfInterno.espessura
  // Reserva uso de padraoProjeto para futura variação de markup (sem efeito agora).
  void padraoProjeto

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
      CUSTOS_UNITARIOS[`MDF Externo ${espExt}`],
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
      CUSTOS_UNITARIOS[`MDF Externo ${espExt}`],
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
      CUSTOS_UNITARIOS[`MDF Interno ${espInt}`],
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
      CUSTOS_UNITARIOS['MDF Fundo 6'],
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
      CUSTOS_UNITARIOS['Fita de Borda'],
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
      CUSTOS_UNITARIOS['Ferragens'],
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
