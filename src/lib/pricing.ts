import { BudgetItem } from '@/data/mockData'
import type { CatalogoMaterial } from '@/services/catalogo'
import type { PerfilConstrutivo } from '@/services/templates'

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

export interface ComposicaoCorpo {
  id?: string
  gavetas: number
  prateleiras: number
  cabideiro: boolean
  sapateira?: boolean
}

export interface ModuloComposicao {
  /** Quantidade de divisórias verticais que separam o módulo em corpos */
  divisorias?: {
    qtd: number
  }
  /** Configuração detalhada por corpo (se omitida, o sistema distribui os totais) */
  corpos?: ComposicaoCorpo[]
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
  /** Quantidade explícita de cabideiros quando fornecida */
  qtdCabideiros?: number
  /** Iluminação / Fita LED integrada */
  iluminacaoLed?: boolean
  sapateira?: boolean
  puxadores?: number
  /** Se true, o móvel é calculado como caixa simples sem envelopamento (padrão: false) */
  semTamponamento?: boolean
  /** Se true ou se o móvel for balcão com tampo de pedra, substitui o tampo/topo por travessas (padrão: false) */
  tampoPedra?: boolean
  /** Perfil construtivo selecionado ou override (Fechado Envelopado, Balcão, Aberto / Painel, Caixa Simples) */
  perfilConstrutivo?: PerfilConstrutivo | string
}

/**
 * Constantes paramétricas padrão de ofício para marcenaria sob medida.
 * Centralizadas em objeto único para futura customização nas Configurações de Engenharia.
 */
export const PARAMS_CONSTRUTIVOS = {
  /** Espessura padrão de MDF estrutural externo (mm) */
  esp_mdf_externo_padrao_mm: 18,
  /** Espessura padrão de MDF estrutural interno (mm) */
  esp_mdf_interno_padrao_mm: 15,
  /** Recuo frontal da caixa interna estrutural em relação à profundidade externa total (mm) */
  recuo_caixa_interna_mm: 20,
  /** Altura padrão do rodapé inferior (mm) */
  altura_rodape_mm: 100,
  /** Altura padrão do rodateto superior (mm) */
  altura_rodateto_mm: 40,
  /** Altura (largura da ripa) padrão das travessas de apoio para tampo de pedra (mm) */
  altura_travessa_mm: 100,
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
/**
 * Formata o rótulo descritivo do material na lista técnica (BOM),
 * combinando a classificação técnica ("MDF Externo", "MDF Interno", etc.)
 * com a especificação de padrão do MDF (cor e/ou espessura) escolhida pelo usuário.
 */
export function formatarRotuloMaterial(tipo: string, spec?: MdfSpec | string): string {
  if (!spec) return tipo

  if (typeof spec === 'string') {
    const trimmed = spec.trim()
    return trimmed ? `${tipo} — ${trimmed}` : tipo
  }

  const cor = (spec.cor || '').trim()
  const esp = spec.espessura

  if (cor && esp) {
    return `${tipo} — ${cor} ${esp}mm`
  }
  if (cor) {
    return `${tipo} — ${cor}`
  }
  if (esp) {
    return `${tipo} — ${esp}mm`
  }

  return tipo
}

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
  modulo:
    | { id: string; nome_template?: string; perfil_construtivo?: string | null }
    | null
    | undefined,
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

  const rotuloMdfExterno = formatarRotuloMaterial('MDF Externo', mdfExterno)
  const rotuloMdfInterno = formatarRotuloMaterial('MDF Interno', mdfInterno)
  const rotuloMdfFundo = mdfFundo?.trim() ? 'MDF Fundo — ' + mdfFundo.trim() : 'MDF Fundo'

  // =========================================================================
  // RESOLUÇÃO DE CUSTOS DE MDF (EXATO POR NOME COM FALLBACK POR CATEGORIA)
  // 1. Tenta match exato pelo nome_material escolhido contra catalogoPrecos.
  // 2. Se não encontrar (ex.: orçamentos legados), recorre ao resolverCustoUnitario.
  // =========================================================================
  const normalizarNome = (str?: string) => (str || '').trim().toLowerCase().replace(/\s+/g, ' ')

  const buscarCustoExatoPorNome = (
    nome?: string,
    catalogo?: CatalogoMaterial[],
  ): number | undefined => {
    if (!nome || !catalogo || catalogo.length === 0) return undefined
    const nomeNorm = normalizarNome(nome)
    if (!nomeNorm) return undefined
    const match = catalogo.find(
      (m) => normalizarNome(m.nome_material) === nomeNorm && Number(m.preco_custo) > 0,
    )
    if (match) {
      const preco = Number(match.preco_custo)
      if (!Number.isNaN(preco) && preco > 0) return preco
    }
    return undefined
  }

  const custoMdfExterno =
    buscarCustoExatoPorNome(mdfExterno.cor, catalogoPrecos) ??
    resolverCustoUnitario(`MDF Externo ${espExt}`, catalogoPrecos, padraoProjeto)

  const custoMdfInterno =
    buscarCustoExatoPorNome(mdfInterno.cor, catalogoPrecos) ??
    resolverCustoUnitario(`MDF Interno ${espInt}`, catalogoPrecos, padraoProjeto)

  const custoMdfFundo =
    buscarCustoExatoPorNome(mdfFundo, catalogoPrecos) ??
    resolverCustoUnitario('MDF Fundo 6', catalogoPrecos, padraoProjeto)

  const pecas: BudgetItem[] = []

  // Verifica se há decomposição/composição fornecida (portas/gavetas/prateleiras/cabideiro/sapateira)
  const temComposicao = composicao !== null && composicao !== undefined

  // =========================================================================
  // DETERMINAÇÃO DO PERFIL CONSTRUTIVO
  // Prioridade:
  // 1. Override explícito em composicao.perfilConstrutivo (se setado)
  // 2. Override legado / atalho: semTamponamento força "Caixa Simples"
  // 3. Perfil definido no cadastro do módulo da biblioteca (modulo.perfil_construtivo)
  // 4. Inferência por nome de template como fallback seguro
  // 5. Default seguro: 'Fechado Envelopado'
  // =========================================================================
  const nomeTemplateLower = (modulo?.nome_template || '').toLowerCase()
  let perfilEfetivo: PerfilConstrutivo = 'Fechado Envelopado'

  if (composicao?.perfilConstrutivo) {
    perfilEfetivo = composicao.perfilConstrutivo as PerfilConstrutivo
  } else if (composicao?.semTamponamento) {
    perfilEfetivo = 'Caixa Simples'
  } else if (modulo?.perfil_construtivo) {
    perfilEfetivo = modulo.perfil_construtivo as PerfilConstrutivo
  } else {
    // Fallback por nome
    if (
      nomeTemplateLower.includes('painel') ||
      nomeTemplateLower.includes('tv') ||
      nomeTemplateLower.includes('rack') ||
      nomeTemplateLower.includes('estante') ||
      nomeTemplateLower.includes('nicho')
    ) {
      perfilEfetivo = 'Aberto / Painel'
    } else if (
      nomeTemplateLower.includes('balcão') ||
      nomeTemplateLower.includes('balcao') ||
      nomeTemplateLower.includes('pia') ||
      nomeTemplateLower.includes('bancada')
    ) {
      perfilEfetivo = 'Balcão (tampo por conta do cliente)'
    } else if (nomeTemplateLower.includes('aereo') || nomeTemplateLower.includes('aéreo')) {
      perfilEfetivo = 'Caixa Simples'
    } else {
      perfilEfetivo = 'Fechado Envelopado'
    }
  }

  // Flags derivadas do perfil efetivo
  const isFechadoEnvelopado = perfilEfetivo === 'Fechado Envelopado'
  const isBalcao = perfilEfetivo === 'Balcão (tampo por conta do cliente)'
  const isAbertoPainel = perfilEfetivo === 'Aberto / Painel'
  const isCaixaSimples = perfilEfetivo === 'Caixa Simples'

  // =========================================================================
  // DIMENSÕES E SUBTRAÇÕES PARAMÉTRICAS
  // =========================================================================
  const { recuo_caixa_interna_mm, altura_rodape_mm, altura_rodateto_mm, altura_travessa_mm } =
    PARAMS_CONSTRUTIVOS

  // =========================================================================
  // TRATAMENTO ESPECÍFICO: PERFIL "ABERTO / PAINEL" (EX: PAINEL DE TV, NICHOS)
  // O corpo do móvel é uma CHAPA TRASEIRA ESTRUTURAL (L × A) em MDF Externo 18mm,
  // mais estrutura de fixação/rebaixos (sarrafos franceses / mão-amiga 100mm),
  // e prateleiras/nichos/gavetas apenas se a composição pedir.
  // ZERO laterais de caixa rasa, ZERO base inferior de box, ZERO teto interno,
  // ZERO base interna, ZERO rodateto.
  // =========================================================================
  if (isAbertoPainel) {
    // 1. Chapa Traseira Estrutural de Painel (L × A) em MDF Externo (18mm)
    const areaPainelPrincipal = ((L * A) / 1_000_000) * PERDA * escala
    pecas.push(
      criarPeca(
        'bom-painel-traseiro-estrutural',
        `Chapa Traseira Estrutural de Painel (1x) — ${L}×${A}mm`,
        rotuloMdfExterno,
        espExt,
        areaPainelPrincipal,
        'm²',
        custoMdfExterno,
        effectiveMarkup,
      ),
    )

    // 2. Sarrafos de Fixação Traseira / Estrutura Francesa / Mão-Amiga (2 sarrafos de 100mm × L)
    const largSarrafo = Math.max(100, L - 100)
    const altSarrafoMm = 100
    const areaSarrafos = ((largSarrafo * altSarrafoMm * 2) / 1_000_000) * PERDA * escala
    pecas.push(
      criarPeca(
        'bom-sarrafos-fixacao-painel',
        `Sarrafos Estruturais de Fixação / Mão-Amiga (2x) — ${largSarrafo}×${altSarrafoMm}mm`,
        rotuloMdfExterno,
        espExt,
        areaSarrafos,
        'm²',
        custoMdfExterno,
        effectiveMarkup,
      ),
    )

    // Acumulador de fita de borda para o painel (perímetro da chapa traseira)
    let perimetroFitaMmPainel = 2 * (L + A) * escala

    // 3. Prateleiras ou nichos abertos suspensos (se informados na composição)
    const qtdPrateleirasPainel = Math.max(0, composicao?.prateleiras?.qtd ?? 0)
    if (qtdPrateleirasPainel > 0) {
      // Usa a profundidade informada do projeto (ex: 200-300mm para prateleira de TV)
      const profPratPainel = Math.max(120, P)
      const largPratPainel = Math.max(200, Math.round(L * 0.85))
      const areaPratPainel = ((largPratPainel * profPratPainel) / 1_000_000) * PERDA * escala
      pecas.push(
        criarPeca(
          'bom-prateleiras-painel',
          `Prateleira Suspensa de Apoio (${qtdPrateleirasPainel}x) — ${largPratPainel}×${profPratPainel}mm`,
          rotuloMdfExterno,
          espExt,
          areaPratPainel * qtdPrateleirasPainel,
          'm²',
          custoMdfExterno,
          effectiveMarkup,
        ),
      )
      perimetroFitaMmPainel +=
        qtdPrateleirasPainel * (2 * largPratPainel + 2 * profPratPainel) * escala
    }

    // 4. Gavetas no rack/nicho suspenso acoplado (se houver)
    const qtdGavetasPainel = Math.max(0, composicao?.gavetas?.qtd ?? 0)
    if (qtdGavetasPainel > 0) {
      const profGavPainel = Math.max(250, P - 50)
      const largFrentePainel = Math.max(200, Math.round(L / qtdGavetasPainel))
      const altFrentePainel = 160
      const areaFrentes = ((largFrentePainel * altFrentePainel) / 1_000_000) * PERDA * escala
      pecas.push(
        criarPeca(
          'bom-gavetas-frentes-painel',
          `Frentes de Gaveta (${qtdGavetasPainel}x) — ${largFrentePainel}×${altFrentePainel}mm`,
          rotuloMdfExterno,
          espExt,
          areaFrentes * qtdGavetasPainel,
          'm²',
          custoMdfExterno,
          effectiveMarkup,
        ),
      )
      perimetroFitaMmPainel += qtdGavetasPainel * 2 * (largFrentePainel + altFrentePainel) * escala

      // Caixotes internos
      const largCaixote = Math.max(150, largFrentePainel - 30)
      const altCaixote = 120
      const areaCaixote =
        ((2 * profGavPainel * altCaixote + 2 * largCaixote * altCaixote) / 1_000_000) *
        PERDA *
        escala
      pecas.push(
        criarPeca(
          'bom-gavetas-caixotes-painel',
          `Caixotes de Gaveta (${qtdGavetasPainel}x internos) — MDF 15mm`,
          rotuloMdfInterno,
          espInt,
          areaCaixote * qtdGavetasPainel,
          'm²',
          custoMdfInterno,
          effectiveMarkup,
        ),
      )

      // Fundos 6mm
      const areaFundoGav = ((largCaixote * profGavPainel) / 1_000_000) * PERDA * escala
      pecas.push(
        criarPeca(
          'bom-gavetas-fundos-painel',
          `Fundos de Gaveta (${qtdGavetasPainel}x) — ${largCaixote}×${profGavPainel}mm MDF 6mm`,
          rotuloMdfFundo,
          6,
          areaFundoGav * qtdGavetasPainel,
          'm²',
          custoMdfFundo,
          effectiveMarkup,
        ),
      )

      // Corrediças
      const corredicaMat = findItemCatalogo(catalogoPrecos, ['corrediça', 'corredica'])
      const unitCostCorredica = corredicaMat ? Number(corredicaMat.preco_custo) || 95.0 : 50.0
      pecas.push({
        id: 'bom-ferragem-corredicas-painel',
        description: corredicaMat
          ? `Corrediças com amortecedor (${qtdGavetasPainel} pares)`
          : `Corrediças telescópicas (${qtdGavetasPainel} pares) — Estimado`,
        material: 'Ferragem',
        metragem: qtdGavetasPainel,
        unidade: corredicaMat?.unidade === 'un' ? 'un' : 'par',
        unitCost: unitCostCorredica,
        totalCost: round2(unitCostCorredica * qtdGavetasPainel),
        markup: effectiveMarkup,
        salePrice: round2(unitCostCorredica * qtdGavetasPainel * effectiveMarkup),
        item_nao_cadastrado: !corredicaMat,
        catalogo_id: corredicaMat?.id || null,
      })
    }

    // 5. Fita de Borda para o painel
    const perimetroFitaM = perimetroFitaMmPainel / 1000
    pecas.push(
      criarPeca(
        'bom-fita-borda-painel',
        `Fita de Borda — ${round2(perimetroFitaM)}m linear`,
        'Fita de Borda',
        0,
        perimetroFitaM,
        'm',
        resolverCustoUnitario('Fita de Borda', catalogoPrecos, padraoProjeto),
        effectiveMarkup,
      ),
    )

    // 6. Kit de Fixação e Buchas Estruturais para Alvenaria/Drywall
    pecas.push({
      id: 'bom-kit-fixacao-painel',
      description: 'Kit de Fixação Reforçado para Painel Suspenso (Buchas 10mm + Parafusos)',
      material: 'Ferragem',
      metragem: 1,
      unidade: 'jogo',
      unitCost: 35.0,
      totalCost: 35.0,
      markup: effectiveMarkup,
      salePrice: round2(35.0 * effectiveMarkup),
      item_nao_cadastrado: false,
      catalogo_id: null,
    })

    return pecas
  }

  // =========================================================================
  // PERFIS DE CAIXA: FECHADO ENVELOPADO, BALCÃO, CAIXA SIMPLES
  // =========================================================================

  // 1. Laterais Externas: 2x (A × P) em MDF Externo
  const areaLateralExt = ((A * P) / 1_000_000) * PERDA * escala
  pecas.push(
    criarPeca(
      'bom-laterais-externas',
      `Laterais Externas (2x) — ${A}×${P}mm`,
      rotuloMdfExterno,
      espExt,
      areaLateralExt * 2,
      'm²',
      custoMdfExterno,
      effectiveMarkup,
    ),
  )

  const larguraEntreLateraisExt = Math.max(100, L - 2 * espExt)
  const profInterna = Math.max(100, P - recuo_caixa_interna_mm)
  const largCaixariaInt = Math.max(100, L - 2 * espExt - 2 * espInt)

  // 2. Cobertura / Topo e Base de acordo com o Perfil Construtivo:
  if (isBalcao) {
    // BALCÃO: NUNCA gera tampo de MDF (nem pedra).
    // Gera TRAVESSAS de apoio no topo (frontal e traseira) + BASE inferior estrutural simples.
    const areaTravessaFrontal = ((L * altura_travessa_mm) / 1_000_000) * PERDA * escala
    const areaTravessaTraseira =
      ((larguraEntreLateraisExt * altura_travessa_mm) / 1_000_000) * PERDA * escala

    pecas.push(
      criarPeca(
        'bom-travessa-frontal',
        `Travessa Frontal de Apoio (1x) — ${L}×${altura_travessa_mm}mm`,
        rotuloMdfExterno,
        espExt,
        areaTravessaFrontal,
        'm²',
        custoMdfExterno,
        effectiveMarkup,
      ),
    )

    pecas.push(
      criarPeca(
        'bom-travessa-traseira',
        `Travessa Traseira de Apoio (1x) — ${larguraEntreLateraisExt}×${altura_travessa_mm}mm`,
        rotuloMdfExterno,
        espExt,
        areaTravessaTraseira,
        'm²',
        custoMdfExterno,
        effectiveMarkup,
      ),
    )

    // Base inferior do balcão (1x)
    const areaBaseBalcao = ((larguraEntreLateraisExt * P) / 1_000_000) * PERDA * escala
    pecas.push(
      criarPeca(
        'bom-base-simples',
        `Base Inferior (1x) — ${larguraEntreLateraisExt}×${P}mm`,
        rotuloMdfExterno,
        espExt,
        areaBaseBalcao,
        'm²',
        custoMdfExterno,
        effectiveMarkup,
      ),
    )

    // Rodapé de balcão (se tiver altura_rodape_mm)
    if (altura_rodape_mm > 0) {
      const areaRodapeM2 = (((L + 2 * P) * altura_rodape_mm) / 1_000_000) * PERDA * escala
      pecas.push(
        criarPeca(
          'bom-rodape',
          `Rodapé Inferior (1 jogo: frente + 2 lat.) — h=${altura_rodape_mm}mm`,
          rotuloMdfExterno,
          espExt,
          areaRodapeM2,
          'm²',
          custoMdfExterno,
          effectiveMarkup,
        ),
      )
    }
  } else if (isCaixaSimples) {
    // CAIXA SIMPLES: caixa única tradicional sem caixaria interna.
    // Base e Topo (2x) em MDF Externo.
    const areaBaseTopo = ((larguraEntreLateraisExt * P) / 1_000_000) * PERDA * escala
    pecas.push(
      criarPeca(
        'bom-base-topo',
        `Base e Topo (2x) — ${larguraEntreLateraisExt}×${P}mm`,
        rotuloMdfExterno,
        espExt,
        areaBaseTopo * 2,
        'm²',
        custoMdfExterno,
        effectiveMarkup,
      ),
    )
  } else {
    // FECHADO ENVELOPADO (Caixa Dupla Completa):
    // 1x Tampo/Teto Externo em MDF Externo
    const areaTampoExt = ((larguraEntreLateraisExt * P) / 1_000_000) * PERDA * escala
    pecas.push(
      criarPeca(
        'bom-tampo-externo',
        `Tampo/Teto Externo (1x) — ${larguraEntreLateraisExt}×${P}mm`,
        rotuloMdfExterno,
        espExt,
        areaTampoExt,
        'm²',
        custoMdfExterno,
        effectiveMarkup,
      ),
    )

    // Caixaria Interna Estrutural (Envelopamento):
    // - Lateral interna (2x) em MDF Interno
    // - Teto interno (1x) em MDF Interno
    // - Base interna (1x) em MDF Interno
    // - Rodapé (1 jogo) em MDF Externo
    // - Rodateto (1 jogo) em MDF Externo
    const altLateralInt = Math.max(100, A - altura_rodape_mm - espExt)
    const areaLatInt = ((altLateralInt * profInterna) / 1_000_000) * PERDA * escala
    pecas.push(
      criarPeca(
        'bom-laterais-internas',
        `Laterais Internas Estruturais (2x) — ${altLateralInt}×${profInterna}mm`,
        rotuloMdfInterno,
        espInt,
        areaLatInt * 2,
        'm²',
        custoMdfInterno,
        effectiveMarkup,
      ),
    )

    const areaTetoInt = ((largCaixariaInt * profInterna) / 1_000_000) * PERDA * escala
    pecas.push(
      criarPeca(
        'bom-teto-interno',
        `Teto Interno Estrutural (1x) — ${largCaixariaInt}×${profInterna}mm`,
        rotuloMdfInterno,
        espInt,
        areaTetoInt,
        'm²',
        custoMdfInterno,
        effectiveMarkup,
      ),
    )

    const areaBaseInt = ((largCaixariaInt * profInterna) / 1_000_000) * PERDA * escala
    pecas.push(
      criarPeca(
        'bom-base-interna',
        `Base Interna Estrutural (1x) — ${largCaixariaInt}×${profInterna}mm`,
        rotuloMdfInterno,
        espInt,
        areaBaseInt,
        'm²',
        custoMdfInterno,
        effectiveMarkup,
      ),
    )

    const areaRodapeM2 = (((L + 2 * P) * altura_rodape_mm) / 1_000_000) * PERDA * escala
    pecas.push(
      criarPeca(
        'bom-rodape',
        `Rodapé Inferior (1 jogo: frente + 2 lat.) — h=${altura_rodape_mm}mm`,
        rotuloMdfExterno,
        espExt,
        areaRodapeM2,
        'm²',
        custoMdfExterno,
        effectiveMarkup,
      ),
    )

    if (altura_rodateto_mm > 0) {
      const areaRodatetoM2 = (((L + 2 * P) * altura_rodateto_mm) / 1_000_000) * PERDA * escala
      pecas.push(
        criarPeca(
          'bom-rodateto',
          `Rodateto Superior (1 jogo: frente + 2 lat.) — h=${altura_rodateto_mm}mm`,
          rotuloMdfExterno,
          espExt,
          areaRodatetoM2,
          'm²',
          custoMdfExterno,
          effectiveMarkup,
        ),
      )
    }
  }

  // 3. Fundo:
  // Em Fechado Envelopado, Balcão e Caixa Simples o fundo fechado (1x L×A) em 6mm é gerado.
  const areaFundo = ((L * A) / 1_000_000) * PERDA * escala
  pecas.push(
    criarPeca(
      'bom-fundo',
      `Fundo (1x) — ${L}×${A}mm`,
      rotuloMdfFundo,
      6,
      areaFundo,
      'm²',
      custoMdfFundo,
      effectiveMarkup,
    ),
  )

  // Altura lateral interna de referência para peças internas
  const altLateralIntRef = isFechadoEnvelopado
    ? Math.max(100, A - altura_rodape_mm - espExt)
    : Math.max(100, A - 2 * espExt)

  // Vão livre útil para prateleiras internas e portas
  const larguraVaoUtil = isFechadoEnvelopado ? largCaixariaInt : larguraEntreLateraisExt
  const alturaVaoUtil = isFechadoEnvelopado
    ? Math.max(100, altLateralIntRef - 2 * espInt)
    : Math.max(100, A - 2 * espExt)

  if (!temComposicao) {
    // RECEITA FIXA LEGADA (para orçamentos antigos reabertos ou módulos sem decomposição)
    const profPrateleira = Math.max(100, profInterna)
    const areaPrateleira = ((larguraVaoUtil * profPrateleira) / 1_000_000) * PERDA * escala
    pecas.push(
      criarPeca(
        'bom-prateleiras',
        `Prateleiras Internas (2x) — ${larguraVaoUtil}×${profPrateleira}mm`,
        rotuloMdfInterno,
        espInt,
        areaPrateleira * 2,
        'm²',
        custoMdfInterno,
        effectiveMarkup,
      ),
    )

    const perimetroFitaMm = (2 * (A * 2) + 2 * (larguraVaoUtil * 2) + 2 * larguraVaoUtil) * escala
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
  // CÁLCULO DINÂMICO DERIVADO DA COMPOSIÇÃO DO MÓVEL & CORPOS POR DIVISÓRIAS
  // =========================================================================
  const qtdDivisorias = Math.max(0, composicao.divisorias?.qtd ?? 0)
  const qtdCorpos = qtdDivisorias + 1

  // Vão livre de cada corpo (subtraindo espessuras das divisórias intermediárias)
  // Se divisorias = 0, larguraCorpo = larguraVaoUtil (compatibilidade total de vão único)
  const larguraCorpo = Math.max(
    100,
    Math.round((larguraVaoUtil - qtdDivisorias * espInt) / qtdCorpos),
  )

  // Altura da divisória vertical: igual à altura interna
  const altDivisoria = isFechadoEnvelopado
    ? Math.max(100, A - altura_rodape_mm - espExt)
    : Math.max(100, A - 2 * espExt)
  const profDivisoria = profInterna

  // 3f. Divisórias Verticais Internas (em MDF Interno)
  if (qtdDivisorias > 0) {
    const areaUmaDivisoria = ((altDivisoria * profDivisoria) / 1_000_000) * PERDA * escala
    pecas.push(
      criarPeca(
        'bom-divisorias-verticais',
        `Divisória Vertical Interna (${qtdDivisorias}x) — ${altDivisoria}×${profDivisoria}mm`,
        rotuloMdfInterno,
        espInt,
        areaUmaDivisoria * qtdDivisorias,
        'm²',
        custoMdfInterno,
        effectiveMarkup,
      ),
    )
  }

  // Composição por corpo: verifica se há corpos definidos individualmente
  let corposConfig: ComposicaoCorpo[] = []
  if (Array.isArray(composicao.corpos) && composicao.corpos.length === qtdCorpos) {
    corposConfig = composicao.corpos
  } else {
    // Distribuição automática padrão dos componentes entre os corpos:
    // Se a IA informou cabideiro e qtdCorpos > 1, cada corpo ganha cabideiro (ou distribui)
    const totalGavetas = Math.max(0, composicao.gavetas?.qtd ?? 0)
    const totalPrateleiras = Math.max(0, composicao.prateleiras?.qtd ?? 2)
    const cabideiroGlobal = Boolean(composicao.cabideiro)
    const sapateiraGlobal = Boolean(composicao.sapateira)

    // Se temos 2 corpos e gavetas, concentra as gavetas num corpo gaveteiro se for layout assimétrico,
    // ou distribui igualmente se não houver divisão prévia.
    // Para simplificar a inicialização padrão: distribui igualmente
    const gavetasPorCorpoBase = Math.floor(totalGavetas / qtdCorpos)
    const restoGavetas = totalGavetas % qtdCorpos

    const pratPorCorpoBase = Math.floor(totalPrateleiras / qtdCorpos)
    const restoPrat = totalPrateleiras % qtdCorpos

    for (let c = 0; c < qtdCorpos; c++) {
      corposConfig.push({
        id: `corpo-${c + 1}`,
        gavetas: gavetasPorCorpoBase + (c === 0 ? restoGavetas : 0),
        prateleiras: pratPorCorpoBase + (c === 0 ? restoPrat : 0),
        // Se a IA detectou cabideiro, no guarda-roupa de múltiplos corpos cada corpo pode receber cabideiro
        cabideiro: cabideiroGlobal,
        sapateira: c === 0 ? sapateiraGlobal : false,
      })
    }
  }

  // Totais consolidados derivados dos corpos ou override da composição direta
  const qtdGavetas =
    composicao.gavetas?.qtd !== undefined
      ? Math.max(0, composicao.gavetas.qtd)
      : corposConfig.reduce((acc, c) => acc + (Number(c.gavetas) || 0), 0)
  const qtdPrateleiras =
    composicao.prateleiras?.qtd !== undefined
      ? Math.max(0, composicao.prateleiras.qtd)
      : corposConfig.reduce((acc, c) => acc + (Number(c.prateleiras) || 0), 0)
  const qtdCabideiros =
    composicao.qtdCabideiros !== undefined
      ? Math.max(0, composicao.qtdCabideiros)
      : composicao.cabideiro
        ? 1
        : corposConfig.filter((c) => Boolean(c.cabideiro)).length
  const temSapateira = corposConfig.some((c) => Boolean(c.sapateira))

  const qtdPortas = Math.max(0, composicao.portas?.qtd ?? 0)
  const tipoPorta: TipoAberturaPorta = qtdPortas > 0 ? composicao.portas?.tipo || 'abrir' : 'nenhum'

  const qtdPuxadores =
    typeof composicao.puxadores === 'number' && composicao.puxadores >= 0
      ? composicao.puxadores
      : qtdPortas + qtdGavetas

  // Acumulador de fita de borda (em mm)
  // Estrutura externa base: laterais (2x frentes + 2x fundos) + tampo/base + fita de borda de peças internas visíveis
  let perimetroFitaMm = (2 * (A * 2) + 2 * (larguraEntreLateraisExt * 2)) * escala
  if (isFechadoEnvelopado) {
    // Bordas frontais das laterais internas, teto e base internos
    const altLatInt = Math.max(100, A - altura_rodape_mm - espExt)
    perimetroFitaMm += (2 * altLatInt + 2 * largCaixariaInt) * escala
  }

  // Fita de borda na frente vertical de cada divisória interna
  if (qtdDivisorias > 0) {
    perimetroFitaMm += qtdDivisorias * altDivisoria * escala
  }

  // 4. Prateleiras Internas (calculadas por corpo com a largura do corpo)
  if (qtdPrateleiras > 0) {
    const profPrat = Math.max(100, profInterna)
    // Se divisórias > 0, cada prateleira mede larguraCorpo × profPrat
    // Se divisórias = 0, larguraCorpo = larguraVaoUtil
    const areaUmaPrat = ((larguraCorpo * profPrat) / 1_000_000) * PERDA * escala
    pecas.push(
      criarPeca(
        'bom-prateleiras',
        `Prateleiras Internas (${qtdPrateleiras}x) — ${larguraCorpo}×${profPrat}mm`,
        rotuloMdfInterno,
        espInt,
        areaUmaPrat * qtdPrateleiras,
        'm²',
        custoMdfInterno,
        effectiveMarkup,
      ),
    )
    // Fita de borda na frente de cada prateleira
    perimetroFitaMm += qtdPrateleiras * larguraCorpo * escala
  }

  // 5. Portas (MDF Externo) e Ferragens de Porta (para perfis de caixa)
  if (!isAbertoPainel && qtdPortas > 0 && tipoPorta !== 'nenhum') {
    const largPorta = Math.round(larguraEntreLateraisExt / qtdPortas)
    const altPorta = Math.max(100, A - 2 * espExt)
    const areaUmaPorta = ((largPorta * altPorta) / 1_000_000) * PERDA * escala

    pecas.push(
      criarPeca(
        'bom-portas-folhas',
        `Folhas de Porta (${qtdPortas}x ${tipoPorta}) — ${largPorta}×${altPorta}mm`,
        rotuloMdfExterno,
        espExt,
        areaUmaPorta * qtdPortas,
        'm²',
        custoMdfExterno,
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
  // Com divisórias / corpos, as gavetas ocupam a largura do corpo (ex: ~745mm em vez de 1520mm)
  if (qtdGavetas > 0) {
    // Se houver divisórias, as gavetas correm dentro do corpo gaveteiro com folga adequada
    const largFrenteGav = Math.max(100, qtdDivisorias > 0 ? larguraCorpo : larguraEntreLateraisExt)
    const altFrenteGav = Math.max(100, Math.round(500 / qtdGavetas) || 160)
    const areaFrentes = ((largFrenteGav * altFrenteGav) / 1_000_000) * PERDA * escala

    // Frente da gaveta em MDF Externo
    pecas.push(
      criarPeca(
        'bom-gavetas-frentes',
        `Frentes de Gaveta (${qtdGavetas}x) — ${largFrenteGav}×${altFrenteGav}mm`,
        rotuloMdfExterno,
        espExt,
        areaFrentes * qtdGavetas,
        'm²',
        custoMdfExterno,
        effectiveMarkup,
      ),
    )

    // Fita de borda no contorno de cada frente de gaveta
    perimetroFitaMm += qtdGavetas * 2 * (largFrenteGav + altFrenteGav) * escala

    // Caixote interno da gaveta (laterais e contra-frente/traseira em MDF Interno 15mm)
    // O caixote interno corre dentro do corpo (larguraCorpo - folga para corrediças de 30mm)
    const profGaveta = Math.max(150, profInterna - 50)
    const largCaixoteGav = Math.max(100, larguraCorpo - 30)
    const altCaixote = Math.max(80, altFrenteGav - 40)
    // 2 laterais + 2 travessas (contra-frente e traseira)
    const areaCaixotePorGav =
      ((2 * profGaveta * altCaixote + 2 * largCaixoteGav * altCaixote) / 1_000_000) * PERDA * escala

    pecas.push(
      criarPeca(
        'bom-gavetas-caixotes',
        `Caixotes de Gaveta (${qtdGavetas}x internos) — MDF 15mm`,
        rotuloMdfInterno,
        espInt,
        areaCaixotePorGav * qtdGavetas,
        'm²',
        custoMdfInterno,
        effectiveMarkup,
      ),
    )

    // Fundo da gaveta (MDF 6mm)
    const areaFundoGavPorGav = ((largCaixoteGav * profGaveta) / 1_000_000) * PERDA * escala
    pecas.push(
      criarPeca(
        'bom-gavetas-fundos',
        `Fundos de Gaveta (${qtdGavetas}x) — ${largCaixoteGav}×${profGaveta}mm MDF 6mm`,
        rotuloMdfFundo,
        6,
        areaFundoGavPorGav * qtdGavetas,
        'm²',
        custoMdfFundo,
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

  // 7. Cabideiro: calculado conforme qtdCabideiros (ex: 2 corpos = 2 cabideiros)
  if (qtdCabideiros > 0) {
    const cabideiroMat = findItemCatalogo(catalogoPrecos, ['cabideiro', 'tubo'])
    const unitCostCabideiro = cabideiroMat ? Number(cabideiroMat.preco_custo) || 50.0 : 50.0

    pecas.push({
      id: 'bom-acessorio-cabideiro',
      description: cabideiroMat
        ? `Tubo Cabideiro com suportes laterais (${qtdCabideiros}x)`
        : `Tubo Cabideiro com suportes (${qtdCabideiros}x) — Estimado`,
      material: 'Ferragem',
      metragem: qtdCabideiros,
      unidade: cabideiroMat?.unidade === 'm' ? 'm' : 'un',
      unitCost: unitCostCabideiro,
      totalCost: round2(unitCostCabideiro * qtdCabideiros),
      markup: effectiveMarkup,
      salePrice: round2(unitCostCabideiro * qtdCabideiros * effectiveMarkup),
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

  // 10. Iluminação / Perfil LED (se ativado na composição)
  if (composicao.iluminacaoLed) {
    const perfilLedMat = findItemCatalogo(catalogoPrecos, ['led', 'perfil'])
    const unitCostLed = perfilLedMat ? Number(perfilLedMat.preco_custo) || 85.0 : 85.0
    // Metragem estimada de LED baseada na largura do módulo (em metros lineares, mínimo 1m)
    const metrosLed = Math.max(1, Math.round((L / 1000) * 10) / 10)

    pecas.push({
      id: 'bom-acessorio-led',
      description: perfilLedMat
        ? `Kit Iluminação LED de Embutir + Fonte Slim (${metrosLed}m)`
        : `Kit Iluminação / Fita LED de Embutir + Fonte Slim (${metrosLed}m) — Estimado`,
      material: 'Ferragem',
      metragem: metrosLed,
      unidade: 'm',
      unitCost: unitCostLed,
      totalCost: round2(unitCostLed * metrosLed),
      markup: effectiveMarkup,
      salePrice: round2(unitCostLed * metrosLed * effectiveMarkup),
      item_nao_cadastrado: !perfilLedMat,
      catalogo_id: perfilLedMat?.id || null,
    })
  }

  // 11. Fita de Borda consolidada para o módulo decomposto
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
