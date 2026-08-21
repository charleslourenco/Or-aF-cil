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
  unidade?: 'm²' | 'm' | 'jogo'
  isEditing?: boolean
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
