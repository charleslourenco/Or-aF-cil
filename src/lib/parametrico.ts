import { evaluate } from 'mathjs'
import type { BudgetItem } from '@/data/mockData'
import type { MdfSpec, PadraoProjeto } from '@/lib/pricing'
import { MARKUP_PADRAO, PERDA_PERCENT_PADRAO } from '@/lib/pricing'
import type { CatalogoMaterial } from '@/services/catalogo'
import type { FerragemVinculo, VinculoComDetalhes } from '@/services/ferragensVinculos'
import type {
  RegrasParametricasJson,
  TemplateEngenhariaParametrico,
} from '@/services/templatesParametricos'

export type TemplateParametrico = TemplateEngenhariaParametrico
export type VinculoFerragem = FerragemVinculo | VinculoComDetalhes

export interface EntradaParametrica {
  template: TemplateParametrico
  dimensoes: { largura: number; altura: number; profundidade: number }
  espessuraCaixaria: 15 | 18
  mdfExterno: MdfSpec
  mdfInterno: MdfSpec
  mdfFundo: string
  padraoProjeto: PadraoProjeto
  catalogo: CatalogoMaterial[]
  vinculos: VinculoFerragem[]
  markup: number
  perdaPercent: number
}

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100
}

function normalizarExpressao(expr: string | number): string {
  if (typeof expr === 'number') return expr.toString()
  if (!expr || typeof expr !== 'string') return '0'
  return expr
    .trim()
    .replace(/[–—−]/g, '-')
    .replace(/×/g, '*')
    .replace(/\s+/g, ' ')
}

export function avaliarFormulaSegura(
  expr: string | number,
  scope: Record<string, number>,
): { valor: number; erro?: string } {
  try {
    const raw = normalizarExpressao(expr)
    const numDirect = Number(raw)
    if (!isNaN(numDirect) && raw.trim() !== '') {
      return { valor: Math.max(0, Math.round(numDirect * 100) / 100) }
    }
    const resultado = evaluate(raw, scope)
    if (typeof resultado === 'number' && !isNaN(resultado) && isFinite(resultado)) {
      return { valor: Math.max(0, Math.round(resultado * 100) / 100) }
    }
    return {
      valor: 0,
      erro: `Resultado inválido (${resultado}) para expressão "${expr}"`,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      valor: 0,
      erro: `Erro na fórmula "${expr}": ${msg}`,
    }
  }
}

const CATEGORIA_POR_ESPESSURA: Record<number, string> = {
  18: 'MDF 18mm',
  15: 'MDF 15mm',
  6: 'MDF 6mm',
}

function buscarCustoMdf(
  nome: string | undefined,
  espessuraFallback: number,
  catalogo: CatalogoMaterial[],
  padraoProjeto: PadraoProjeto,
): number {
  if (catalogo.length === 0) {
    if (espessuraFallback === 18) return 65
    if (espessuraFallback === 15) return 50
    return 25
  }

  const normalizarNome = (str?: string) => (str || '').trim().toLowerCase().replace(/\s+/g, ' ')

  if (nome && nome.trim()) {
    const nomeNorm = normalizarNome(nome)
    const exato = catalogo.find(
      (m) => normalizarNome(m.nome_material) === nomeNorm && Number(m.preco_custo) > 0,
    )
    if (exato) return Number(exato.preco_custo)

    // Tenta partial match
    const parcial = catalogo.find(
      (m) =>
        (normalizarNome(m.nome_material).includes(nomeNorm) ||
          nomeNorm.includes(normalizarNome(m.nome_material))) &&
        Number(m.preco_custo) > 0,
    )
    if (parcial) return Number(parcial.preco_custo)
  }

  // Fallback por categoria e nível de padrão
  const categoriaNome = CATEGORIA_POR_ESPESSURA[espessuraFallback] || 'MDF 18mm'
  const daCategoria = catalogo.filter((m) => m.categoria === categoriaNome)
  if (daCategoria.length > 0) {
    const nivelDesejado = padraoProjeto === 'premium' ? 'premium' : 'padrao'
    const matchNivel = daCategoria.find((m) => m.nivel_padrao === nivelDesejado)
    const escolhido = matchNivel ?? daCategoria[0]
    return Number(escolhido.preco_custo) || 0
  }

  if (espessuraFallback === 18) return 65
  if (espessuraFallback === 15) return 50
  return 25
}

export function calcularBOMParametrico(entrada: EntradaParametrica): BudgetItem[] {
  const {
    template,
    dimensoes,
    espessuraCaixaria,
    mdfExterno,
    mdfInterno,
    mdfFundo,
    padraoProjeto,
    catalogo = [],
    vinculos = [],
    markup,
    perdaPercent,
  } = entrada

  if (!template || !dimensoes?.largura || !dimensoes?.altura || !dimensoes?.profundidade) {
    return []
  }

  const effectiveMarkup = typeof markup === 'number' && markup > 0 ? markup : MARKUP_PADRAO
  const perdaVal =
    typeof perdaPercent === 'number' && perdaPercent >= 0 && perdaPercent < 100
      ? perdaPercent
      : PERDA_PERCENT_PADRAO
  const PERDA = 1 + perdaVal / 100

  const scope: Record<string, number> = {
    largura: Number(dimensoes.largura) || 0,
    altura: Number(dimensoes.altura) || 0,
    profundidade: Number(dimensoes.profundidade) || 0,
    espessura_caixaria: espessuraCaixaria || 18,
  }

  const regras: RegrasParametricasJson = (template.regras_json || {}) as RegrasParametricasJson
  const componentes = Array.isArray(regras.componentes) ? regras.componentes : []
  const ferragens = Array.isArray(regras.ferragens) ? regras.ferragens : []

  // Preços de MDF por slot
  const espInt = mdfInterno?.espessura === 15 ? 15 : 18
  const espExt = mdfExterno?.espessura === 15 ? 15 : 18

  const custoInterno = buscarCustoMdf(mdfInterno?.cor, espInt, catalogo, padraoProjeto)
  const custoExterno = buscarCustoMdf(mdfExterno?.cor, espExt, catalogo, padraoProjeto)
  const custoFundo = buscarCustoMdf(mdfFundo, 6, catalogo, padraoProjeto)

  const nomeInterno = mdfInterno?.cor
    ? `MDF Interno — ${mdfInterno.cor} ${espInt}mm`
    : `MDF Interno ${espInt}mm`
  const nomeExterno = mdfExterno?.cor
    ? `MDF Externo — ${mdfExterno.cor} ${espExt}mm`
    : `MDF Externo ${espExt}mm`
  const nomeFundo = mdfFundo?.trim() ? `MDF Fundo — ${mdfFundo.trim()}` : 'MDF Fundo 6mm'

  // Mapa de vínculos para busca rápida
  const vinculosMap = new Map<string, VinculoFerragem>()
  for (const v of vinculos) {
    if (v.nome_ferragem) {
      vinculosMap.set(v.nome_ferragem, v)
      vinculosMap.set(v.nome_ferragem.toLowerCase(), v)
    }
  }

  const items: BudgetItem[] = []

  // 1) Componentes MDF
  componentes.forEach((comp, idx) => {
    const rawDesc = comp.descricao?.trim() || `Peça ${idx + 1}`
    const slot = comp.slot_material || 'caixaria_interna'

    let qtd = 1
    if (typeof comp.quantidade === 'number') {
      qtd = Math.max(1, comp.quantidade)
    } else if (typeof comp.quantidade === 'string') {
      const parsed = parseInt(comp.quantidade, 10)
      qtd = isNaN(parsed) ? 1 : Math.max(1, parsed)
    }

    const altRes = avaliarFormulaSegura(comp.altura, scope)
    const largRes = avaliarFormulaSegura(comp.largura, scope)
    const temErro = Boolean(altRes.erro || largRes.erro)

    const altMm = altRes.valor
    const largMm = largRes.valor

    let materialNome = nomeInterno
    let custoUnit = custoInterno
    let espessura = espInt

    if (slot === 'frentes_externas') {
      materialNome = nomeExterno
      custoUnit = custoExterno
      espessura = espExt
    } else if (slot === 'fundo') {
      materialNome = nomeFundo
      custoUnit = custoFundo
      espessura = 6
    }

    const qtdEfetiva = temErro ? 0 : qtd
    const areaM2 = temErro ? 0 : round2(((qtdEfetiva * altMm * largMm) / 1_000_000) * PERDA)
    const totalCost = round2(areaM2 * custoUnit)
    const salePrice = round2(totalCost * effectiveMarkup)

    const item: BudgetItem = {
      id: `bom-prm-peca-${idx + 1}-${rawDesc.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      description: `${rawDesc} (${altMm}×${largMm} mm)`,
      material: materialNome,
      espessura,
      metragem: areaM2,
      unidade: 'm²',
      unitCost: custoUnit,
      totalCost,
      markup: effectiveMarkup,
      salePrice,
    }

    if (temErro) {
      item.erro_formula = true
    }

    items.push(item)
  })

  // 2) Ferragens
  ferragens.forEach((ferr, idx) => {
    const rawNome = (ferr.item || `Ferragem ${idx + 1}`).trim()

    let qtd = 1
    if (typeof ferr.quantidade === 'number') {
      qtd = Math.max(1, ferr.quantidade)
    } else if (typeof ferr.quantidade === 'string') {
      const parsed = parseInt(ferr.quantidade, 10)
      qtd = isNaN(parsed) ? 1 : Math.max(1, parsed)
    }

    const vinculo =
      vinculosMap.get(rawNome) ||
      vinculosMap.get(rawNome.toLowerCase()) ||
      Array.from(vinculosMap.values()).find(
        (v) => (v.nome_ferragem || '').toLowerCase() === rawNome.toLowerCase(),
      )

    const catId = vinculo?.catalogo_material_id || null
    let catItem: CatalogoMaterial | undefined

    if (catId) {
      catItem = catalogo.find((m) => m.id === catId)
    }

    const vinculoComDetalhes = vinculo as VinculoComDetalhes | undefined
    const nomeMaterialVinculado =
      catItem?.nome_material ||
      vinculoComDetalhes?.nome_material ||
      (vinculo as any)?.catalogo?.nome_material ||
      null

    const precoCusto =
      catItem?.preco_custo !== undefined
        ? Number(catItem.preco_custo)
        : vinculoComDetalhes?.preco_custo !== undefined && vinculoComDetalhes.preco_custo !== null
          ? Number(vinculoComDetalhes.preco_custo)
          : (vinculo as any)?.catalogo?.preco_custo !== undefined
            ? Number((vinculo as any).catalogo.preco_custo)
            : null

    const unidade =
      catItem?.unidade ||
      vinculoComDetalhes?.unidade ||
      (vinculo as any)?.catalogo?.unidade ||
      ferr.unidade ||
      'un'

    const temVinculo = Boolean(catId && precoCusto !== null && !isNaN(precoCusto))

    const custoUnit = temVinculo ? Number(precoCusto) : 0
    const totalCost = round2(qtd * custoUnit)
    const salePrice = round2(totalCost * effectiveMarkup)

    const descFinal = temVinculo ? nomeMaterialVinculado || rawNome : `${rawNome} (sem vínculo)`

    const item: BudgetItem = {
      id: `bom-prm-ferr-${idx + 1}-${rawNome.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      description: descFinal,
      material: catItem?.categoria || 'Ferragem',
      espessura: 0,
      metragem: qtd,
      unidade: unidade as 'un' | 'par' | 'm' | 'm²',
      unitCost: custoUnit,
      totalCost,
      markup: effectiveMarkup,
      salePrice,
      catalogo_id: catId,
    }

    if (!temVinculo) {
      item.item_nao_cadastrado = true
    }

    items.push(item)
  })

  return items
}
