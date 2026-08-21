export interface BudgetItem {
  id: string
  description: string
  unitCost: number
  totalCost: number
  markup: number
  salePrice: number
  /** Campos do motor de cálculo geométrico (BOM dinâmica). */
  material?: string
  espessura?: number
  metragem?: number
  unidade?: 'm²' | 'm' | 'jogo' | 'un' | 'par' | string
  isEditing?: boolean
  /** Flag para itens de estimativa que não estão cadastrados no catálogo */
  item_nao_cadastrado?: boolean
  catalogo_id?: string | null
}

export interface QuoteRecord {
  id: string
  code: string
  clientName: string
  room: string
  moduleName: string
  totalItems: number
  totalCost: number
  totalSalePrice: number
  status: 'Rascunho' | 'Em Análise' | 'Aprovado' | 'Concluído'
  createdAt: string
}

export const MOCK_EXISTING_QUOTES: QuoteRecord[] = []
