import { supabase } from '@/lib/supabase/client'

export type ModuleIconType = 'wardrobe' | 'counter' | 'aerial'

export interface TemplateEngenharia {
  id: string
  nome_template: string
  categoria?: string | null
  dimensoes?: string | null
  material?: string | null
  descricao?: string | null
  icon_type?: string | null
  assinatura_visual?: string[] | null
}

/** Payload aceito pelas funções de criação/atualização de módulos. */
export type TemplateEngenhariaInput = {
  nome_template: string
  categoria?: string | null
  dimensoes?: string | null
  material?: string | null
  descricao?: string | null
  icon_type?: ModuleIconType | null
  assinatura_visual?: string[] | null
}

/**
 * Busca os módulos de engenharia disponíveis no Supabase (tabela
 * `TemplatesEngenharia`) para popular o catálogo da Biblioteca de forma 100%
 * dinâmica — sem nenhum dado mock/estático no frontend.
 *
 * Retorna `{ data, error }` para que a página consiga distinguir sucesso de
 * falha (necessário para o estado de erro com botão "Tentar novamente").
 */
export async function fetchTemplatesEngenharia(): Promise<{
  data: TemplateEngenharia[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('TemplatesEngenharia')
    .select(
      'id, nome_template, categoria, dimensoes, material, descricao, icon_type, assinatura_visual',
    )
    .order('nome_template')
    .limit(100)

  if (error) {
    console.error('Erro ao buscar módulos da biblioteca (TemplatesEngenharia):', error)
    return { data: [], error: error.message }
  }

  return { data: (data ?? []) as TemplateEngenharia[], error: null }
}

/**
 * Cria (INSERT) um novo módulo na tabela TemplatesEngenharia.
 * Retorna o registro criado.
 */
export async function createTemplateEngenharia(
  payload: TemplateEngenhariaInput,
): Promise<{ data: TemplateEngenharia | null; error: string | null }> {
  const { data, error } = await supabase
    .from('TemplatesEngenharia')
    .insert({
      nome_template: payload.nome_template,
      categoria: payload.categoria ?? null,
      dimensoes: payload.dimensoes ?? null,
      material: payload.material ?? null,
      descricao: payload.descricao ?? null,
      icon_type: payload.icon_type ?? 'wardrobe',
      assinatura_visual: payload.assinatura_visual ?? null,
    })
    .select(
      'id, nome_template, categoria, dimensoes, material, descricao, icon_type, assinatura_visual',
    )
    .single()

  if (error) {
    console.error('Erro ao criar módulo (TemplatesEngenharia):', error)
    return { data: null, error: error.message }
  }

  return { data: data as TemplateEngenharia, error: null }
}

/**
 * Atualiza (UPDATE) um módulo existente na tabela TemplatesEngenharia.
 * Retorna o registro atualizado.
 */
export async function updateTemplateEngenharia(
  id: string,
  payload: TemplateEngenhariaInput,
): Promise<{ data: TemplateEngenharia | null; error: string | null }> {
  const { data, error } = await supabase
    .from('TemplatesEngenharia')
    .update({
      nome_template: payload.nome_template,
      categoria: payload.categoria ?? null,
      dimensoes: payload.dimensoes ?? null,
      material: payload.material ?? null,
      descricao: payload.descricao ?? null,
      icon_type: payload.icon_type ?? 'wardrobe',
      assinatura_visual: payload.assinatura_visual ?? null,
    })
    .eq('id', id)
    .select(
      'id, nome_template, categoria, dimensoes, material, descricao, icon_type, assinatura_visual',
    )
    .single()

  if (error) {
    console.error('Erro ao atualizar módulo (TemplatesEngenharia):', error)
    return { data: null, error: error.message }
  }

  return { data: data as TemplateEngenharia, error: null }
}

/** Normaliza o tipo de ícone vindo do banco para os tipos aceitos pelo blueprint. */
export function normalizeIconType(type?: string | null): ModuleIconType {
  if (type === 'counter' || type === 'aerial') return type
  return 'wardrobe'
}
