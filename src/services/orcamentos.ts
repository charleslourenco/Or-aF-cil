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
  unidade?: 'm²' | 'm' | 'jogo' | 'un' | 'par' | string
  unitCost?: number
  totalCost?: number
  markup?: number
  salePrice?: number
  item_nao_cadastrado?: boolean
  catalogo_id?: string | null
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

export interface OrcamentoDimensoes {
  largura: number
  altura: number
  profundidade: number
}

export interface ComposicaoCorpo {
  id?: string
  gavetas: number
  prateleiras: number
  cabideiro: boolean
  sapateira?: boolean
}

export interface ComposicaoModuloPersistida {
  divisorias?: {
    qtd: number
  }
  corpos?: ComposicaoCorpo[]
  portas?: {
    qtd: number
    tipo: 'abrir' | 'correr' | 'batente' | 'nenhum'
  }
  gavetas?: {
    qtd: number
  }
  prateleiras?: {
    qtd: number
  }
  cabideiro?: boolean
  sapateira?: boolean
  puxadores?: number
  adaptacoes?: string
  semTamponamento?: boolean
  tampoPedra?: boolean
}

export interface ModuloOrcamento {
  id: string
  modulo_id?: string
  nome: string
  dimensoes?: OrcamentoDimensoes
  mdf_externo?: string
  mdf_interno?: string
  mdf_fundo?: string
  padrao_projeto?: string
  imagem_url?: string | null
  itens: OrcamentoBOMItem[]
  subtotal: number
  composicao?: ComposicaoModuloPersistida
  adaptacoes?: string
}

export interface AmbienteOrcamento {
  id: string
  nome: string
  modulos: ModuloOrcamento[]
  subtotal: number
}

export interface Orcamento {
  id: string
  numero_sequencial?: number | null
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
  ambientes_json?: AmbienteOrcamento[] | null
  dimensoes_json?: OrcamentoDimensoes | null
  mdf_externo?: string | null
  mdf_interno?: string | null
  mdf_fundo?: string | null
  padrao_projeto?: string | null
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
  ambientes_json?: AmbienteOrcamento[] | unknown[] | null
  dimensoes_json?: OrcamentoDimensoes | Record<string, unknown> | null
  mdf_externo?: string | null
  mdf_interno?: string | null
  mdf_fundo?: string | null
  padrao_projeto?: string | null
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
    if (input.ambientes_json !== undefined) updatePayload.ambientes_json = input.ambientes_json
    if (input.dimensoes_json !== undefined) updatePayload.dimensoes_json = input.dimensoes_json
    if (input.mdf_externo !== undefined) updatePayload.mdf_externo = input.mdf_externo
    if (input.mdf_interno !== undefined) updatePayload.mdf_interno = input.mdf_interno
    if (input.mdf_fundo !== undefined) updatePayload.mdf_fundo = input.mdf_fundo
    if (input.padrao_projeto !== undefined) updatePayload.padrao_projeto = input.padrao_projeto

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
        ambientes_json: input.ambientes_json ?? null,
        dimensoes_json: input.dimensoes_json ?? null,
        mdf_externo: input.mdf_externo ?? null,
        mdf_interno: input.mdf_interno ?? null,
        mdf_fundo: input.mdf_fundo ?? null,
        padrao_projeto: input.padrao_projeto ?? null,
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

/**
 * Deleta um orçamento da tabela Orcamentos pelo seu ID.
 * Retorna true se sucesso, false se erro.
 */
export async function deleteOrcamento(id: string): Promise<boolean> {
  try {
    const { error } = await db.from('Orcamentos').delete().eq('id', id)

    if (error) {
      console.error(`Erro ao deletar orçamento com id ${id}:`, error.message ?? error)
      return false
    }

    return true
  } catch (err) {
    console.error(`Erro inesperado ao deletar orçamento com id ${id}:`, err)
    return false
  }
}
