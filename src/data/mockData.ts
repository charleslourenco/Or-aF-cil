export interface LibraryModule {
  id: string
  name: string
  category: string
  dimensions: string
  material: string
  description: string
  defaultParts: {
    description: string
    unitCost: number
    quantity: number
    markup: number
  }[]
  iconType: 'wardrobe' | 'counter' | 'aerial'
}

export const LIBRARY_MODULES: Record<string, LibraryModule> = {
  'roupeiro-2-portas': {
    id: 'roupeiro-2-portas',
    name: 'Roupeiro 2 Portas — Linha Clássica',
    category: 'Quarto • 2 Portas',
    dimensions: '2000 x 1200 x 600 mm',
    material: 'MDP / MDF 18mm, puxador metálico em perfil gola',
    description:
      'Módulo de roupeiro com 2 portas de giro, prateleiras internas ajustáveis e maleiro reforçado.',
    iconType: 'wardrobe',
    defaultParts: [
      {
        description: 'Lateral MDP 18mm 2750x600mm',
        unitCost: 120.0,
        quantity: 2,
        markup: 150,
      },
      {
        description: 'Porta MDF 18mm 2000x500mm (2 un.)',
        unitCost: 95.0,
        quantity: 2,
        markup: 150,
      },
    ],
  },
  balcao: {
    id: 'balcao',
    name: 'Balcão de Cozinha 2 Portas e 2 Gavetas',
    category: 'Cozinha • Inferior',
    dimensions: '850 x 1200 x 580 mm',
    material: 'MDF 18mm Ultra (resistente à umidade), corrediças telescópicas',
    description:
      'Balcão baixo para pia ou tampo granito, com divisória para gaveteiro e portas inferiores.',
    iconType: 'counter',
    defaultParts: [
      {
        description: 'Caixaria MDF Ultra 18mm 850x580mm',
        unitCost: 110.0,
        quantity: 2,
        markup: 150,
      },
      {
        description: 'Frente de Gaveta MDF 18mm 600x200mm (2 un.)',
        unitCost: 65.0,
        quantity: 2,
        markup: 150,
      },
      {
        description: 'Porta Baixa MDF 18mm 650x500mm (2 un.)',
        unitCost: 80.0,
        quantity: 2,
        markup: 150,
      },
    ],
  },
  aereo: {
    id: 'aereo',
    name: 'Armário Aéreo Basculante 1 Porta',
    category: 'Cozinha / Sala • Suspenso',
    dimensions: '600 x 900 x 350 mm',
    material: 'MDF 18mm acetinado com pistão a gás e amortecedor',
    description:
      'Armário suspenso moderno com abertura basculante assistida e sistema de fixação oculta.',
    iconType: 'aerial',
    defaultParts: [
      {
        description: 'Estrutura Aéreo MDF 18mm 900x350mm',
        unitCost: 85.0,
        quantity: 1,
        markup: 150,
      },
      {
        description: 'Porta Basculante MDF 18mm 900x600mm com Pistão',
        unitCost: 140.0,
        quantity: 1,
        markup: 150,
      },
    ],
  },
}

export interface BudgetItem {
  id: string
  description: string
  unitCost: number
  totalCost: number
  markup: number
  salePrice: number
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
