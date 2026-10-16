import { avaliarFormulaSegura } from '@/lib/parametrico'

export type SlotMaterial = 'caixaria_interna' | 'frentes_externas' | 'fundo' | string

export interface RegraComponente {
  descricao: string
  altura: string | number
  largura: string | number
  quantidade: number | string
  slot_material?: SlotMaterial
}

export interface RegraFerragem {
  item: string
  quantidade: number | string
  unidade?: string
}

export interface RegrasParametricasJson {
  componentes?: RegraComponente[]
  ferragens?: RegraFerragem[]
  [key: string]: unknown
}

export interface DimensoesParametricas {
  largura: number
  altura: number
  profundidade: number
  espessura_caixaria?: number
}

export interface PecaCalculada {
  descricao: string
  slot_material: SlotMaterial
  alturaCalculada: number
  larguraCalculada: number
  quantidade: number
  areaM2Total: number
  erro?: string
}

export interface FerragemCalculada {
  item: string
  quantidade: number
  unidade?: string
  catalogoMaterialId?: string | null
  nomeCatalogo?: string | null
  precoUnitario?: number | null
  estoqueQtd?: number | null
  subtotal?: number | null
  vinculado: boolean
}

export interface MaterialResumoCusto {
  slot: SlotMaterial
  nomeMaterial: string
  precoM2: number
  areaTotalM2: number
  custoTotal: number
}

export interface ResultadoCalculoParametrico {
  pecas: PecaCalculada[]
  ferragens: FerragemCalculada[]
  resumoMateriais: Record<string, MaterialResumoCusto>
  custoTotalMdf: number
  custoTotalFerragens: number
  custoTotalGeral: number
  avisos: string[]
}

export { avaliarFormulaSegura }

export interface MateriaisPrecoMap {
  caixaria_interna?: { nome: string; precoM2: number }
  frentes_externas?: { nome: string; precoM2: number }
  fundo?: { nome: string; precoM2: number }
  [key: string]: { nome: string; precoM2: number } | undefined
}

export interface VinculoFerragemInfo {
  nome_ferragem: string
  catalogo_material_id: string | null
  nome_material?: string | null
  preco_custo?: number | null
  estoque_qtd?: number | null
}

/**
 * Calcula todas as peças e ferragens a partir das regras_json,
 * dimensões fornecidas e vínculos de ferragens e materiais de MDF.
 */
export function calcularModuloParametrico(
  regras: RegrasParametricasJson | null | undefined,
  dimensoes: DimensoesParametricas,
  materiaisMdf: MateriaisPrecoMap = {
    caixaria_interna: { nome: 'MDF 18mm Branco TX (Caixaria)', precoM2: 50.0 },
    frentes_externas: { nome: 'MDF 18mm Cor/Madeirado (Frentes)', precoM2: 65.0 },
    fundo: { nome: 'MDF 6mm Branco TX (Fundo)', precoM2: 25.0 },
  },
  vinculosFerragens: Map<string, VinculoFerragemInfo> = new Map(),
): ResultadoCalculoParametrico {
  const avisos: string[] = []

  const scope: Record<string, number> = {
    largura: Number(dimensoes.largura) || 0,
    altura: Number(dimensoes.altura) || 0,
    profundidade: Number(dimensoes.profundidade) || 0,
    espessura_caixaria:
      dimensoes.espessura_caixaria !== undefined ? Number(dimensoes.espessura_caixaria) : 18,
  }

  const pecasCalculadas: PecaCalculada[] = []
  const ferragensCalculadas: FerragemCalculada[] = []

  // 1. Cálculo de Componentes / Peças de MDF
  const componentes = Array.isArray(regras?.componentes) ? regras!.componentes : []

  for (const comp of componentes) {
    const desc = comp.descricao || 'Peça sem descrição'
    const slot = comp.slot_material || 'caixaria_interna'

    let qtd = 1
    if (typeof comp.quantidade === 'number') {
      qtd = Math.max(1, comp.quantidade)
    } else if (typeof comp.quantidade === 'string') {
      const parsedQtd = parseInt(comp.quantidade, 10)
      qtd = isNaN(parsedQtd) ? 1 : Math.max(1, parsedQtd)
    }

    const alturaEval = avaliarFormulaSegura(comp.altura, scope)
    const larguraEval = avaliarFormulaSegura(comp.largura, scope)

    let erro: string | undefined
    if (alturaEval.erro || larguraEval.erro) {
      erro = [alturaEval.erro, larguraEval.erro].filter(Boolean).join('; ')
      avisos.push(`[${desc}] ${erro}`)
    }

    // mm -> m: / 1000, área m² = (altura/1000) * (largura/1000) * quantidade
    const alturaM = alturaEval.valor / 1000
    const larguraM = larguraEval.valor / 1000
    const areaM2Total = Math.round(alturaM * larguraM * qtd * 1000) / 1000

    pecasCalculadas.push({
      descricao: desc,
      slot_material: slot,
      alturaCalculada: alturaEval.valor,
      larguraCalculada: larguraEval.valor,
      quantidade: qtd,
      areaM2Total,
      erro,
    })
  }

  // 2. Cálculo de Ferragens
  const ferragens = Array.isArray(regras?.ferragens) ? regras!.ferragens : []

  for (const ferr of ferragens) {
    const nomeItem = (ferr.item || 'Ferragem').trim()
    let qtd = 1
    if (typeof ferr.quantidade === 'number') {
      qtd = Math.max(1, ferr.quantidade)
    } else if (typeof ferr.quantidade === 'string') {
      const parsedQtd = parseInt(ferr.quantidade, 10)
      qtd = isNaN(parsedQtd) ? 1 : Math.max(1, parsedQtd)
    }

    // Busca vínculo no Map (case-insensitive)
    const vinculo =
      vinculosFerragens.get(nomeItem) ||
      Array.from(vinculosFerragens.values()).find(
        (v) => v.nome_ferragem.toLowerCase() === nomeItem.toLowerCase(),
      )

    const vinculado = Boolean(vinculo && vinculo.catalogo_material_id)
    const precoUnit = vinculado ? Number(vinculo?.preco_custo) || 0 : null
    const subtotal = precoUnit !== null ? Math.round(precoUnit * qtd * 100) / 100 : null

    ferragensCalculadas.push({
      item: nomeItem,
      quantidade: qtd,
      unidade: ferr.unidade || 'un',
      catalogoMaterialId: vinculo?.catalogo_material_id ?? null,
      nomeCatalogo: vinculo?.nome_material ?? null,
      precoUnitario: precoUnit,
      estoqueQtd: vinculo?.estoque_qtd !== undefined ? vinculo.estoque_qtd : null,
      subtotal,
      vinculado,
    })
  }

  // 3. Resumo por Material (área somada por slot e custo de MDF)
  const resumoMateriais: Record<string, MaterialResumoCusto> = {}

  for (const peca of pecasCalculadas) {
    const slot = peca.slot_material
    const matConfig = materiaisMdf[slot] || {
      nome:
        slot === 'fundo'
          ? 'MDF 6mm Fundo'
          : slot === 'frentes_externas'
            ? 'MDF 18mm Frentes'
            : 'MDF 18mm Caixaria',
      precoM2: slot === 'fundo' ? 25.0 : slot === 'frentes_externas' ? 65.0 : 50.0,
    }

    if (!resumoMateriais[slot]) {
      resumoMateriais[slot] = {
        slot,
        nomeMaterial: matConfig.nome,
        precoM2: matConfig.precoM2,
        areaTotalM2: 0,
        custoTotal: 0,
      }
    }

    resumoMateriais[slot].areaTotalM2 += peca.areaM2Total
  }

  // Arredonda as áreas e calcula custo por material
  let custoTotalMdf = 0
  for (const slotKey of Object.keys(resumoMateriais)) {
    const item = resumoMateriais[slotKey]
    item.areaTotalM2 = Math.round(item.areaTotalM2 * 1000) / 1000
    item.custoTotal = Math.round(item.areaTotalM2 * item.precoM2 * 100) / 100
    custoTotalMdf += item.custoTotal
  }

  // 4. Custo total de ferragens vinculadas
  let custoTotalFerragens = 0
  for (const f of ferragensCalculadas) {
    if (f.subtotal !== null && f.subtotal !== undefined) {
      custoTotalFerragens += f.subtotal
    }
  }

  const custoTotalGeral = Math.round((custoTotalMdf + custoTotalFerragens) * 100) / 100

  return {
    pecas: pecasCalculadas,
    ferragens: ferragensCalculadas,
    resumoMateriais,
    custoTotalMdf: Math.round(custoTotalMdf * 100) / 100,
    custoTotalFerragens: Math.round(custoTotalFerragens * 100) / 100,
    custoTotalGeral,
    avisos,
  }
}
