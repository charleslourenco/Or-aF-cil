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
}

/**
 * Busca os módulos de engenharia disponíveis no Supabase (tabela
 * `TemplatesEngenharia`) para popular o Select de Módulos de forma 100%
 * dinâmica — sem nenhum dado mock/estático no frontend.
 */
export async function fetchTemplatesEngenharia(): Promise<TemplateEngenharia[]> {
  const { data, error } = await supabase
    .from('TemplatesEngenharia')
    .select('id, nome_template, categoria, dimensoes, material, descricao, icon_type')
    .order('nome_template')

  if (error) {
    console.error('Erro ao buscar módulos da biblioteca (TemplatesEngenharia):', error)
    return []
  }

  return (data ?? []) as TemplateEngenharia[]
}

/** Normaliza o tipo de ícone vindo do banco para os tipos aceitos pelo blueprint. */
export function normalizeIconType(type?: string | null): ModuleIconType {
  if (type === 'counter' || type === 'aerial') return type
  return 'wardrobe'
}
