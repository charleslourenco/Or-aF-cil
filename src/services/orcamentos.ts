import { supabase } from '@/lib/supabase/client'

// Como a tabela Orcamentos é recém-criada via migration e types.ts é auto-gerado,
// usamos o pattern de alias não-tipado para evitar conflitos de overload no TypeScript.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export type OrcamentoStatus = 'Rascunho' | 'Em Negociação' | 'Aprovado'

export interface Orcamento {
  id: string
  cliente_nome: string
  ambiente: string | null
  modulo: string | null
  data: string | null
  valor_total: number | null
  status: OrcamentoStatus | string | null
  created_at: string | null
  updated_at: string | null
}

export interface OrcamentoInput {
  cliente_nome: string
  ambiente?: string | null
  modulo?: string | null
  data?: string | null
  valor_total?: number | null
  status?: OrcamentoStatus | string
}

// Auxiliar para obter a data ISO do início do mês atual (ex: 2026-08-01T00:00:00.000Z)
function getInicioDoMesAtual(): string {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  return startOfMonth.toISOString()
}

/**
 * Busca todos os orçamentos ordenados por created_at decrescente.
 * Retorna null em caso de erro na consulta.
 */
export async function fetchOrcamentos(): Promise<Orcamento[] | null> {
  try {
    const { data, error } = await db
      .from('Orcamentos')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar orçamentos:', error.message ?? error)
      return null
    }

    return (data ?? []) as Orcamento[]
  } catch (err) {
    console.error('Erro inesperado ao buscar orçamentos:', err)
    return null
  }
}

/**
 * Conta o total de orçamentos criados no mês atual (created_at >= início do mês).
 * Retorna null em caso de erro.
 */
export async function fetchOrcamentosCount(): Promise<number | null> {
  try {
    const startOfMonth = getInicioDoMesAtual()
    const { count, error } = await db
      .from('Orcamentos')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfMonth)

    if (error) {
      console.error('Erro ao contar orçamentos do mês:', error.message ?? error)
      return null
    }

    return count ?? 0
  } catch (err) {
    console.error('Erro inesperado ao contar orçamentos do mês:', err)
    return null
  }
}

/**
 * Soma o valor_total dos orçamentos do mês atual.
 * Retorna null em caso de erro.
 */
export async function fetchOrcamentosSomaValor(): Promise<number | null> {
  try {
    const startOfMonth = getInicioDoMesAtual()
    const { data, error } = await db
      .from('Orcamentos')
      .select('valor_total')
      .gte('created_at', startOfMonth)

    if (error) {
      console.error('Erro ao somar valor dos orçamentos do mês:', error.message ?? error)
      return null
    }

    if (!data) return 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const total = data.reduce((acc: number, curr: any) => {
      const val =
        typeof curr.valor_total === 'number' ? curr.valor_total : parseFloat(curr.valor_total) || 0
      return acc + val
    }, 0)

    return total
  } catch (err) {
    console.error('Erro inesperado ao somar valor dos orçamentos do mês:', err)
    return null
  }
}

/**
 * Conta a quantidade de orçamentos com status = 'Aprovado' no mês atual.
 * Retorna null em caso de erro.
 */
export async function fetchOrcamentosAprovadosCount(): Promise<number | null> {
  try {
    const startOfMonth = getInicioDoMesAtual()
    const { count, error } = await db
      .from('Orcamentos')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfMonth)
      .eq('status', 'Aprovado')

    if (error) {
      console.error('Erro ao contar propostas aprovadas do mês:', error.message ?? error)
      return null
    }

    return count ?? 0
  } catch (err) {
    console.error('Erro inesperado ao contar propostas aprovadas do mês:', err)
    return null
  }
}

/**
 * Calcula a média de valor_total dos orçamentos do mês atual.
 * Se zero linhas ou soma 0, retorna 0.
 * Retorna null em caso de erro.
 */
export async function fetchTicketMedio(): Promise<number | null> {
  try {
    const startOfMonth = getInicioDoMesAtual()
    const { data, error } = await db
      .from('Orcamentos')
      .select('valor_total')
      .gte('created_at', startOfMonth)

    if (error) {
      console.error('Erro ao calcular ticket médio do mês:', error.message ?? error)
      return null
    }

    if (!data || data.length === 0) return 0

    let validCount = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const total = data.reduce((acc: number, curr: any) => {
      const val =
        typeof curr.valor_total === 'number' ? curr.valor_total : parseFloat(curr.valor_total) || 0
      validCount += 1
      return acc + val
    }, 0)

    return validCount > 0 ? total / validCount : 0
  } catch (err) {
    console.error('Erro inesperado ao calcular ticket médio do mês:', err)
    return null
  }
}

/**
 * Cria um novo orçamento na tabela Orcamentos.
 */
export async function createOrcamento(input: OrcamentoInput): Promise<Orcamento | null> {
  try {
    const { data, error } = await db
      .from('Orcamentos')
      .insert({
        cliente_nome: input.cliente_nome,
        ambiente: input.ambiente ?? null,
        modulo: input.modulo ?? null,
        data: input.data ?? new Date().toISOString(),
        valor_total: input.valor_total ?? 0,
        status: input.status ?? 'Rascunho',
      })
      .select()
      .single()

    if (error) {
      console.error('Erro ao criar orçamento:', error.message ?? error)
      return null
    }

    return data as Orcamento
  } catch (err) {
    console.error('Erro inesperado ao criar orçamento:', err)
    return null
  }
}
