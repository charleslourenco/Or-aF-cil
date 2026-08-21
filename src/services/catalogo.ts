import { supabase } from '@/lib/supabase/client'

/** Categorias de material aceitas pelo catálogo. */
export const CATEGORIAS_MATERIAL = [
  'MDF 15mm',
  'MDF 18mm',
  'MDF 6mm',
  'Fita de Borda',
  'Ferragem',
] as const

export type CategoriaMaterial = (typeof CATEGORIAS_MATERIAL)[number]

/** Unidades de medida aceitas pelo catálogo. */
export const UNIDADES_MATERIAL = ['m²', 'm', 'un', 'par'] as const
export type UnidadeMaterial = (typeof UNIDADES_MATERIAL)[number]

/** Nível padrão do material. */
export type NivelPadrao = 'padrao' | 'premium'

/** Interface que reflete a tabela `CatalogoMateriais` no Supabase. */
export interface CatalogoMaterial {
  id: string
  nome_material: string
  categoria: string
  unidade: string
  preco_custo: number
  nivel_padrao: string
  ativo: boolean
  created_at: string
  updated_at: string
}

/** Payload de criação/atualização de um material. */
export interface CatalogoMaterialInput {
  nome_material: string
  categoria: string
  unidade: string
  preco_custo: number
  nivel_padrao?: string
  ativo?: boolean
}

/**
 * Busca todos os materiais ATIVOS da tabela `CatalogoMateriais`,
 * ordenados por categoria e nome.
 *
 * Retorna `null` em caso de erro (para que o chamador possa distinguir
 * "tabela vazia" de "falha de conexão" e acionar o estado de erro).
 */
export async function fetchCatalogoMateriais(): Promise<CatalogoMaterial[] | null> {
  try {
    const { data, error } = await supabase
      .from('CatalogoMateriais')
      .select(
        'id, nome_material, categoria, unidade, preco_custo, nivel_padrao, ativo, created_at, updated_at',
      )
      .eq('ativo', true)
      .order('categoria')
      .order('nome_material')

    if (error) {
      console.error('Erro ao buscar catálogo de materiais:', error.message ?? error)
      return null
    }

    return (data ?? []) as CatalogoMaterial[]
  } catch (err) {
    console.error('Erro inesperado ao buscar catálogo de materiais:', err)
    return null
  }
}

/** Cria um novo material no catálogo. */
export async function createMaterial(
  data: CatalogoMaterialInput,
): Promise<CatalogoMaterial | null> {
  try {
    const { data: created, error } = await supabase
      .from('CatalogoMateriais')
      .insert({
        nome_material: data.nome_material,
        categoria: data.categoria,
        unidade: data.unidade,
        preco_custo: data.preco_custo,
        nivel_padrao: data.nivel_padrao ?? 'padrao',
        ativo: data.ativo ?? true,
      })
      .select(
        'id, nome_material, categoria, unidade, preco_custo, nivel_padrao, ativo, created_at, updated_at',
      )
      .single()

    if (error) {
      console.error('Erro ao criar material:', error.message ?? error)
      return null
    }

    return created as CatalogoMaterial
  } catch (err) {
    console.error('Erro inesperado ao criar material:', err)
    return null
  }
}

/** Atualiza um material existente. */
export async function updateMaterial(
  id: string,
  data: CatalogoMaterialInput,
): Promise<CatalogoMaterial | null> {
  try {
    const { data: updated, error } = await supabase
      .from('CatalogoMateriais')
      .update({
        nome_material: data.nome_material,
        categoria: data.categoria,
        unidade: data.unidade,
        preco_custo: data.preco_custo,
        nivel_padrao: data.nivel_padrao ?? 'padrao',
        ativo: data.ativo ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(
        'id, nome_material, categoria, unidade, preco_custo, nivel_padrao, ativo, created_at, updated_at',
      )
      .single()

    if (error) {
      console.error('Erro ao atualizar material:', error.message ?? error)
      return null
    }

    return updated as CatalogoMaterial
  } catch (err) {
    console.error('Erro inesperado ao atualizar material:', err)
    return null
  }
}

/** Soft-delete: marca o material como inativo (ativo = false). */
export async function deleteMaterial(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('CatalogoMateriais')
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('Erro ao excluir material:', error.message ?? error)
      return false
    }

    return true
  } catch (err) {
    console.error('Erro inesperado ao excluir material:', err)
    return false
  }
}
