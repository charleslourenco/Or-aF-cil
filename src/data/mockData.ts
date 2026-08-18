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

export const MOCK_EXISTING_QUOTES: QuoteRecord[] = [
  {
    id: 'quote-1',
    code: 'ORC-2025-089',
    clientName: 'Maria Silva',
    room: 'Quarto',
    moduleName: 'Roupeiro 2 Portas',
    totalItems: 2,
    totalCost: 430.0,
    totalSalePrice: 1075.0,
    status: 'Aprovado',
    createdAt: '12/03/2025',
  },
  {
    id: 'quote-2',
    code: 'ORC-2025-088',
    clientName: 'Carlos Eduardo Oliveira',
    room: 'Cozinha',
    moduleName: 'Balcão de Cozinha',
    totalItems: 3,
    totalCost: 650.0,
    totalSalePrice: 1625.0,
    status: 'Em Análise',
    createdAt: '11/03/2025',
  },
  {
    id: 'quote-3',
    code: 'ORC-2025-087',
    clientName: 'Fernanda Lima',
    room: 'Sala',
    moduleName: 'Armário Aéreo Basculante',
    totalItems: 2,
    totalCost: 310.0,
    totalSalePrice: 775.0,
    status: 'Concluído',
    createdAt: '08/03/2025',
  },
]
