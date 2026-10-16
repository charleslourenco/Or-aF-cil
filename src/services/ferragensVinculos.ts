import { supabase } from '@/lib/supabase/client'
import type { CatalogoMaterial } from '@/services/catalogo'

export interface FerragemVinculo {
  id: string
  nome_ferragem: string
  catalogo_material_id: string | null
  created_at: string
  updated_at: string
  catalogo?: CatalogoMaterial | null
}

export interface VinculoComDetalhes {
  id?: string
  nome_ferragem: string
  catalogo_material_id: string | null
  nome_material?: string | null
  preco_custo?: number | null
  estoque_qtd?: number | null
  unidade?: string | null
  categoria?: string | null
}

/**
 * Busca todos os vínculos de ferragens cadastrados, com join opcional em CatalogoMateriais.
 */
export async function fetchFerragensVinculos(): Promise<{
  data: FerragemVinculo[]
  mapVinculos: Map<string, VinculoComDetalhes>
  error: string | null
}> {
  try {
    const { data, error } = await supabase
      .from('ferragens_vinculos')
      .select(`
        id,
        nome_ferragem,
        catalogo_material_id,
        created_at,
        updated_at,
        catalogo:CatalogoMateriais (
          id,
          nome_material,
          categoria,
          unidade,
          preco_custo,
          estoque_qtd,
          fornecedor
        )
      `)
      .order('nome_ferragem', { ascending: true })

    if (error) {
      console.error('Erro ao buscar vínculos de ferragens:', error)
      return { data: [], mapVinculos: new Map(), error: error.message }
    }

    const items = (data ?? []) as unknown as FerragemVinculo[]
    const map = new Map<string, VinculoComDetalhes>()

    for (const v of items) {
      const cat = v.catalogo as any
      const info: VinculoComDetalhes = {
        id: v.id,
        nome_ferragem: v.nome_ferragem,
        catalogo_material_id: v.catalogo_material_id,
        nome_material: cat?.nome_material ?? null,
        preco_custo: cat?.preco_custo !== undefined ? Number(cat.preco_custo) : null,
        estoque_qtd: cat?.estoque_qtd !== undefined ? Number(cat.estoque_qtd) : null,
        unidade: cat?.unidade ?? null,
        categoria: cat?.categoria ?? null,
      }
      map.set(v.nome_ferragem, info)
      map.set(v.nome_ferragem.toLowerCase(), info)
    }

    return { data: items, mapVinculos: map, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { data: [], mapVinculos: new Map(), error: msg }
  }
}

/**
 * Salva ou atualiza um vínculo entre um nome genérico de ferragem e um item do CatalogoMateriais.
 * Utiliza upsert pelo índice único `nome_ferragem`.
 */
export async function upsertFerragemVinculo(
  nome_ferragem: string,
  catalogo_material_id: string | null,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const nomeLimpo = nome_ferragem.trim()
    if (!nomeLimpo) {
      return { success: false, error: 'O nome da ferragem é obrigatório.' }
    }

    const { error } = await supabase.from('ferragens_vinculos').upsert(
      {
        nome_ferragem: nomeLimpo,
        catalogo_material_id: catalogo_material_id || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'nome_ferragem' },
    )

    if (error) {
      console.error('Erro ao salvar vínculo de ferragem:', error)
      return { success: false, error: error.message }
    }

    return { success: true, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}

/**
 * Remove o vínculo de uma ferragem.
 */
export async function deleteFerragemVinculo(
  idOuNome: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('ferragens_vinculos')
      .delete()
      .or(`id.eq.${idOuNome},nome_ferragem.eq.${idOuNome}`)

    if (error) {
      return { success: false, error: error.message }
    }
    return { success: true, error: null }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}
