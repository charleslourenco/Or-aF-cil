/**
 * Utilitário para geração e normalização de IDs únicos e estáveis de itens de orçamento.
 * Previne colisões entre itens salvos do banco, BOM recalculada dinamicamente, itens manuais/avulsos
 * e itens do resumo consolidado.
 */

let monotonicCounter = 0

/**
 * Gera um ID único com prefixo de fonte e garantia monotônica + timestamp + aleatório.
 */
export function generateUniqueBudgetItemId(
  prefix: 'loaded' | 'bom' | 'manual' | 'consolidated' | 'ia',
): string {
  monotonicCounter += 1
  const rnd = Math.random().toString(36).substring(2, 8)
  return `${prefix}-${Date.now()}-${monotonicCounter}-${rnd}`
}

/**
 * Garante que um item possua um ID único sem colisões. Se o item já tiver um ID
 * que siga o padrão com prefixo da fonte, preserva-o; caso contrário, gera um ID único
 * indexado ou monotônico estável.
 */
export function ensureUniqueBudgetItemId(
  existingId: string | undefined | null,
  prefix: 'loaded' | 'bom' | 'manual' | 'consolidated' | 'ia',
  salt?: string | number,
): string {
  if (existingId && typeof existingId === 'string' && existingId.trim().length > 0) {
    // Se já é um ID com prefixo confiável e específico, mantém
    if (existingId.startsWith(`${prefix}-`) && !existingId.match(/^loaded-\d+$/)) {
      return existingId
    }
    // Para IDs genéricos do tipo "loaded-0" ou IDs reaproveitados de catálogo "catalogo-1",
    // acopla o prefixo e o salteamento para torná-lo 100% único
    monotonicCounter += 1
    const saltSuffix = salt !== undefined ? `-${salt}` : ''
    return `${prefix}-${existingId}${saltSuffix}-${monotonicCounter}`
  }
  return generateUniqueBudgetItemId(prefix)
}
