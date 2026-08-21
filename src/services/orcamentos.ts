import { supabase } from '@/lib/supabase/client'

// Como a tabela Orcamentos é recém-criada via migration e types.ts é auto-gerado,
// usamos o pattern de alias não-tipado para evitar conflitos de overload no TypeScript.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export type OrcamentoStatus = 'Rascunho' | 'Em Negociação' | 'Aprovado'

export interface OrcamentoBOMItem {
  id: string
  description: string
  material?: string
  espessura?: number
  metragem?: number
  unidade?: 'm²' | 'm' | 'jogo' | string
  unitCost?: number
  totalCost?: number
  markup?: number
  salePrice?: number
  [key: string]: unknown
}

export interface OrcamentoDRE {
  custo_mp?: number
  impostos?: number
  impostos_percent?: number
  comissao?: number
  comissao_percent?: number
  custo_fixo_rateado?: number
  custo_fixo_percent?: number
  lucro_liquido?: number
  lucro_liquido_percent?: number
  markup_efetivo?: number
  preco_final?: number
  [key: string]: unknown
}

export interface Orcamento {
  id: string
  cliente_nome: string
  ambiente: string | null
  modulo: string | null
  data: string | null
  valor_total: number | null
  status: OrcamentoStatus | string | null
  forma_pagamento: string | null
  observacoes: string | null
  bom_json: OrcamentoBOMItem[] | null
  dre_json: OrcamentoDRE | null
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
  forma_pagamento?: string | null
  observacoes?: string | null
  bom_json?: OrcamentoBOMItem[] | unknown[] | null
  dre_json?: OrcamentoDRE | Record<string, unknown> | null
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
/**
 * Busca um orçamento específico pelo seu ID (UUID).
 * Retorna null se não encontrado ou em caso de erro.
 */
export async function fetchOrcamentoById(id: string): Promise<Orcamento | null> {
  try {
    const { data, error } = await db.from('Orcamentos').select('*').eq('id', id).single()

    if (error) {
      console.error(`Erro ao buscar orçamento com id ${id}:`, error.message ?? error)
      return null
    }

    return data as Orcamento
  } catch (err) {
    console.error(`Erro inesperado ao buscar orçamento com id ${id}:`, err)
    return null
  }
}

/**
 * Atualiza um orçamento existente pelo seu ID.
 * Retorna o orçamento atualizado ou null em caso de erro.
 */
export async function updateOrcamento(
  id: string,
  input: Partial<OrcamentoInput>,
): Promise<Orcamento | null> {
  try {
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (input.cliente_nome !== undefined) updatePayload.cliente_nome = input.cliente_nome
    if (input.ambiente !== undefined) updatePayload.ambiente = input.ambiente
    if (input.modulo !== undefined) updatePayload.modulo = input.modulo
    if (input.data !== undefined) updatePayload.data = input.data
    if (input.valor_total !== undefined) updatePayload.valor_total = input.valor_total
    if (input.status !== undefined) updatePayload.status = input.status
    if (input.forma_pagamento !== undefined) updatePayload.forma_pagamento = input.forma_pagamento
    if (input.observacoes !== undefined) updatePayload.observacoes = input.observacoes
    if (input.bom_json !== undefined) updatePayload.bom_json = input.bom_json
    if (input.dre_json !== undefined) updatePayload.dre_json = input.dre_json

    const { data, error } = await db
      .from('Orcamentos')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error(`Erro ao atualizar orçamento ${id}:`, error.message ?? error)
      return null
    }

    return data as Orcamento
  } catch (err) {
    console.error(`Erro inesperado ao atualizar orçamento ${id}:`, err)
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
        forma_pagamento: input.forma_pagamento ?? null,
        observacoes: input.observacoes ?? null,
        bom_json: input.bom_json ?? null,
        dre_json: input.dre_json ?? null,
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
