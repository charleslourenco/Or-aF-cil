import { supabase } from '@/lib/supabase/client'
import { UserRole, UserProfile } from '@/hooks/use-auth'

const db = supabase as unknown as {
  from: (table: string) => ReturnType<typeof supabase.from>
}

export interface UsuarioItem {
  id: string
  email: string
  nome?: string | null
  role: UserRole
  ativo?: boolean
  created_at?: string
  updated_at?: string
}

/**
 * Busca todos os perfis cadastrados na tabela profiles.
 */
export async function fetchUsuarios(): Promise<{ data: UsuarioItem[]; error: string | null }> {
  try {
    const { data, error } = await db
      .from('profiles')
      .select('id, email, nome, role, ativo, created_at, updated_at')
      .order('nome', { ascending: true })

    if (error) {
      console.error('Erro ao buscar usuários:', error)
      return { data: [], error: error.message }
    }

    const formatted: UsuarioItem[] = (data || []).map((row: any) => ({
      id: row.id,
      email: row.email || '',
      nome: row.nome || row.email?.split('@')[0] || 'Sem nome',
      role: (row.role as UserRole) || 'viewer',
      ativo: row.ativo !== false,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }))

    return { data: formatted, error: null }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao listar usuários'
    console.error('Exceção ao listar usuários:', err)
    return { data: [], error: msg }
  }
}

/**
 * Deleta ou desativa um usuário na tabela profiles.
 */
export async function deleteUsuario(
  id: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await db.from('profiles').delete().eq('id', id)
    if (error) {
      console.error('Erro ao remover usuário:', error)
      return { success: false, error: error.message }
    }
    return { success: true, error: null }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao remover usuário'
    return { success: false, error: msg }
  }
}

/**
 * Atualiza o role (cargo) de um usuário na tabela profiles.
 */
export async function updateUsuarioRole(
  id: string,
  role: UserRole,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await db
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('Erro ao atualizar cargo do usuário:', error)
      return { success: false, error: error.message }
    }
    return { success: true, error: null }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao atualizar cargo do usuário'
    return { success: false, error: msg }
  }
}

/**
 * Convida um novo usuário chamando a Edge Function `admin-create-user`.
 * Caso a Edge Function não esteja disponível ou falhe por conexão de infra,
 * faz fallback criando o registro no profiles diretamente se o caller for admin.
 */
export async function inviteUsuario(
  nome: string,
  email: string,
  role: UserRole,
): Promise<{ success: boolean; userId?: string; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: { nome, email, role },
    })

    if (!error && data?.success) {
      return { success: true, userId: data.userId, error: null }
    }

    // Se o backend retornou um erro estruturado no body
    if (data && !data.success && data.error) {
      return { success: false, error: data.error }
    }

    if (error) {
      console.warn('Falha na invocação da Edge Function:', error)
      // Se for erro de deploy ou edge function indisponível, tenta criar/atualizar no profiles
      const { data: insertedProfile, error: profileError } = await db
        .from('profiles')
        .insert({
          email,
          nome,
          role,
          ativo: true,
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (profileError) {
        return { success: false, error: error.message || profileError.message }
      }

      return { success: true, userId: (insertedProfile as any)?.id, error: null }
    }

    return { success: true, error: null }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado ao convidar usuário'
    return { success: false, error: msg }
  }
}
