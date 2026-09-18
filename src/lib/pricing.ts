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

export type TipoAberturaPorta = 'abrir' | 'correr' | 'batente' | 'nenhum'

export interface ModuloComposicao {
  portas?: {
    qtd: number
    tipo: TipoAberturaPorta
  }
  gavetas?: {
    qtd: number
  }
  prateleiras?: {
    qtd: number
  }
  cabideiro?: boolean
  sapateira?: boolean
  puxadores?: number
}

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
/**
 * Busca item de ferragem ou acessório no catálogo por termos-chave.
 * Retorna o item do catálogo encontrado ou undefined.
 */
function findItemCatalogo(
  catalogo: CatalogoMaterial[] | undefined,
  keywords: string[],
  categoria: string = 'Ferragem',
): CatalogoMaterial | undefined {
  if (!catalogo || catalogo.length === 0) return undefined
  const daCategoria = catalogo.filter((c) => c.categoria.toLowerCase() === categoria.toLowerCase())
  if (daCategoria.length === 0) return undefined

  for (const item of daCategoria) {
    const nome = (item.nome_material || '').toLowerCase()
    if (keywords.every((kw) => nome.includes(kw.toLowerCase()))) {
      return item
    }
  }

  // Tenta pelo menos uma das palavras-chave
  for (const item of daCategoria) {
    const nome = (item.nome_material || '').toLowerCase()
    if (keywords.some((kw) => nome.includes(kw.toLowerCase()))) {
      return item
    }
  }

  return undefined
}

export function calcularBOM(
  modulo: { id: string; nome_template?: string } | null | undefined,
  dimensoes: Dimensoes,
  mdfExterno: MdfSpec,
  mdfInterno: MdfSpec,
  mdfFundo: string,
  padraoProjeto: PadraoProjeto,
  catalogoPrecos?: CatalogoMaterial[],
  markup?: number,
  fatorEscala?: number,
  composicao?: ModuloComposicao | null,
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

  // Fator de escala proporcional (default 1.0 se não fornecido ou inválido)
  const escala = typeof fatorEscala === 'number' && fatorEscala > 0 ? fatorEscala : 1.0

  const pecas: BudgetItem[] = []

  // Verifica se há decomposição/composição fornecida (portas/gavetas/prateleiras/cabideiro/sapateira)
  // Se composicao não for informada, mantém a receita padrão fixa de 6 itens (legado).
  const temComposicao = composicao !== null && composicao !== undefined

  // 1. Laterais Externas: 2x (A × P) com fator de escala aplicado aos m² de MDF
  const areaLateral = ((A * P) / 1_000_000) * PERDA * escala
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

  // 2. Base e Topo: 2x ((L - 2×espExt) × P) com fator de escala aplicado aos m² de MDF
  const larguraInterna = Math.max(100, L - 2 * espExt)
  const areaBaseTopo = ((larguraInterna * P) / 1_000_000) * PERDA * escala
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

  // 3. Fundo: 1x (L × A) com fator de escala aplicado aos m² de MDF
  const areaFundo = ((L * A) / 1_000_000) * PERDA * escala
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

  if (!temComposicao) {
    // RECEITA FIXA LEGADA (para orçamentos antigos reabertos ou módulos sem decomposição)
    const profPrateleira = Math.max(100, P - 20)
    const areaPrateleira = ((larguraInterna * profPrateleira) / 1_000_000) * PERDA * escala
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

    const perimetroFitaMm = (2 * (A * 2) + 2 * (larguraInterna * 2) + 2 * larguraInterna) * escala
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

  // =========================================================================
  // CÁLCULO DINÂMICO DERIVADO DA COMPOSIÇÃO DO MÓVEL
  // =========================================================================
  const qtdPortas = Math.max(0, composicao.portas?.qtd ?? 0)
  const tipoPorta: TipoAberturaPorta = qtdPortas > 0 ? composicao.portas?.tipo || 'abrir' : 'nenhum'
  const qtdGavetas = Math.max(0, composicao.gavetas?.qtd ?? 0)
  const qtdPrateleiras = Math.max(0, composicao.prateleiras?.qtd ?? 2)
  const temCabideiro = Boolean(composicao.cabideiro)
  const temSapateira = Boolean(composicao.sapateira)
  const qtdPuxadores =
    typeof composicao.puxadores === 'number' && composicao.puxadores >= 0
      ? composicao.puxadores
      : qtdPortas + qtdGavetas

  // Acumulador de fita de borda (em mm)
  // Estrutura externa base: laterais (2x frentes + 2x fundos) + base e topo (frentes e fundos)
  let perimetroFitaMm = (2 * (A * 2) + 2 * (larguraInterna * 2)) * escala

  // 4. Prateleiras Internas (dinâmico)
  if (qtdPrateleiras > 0) {
    const profPrat = Math.max(100, P - 20)
    const areaUmaPrat = ((larguraInterna * profPrat) / 1_000_000) * PERDA * escala
    pecas.push(
      criarPeca(
        'bom-prateleiras',
        `Prateleiras Internas (${qtdPrateleiras}x) — ${larguraInterna}×${profPrat}mm`,
        'MDF Interno',
        espInt,
        areaUmaPrat * qtdPrateleiras,
        'm²',
        resolverCustoUnitario(`MDF Interno ${espInt}`, catalogoPrecos, padraoProjeto),
        effectiveMarkup,
      ),
    )
    // Fita de borda na frente de cada prateleira
    perimetroFitaMm += qtdPrateleiras * larguraInterna * escala
  }

  // 5. Portas (MDF Externo) e Ferragens de Porta
  if (qtdPortas > 0 && tipoPorta !== 'nenhum') {
    const largPorta = Math.round(larguraInterna / qtdPortas)
    const altPorta = Math.max(100, A - 2 * espExt)
    const areaUmaPorta = ((largPorta * altPorta) / 1_000_000) * PERDA * escala

    pecas.push(
      criarPeca(
        'bom-portas-folhas',
        `Folhas de Porta (${qtdPortas}x ${tipoPorta}) — ${largPorta}×${altPorta}mm`,
        'MDF Externo',
        espExt,
        areaUmaPorta * qtdPortas,
        'm²',
        resolverCustoUnitario(`MDF Externo ${espExt}`, catalogoPrecos, padraoProjeto),
        effectiveMarkup,
      ),
    )

    // Fita de borda em todos os 4 lados de cada folha de porta
    perimetroFitaMm += qtdPortas * 2 * (largPorta + altPorta) * escala

    if (tipoPorta === 'correr') {
      // Portas de correr: Kit Sistema de Correr + Trilho Superior + Trilho Inferior
      const kitCorrerMat = findItemCatalogo(catalogoPrecos, ['correr', 'kit'])
      const trilhoMat = findItemCatalogo(catalogoPrecos, ['trilho'])

      const unitCostKit = kitCorrerMat ? Number(kitCorrerMat.preco_custo) || 190 : 190.0
      const unitCostTrilho = trilhoMat ? Number(trilhoMat.preco_custo) || 79 : 79.0

      pecas.push({
        id: 'bom-ferragem-kit-correr',
        description: kitCorrerMat
          ? `Kit Sistema de Correr (${qtdPortas} portas)`
          : `Kit Sistema de Correr (${qtdPortas} portas) — Estimado`,
        material: 'Ferragem',
        metragem: Math.ceil(qtdPortas / 2) || 1,
        unidade: 'un',
        unitCost: unitCostKit,
        totalCost: round2(unitCostKit * (Math.ceil(qtdPortas / 2) || 1)),
        markup: effectiveMarkup,
        salePrice: round2(unitCostKit * (Math.ceil(qtdPortas / 2) || 1) * effectiveMarkup),
        item_nao_cadastrado: !kitCorrerMat,
        catalogo_id: kitCorrerMat?.id || null,
      })

      pecas.push({
        id: 'bom-ferragem-trilhos-correr',
        description: trilhoMat
          ? 'Trilhos Superior e Inferior para Sistema de Correr'
          : 'Trilhos Superior e Inferior — Estimado',
        material: 'Ferragem',
        metragem: 2,
        unidade: 'un',
        unitCost: unitCostTrilho,
        totalCost: round2(unitCostTrilho * 2),
        markup: effectiveMarkup,
        salePrice: round2(unitCostTrilho * 2 * effectiveMarkup),
        item_nao_cadastrado: !trilhoMat,
        catalogo_id: trilhoMat?.id || null,
      })
    } else {
      // Portas de abrir ou batente: 2 dobradiças por porta (1 par por porta)
      const dobradicaMat = findItemCatalogo(catalogoPrecos, ['dobradiça', 'dobradica'])
      const unitCostDobradica = dobradicaMat ? Number(dobradicaMat.preco_custo) || 42.0 : 50.0

      pecas.push({
        id: 'bom-ferragem-dobradicas',
        description: dobradicaMat
          ? `Dobradiças com amortecedor (${qtdPortas} pares / ${qtdPortas * 2} un)`
          : `Dobradiças com amortecedor (${qtdPortas * 2} un) — Estimado`,
        material: 'Ferragem',
        metragem: qtdPortas, // 1 par por porta (2 dobradiças)
        unidade: dobradicaMat?.unidade === 'un' ? 'un' : 'par',
        unitCost: unitCostDobradica,
        totalCost: round2(unitCostDobradica * qtdPortas),
        markup: effectiveMarkup,
        salePrice: round2(unitCostDobradica * qtdPortas * effectiveMarkup),
        item_nao_cadastrado: !dobradicaMat,
        catalogo_id: dobradicaMat?.id || null,
      })
    }
  }

  // 6. Gavetas: frentes + caixote (laterais, contra-frente, traseira e fundo) + corrediças
  if (qtdGavetas > 0) {
    const largFrenteGav = Math.max(100, larguraInterna)
    const altFrenteGav = Math.max(100, Math.round(500 / qtdGavetas) || 160)
    const areaFrentes = ((largFrenteGav * altFrenteGav) / 1_000_000) * PERDA * escala

    // Frente da gaveta em MDF Externo
    pecas.push(
      criarPeca(
        'bom-gavetas-frentes',
        `Frentes de Gaveta (${qtdGavetas}x) — ${largFrenteGav}×${altFrenteGav}mm`,
        'MDF Externo',
        espExt,
        areaFrentes * qtdGavetas,
        'm²',
        resolverCustoUnitario(`MDF Externo ${espExt}`, catalogoPrecos, padraoProjeto),
        effectiveMarkup,
      ),
    )

    // Fita de borda no contorno de cada frente de gaveta
    perimetroFitaMm += qtdGavetas * 2 * (largFrenteGav + altFrenteGav) * escala

    // Caixote interno da gaveta (laterais e contra-frente/traseira em MDF Interno 15mm)
    const profGaveta = Math.max(150, P - 70)
    const altCaixote = Math.max(80, altFrenteGav - 40)
    // 2 laterais + 2 travessas (contra-frente e traseira)
    const areaCaixotePorGav =
      ((2 * profGaveta * altCaixote + 2 * largFrenteGav * altCaixote) / 1_000_000) * PERDA * escala

    pecas.push(
      criarPeca(
        'bom-gavetas-caixotes',
        `Caixotes de Gaveta (${qtdGavetas}x internos) — MDF 15mm`,
        'MDF Interno',
        espInt,
        areaCaixotePorGav * qtdGavetas,
        'm²',
        resolverCustoUnitario(`MDF Interno ${espInt}`, catalogoPrecos, padraoProjeto),
        effectiveMarkup,
      ),
    )

    // Fundo da gaveta (MDF 6mm)
    const areaFundoGavPorGav = ((largFrenteGav * profGaveta) / 1_000_000) * PERDA * escala
    pecas.push(
      criarPeca(
        'bom-gavetas-fundos',
        `Fundos de Gaveta (${qtdGavetas}x) — ${largFrenteGav}×${profGaveta}mm MDF 6mm`,
        'MDF Fundo',
        6,
        areaFundoGavPorGav * qtdGavetas,
        'm²',
        resolverCustoUnitario('MDF Fundo 6', catalogoPrecos, padraoProjeto),
        effectiveMarkup,
      ),
    )

    // Corrediças por gaveta (1 par por gaveta)
    const corredicaMat = findItemCatalogo(catalogoPrecos, ['corrediça', 'corredica'])
    const unitCostCorredica = corredicaMat ? Number(corredicaMat.preco_custo) || 95.0 : 50.0

    pecas.push({
      id: 'bom-ferragem-corredicas',
      description: corredicaMat
        ? `Corrediças com amortecedor (${qtdGavetas} pares)`
        : `Corrediças telescópicas/invisíveis (${qtdGavetas} pares) — Estimado`,
      material: 'Ferragem',
      metragem: qtdGavetas,
      unidade: corredicaMat?.unidade === 'un' ? 'un' : 'par',
      unitCost: unitCostCorredica,
      totalCost: round2(unitCostCorredica * qtdGavetas),
      markup: effectiveMarkup,
      salePrice: round2(unitCostCorredica * qtdGavetas * effectiveMarkup),
      item_nao_cadastrado: !corredicaMat,
      catalogo_id: corredicaMat?.id || null,
    })
  }

  // 7. Cabideiro
  if (temCabideiro) {
    const cabideiroMat = findItemCatalogo(catalogoPrecos, ['cabideiro', 'tubo'])
    const unitCostCabideiro = cabideiroMat ? Number(cabideiroMat.preco_custo) || 50.0 : 50.0

    pecas.push({
      id: 'bom-acessorio-cabideiro',
      description: cabideiroMat
        ? `Tubo Cabideiro com suportes laterais`
        : `Tubo Cabideiro com suportes — Estimado`,
      material: 'Ferragem',
      metragem: 1,
      unidade: cabideiroMat?.unidade === 'm' ? 'm' : 'un',
      unitCost: unitCostCabideiro,
      totalCost: round2(unitCostCabideiro),
      markup: effectiveMarkup,
      salePrice: round2(unitCostCabideiro * effectiveMarkup),
      item_nao_cadastrado: !cabideiroMat,
      catalogo_id: cabideiroMat?.id || null,
    })
  }

  // 8. Sapateira
  if (temSapateira) {
    const sapateiraMat = findItemCatalogo(catalogoPrecos, ['sapateira', 'aramado'])
    const unitCostSapateira = sapateiraMat ? Number(sapateiraMat.preco_custo) || 50.0 : 50.0

    pecas.push({
      id: 'bom-acessorio-sapateira',
      description: sapateiraMat
        ? `Módulo / Kit Sapateira com corrediças`
        : `Kit Sapateira com trilhos — Estimado`,
      material: 'Ferragem',
      metragem: 1,
      unidade: 'un',
      unitCost: unitCostSapateira,
      totalCost: round2(unitCostSapateira),
      markup: effectiveMarkup,
      salePrice: round2(unitCostSapateira * effectiveMarkup),
      item_nao_cadastrado: !sapateiraMat,
      catalogo_id: sapateiraMat?.id || null,
    })
  }

  // 9. Puxadores
  if (qtdPuxadores > 0) {
    const puxadorMat = findItemCatalogo(catalogoPrecos, ['puxador'])
    const unitCostPuxador = puxadorMat ? Number(puxadorMat.preco_custo) || 25.0 : 25.0

    pecas.push({
      id: 'bom-ferragem-puxadores',
      description: puxadorMat
        ? `Puxadores (${qtdPuxadores} un)`
        : `Puxadores (${qtdPuxadores} un) — Estimado`,
      material: 'Ferragem',
      metragem: qtdPuxadores,
      unidade: 'un',
      unitCost: unitCostPuxador,
      totalCost: round2(unitCostPuxador * qtdPuxadores),
      markup: effectiveMarkup,
      salePrice: round2(unitCostPuxador * qtdPuxadores * effectiveMarkup),
      item_nao_cadastrado: !puxadorMat,
      catalogo_id: puxadorMat?.id || null,
    })
  }

  // 10. Fita de Borda consolidada para o módulo decomposto
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
