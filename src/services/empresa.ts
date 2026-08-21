import { supabase } from '@/lib/supabase/client'

// Como a tabela perfil_empresa foi criada por migration recente e src/lib/supabase/types.ts
// não deve ser alterado manualmente, usamos tipagem explícita com o client.
const db = supabase as unknown as {
  from: (table: string) => ReturnType<typeof supabase.from>
  storage: typeof supabase.storage
}

export interface PerfilEmpresa {
  id?: string
  logo_url?: string | null
  razao_social?: string | null
  nome_fantasia?: string | null
  cnpj?: string | null
  inscricao_estadual?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
  cep?: string | null
  telefone?: string | null
  email_comercial?: string | null
  instagram?: string | null
  facebook?: string | null
  site?: string | null
  created_at?: string
  updated_at?: string
}

export interface PerfilEmpresaResult {
  data: PerfilEmpresa | null
  error: string | null
}

export interface UpsertPerfilEmpresaResult {
  data: PerfilEmpresa | null
  error: string | null
}

/**
 * Busca o primeiro registro da tabela `perfil_empresa`.
 * Retorna o registro ou null se não houver dados.
 */
export async function fetchPerfilEmpresa(): Promise<PerfilEmpresaResult> {
  try {
    const { data, error } = await db
      .from('perfil_empresa')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Erro ao buscar perfil da empresa:', error)
      return { data: null, error: error.message }
    }

    return { data: (data as PerfilEmpresa) ?? null, error: null }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Erro inesperado ao buscar perfil da empresa'
    console.error('Exceção ao buscar perfil da empresa:', err)
    return { data: null, error: message }
  }
}

/**
 * Faz upsert no registro da empresa (INSERT se não existir, UPDATE se existir).
 * Retorna o registro atualizado.
 */
export async function upsertPerfilEmpresa(
  payload: Partial<PerfilEmpresa>,
): Promise<UpsertPerfilEmpresaResult> {
  try {
    const dataToSave: Record<string, unknown> = {
      ...payload,
      updated_at: new Date().toISOString(),
    }

    // Se já tiver id, atualiza o registro específico
    if (payload.id) {
      const { data, error } = await db
        .from('perfil_empresa')
        .update(dataToSave)
        .eq('id', payload.id)
        .select()
        .single()

      if (error) {
        console.error('Erro ao atualizar perfil da empresa:', error)
        return { data: null, error: error.message }
      }

      return { data: data as PerfilEmpresa, error: null }
    }

    // Se não tiver id passado, verifica se já existe algum registro existente na tabela
    const existing = await fetchPerfilEmpresa()
    if (existing.data?.id) {
      const { data, error } = await db
        .from('perfil_empresa')
        .update(dataToSave)
        .eq('id', existing.data.id)
        .select()
        .single()

      if (error) {
        console.error('Erro ao atualizar perfil da empresa:', error)
        return { data: null, error: error.message }
      }

      return { data: data as PerfilEmpresa, error: null }
    }

    // Caso não exista nenhum registro, faz INSERT
    const { data, error } = await db.from('perfil_empresa').insert(dataToSave).select().single()

    if (error) {
      console.error('Erro ao cadastrar perfil da empresa:', error)
      return { data: null, error: error.message }
    }

    return { data: data as PerfilEmpresa, error: null }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Erro inesperado ao salvar perfil da empresa'
    console.error('Exceção ao salvar perfil da empresa:', err)
    return { data: null, error: message }
  }
}

/**
 * Faz upload do arquivo da logomarca no bucket 'empresa-logos' do Supabase Storage
 * e retorna a URL pública acessível.
 */
export async function uploadEmpresaLogo(
  file: File,
): Promise<{ publicUrl: string | null; error: string | null }> {
  try {
    const fileExt = file.name.split('.').pop() || 'png'
    const fileName = `logo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`
    const filePath = `${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('empresa-logos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      })

    if (uploadError) {
      console.error('Erro no upload da logomarca:', uploadError)
      return { publicUrl: null, error: uploadError.message }
    }

    const { data: publicUrlData } = supabase.storage.from('empresa-logos').getPublicUrl(filePath)

    return { publicUrl: publicUrlData.publicUrl, error: null }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro inesperado no upload da logomarca'
    console.error('Exceção no upload da logomarca:', err)
    return { publicUrl: null, error: message }
  }
}
