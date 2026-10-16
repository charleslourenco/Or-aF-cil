import { supabase } from '@/lib/supabase/client'
import type { PerfilConstrutivo } from '@/services/templates'
import type { RegrasParametricasJson } from '@/lib/parametricEvaluator'

export interface TemplateEngenhariaParametrico {
  id: string
  nome_template: string
  perfil_construtivo: PerfilConstrutivo | string | null
  assinatura_visual: string[]
  regras_json: RegrasParametricasJson
  ativo: boolean
  // Indicador de origem para o frontend
  origem_tabela?: 'templatesengenharia' | 'TemplatesEngenharia'
}

export interface FetchParametricosParams {
  termo?: string
  ambiente?: string
  tipoTag?: string
  page?: number
  pageSize?: number
}

export interface FetchParametricosResult {
  data: TemplateEngenhariaParametrico[]
  total: number
  hasMore: boolean
  error: string | null
}

/**
 * Normaliza o campo assinatura_visual para um array de strings seguro.
 */
export function normalizarAssinaturaVisual(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
      .filter(Boolean)
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return normalizarAssinaturaVisual(parsed)
    } catch {
      return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }
  }
  return []
}

/**
 * Busca módulos paramétricos da tabela `templatesengenharia` (minúsculo),
 * filtrando por ativo = true, com suporte a paginação por range, busca por nome/tag
 * e contagem exata para paginação fluida e botão "Carregar mais".
 */
export async function fetchTemplatesEngenhariaParametricos(
  params: FetchParametricosParams = {},
): Promise<FetchParametricosResult> {
  const { termo, ambiente, tipoTag, page = 0, pageSize = 24 } = params

  try {
    const from = page * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('templatesengenharia')
      .select('id, nome_template, perfil_construtivo, assinatura_visual, regras_json, ativo', {
        count: 'exact',
      })
      .eq('ativo', true)

    if (termo && termo.trim()) {
      const cleanTerm = termo.trim()
      query = query.ilike('nome_template', `%${cleanTerm}%`)
    }

    if (ambiente && ambiente !== 'Todos') {
      const ambLower = ambiente.toLowerCase()
      // Filtra no jsonb ou busca textual simples
      query = query.ilike('assinatura_visual::text', `%"${ambLower}"%`)
    }

    if (tipoTag && tipoTag !== 'Todos') {
      const tagLower = tipoTag.toLowerCase()
      query = query.ilike('assinatura_visual::text', `%"${tagLower}"%`)
    }

    query = query.order('nome_template', { ascending: true }).range(from, to)

    const { data, count, error } = await query

    if (error) {
      console.error('Erro ao buscar templatesengenharia (minúsculo):', error)
      return { data: [], total: 0, hasMore: false, error: error.message }
    }

    const items: TemplateEngenhariaParametrico[] = (data ?? []).map((row: any) => ({
      id: row.id,
      nome_template: row.nome_template || 'Módulo Paramétrico Sem Nome',
      perfil_construtivo: row.perfil_construtivo || 'Fechado Envelopado',
      assinatura_visual: normalizarAssinaturaVisual(row.assinatura_visual),
      regras_json: row.regras_json && typeof row.regras_json === 'object' ? row.regras_json : {},
      ativo: Boolean(row.ativo),
      origem_tabela: 'templatesengenharia',
    }))

    const total = count ?? items.length
    const hasMore = to < total - 1

    return {
      data: items,
      total,
      hasMore,
      error: null,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Exceção ao buscar templatesengenharia:', msg)
    return { data: [], total: 0, hasMore: false, error: msg }
  }
}

/**
 * Busca todas as tags únicas de assinatura_visual e nomes de ferragens dos módulos paramétricos.
 */
export async function fetchMetadadosParametricos(): Promise<{
  tags: string[]
  ferragensNomes: string[]
  error: string | null
}> {
  try {
    const { data, error } = await supabase
      .from('templatesengenharia')
      .select('assinatura_visual, regras_json')
      .eq('ativo', true)

    if (error) {
      return { tags: [], ferragensNomes: [], error: error.message }
    }

    const tagSet = new Set<string>()
    const ferragemSet = new Set<string>()

    for (const row of data ?? []) {
      const tags = normalizarAssinaturaVisual((row as any).assinatura_visual)
      for (const t of tags) {
        if (t) tagSet.add(t.toLowerCase())
      }

      const r = (row as any).regras_json
      if (r && Array.isArray(r.ferragens)) {
        for (const f of r.ferragens) {
          const item = (f?.item || '').trim()
          if (item) ferragemSet.add(item)
        }
      }
    }

    return {
      tags: Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
      ferragensNomes: Array.from(ferragemSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
      error: null,
    }
  } catch (err) {
    return {
      tags: [],
      ferragensNomes: [],
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
