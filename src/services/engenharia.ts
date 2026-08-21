import { supabase } from '@/lib/supabase/client'

// As tabelas `configuracoes_engenharia` e `custos_fixos` foram criadas por
// migration mas ainda não constam em `src/lib/supabase/types.ts` (auto-gerado).
// Usamos um alias sem tipagem de tabela para evitar erros de overload do TS.
const db = supabase as unknown as {
  from: (table: string) => ReturnType<typeof supabase.from>
}

export interface ConfigEngenharia {
  id: string
  meta_faturamento: number
  impostos_percent: number
  comissoes_percent: number
  custo_financeiro_percent: number
  markup_padrao: number
  perda_material_percent: number
  created_at?: string
  updated_at?: string
}

export interface CustoFixo {
  id: string
  config_id: string
  descricao: string
  valor: number
  created_at?: string
}

export interface CustoVariavel {
  id: string
  config_id: string
  descricao: string
  valor: number
  created_at?: string
}

export interface ComissaoPersonalizada {
  id: string
  config_id: string
  nome: string
  percentual: number
  created_at?: string
}

export interface ConfigEngenhariaResult {
  config: ConfigEngenharia | null
  custosFixos: CustoFixo[]
  custosVariaveis: CustoVariavel[]
  comissoesPersonalizadas: ComissaoPersonalizada[]
  error: string | null
}

export interface SaveConfigEngenhariaResult {
  success: boolean
  error: string | null
  configId?: string
}

/**
 * Busca a primeira linha de `configuracoes_engenharia` e os custos fixos relacionados.
 */
export async function fetchConfigEngenharia(): Promise<ConfigEngenhariaResult> {
  const { data: configData, error: configError } = await db
    .from('configuracoes_engenharia')
    .select(
      'id, meta_faturamento, impostos_percent, comissoes_percent, custo_financeiro_percent, markup_padrao, perda_material_percent, created_at, updated_at',
    )
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (configError) {
    console.error('Erro ao buscar configurações de engenharia:', configError)
    return {
      config: null,
      custosFixos: [],
      custosVariaveis: [],
      comissoesPersonalizadas: [],
      error: configError.message,
    }
  }

  if (!configData) {
    return {
      config: null,
      custosFixos: [],
      custosVariaveis: [],
      comissoesPersonalizadas: [],
      error: null,
    }
  }

  const config = configData as unknown as ConfigEngenharia

  const { data: custosData, error: custosError } = await db
    .from('custos_fixos')
    .select('id, config_id, descricao, valor, created_at')
    .eq('config_id', config.id)
    .order('created_at', { ascending: true })

  if (custosError) {
    console.error('Erro ao buscar custos fixos:', custosError)
    return {
      config,
      custosFixos: [],
      custosVariaveis: [],
      comissoesPersonalizadas: [],
      error: custosError.message,
    }
  }

  const { data: custosVariaveisData, error: custosVariaveisError } = await db
    .from('custos_variaveis')
    .select('id, config_id, descricao, valor, created_at')
    .eq('config_id', config.id)
    .order('created_at', { ascending: true })

  if (custosVariaveisError) {
    console.error('Erro ao buscar custos variáveis:', custosVariaveisError)
    return {
      config,
      custosFixos: (custosData ?? []) as unknown as CustoFixo[],
      custosVariaveis: [],
      comissoesPersonalizadas: [],
      error: custosVariaveisError.message,
    }
  }

  const { data: comissoesData, error: comissoesError } = await db
    .from('comissoes_personalizadas')
    .select('id, config_id, nome, percentual, created_at')
    .eq('config_id', config.id)
    .order('created_at', { ascending: true })

  if (comissoesError) {
    console.error('Erro ao buscar comissões personalizadas:', comissoesError)
    return {
      config,
      custosFixos: (custosData ?? []) as unknown as CustoFixo[],
      custosVariaveis: (custosVariaveisData ?? []) as unknown as CustoVariavel[],
      comissoesPersonalizadas: [],
      error: comissoesError.message,
    }
  }

  return {
    config,
    custosFixos: (custosData ?? []) as unknown as CustoFixo[],
    custosVariaveis: (custosVariaveisData ?? []) as unknown as CustoVariavel[],
    comissoesPersonalizadas: (comissoesData ?? []) as unknown as ComissaoPersonalizada[],
    error: null,
  }
}

/**
 * Upsert na config (insert se não existir, update caso contrário) e sincroniza
 * os custos fixos, custos variáveis e comissões (deleta todos do config_id e reinsere as listas).
 */
export async function saveConfigEngenharia(
  config: ConfigEngenharia,
  custosFixos: CustoFixo[],
  custosVariaveis: CustoVariavel[] = [],
  comissoesPersonalizadas: ComissaoPersonalizada[] = [],
): Promise<SaveConfigEngenhariaResult> {
  const payload = {
    meta_faturamento: config.meta_faturamento,
    impostos_percent: config.impostos_percent,
    comissoes_percent: config.comissoes_percent,
    custo_financeiro_percent: config.custo_financeiro_percent,
    markup_padrao: config.markup_padrao,
    perda_material_percent: config.perda_material_percent,
    updated_at: new Date().toISOString(),
  }

  let configId = config.id

  // Busca a primeira linha existente na tabela (sem filtro de ID) para evitar duplicatas
  const { data: existing } = await db
    .from('configuracoes_engenharia')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (existing) {
    configId = (existing as { id: string }).id
    const { error: updateError } = await db
      .from('configuracoes_engenharia')
      .update(payload)
      .eq('id', configId)
    if (updateError) {
      console.error('Erro ao atualizar configurações:', updateError)
      return { success: false, error: updateError.message }
    }
  } else {
    const { data: inserted, error: insertError } = await db
      .from('configuracoes_engenharia')
      .insert(payload)
      .select('id')
      .single()
    if (insertError || !inserted) {
      console.error('Erro ao criar configurações:', insertError)
      return { success: false, error: insertError?.message ?? 'Falha ao criar configuração' }
    }
    configId = (inserted as { id: string }).id
  }

  // Sincroniza custos fixos: deleta todos e reinsere
  const { error: deleteError } = await db.from('custos_fixos').delete().eq('config_id', configId)
  if (deleteError) {
    console.error('Erro ao remover custos fixos antigos:', deleteError)
    return { success: false, error: deleteError.message }
  }

  const toInsert = custosFixos
    .filter((c) => c.descricao.trim() !== '')
    .map((c) => ({
      config_id: configId,
      descricao: c.descricao.trim(),
      valor: c.valor,
    }))

  if (toInsert.length > 0) {
    const { error: insertCustosError } = await db.from('custos_fixos').insert(toInsert)
    if (insertCustosError) {
      console.error('Erro ao inserir custos fixos:', insertCustosError)
      return { success: false, error: insertCustosError.message }
    }
  }

  // Sincroniza custos variáveis: deleta todos e reinsere
  const { error: deleteVariaveisError } = await db
    .from('custos_variaveis')
    .delete()
    .eq('config_id', configId)
  if (deleteVariaveisError) {
    console.error('Erro ao remover custos variáveis antigos:', deleteVariaveisError)
    return { success: false, error: deleteVariaveisError.message }
  }

  const toInsertVariaveis = custosVariaveis
    .filter((c) => c.descricao.trim() !== '')
    .map((c) => ({
      config_id: configId,
      descricao: c.descricao.trim(),
      valor: c.valor,
    }))

  if (toInsertVariaveis.length > 0) {
    const { error: insertVariaveisError } = await db
      .from('custos_variaveis')
      .insert(toInsertVariaveis)
    if (insertVariaveisError) {
      console.error('Erro ao inserir custos variáveis:', insertVariaveisError)
      return { success: false, error: insertVariaveisError.message }
    }
  }

  // Sincroniza comissões personalizadas: deleta todas e reinsere
  const { error: deleteComissoesError } = await db
    .from('comissoes_personalizadas')
    .delete()
    .eq('config_id', configId)
  if (deleteComissoesError) {
    console.error('Erro ao remover comissões personalizadas antigas:', deleteComissoesError)
    return { success: false, error: deleteComissoesError.message }
  }

  const toInsertComissoes = comissoesPersonalizadas
    .filter((c) => c.nome.trim() !== '')
    .map((c) => ({
      config_id: configId,
      nome: c.nome.trim(),
      percentual: c.percentual,
    }))

  if (toInsertComissoes.length > 0) {
    const { error: insertComissoesError } = await db
      .from('comissoes_personalizadas')
      .insert(toInsertComissoes)
    if (insertComissoesError) {
      console.error('Erro ao inserir comissões personalizadas:', insertComissoesError)
      return { success: false, error: insertComissoesError.message }
    }
  }

  return { success: true, error: null, configId }
}
