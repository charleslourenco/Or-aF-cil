import { supabase } from '@/lib/supabase/client'

/** Categorias de material aceitas pelo catálogo e itens avulsos (taxonomia única). */
export const CATEGORIAS_MATERIAL = [
  'MDF 15mm',
  'MDF 18mm',
  'MDF 6mm',
  'Fita de Borda',
  'Ferragem',
  'Iluminação',
  'Componentes Elétricos',
  'Parafusos e Sistemas de Fixação',
  'Acessórios',
  'Serralheria Terceirizada',
  'Estofaria Terceirizada',
  'Instalação',
  'Outro',
] as const

export type CategoriaMaterial = (typeof CATEGORIAS_MATERIAL)[number]

/** Interface da tabela `CategoriasPersonalizadas`. */
export interface CategoriaPersonalizada {
  id: string
  nome: string
  criada_em: string
}

/**
 * Normaliza o nome da categoria:
 * - trim no início e fim
 * - colapso de múltiplos espaços internos para um espaço simples
 */
export function normalizarNomeCategoria(nome: string): string {
  return nome.trim().replace(/\s+/g, ' ')
}

/**
 * Verifica se um nome pertence à taxonomia fixa de 13 categorias (case-insensitive e normalizado).
 */
export function isCategoriaFixa(nome: string): boolean {
  const norm = normalizarNomeCategoria(nome).toLowerCase()
  return CATEGORIAS_MATERIAL.some((cat) => cat.toLowerCase() === norm)
}

/**
 * Helper de lista combinada (fixas + personalizadas, dedup case-insensitive).
 * As 13 categorias fixas vêm primeiro, mantendo sua ordem original,
 * seguidas pelas personalizadas (ordenadas alfabeticamente).
 */
export function getListaCombinadaCategorias(
  categoriasPersonalizadas: (string | CategoriaPersonalizada)[] = [],
): string[] {
  const fixasLower = new Set(CATEGORIAS_MATERIAL.map((c) => c.toLowerCase()))
  const extras: string[] = []

  for (const item of categoriasPersonalizadas) {
    const nomeOriginal = typeof item === 'string' ? item : item?.nome
    if (!nomeOriginal) continue
    const nomeNorm = normalizarNomeCategoria(nomeOriginal)
    if (!nomeNorm) continue

    const lower = nomeNorm.toLowerCase()
    if (!fixasLower.has(lower) && !extras.some((e) => e.toLowerCase() === lower)) {
      extras.push(nomeNorm)
    }
  }

  extras.sort((a, b) => a.localeCompare(b, 'pt-BR'))
  return [...CATEGORIAS_MATERIAL, ...extras]
}

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
export async function fetchCatalogoMateriais(
  timeoutMs: number = 10000,
): Promise<CatalogoMaterial[] | null> {
  try {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Timeout ao carregar catálogo de materiais (${timeoutMs / 1000}s)`))
      }, timeoutMs)
    })

    const queryPromise = supabase
      .from('CatalogoMateriais')
      .select(
        'id, nome_material, categoria, unidade, preco_custo, nivel_padrao, ativo, created_at, updated_at',
      )
      .eq('ativo', true)
      .order('categoria')
      .order('nome_material')

    try {
      const response = (await Promise.race([queryPromise, timeoutPromise])) as Awaited<
        typeof queryPromise
      >

      if (timeoutId) clearTimeout(timeoutId)

      const { data, error } = response

      if (error) {
        console.error('Erro ao buscar catálogo de materiais:', error.message ?? error)
        return null
      }

      return (data ?? []) as CatalogoMaterial[]
    } catch (raceErr) {
      if (timeoutId) clearTimeout(timeoutId)
      throw raceErr
    }
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

/**
 * Busca todas as categorias personalizadas cadastradas, ordenadas por nome.
 */
export async function listarCategoriasPersonalizadas(): Promise<CategoriaPersonalizada[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('CategoriasPersonalizadas')
      .select('id, nome, criada_em')
      .order('nome')

    if (error) {
      console.error('Erro ao listar categorias personalizadas:', error.message ?? error)
      return []
    }

    return (data ?? []) as CategoriaPersonalizada[]
  } catch (err) {
    console.error('Erro inesperado ao listar categorias personalizadas:', err)
    return []
  }
}

export interface CriarCategoriaResult {
  success: boolean
  categoria?: CategoriaPersonalizada
  error?: string
}

/**
 * Cria uma nova categoria personalizada.
 * Valida:
 * - nome não vazio
 * - não conflitar com as 13 categorias fixas (case-insensitive)
 * - não duplicar categoria já existente (case-insensitive)
 */
export async function criarCategoriaPersonalizada(nome: string): Promise<CriarCategoriaResult> {
  const normalizado = normalizarNomeCategoria(nome)

  if (!normalizado) {
    return { success: false, error: 'O nome da categoria não pode estar em branco.' }
  }

  if (isCategoriaFixa(normalizado)) {
    return {
      success: false,
      error: `"${normalizado}" é uma categoria padrão do sistema e já existe.`,
    }
  }

  try {
    // Consulta duplicados case-insensitive
    const { data: existentes, error: checkError } = await (supabase as any)
      .from('CategoriasPersonalizadas')
      .select('id, nome')
      .ilike('nome', normalizado)

    if (checkError) {
      console.error('Erro ao checar existência da categoria:', checkError.message ?? checkError)
    } else if (existentes && (existentes as any[]).length > 0) {
      return {
        success: false,
        error: `A categoria "${(existentes as any[])[0].nome}" já está cadastrada.`,
      }
    }

    const { data, error } = await (supabase as any)
      .from('CategoriasPersonalizadas')
      .insert({ nome: normalizado })
      .select('id, nome, criada_em')
      .single()

    if (error) {
      console.error('Erro ao inserir categoria personalizada:', error.message ?? error)
      return {
        success: false,
        error: error.message || 'Erro ao cadastrar categoria no banco de dados.',
      }
    }

    return { success: true, categoria: data as CategoriaPersonalizada }
  } catch (err) {
    console.error('Erro inesperado ao criar categoria personalizada:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erro inesperado ao criar categoria.',
    }
  }
}

export interface ExcluirCategoriaResult {
  success: boolean
  error?: string
  totalVinculados?: number
}

/**
 * Exclui uma categoria personalizada se não houver materiais vinculados em `CatalogoMateriais`.
 * Caso haja materiais cadastrados com ela, recusa a exclusão informando a contagem.
 */
export async function excluirCategoriaPersonalizada(
  id: string,
  nomeCategoria: string,
): Promise<ExcluirCategoriaResult> {
  if (isCategoriaFixa(nomeCategoria)) {
    return {
      success: false,
      error: 'Categorias padrão do sistema são fixas e não podem ser excluídas.',
    }
  }

  try {
    // 1. Contar quantos materiais no catálogo estão usando essa categoria (inclui ativos e inativos)
    const { count, error: countError } = await supabase
      .from('CatalogoMateriais')
      .select('id', { count: 'exact', head: true })
      .eq('categoria', nomeCategoria)

    if (countError) {
      console.error('Erro ao verificar materiais vinculados:', countError.message ?? countError)
      return {
        success: false,
        error: 'Não foi possível verificar os materiais vinculados à categoria.',
      }
    }

    if (count && count > 0) {
      return {
        success: false,
        totalVinculados: count,
        error: `Existem ${count} material(is) nesta categoria. Reclassifique-os antes de excluir.`,
      }
    }

    // 2. Se não houver nenhum material associado, exclui a categoria
    const { error: deleteError } = await (supabase as any)
      .from('CategoriasPersonalizadas')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Erro ao excluir categoria personalizada:', deleteError.message ?? deleteError)
      return {
        success: false,
        error: deleteError.message || 'Erro ao excluir categoria do banco de dados.',
      }
    }

    return { success: true }
  } catch (err) {
    console.error('Erro inesperado ao excluir categoria:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erro inesperado ao excluir categoria.',
    }
  }
}
