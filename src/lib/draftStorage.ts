import type { AmbienteOrcamento } from '@/services/orcamentos'
import type { ModuloComposicao, PadraoProjeto } from '@/lib/pricing'
import type { BudgetItem } from '@/data/mockData'

export const DRAFT_STORAGE_PREFIX = 'orcafacil_draft_novo_orcamento'

export interface DraftData {
  version: 1
  savedAt: number
  /** ID do orçamento a que este rascunho pertence (se já salvo no banco ou em edição) */
  orcamentoId?: string | null
  clientName: string
  room: string
  ambienteSelecionado: string
  selectedModuleId: string
  ambientes: AmbienteOrcamento[]
  activeAmbienteId: string
  dimensoes: { largura: number; altura: number; profundidade: number }
  composicaoModulo: ModuloComposicao
  padraoProjeto: PadraoProjeto
  mdfExterno: { cor: string; espessura: 15 | 18 }
  mdfInterno: { cor: string; espessura: 15 | 18 }
  mdfFundo: string
  formaPagamento: string
  observacoes: string
  showResults: boolean
  manualItems: BudgetItem[]
  uploadedFilesMeta: Array<{
    id: string
    name: string
    size: number
    previewUrl?: string
  }>
}

/**
 * Retorna a chave de armazenamento no localStorage considerando o usuário logado (se houver).
 */
export function getDraftStorageKey(userId?: string | null): string {
  return userId ? `${DRAFT_STORAGE_PREFIX}_${userId}` : DRAFT_STORAGE_PREFIX
}

/**
 * Lê o rascunho persistido no localStorage de forma segura contra JSON corrompido.
 */
export function readDraftFromStorage(userId?: string | null): DraftData | null {
  try {
    const key = getDraftStorageKey(userId)
    const raw = localStorage.getItem(key) || localStorage.getItem(DRAFT_STORAGE_PREFIX)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== 1) return null
    return parsed as DraftData
  } catch (err) {
    console.warn('Falha ao ler rascunho do localStorage:', err)
    return null
  }
}

/**
 * Persiste o rascunho no localStorage com blindagem contra QuotaExceededError.
 */
export function writeDraftToStorage(draft: DraftData, userId?: string | null): boolean {
  try {
    const key = getDraftStorageKey(userId)
    localStorage.setItem(key, JSON.stringify(draft))
    return true
  } catch (err) {
    console.warn('Falha ao persistir rascunho no localStorage:', err)
    return false
  }
}

/**
 * Limpa o rascunho local tanto da chave específica do usuário quanto da chave genérica.
 */
export function clearDraftStorage(userId?: string | null): void {
  try {
    const key = getDraftStorageKey(userId)
    localStorage.removeItem(key)
    localStorage.removeItem(DRAFT_STORAGE_PREFIX)
  } catch (err) {
    console.warn('Erro ao limpar rascunho do localStorage:', err)
  }
}

/**
 * Vincula o rascunho existente no localStorage a um ID de orçamento salvo.
 */
export function bindDraftToOrcamentoId(orcamentoId: string, userId?: string | null): void {
  try {
    const existing = readDraftFromStorage(userId)
    if (existing) {
      existing.orcamentoId = orcamentoId
      writeDraftToStorage(existing, userId)
    }
  } catch (err) {
    console.warn('Erro ao vincular orcamentoId ao rascunho:', err)
  }
}

/**
 * Remove qualquer rascunho cujo orcamentoId corresponda ao ID informado.
 * Utilizado quando um orçamento é excluído do sistema.
 */
export function clearDraftIfMatchesOrcamentoId(
  orcamentoId: string,
  userId?: string | null,
): boolean {
  if (!orcamentoId) return false
  let removed = false

  try {
    // 1. Checa a chave do usuário atual e a chave genérica
    const current = readDraftFromStorage(userId)
    if (current && current.orcamentoId === orcamentoId) {
      clearDraftStorage(userId)
      removed = true
    }

    // 2. Varrer outras possíveis chaves de rascunho com o prefixo
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(DRAFT_STORAGE_PREFIX)) {
        try {
          const raw = localStorage.getItem(key)
          if (raw) {
            const parsed = JSON.parse(raw)
            if (parsed && parsed.orcamentoId === orcamentoId) {
              localStorage.removeItem(key)
              removed = true
            }
          }
        } catch {
          // ignora item ilegível
        }
      }
    }
  } catch (err) {
    console.warn('Erro ao limpar rascunho por orcamentoId:', err)
  }

  return removed
}
