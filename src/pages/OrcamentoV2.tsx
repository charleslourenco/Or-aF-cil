import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  FileDown,
  User,
  Calendar,
  Layers,
  Plus,
  Pencil,
  Check,
  X,
  Trash2,
  Box,
  ChevronRight,
  Info,
  Save,
  CheckCircle2,
  FileText,
  Settings,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ModuleEditDrawer, ModuloSalvoData } from '@/components/ModuleEditDrawer'
import {
  createOrcamento,
  updateOrcamento,
  fetchOrcamentoById,
  Orcamento,
  AmbienteOrcamento,
  ModuloOrcamento,
  OrcamentoBOMItem,
  OrcamentoDRE,
} from '@/services/orcamentos'
import { fetchPerfilEmpresa, PerfilEmpresa } from '@/services/empresa'
import {
  fetchConfigEngenharia,
  ConfigEngenharia,
  CustoFixo,
  CustoVariavel,
  ComissaoPersonalizada,
} from '@/services/engenharia'
import { gerarPropostaComercial, gerarAnaliseCusto, montarDescricaoNaturalModulo } from '@/lib/pdf'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

// Estrutura comercial estrita de módulo: NUNCA expor ferragens, parafusos, chapas ou fitas na proposta
export interface ModuloComercialV2 {
  id: string
  moduloId?: string
  modulo: string
  descricaoTipo: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
  dimensoes?: {
    largura: number
    altura: number
    profundidade: number
  }
  perfilConstrutivo?: string
  itensBOM?: OrcamentoBOMItem[]
}

export interface AmbienteV2 {
  id: string
  nome: string
  modulos: ModuloComercialV2[]
}

const OPCOES_PREDEFINIDAS_AMBIENTES = [
  'Cozinha',
  'Quarto 01',
  'Quarto 02',
  'Banheiro',
  'Sala',
  'Área Externa',
] as const

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val)

export default function OrcamentoV2() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const orcamentoIdParam = searchParams.get('id')

  // ID do orçamento persistido no Supabase
  const [orcamentoId, setOrcamentoId] = useState<string | null>(orcamentoIdParam)
  const [numeroSequencial, setNumeroSequencial] = useState<number | null>(null)
  const [statusOrcamento, setStatusOrcamento] = useState<string>('Rascunho')
  const [isSaving, setIsSaving] = useState(false)
  const [isSavedSuccessfully, setIsSavedSuccessfully] = useState(false)
  const [isLoadingOrcamento, setIsLoadingOrcamento] = useState(false)

  // Estado para Dados do Cliente
  const [nomeCliente, setNomeCliente] = useState('')
  const [dataOrcamento, setDataOrcamento] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })

  // Estado dos ambientes do projeto
  const [ambientes, setAmbientes] = useState<AmbienteV2[]>([])
  // IDs dos ambientes abertos no accordion
  const [expandedAmbientes, setExpandedAmbientes] = useState<string[]>([])

  // Ambiente Ativo (em edição guiada). Apenas um por vez fica ativo.
  const [activeAmbienteId, setActiveAmbienteId] = useState<string | null>(null)

  // Estado que indica se o orçamento foi concluído via fluxo guiado (exibe resumo geral)
  const [isOrcamentoFinalizado, setIsOrcamentoFinalizado] = useState(false)

  // Referência para o container seletor de ambientes (para dar foco ao finalizar ambiente)
  const selectorContainerRef = useRef<HTMLDivElement>(null)
  const resumoGeralRef = useRef<HTMLDivElement>(null)

  // Estado para renomear ambiente inline
  const [editingAmbienteId, setEditingAmbienteId] = useState<string | null>(null)
  const [editingAmbienteNome, setEditingAmbienteNome] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Estado do seletor dropdown do topo de ambientes
  const [selectedAmbienteOpcao, setSelectedAmbienteOpcao] = useState<string>('')

  // Estado para modal de inclusão com nome livre
  const [isCustomDialogOpen, setIsCustomDialogOpen] = useState(false)
  const [customAmbienteNome, setCustomAmbienteNome] = useState('')

  // Estado do Drawer de Adicionar/Configurar Módulo
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [targetAmbienteId, setTargetAmbienteId] = useState<string | null>(null)
  const [editingModuloData, setEditingModuloData] = useState<ModuloSalvoData | null>(null)
  const [editingModuloId, setEditingModuloId] = useState<string | null>(null)

  // Estados de engenharia financeira e dados da empresa
  const [perfilEmpresa, setPerfilEmpresa] = useState<PerfilEmpresa | null>(null)
  const [configEngenharia, setConfigEngenharia] = useState<ConfigEngenharia | null>(null)
  const [custosFixos, setCustosFixos] = useState<CustoFixo[]>([])
  const [custosVariaveis, setCustosVariaveis] = useState<CustoVariavel[]>([])
  const [comissoesPersonalizadas, setComissoesPersonalizadas] = useState<ComissaoPersonalizada[]>(
    [],
  )
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<'proposta' | 'custo' | null>(null)

  // Carregar dados de Perfil da Empresa e Configurações de Engenharia
  useEffect(() => {
    fetchPerfilEmpresa()
      .then((res) => {
        if (res?.data) {
          setPerfilEmpresa(res.data)
        }
      })
      .catch((err) => {
        console.error('Erro ao buscar perfil da empresa:', err)
      })

    fetchConfigEngenharia()
      .then((res) => {
        if (res) {
          if (res.config) setConfigEngenharia(res.config)
          if (Array.isArray(res.custosFixos)) setCustosFixos(res.custosFixos)
          if (Array.isArray(res.custosVariaveis)) setCustosVariaveis(res.custosVariaveis)
          if (Array.isArray(res.comissoesPersonalizadas))
            setComissoesPersonalizadas(res.comissoesPersonalizadas)
        }
      })
      .catch((err) => {
        console.error('Erro ao buscar configurações de engenharia:', err)
      })
  }, [])

  // Carregar orçamento existente se vier ID na URL
  useEffect(() => {
    if (orcamentoIdParam) {
      setIsLoadingOrcamento(true)
      fetchOrcamentoById(orcamentoIdParam)
        .then((orc: Orcamento | null) => {
          if (orc) {
            setOrcamentoId(orc.id)
            setNumeroSequencial(orc.numero_sequencial ?? null)
            setNomeCliente(orc.cliente_nome || '')
            if (orc.data) {
              setDataOrcamento(orc.data.split('T')[0])
            }
            if (orc.status) {
              setStatusOrcamento(orc.status)
            }
            // Mapeia ambientes_json salvo para AmbienteV2[]
            if (Array.isArray(orc.ambientes_json)) {
              const mappedAmbientes: AmbienteV2[] = orc.ambientes_json.map((a: any) => ({
                id: a.id || `amb-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                nome: a.nome,
                modulos: Array.isArray(a.modulos)
                  ? a.modulos.map((m: any) => ({
                      id: m.id || `mod-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                      moduloId: m.modulo_id,
                      modulo: m.nome,
                      descricaoTipo: m.adaptacoes || m.perfil_construtivo || 'Módulo Sob Medida',
                      quantidade: 1,
                      valorUnitario: m.subtotal || 0,
                      valorTotal: m.subtotal || 0,
                      dimensoes: m.dimensoes,
                      perfilConstrutivo: m.perfil_construtivo,
                      itensBOM: m.itens || [],
                    }))
                  : [],
              }))
              setAmbientes(mappedAmbientes)
              // Em orçamentos carregados, se houver ambientes, define o primeiro ou último como ativo, ou mantém recolhidos
              if (mappedAmbientes.length > 0) {
                const ultimo = mappedAmbientes[mappedAmbientes.length - 1]
                setActiveAmbienteId(ultimo.id)
                setExpandedAmbientes([ultimo.id])
              }
            }
          }
        })
        .catch((err) => {
          console.error('Erro ao carregar orçamento:', err)
        })
        .finally(() => {
          setIsLoadingOrcamento(false)
        })
    }
  }, [orcamentoIdParam])

  // Subtotal por ambiente: reflete ESTRITAMENTE módulos JÁ SALVOS nos ambientes
  const subtotalPorAmbiente = useMemo(() => {
    const map = new Map<string, number>()
    for (const amb of ambientes) {
      const total = amb.modulos.reduce((acc, m) => acc + (Number(m.valorTotal) || 0), 0)
      map.set(amb.id, total)
    }
    return map
  }, [ambientes])

  // Valor Total Geral: SOMA apenas após salvar módulos nos ambientes
  const valorTotalGeral = useMemo(() => {
    let total = 0
    for (const sub of subtotalPorAmbiente.values()) {
      total += sub
    }
    return total
  }, [subtotalPorAmbiente])

  // Custo Total Geral: soma de Number(peca.totalCost) de mod.itensBOM de todos os módulos de todos os ambientes
  const custoTotalGeral = useMemo(() => {
    let custo = 0
    for (const amb of ambientes) {
      for (const mod of amb.modulos) {
        if (Array.isArray(mod.itensBOM)) {
          for (const peca of mod.itensBOM) {
            custo += Number(peca.totalCost) || 0
          }
        }
      }
    }
    return custo
  }, [ambientes])

  // Cálculo determinístico da DRE a partir da engenharia financeira do banco
  const calcularDRE = useCallback((): OrcamentoDRE => {
    const totalSale = valorTotalGeral
    const totalCost = custoTotalGeral

    // Impostos (%)
    const impostos_percent =
      typeof configEngenharia?.impostos_percent === 'number'
        ? configEngenharia.impostos_percent
        : 10

    // Comissões (%): base + comissões personalizadas
    const somaComissoesPersonalizadas = comissoesPersonalizadas.reduce(
      (acc, c) => acc + (Number(c.percentual) || 0),
      0,
    )
    const comissao_percent =
      typeof configEngenharia?.comissoes_percent === 'number'
        ? configEngenharia.comissoes_percent + somaComissoesPersonalizadas
        : 5 + somaComissoesPersonalizadas

    // Custo fixo rateado (%)
    const totalCustosEmpresa = custosFixos.reduce((acc, c) => acc + (Number(c.valor) || 0), 0)
    const metaFaturamento = Number(configEngenharia?.meta_faturamento) || 0
    const custo_fixo_percent =
      metaFaturamento > 0 && totalCustosEmpresa > 0
        ? (totalCustosEmpresa / metaFaturamento) * 100
        : 8

    // Valores em Reais arredondados
    const impVal = Math.round(((totalSale * impostos_percent) / 100) * 100) / 100
    const comVal = Math.round(((totalSale * comissao_percent) / 100) * 100) / 100
    const fixoVal = Math.round(((totalSale * custo_fixo_percent) / 100) * 100) / 100

    const lucro_liquido =
      Math.round((totalSale - totalCost - impVal - comVal - fixoVal) * 100) / 100
    const lucro_liquido_percent =
      totalSale > 0 ? Math.round((lucro_liquido / totalSale) * 100 * 100) / 100 : 0

    const markup_efetivo =
      totalCost > 0
        ? Math.round((totalSale / totalCost) * 100) / 100
        : Number(configEngenharia?.markup_padrao) || 2.5

    return {
      custo_mp: Math.round(totalCost * 100) / 100,
      impostos: impVal,
      impostos_percent: Math.round(impostos_percent * 100) / 100,
      comissao: comVal,
      comissao_percent: Math.round(comissao_percent * 100) / 100,
      custo_fixo_rateado: fixoVal,
      custo_fixo_percent: Math.round(custo_fixo_percent * 100) / 100,
      lucro_liquido,
      lucro_liquido_percent,
      markup_efetivo,
      preco_final: Math.round(totalSale * 100) / 100,
    }
  }, [valorTotalGeral, custoTotalGeral, configEngenharia, comissoesPersonalizadas, custosFixos])

  const handleVoltar = () => {
    navigate('/orcamentos')
  }

  const handleExportarPdf = () => {
    toast({
      title: 'Exportar PDF',
      description: 'A exportação de PDF estará disponível nas próximas etapas.',
    })
  }

  // Criação de novo ambiente
  const handleAddAmbiente = (nomeEscolhido: string) => {
    const nomeLimpo = nomeEscolhido.trim()
    if (!nomeLimpo) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe um nome válido para o ambiente.',
        variant: 'destructive',
      })
      return
    }

    const novoId = `amb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const novoAmbiente: AmbienteV2 = {
      id: novoId,
      nome: nomeLimpo,
      modulos: [],
    }

    setAmbientes((prev) => [...prev, novoAmbiente])
    // Define o novo ambiente como o Ambiente Ativo e garante que ele esteja expandido
    setActiveAmbienteId(novoId)
    setExpandedAmbientes((prev) => (prev.includes(novoId) ? prev : [...prev, novoId]))
    setIsOrcamentoFinalizado(false)

    toast({
      title: 'Ambiente adicionado',
      description: `O ambiente "${nomeLimpo}" agora é o ambiente ativo para configuração.`,
    })
  }

  const handleConfirmCustomAmbiente = () => {
    const nome = customAmbienteNome.trim()
    if (!nome) return
    handleAddAmbiente(nome)
    setCustomAmbienteNome('')
    setSelectedAmbienteOpcao('')
    setIsCustomDialogOpen(false)
  }

  // Handler acionado pelo botão destacado "+ Adicionar Ambiente" ao lado do dropdown
  const handleAddAmbienteClick = () => {
    if (!selectedAmbienteOpcao) {
      toast({
        title: 'Selecione um ambiente',
        description: 'Escolha uma opção no dropdown ou digite um nome personalizado.',
      })
      return
    }

    if (selectedAmbienteOpcao === '__custom__') {
      setCustomAmbienteNome('')
      setIsCustomDialogOpen(true)
      return
    }

    handleAddAmbiente(selectedAmbienteOpcao)
    setSelectedAmbienteOpcao('')
  }

  // Exclusão de ambiente
  const handleRemoveAmbiente = (ambienteId: string) => {
    const alvo = ambientes.find((a) => a.id === ambienteId)
    setAmbientes((prev) => {
      const restantes = prev.filter((a) => a.id !== ambienteId)
      if (activeAmbienteId === ambienteId) {
        const prox = restantes.length > 0 ? restantes[restantes.length - 1].id : null
        setActiveAmbienteId(prox)
        if (prox) {
          setExpandedAmbientes((cur) => (cur.includes(prox) ? cur : [...cur, prox]))
        }
      }
      return restantes
    })
    setExpandedAmbientes((prev) => prev.filter((id) => id !== ambienteId))
    if (editingAmbienteId === ambienteId) {
      setEditingAmbienteId(null)
    }
    toast({
      title: 'Ambiente removido',
      description: `O ambiente "${alvo?.nome || ''}" foi removido do orçamento.`,
    })
  }

  // Ação Guiada 1: Finalizar Ambiente e Criar Novo
  const handleFinalizarAmbienteECriarNovo = (ambienteId: string) => {
    const amb = ambientes.find((a) => a.id === ambienteId)
    // Recolhe o card do ambiente que estava ativo
    setExpandedAmbientes((prev) => prev.filter((id) => id !== ambienteId))
    // Sai do estado de ativo
    setActiveAmbienteId(null)
    setIsOrcamentoFinalizado(false)

    toast({
      title: 'Ambiente finalizado!',
      description: `"${amb?.nome || 'Ambiente'}" foi concluído e recolhido. Selecione o próximo ambiente acima.`,
    })

    // Rola e dá destaque para o container do seletor de ambientes
    setTimeout(() => {
      if (selectorContainerRef.current) {
        selectorContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        selectorContainerRef.current.classList.add(
          'ring-2',
          'ring-slate-900',
          'dark:ring-slate-100',
        )
        setTimeout(() => {
          selectorContainerRef.current?.classList.remove(
            'ring-2',
            'ring-slate-900',
            'dark:ring-slate-100',
          )
        }, 1500)
      }
    }, 100)
  }

  // Ação Guiada 2: Finalizar Orçamento (fecha o lançamento de ambientes e calcula o resumo geral do projeto)
  const handleFinalizarOrcamentoGuiado = () => {
    // Recolhe todos os ambientes
    setExpandedAmbientes([])
    setActiveAmbienteId(null)
    setIsOrcamentoFinalizado(true)

    toast({
      title: 'Orçamento Finalizado!',
      description: 'Lançamento de ambientes concluído. Confira o resumo geral do projeto.',
    })

    // Rola suavemente até o card de resumo geral
    setTimeout(() => {
      resumoGeralRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
  }

  // Controle de expansão do Accordion
  const toggleAccordion = (ambienteId: string) => {
    setExpandedAmbientes((prev) =>
      prev.includes(ambienteId) ? prev.filter((id) => id !== ambienteId) : [...prev, ambienteId],
    )
  }

  // Iniciar renomeação inline
  const handleStartRename = (amb: AmbienteV2) => {
    setEditingAmbienteId(amb.id)
    setEditingAmbienteNome(amb.nome)
    setTimeout(() => {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }, 50)
  }

  // Salvar renomeação inline
  const handleSaveRename = () => {
    if (!editingAmbienteId) return
    const novoNome = editingAmbienteNome.trim()
    if (!novoNome) {
      toast({
        title: 'Nome inválido',
        description: 'O nome do ambiente não pode ficar vazio.',
        variant: 'destructive',
      })
      return
    }

    setAmbientes((prev) =>
      prev.map((a) => (a.id === editingAmbienteId ? { ...a, nome: novoNome } : a)),
    )
    setEditingAmbienteId(null)
    toast({
      title: 'Ambiente renomeado',
      description: `Nome alterado para "${novoNome}".`,
    })
  }

  const handleCancelRename = () => {
    setEditingAmbienteId(null)
    setEditingAmbienteNome('')
  }

  // Clique em "+ Adicionar Módulo neste Ambiente" — abre o Drawer lateral para NOVO módulo (nome sempre vazio)
  const handleOpenAddModuloDrawer = (ambienteId: string) => {
    setTargetAmbienteId(ambienteId)
    setEditingModuloId(null)
    setEditingModuloData(null)
    setIsDrawerOpen(true)
  }

  // Clique em editar módulo existente na tabela comercial — abre o Drawer mantendo o nome e dados salvos
  const handleOpenEditModuloDrawer = (ambienteId: string, mod: ModuloComercialV2) => {
    setTargetAmbienteId(ambienteId)
    setEditingModuloId(mod.id)
    const dataToEdit: ModuloSalvoData = {
      id: mod.id,
      moduloId: mod.moduloId,
      nome: mod.modulo,
      descricaoTipo: mod.descricaoTipo,
      quantidade: mod.quantidade || 1,
      valorUnitario: mod.valorUnitario || 0,
      valorTotal: mod.valorTotal || 0,
      dimensoes: mod.dimensoes || { largura: 800, altura: 700, profundidade: 550 },
      perfilConstrutivo: (mod.perfilConstrutivo as any) || 'Fechado Envelopado',
      padraoProjeto: 'comercial',
      mdfExterno: { cor: 'Branco TX', espessura: 18 },
      mdfInterno: { cor: 'Branco TX', espessura: 15 },
      mdfFundo: 'MDF 6mm Branco TX',
      itensBOM: mod.itensBOM || [],
    }
    setEditingModuloData(dataToEdit)
    setIsDrawerOpen(true)
  }

  // Exclusão rápida de módulo
  const handleRemoveModulo = (ambienteId: string, moduloId: string) => {
    setAmbientes((prev) =>
      prev.map((amb) =>
        amb.id === ambienteId
          ? { ...amb, modulos: amb.modulos.filter((m) => m.id !== moduloId) }
          : amb,
      ),
    )
    setIsSavedSuccessfully(false)
  }

  // Salvar Módulo vindo do Drawer no Ambiente (Aba 3 confirmada)
  const handleSaveModuloNoAmbiente = (moduloData: ModuloSalvoData) => {
    if (!targetAmbienteId) return

    if (editingModuloId) {
      // Modo Edição: atualiza o módulo existente preservando seu id
      setAmbientes((prev) =>
        prev.map((amb) => {
          if (amb.id !== targetAmbienteId) return amb
          return {
            ...amb,
            modulos: amb.modulos.map((m) => {
              if (m.id !== editingModuloId) return m
              return {
                ...m,
                moduloId: moduloData.moduloId,
                modulo: moduloData.nome,
                descricaoTipo: moduloData.descricaoTipo,
                quantidade: moduloData.quantidade,
                valorUnitario: moduloData.valorUnitario,
                valorTotal: moduloData.valorTotal,
                dimensoes: moduloData.dimensoes,
                perfilConstrutivo: moduloData.perfilConstrutivo,
                itensBOM: moduloData.itensBOM,
              }
            }),
          }
        }),
      )
    } else {
      // Modo Novo Módulo
      const novoModulo: ModuloComercialV2 = {
        id: `mod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        moduloId: moduloData.moduloId,
        modulo: moduloData.nome,
        descricaoTipo: moduloData.descricaoTipo,
        quantidade: moduloData.quantidade,
        valorUnitario: moduloData.valorUnitario,
        valorTotal: moduloData.valorTotal,
        dimensoes: moduloData.dimensoes,
        perfilConstrutivo: moduloData.perfilConstrutivo,
        itensBOM: moduloData.itensBOM,
      }

      setAmbientes((prev) =>
        prev.map((amb) =>
          amb.id === targetAmbienteId ? { ...amb, modulos: [...amb.modulos, novoModulo] } : amb,
        ),
      )
    }

    // Marca como não salvo após alteração
    setIsSavedSuccessfully(false)

    const ambAlvo = ambientes.find((a) => a.id === targetAmbienteId)
    toast({
      title: editingModuloId ? 'Módulo atualizado!' : 'Módulo salvo no ambiente!',
      description: `"${moduloData.nome}" foi salvo em "${ambAlvo?.nome || 'Ambiente'}". Valor Geral atualizado.`,
    })

    setEditingModuloId(null)
    setEditingModuloData(null)
  }

  // Persistência Completa no Supabase: Orcamentos, Ambientes, Módulos e Peças BOM
  const handleSalvarOrcamento = async () => {
    const nomeLimpo = nomeCliente.trim()
    if (!nomeLimpo) {
      toast({
        title: 'Nome do cliente obrigatório',
        description: 'Informe o nome do cliente antes de salvar o orçamento.',
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)
    try {
      // 1. Converte ambientes e módulos para o formato de persistência
      const ambientesJsonPayload: AmbienteOrcamento[] = ambientes.map((amb) => {
        const modulosPayload: ModuloOrcamento[] = amb.modulos.map((mod) => {
          return {
            id: mod.id,
            modulo_id: mod.moduloId,
            nome: mod.modulo,
            dimensoes: mod.dimensoes
              ? {
                  largura: mod.dimensoes.largura,
                  altura: mod.dimensoes.altura,
                  profundidade: mod.dimensoes.profundidade,
                }
              : undefined,
            perfil_construtivo: mod.perfilConstrutivo,
            adaptacoes: mod.descricaoTipo,
            subtotal: mod.valorTotal,
            itens: mod.itensBOM || [],
          }
        })

        const subtotal = amb.modulos.reduce((acc, m) => acc + (Number(m.valorTotal) || 0), 0)

        return {
          id: amb.id,
          nome: amb.nome,
          modulos: modulosPayload,
          subtotal,
        }
      })

      // 2. Consolidação de todas as peças (BOM) do orçamento para a coluna bom_json
      const todasPecasBOM: OrcamentoBOMItem[] = []
      ambientes.forEach((amb) => {
        amb.modulos.forEach((mod) => {
          if (Array.isArray(mod.itensBOM)) {
            mod.itensBOM.forEach((peca) => {
              todasPecasBOM.push({
                ...peca,
                description: `${amb.nome} · ${mod.modulo}: ${peca.description}`,
              })
            })
          }
        })
      })

      const primeiroAmbienteNome = ambientes[0]?.nome || null
      const primeiroModuloNome = ambientes[0]?.modulos[0]?.modulo || null
      const dreCalculada = calcularDRE()

      if (orcamentoId) {
        // Atualiza orçamento existente
        const updated = await updateOrcamento(orcamentoId, {
          cliente_nome: nomeLimpo,
          data: `${dataOrcamento}T12:00:00.000Z`,
          valor_total: valorTotalGeral,
          status: statusOrcamento,
          ambiente: primeiroAmbienteNome,
          modulo: primeiroModuloNome,
          ambientes_json: ambientesJsonPayload,
          bom_json: todasPecasBOM,
          dre_json: dreCalculada,
        })

        if (!updated) {
          throw new Error('Falha ao atualizar orçamento no banco de dados.')
        }

        setIsSavedSuccessfully(true)
        toast({
          title: 'Orçamento atualizado!',
          description: `Orçamento nº ${updated.numero_sequencial ?? ''} salvo com sucesso.`,
        })
      } else {
        // Cria novo orçamento
        const created = await createOrcamento({
          cliente_nome: nomeLimpo,
          data: `${dataOrcamento}T12:00:00.000Z`,
          valor_total: valorTotalGeral,
          status: 'Rascunho',
          ambiente: primeiroAmbienteNome,
          modulo: primeiroModuloNome,
          ambientes_json: ambientesJsonPayload,
          bom_json: todasPecasBOM,
          dre_json: dreCalculada,
        })

        if (!created) {
          throw new Error('Falha ao criar orçamento no banco de dados.')
        }

        setOrcamentoId(created.id)
        setNumeroSequencial(created.numero_sequencial ?? null)
        setIsSavedSuccessfully(true)

        toast({
          title: 'Orçamento criado!',
          description: `Orçamento nº ${created.numero_sequencial ?? ''} salvo com sucesso no banco de dados.`,
        })
      }
    } catch (err: any) {
      console.error('Erro ao salvar orçamento:', err)
      toast({
        title: 'Erro ao salvar orçamento',
        description: err.message || 'Verifique a conexão com o Supabase e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Download em memória da Proposta Comercial (PDF do Cliente)
  const handleDownloadPropostaMemoria = async () => {
    const totalModulos = ambientes.reduce((acc, a) => acc + a.modulos.length, 0)
    if (totalModulos === 0) {
      toast({
        title: 'Nenhum módulo adicionado',
        description:
          'Adicione pelo menos um módulo em algum ambiente para gerar a Proposta Comercial.',
        variant: 'destructive',
      })
      return
    }

    setIsGeneratingPdf('proposta')
    try {
      const ambientesGrupos = ambientes.map((amb) => {
        const subtotal = amb.modulos.reduce((acc, m) => acc + (Number(m.valorTotal) || 0), 0)
        const itens = amb.modulos.map((m) => {
          const descricao =
            m.descricaoTipo ||
            montarDescricaoNaturalModulo({
              nome: m.modulo,
              dimensoes: m.dimensoes,
            })
          return {
            nome: m.modulo,
            descricao,
            quantidade: m.quantidade || 1,
            valorUnitario: m.valorUnitario || 0,
            valorTotal: m.valorTotal || 0,
          }
        })
        return {
          nome: amb.nome,
          subtotal,
          itens,
        }
      })

      const codigoFormatado =
        numeroSequencial !== null && numeroSequencial !== undefined
          ? String(numeroSequencial).padStart(3, '0')
          : 'PROV'

      await gerarPropostaComercial({
        orcamentoId: orcamentoId || undefined,
        numeroSequencial,
        codigo: codigoFormatado,
        data: `${dataOrcamento}T12:00:00.000Z`,
        cliente: {
          nome: nomeCliente.trim() || 'Cliente Não Informado',
        },
        empresa: perfilEmpresa,
        ambientes: [],
        ambientesGrupos,
        valorTotal: valorTotalGeral,
      })

      toast({
        title: '✓ Proposta Comercial Gerada',
        description: `Download do PDF para ${nomeCliente.trim() || 'Cliente'} concluído com sucesso.`,
      })
    } catch (err: unknown) {
      console.error('Erro ao gerar proposta comercial em memória:', err)
      const errorMsg =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Não foi possível gerar a Proposta Comercial.'
      toast({
        title: 'Erro ao gerar Proposta Comercial',
        description: errorMsg,
        variant: 'destructive',
      })
    } finally {
      setIsGeneratingPdf(null)
    }
  }

  // Download em memória da Análise de Custo (PDF Interno de Engenharia)
  const handleDownloadAnaliseCustoMemoria = async () => {
    const totalModulos = ambientes.reduce((acc, a) => acc + a.modulos.length, 0)
    if (totalModulos === 0) {
      toast({
        title: 'Nenhum módulo adicionado',
        description:
          'Adicione pelo menos um módulo em algum ambiente para gerar a Análise de Custo.',
        variant: 'destructive',
      })
      return
    }

    setIsGeneratingPdf('custo')
    try {
      const dre = calcularDRE()

      // Consolidação de todas as peças BOM
      const bomParaPdf: OrcamentoBOMItem[] = []
      ambientes.forEach((amb) => {
        amb.modulos.forEach((mod) => {
          if (Array.isArray(mod.itensBOM)) {
            mod.itensBOM.forEach((peca) => {
              bomParaPdf.push({
                ...peca,
                description: `${amb.nome} · ${mod.modulo}: ${peca.description}`,
              })
            })
          }
        })
      })

      // Mapeamento dos ambientes no formato AmbienteOrcamento para a tabela de engenharia
      const ambientesParaPdf: AmbienteOrcamento[] = ambientes.map((amb) => ({
        id: amb.id,
        nome: amb.nome,
        subtotal: amb.modulos.reduce((acc, m) => acc + (Number(m.valorTotal) || 0), 0),
        modulos: amb.modulos.map((m) => ({
          id: m.id,
          modulo_id: m.moduloId,
          nome: m.modulo,
          subtotal: m.valorTotal,
          dimensoes: m.dimensoes,
          perfil_construtivo: m.perfilConstrutivo,
          adaptacoes: m.descricaoTipo,
          itens: m.itensBOM || [],
        })),
      }))

      const codigoFormatado =
        numeroSequencial !== null && numeroSequencial !== undefined
          ? String(numeroSequencial).padStart(3, '0')
          : 'PROV'

      await gerarAnaliseCusto({
        orcamentoId: orcamentoId || undefined,
        numeroSequencial,
        codigo: codigoFormatado,
        versaoSistema: 'OrçaFácil v3.0 (v2)',
        data: `${dataOrcamento}T12:00:00.000Z`,
        cliente: {
          nome: nomeCliente.trim() || 'Cliente Não Informado',
        },
        empresa: perfilEmpresa,
        dre,
        bom: bomParaPdf,
        ambientes_json: ambientesParaPdf,
        valorTotalVenda: valorTotalGeral,
        valorTotalCusto: custoTotalGeral,
      })

      toast({
        title: '✓ Análise de Custo Gerada',
        description: `Download do relatório técnico para ${nomeCliente.trim() || 'Cliente'} concluído.`,
      })
    } catch (err: unknown) {
      console.error('Erro ao gerar análise de custo em memória:', err)
      const errorMsg =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Não foi possível gerar a Análise de Custo.'
      toast({
        title: 'Erro ao gerar Análise de Custo',
        description: errorMsg,
        variant: 'destructive',
      })
    } finally {
      setIsGeneratingPdf(null)
    }
  }

  // Nome do ambiente alvo para o título do drawer
  const targetAmbienteNome = useMemo(() => {
    return ambientes.find((a) => a.id === targetAmbienteId)?.nome || ''
  }, [ambientes, targetAmbienteId])

  return (
    <TooltipProvider delayDuration={150}>
      <div className="relative min-h-[calc(100vh-10rem)] pb-28 space-y-6">
        {/* 1. Cabeçalho principal com nome do sistema, botão Voltar e botão Exportar PDF */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleVoltar}
              className="h-9 px-3 gap-1.5 text-xs font-semibold border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </Button>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                  OrçaFácil 3.0
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  v2
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Novo fluxo de elaboração de orçamentos sob medida
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {numeroSequencial && (
              <span className="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                Nº {numeroSequencial}
              </span>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={handleExportarPdf}
              className="h-9 px-4 gap-2 text-xs font-semibold border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl shadow-xs"
            >
              <FileDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>Exportar PDF</span>
            </Button>

            <Button
              type="button"
              onClick={handleSalvarOrcamento}
              disabled={isSaving}
              className={cn(
                'h-9 px-4 gap-2 text-xs font-bold rounded-xl transition-all shadow-sm',
                isSavedSuccessfully
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900',
              )}
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : isSavedSuccessfully ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Salvo no Banco</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar Orçamento</span>
                </>
              )}
            </Button>
          </div>
        </header>

        {/* 2. Card de Dados do Cliente: Nome do Cliente e Data */}
        <Card className="border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <CardTitle className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs">
                1
              </div>
              <span>Dados do Cliente</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label
                  htmlFor="clientNameV2"
                  className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5"
                >
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  Nome do Cliente
                </Label>
                <Input
                  id="clientNameV2"
                  type="text"
                  placeholder="Ex.: Maria Oliveira"
                  value={nomeCliente}
                  onChange={(e) => setNomeCliente(e.target.value)}
                  className="h-11 rounded-xl text-sm border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="quoteDateV2"
                  className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Data
                </Label>
                <Input
                  id="quoteDateV2"
                  type="date"
                  value={dataOrcamento}
                  onChange={(e) => setDataOrcamento(e.target.value)}
                  className="h-11 rounded-xl text-sm border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Container Ambientes do Projeto */}
        <section aria-labelledby="ambientes-heading" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs">
                2
              </div>
              <div>
                <h2
                  id="ambientes-heading"
                  className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100"
                >
                  Ambientes do Projeto
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {ambientes.length === 0
                    ? 'Nenhum ambiente adicionado'
                    : `${ambientes.length} ${ambientes.length === 1 ? 'ambiente criado' : 'ambientes criados'}`}
                </p>
              </div>
            </div>

            {/* Ações do Header de Ambientes: Botões de PDF em Memória + Seletor dropdown com '+ Adicionar Ambiente' */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              {/* Botões de PDF em memória (Proposta Comercial e Análise de Custo) */}
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={ambientes.length === 0 || isGeneratingPdf === 'proposta'}
                      onClick={handleDownloadPropostaMemoria}
                      className="h-10 px-3 gap-1.5 text-xs font-semibold border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl shadow-xs disabled:opacity-50"
                    >
                      {isGeneratingPdf === 'proposta' ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-600 dark:text-slate-300" />
                      ) : (
                        <FileText className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      )}
                      <span className="hidden md:inline">Proposta Comercial</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {ambientes.length === 0
                      ? 'Adicione ambientes e módulos para gerar o PDF'
                      : 'Gerar Proposta Comercial (PDF do Cliente) em memória'}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={ambientes.length === 0 || isGeneratingPdf === 'custo'}
                      onClick={handleDownloadAnaliseCustoMemoria}
                      className="h-10 px-3 gap-1.5 text-xs font-semibold border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl shadow-xs disabled:opacity-50"
                    >
                      {isGeneratingPdf === 'custo' ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-600 dark:text-slate-300" />
                      ) : (
                        <Settings className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      )}
                      <span className="hidden md:inline">Análise de Custo</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {ambientes.length === 0
                      ? 'Adicione ambientes e módulos para gerar a Análise de Custo'
                      : 'Gerar Análise de Custo (PDF Interno de Engenharia) em memória'}
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Seletor dropdown ao lado do botão destacado '+ Adicionar Ambiente' */}
              <div
                ref={selectorContainerRef}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto p-1 rounded-2xl transition-all duration-300"
              >
                <Select
                  value={selectedAmbienteOpcao}
                  onValueChange={(val) => {
                    setSelectedAmbienteOpcao(val)
                    if (val === '__custom__') {
                      setCustomAmbienteNome('')
                      setIsCustomDialogOpen(true)
                    }
                  }}
                >
                  <SelectTrigger
                    aria-label="Selecionar ambiente"
                    className="h-10 w-full sm:w-56 rounded-xl text-xs font-medium border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20 shadow-xs"
                  >
                    <SelectValue placeholder="Selecione um ambiente…" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-950">
                    {OPCOES_PREDEFINIDAS_AMBIENTES.map((opcao) => (
                      <SelectItem key={opcao} value={opcao} className="text-xs cursor-pointer">
                        {opcao}
                      </SelectItem>
                    ))}
                    <SelectSeparator className="my-1 border-slate-100 dark:border-slate-800" />
                    <SelectItem
                      value="__custom__"
                      className="text-xs font-semibold cursor-pointer text-slate-900 dark:text-slate-100"
                    >
                      + Outro nome personalizado…
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  onClick={handleAddAmbienteClick}
                  disabled={!selectedAmbienteOpcao}
                  className={cn(
                    'h-10 px-4 gap-2 text-xs font-bold rounded-xl shadow-sm transition-all',
                    selectedAmbienteOpcao
                      ? 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 shadow-slate-900/15 cursor-pointer active:scale-[0.98]'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border-0',
                  )}
                  title={
                    !selectedAmbienteOpcao
                      ? 'Selecione uma opção no dropdown ao lado para adicionar o ambiente'
                      : 'Adicionar este ambiente ao projeto'
                  }
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Adicionar Ambiente</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Estado vazio quando nenhum ambiente foi adicionado */}
          {ambientes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-8 sm:p-12 flex flex-col items-center justify-center text-center gap-3 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs text-slate-400 dark:text-slate-500 flex items-center justify-center">
                <Layers className="w-6 h-6" />
              </div>
              <div className="max-w-md space-y-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Nenhum ambiente adicionado
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Escolha uma opção no seletor acima (ex.: Cozinha, Quarto 01, Banheiro) e clique em{' '}
                  <strong className="text-slate-700 dark:text-slate-300 font-semibold">
                    + Adicionar Ambiente
                  </strong>
                  .
                </p>
              </div>
            </div>
          ) : (
            /* Lista de Cards Expansíveis (estilo Accordion) */
            <div className="space-y-3.5">
              {ambientes.map((amb) => {
                const isOpen = expandedAmbientes.includes(amb.id)
                const isActive = activeAmbienteId === amb.id
                const subtotalAmbiente = subtotalPorAmbiente.get(amb.id) || 0
                const qtdModulos = amb.modulos.length
                const isEditing = editingAmbienteId === amb.id

                return (
                  <div
                    key={amb.id}
                    className={cn(
                      'rounded-2xl border transition-all duration-200 overflow-hidden',
                      isActive
                        ? 'bg-white dark:bg-slate-900 ring-2 ring-slate-900 dark:ring-slate-100 border-slate-900 dark:border-slate-100 shadow-md shadow-slate-900/5'
                        : isOpen
                          ? 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 shadow-xs'
                          : 'bg-slate-50/70 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 opacity-90 hover:opacity-100 shadow-2xs',
                    )}
                  >
                    {/* Cabeçalho do Card Accordion: Nome, Qtd de módulos, Subtotal e Ações */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (!isEditing) {
                          toggleAccordion(amb.id)
                        }
                      }}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && !isEditing) {
                          e.preventDefault()
                          toggleAccordion(amb.id)
                        }
                      }}
                      className={cn(
                        'w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3.5 text-left select-none cursor-pointer transition-colors',
                        isActive
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                          : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/40 text-slate-900 dark:text-slate-100',
                      )}
                    >
                      {/* Lado esquerdo: Chevron indicador, Badge de Ambiente Ativo, Nome editável e Badge de qtd de módulos */}
                      <div
                        className="flex items-center gap-2.5 min-w-0"
                        onClick={(e) => {
                          // Não propaga o toggle quando interagir com a edição do nome
                          if (isEditing) {
                            e.stopPropagation()
                          }
                        }}
                      >
                        <button
                          type="button"
                          aria-label={isOpen ? 'Recolher ambiente' : 'Expandir ambiente'}
                          className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200',
                            isActive
                              ? 'bg-white/15 text-white dark:bg-slate-900/15 dark:text-slate-900'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
                          )}
                        >
                          <ChevronRight
                            className={cn(
                              'w-4 h-4 transition-transform duration-200',
                              isOpen && 'rotate-90',
                            )}
                          />
                        </button>

                        {/* Tag destacada de Ambiente Ativo */}
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-white text-slate-900 dark:bg-slate-900 dark:text-white shrink-0 shadow-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Ambiente Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 shrink-0">
                            Concluído
                          </span>
                        )}

                        {isEditing ? (
                          <div
                            className="flex items-center gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Input
                              ref={renameInputRef}
                              value={editingAmbienteNome}
                              onChange={(e) => setEditingAmbienteNome(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  handleSaveRename()
                                } else if (e.key === 'Escape') {
                                  e.preventDefault()
                                  handleCancelRename()
                                }
                              }}
                              className="h-8 text-sm font-bold w-48 sm:w-64 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border-slate-300"
                              placeholder="Nome do ambiente..."
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSaveRename()
                              }}
                              className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"
                              title="Salvar nome"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCancelRename()
                              }}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                              title="Cancelar edição"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={cn(
                                'font-bold text-sm sm:text-base truncate',
                                isActive
                                  ? 'text-white dark:text-slate-900'
                                  : 'text-slate-900 dark:text-slate-100',
                              )}
                            >
                              {amb.nome}
                            </span>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleStartRename(amb)
                              }}
                              className={cn(
                                'w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
                                isActive
                                  ? 'text-white/70 hover:text-white hover:bg-white/10 dark:text-slate-900/70 dark:hover:text-slate-900 dark:hover:bg-slate-900/10'
                                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800',
                              )}
                              title="Editar nome do ambiente"
                              aria-label={`Editar nome de ${amb.nome}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            <span
                              className={cn(
                                'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0',
                                isActive
                                  ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700',
                              )}
                            >
                              {qtdModulos} {qtdModulos === 1 ? 'módulo' : 'módulos'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Lado direito: Subtotal do ambiente, botão Tornar Ativo (se não for ativo) e botão de excluir */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <div className="text-left sm:text-right">
                          <span
                            className={cn(
                              'text-[10px] uppercase font-semibold tracking-wider block',
                              isActive
                                ? 'text-white/70 dark:text-slate-900/70'
                                : 'text-slate-400 dark:text-slate-500',
                            )}
                          >
                            Subtotal
                          </span>
                          <span
                            className={cn(
                              'text-sm sm:text-base font-bold font-mono',
                              isActive
                                ? 'text-white dark:text-slate-900'
                                : 'text-slate-900 dark:text-slate-100',
                            )}
                          >
                            {formatCurrency(subtotalAmbiente)}
                          </span>
                        </div>

                        {!isActive && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setActiveAmbienteId(amb.id)
                              setExpandedAmbientes((cur) =>
                                cur.includes(amb.id) ? cur : [...cur, amb.id],
                              )
                              setIsOrcamentoFinalizado(false)
                            }}
                            className="h-7 px-2 text-[11px] font-semibold border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                            title="Tornar este o ambiente ativo para edição"
                          >
                            Editar Módulos
                          </Button>
                        )}

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveAmbiente(amb.id)
                          }}
                          className={cn(
                            'h-8 w-8 p-0 rounded-lg shrink-0 transition-colors',
                            isActive
                              ? 'text-white/70 hover:text-white hover:bg-white/10 dark:text-slate-900/70 dark:hover:text-slate-900 dark:hover:bg-slate-900/10'
                              : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40',
                          )}
                          title={`Excluir ambiente "${amb.nome}"`}
                          aria-label={`Excluir ambiente ${amb.nome}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Conteúdo Expansível (Accordion Content) */}
                    {isOpen && (
                      <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 p-4 sm:p-5 space-y-4 animate-fade-in">
                        {/* Tabela Comercial Limpa */}
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden">
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800">
                                  <TableHead className="py-3 px-4 font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400 w-1/4">
                                    Módulo
                                  </TableHead>
                                  <TableHead className="py-3 px-4 font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400 w-2/5">
                                    Descrição / Tipo
                                  </TableHead>
                                  <TableHead className="py-3 px-4 font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400 text-center w-20">
                                    Qtd
                                  </TableHead>
                                  <TableHead className="py-3 px-4 font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400 text-right w-32">
                                    Valor Unitário
                                  </TableHead>
                                  <TableHead className="py-3 px-4 font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100 text-right w-32">
                                    Valor Total
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {amb.modulos.length === 0 ? (
                                  /* Linha com dados mock/zeros para visualização limpa comercial */
                                  <TableRow className="hover:bg-transparent">
                                    <TableCell className="py-6 px-4 font-medium text-slate-400 text-xs italic">
                                      <div className="flex items-center gap-2">
                                        <Box className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                                        <span>Nenhum módulo adicionado ainda</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-6 px-4 text-xs text-slate-400 italic">
                                      Os módulos deste ambiente serão configurados na próxima etapa
                                    </TableCell>
                                    <TableCell className="py-6 px-4 text-xs text-center font-mono text-slate-400">
                                      0
                                    </TableCell>
                                    <TableCell className="py-6 px-4 text-xs text-right font-mono text-slate-400">
                                      {formatCurrency(0)}
                                    </TableCell>
                                    <TableCell className="py-6 px-4 text-xs text-right font-mono font-semibold text-slate-400">
                                      {formatCurrency(0)}
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  amb.modulos.map((mod) => (
                                    <TableRow
                                      key={mod.id}
                                      className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 group"
                                    >
                                      <TableCell className="py-3.5 px-4 font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                                        <div className="flex items-center gap-2">
                                          <Box className="w-4 h-4 text-slate-500 shrink-0" />
                                          <span>{mod.modulo}</span>
                                          <button
                                            type="button"
                                            onClick={() => handleOpenEditModuloDrawer(amb.id, mod)}
                                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                            title={`Editar módulo "${mod.modulo}"`}
                                            aria-label={`Editar módulo ${mod.modulo}`}
                                          >
                                            <Pencil className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </TableCell>
                                      <TableCell className="py-3.5 px-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                                        {mod.descricaoTipo}
                                      </TableCell>
                                      <TableCell className="py-3.5 px-4 text-xs sm:text-sm text-center font-mono text-slate-700 dark:text-slate-300">
                                        {mod.quantidade}
                                      </TableCell>
                                      <TableCell className="py-3.5 px-4 text-xs sm:text-sm text-right font-mono text-slate-700 dark:text-slate-300">
                                        {formatCurrency(mod.valorUnitario)}
                                      </TableCell>
                                      <TableCell className="py-3.5 px-4 text-xs sm:text-sm text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                                        <div className="flex items-center justify-end gap-2">
                                          <span>{formatCurrency(mod.valorTotal)}</span>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveModulo(amb.id, mod.id)}
                                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                            title={`Remover módulo "${mod.modulo}"`}
                                            aria-label={`Remover módulo ${mod.modulo}`}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))
                                )}
                              </TableBody>
                            </Table>
                          </div>

                          {/* Banner discreto de conformidade comercial: sem peças técnicas */}
                          <div className="bg-slate-50/70 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 px-4 py-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1.5">
                              <Info className="w-3.5 h-3.5 text-slate-400" />
                              <span>
                                Proposta comercial limpa — peças técnicas não são exibidas nesta
                                tabela
                              </span>
                            </span>
                            <span className="font-semibold text-slate-600 dark:text-slate-300">
                              Subtotal do ambiente: {formatCurrency(subtotalAmbiente)}
                            </span>
                          </div>
                        </div>

                        {/* Linha com botão '+ Adicionar Módulo neste Ambiente' */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenAddModuloDrawer(amb.id)}
                            className="h-9 px-3.5 gap-2 text-xs font-semibold rounded-xl border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-2xs w-full sm:w-auto"
                          >
                            <Plus className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                            <span>+ Adicionar Módulo neste Ambiente</span>
                          </Button>

                          <span className="text-[11px] text-slate-400 dark:text-slate-500 text-center sm:text-right">
                            Configure dimensões, foto/IA e perfil no painel lateral
                          </span>
                        </div>

                        {/* Botões de Ação Guiada no Rodapé do Ambiente (apenas quando o ambiente está ATIVO) */}
                        {isActive && (
                          <div className="pt-4 mt-2 border-t border-slate-200/90 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
                            {/* Botão Secundário: [ Finalizar Ambiente e Criar Novo ] */}
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleFinalizarAmbienteECriarNovo(amb.id)}
                              disabled={amb.modulos.length === 0}
                              className="h-10 px-4 text-xs font-semibold rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs transition-all disabled:opacity-50"
                              title={
                                amb.modulos.length === 0
                                  ? 'Adicione pelo menos um módulo antes de finalizar o ambiente'
                                  : 'Conclui e recolhe este ambiente, abrindo a seleção do próximo'
                              }
                            >
                              <Check className="w-4 h-4 text-slate-500 mr-1.5" />
                              <span>Finalizar Ambiente e Criar Novo</span>
                            </Button>

                            {/* Botão Principal: [ Finalizar Orçamento ] */}
                            <Button
                              type="button"
                              onClick={handleFinalizarOrcamentoGuiado}
                              disabled={amb.modulos.length === 0}
                              className="h-10 px-5 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 shadow-sm transition-all disabled:opacity-50"
                              title={
                                amb.modulos.length === 0
                                  ? 'Adicione pelo menos um módulo antes de finalizar o orçamento'
                                  : 'Encerra o lançamento de ambientes e calcula o resumo geral do projeto'
                              }
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1.5" />
                              <span>Finalizar Orçamento</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* 4. Resumo Geral do Projeto (exibido quando o orçamento for finalizado pelo fluxo guiado ou quando houver ambientes) */}
        {isOrcamentoFinalizado && ambientes.length > 0 && (
          <section
            ref={resumoGeralRef}
            aria-labelledby="resumo-geral-heading"
            className="rounded-2xl border-2 border-slate-900 dark:border-slate-100 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 p-6 sm:p-7 shadow-lg space-y-6 animate-fade-in"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Lançamento Concluído</span>
                </div>
                <h2
                  id="resumo-geral-heading"
                  className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight"
                >
                  Resumo Geral do Projeto
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Cliente:{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {nomeCliente || 'Não informado'}
                  </strong>{' '}
                  · Data: {dataOrcamento}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (ambientes.length > 0) {
                      const firstId = ambientes[0].id
                      setActiveAmbienteId(firstId)
                      setExpandedAmbientes([firstId])
                      setIsOrcamentoFinalizado(false)
                    }
                  }}
                  className="h-9 px-3.5 text-xs font-semibold rounded-xl border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  Reabrir Lançamento
                </Button>

                <Button
                  type="button"
                  onClick={handleSalvarOrcamento}
                  disabled={isSaving}
                  className={cn(
                    'h-9 px-4 text-xs font-bold rounded-xl text-white shadow-sm transition-all',
                    isSavedSuccessfully
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900',
                  )}
                >
                  {isSaving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
                      <span>Salvando...</span>
                    </>
                  ) : isSavedSuccessfully ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-1.5" />
                      <span>Salvo no Banco</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-1.5" />
                      <span>Salvar Orçamento</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Cards com Métricas Gerais */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between shadow-2xs">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Total de Ambientes
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                    {ambientes.length}
                  </span>
                  <span className="text-xs text-slate-400">
                    {ambientes.length === 1 ? 'ambiente' : 'ambientes'}
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between shadow-2xs">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Total de Módulos
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                    {ambientes.reduce((acc, a) => acc + a.modulos.length, 0)}
                  </span>
                  <span className="text-xs text-slate-400">
                    {ambientes.reduce((acc, a) => acc + a.modulos.length, 0) === 1
                      ? 'módulo'
                      : 'módulos'}
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 p-4 flex flex-col justify-between shadow-md">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 dark:text-slate-600">
                  Valor Total Geral
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight">
                    {formatCurrency(valorTotalGeral)}
                  </span>
                </div>
              </div>
            </div>

            {/* Discriminação por Ambiente */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                <span>Detalhamento Comercial por Ambiente</span>
                <span>Subtotal</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {ambientes.map((amb) => {
                  const sub = subtotalPorAmbiente.get(amb.id) || 0
                  return (
                    <div
                      key={amb.id}
                      className="px-4 py-3 flex items-center justify-between text-xs sm:text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Box className="w-4 h-4 text-slate-400" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {amb.nome}
                        </span>
                        <span className="text-xs text-slate-400">
                          ({amb.modulos.length} {amb.modulos.length === 1 ? 'módulo' : 'módulos'})
                        </span>
                      </div>
                      <span className="font-bold font-mono text-slate-900 dark:text-slate-100">
                        {formatCurrency(sub)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* Modal/Dialog para Adicionar Ambiente com Nome Livre/Personalizado */}
        <Dialog open={isCustomDialogOpen} onOpenChange={setIsCustomDialogOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                Nome do Novo Ambiente
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                Informe o nome do ambiente personalizado para adicioná-lo ao orçamento.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleConfirmCustomAmbiente()
              }}
              className="space-y-4 pt-2"
            >
              <div className="space-y-1.5">
                <Label
                  htmlFor="customAmbienteInput"
                  className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  Nome do Cômodo / Ambiente
                </Label>
                <Input
                  id="customAmbienteInput"
                  autoFocus
                  placeholder="Ex.: Varanda Gourmet, Adega, Closet 01..."
                  value={customAmbienteNome}
                  onChange={(e) => setCustomAmbienteNome(e.target.value)}
                  className="h-10 text-sm rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              <DialogFooter className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCustomDialogOpen(false)}
                  className="h-9 text-xs rounded-xl border-slate-300 dark:border-slate-700"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!customAmbienteNome.trim()}
                  className="h-9 text-xs rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 font-semibold"
                >
                  Adicionar Ambiente
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Drawer Lateral (Sheet) para Configuração do Módulo */}
        <ModuleEditDrawer
          open={isDrawerOpen}
          onOpenChange={(open) => {
            setIsDrawerOpen(open)
            if (!open) {
              setEditingModuloId(null)
              setEditingModuloData(null)
            }
          }}
          ambienteNome={targetAmbienteNome}
          initialData={editingModuloData}
          onSaveModulo={handleSaveModuloNoAmbiente}
        />

        {/* 4. Barra fixa no rodapé com o Valor Total Geral dinâmico */}
        <aside
          aria-label="Resumo do Valor Total"
          className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-2.5 h-2.5 rounded-full',
                  valorTotalGeral > 0
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-slate-400 dark:bg-slate-600',
                )}
              />
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Valor Total Geral
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">
                  Soma de todos os ambientes e módulos
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tracking-tight">
                  {formatCurrency(valorTotalGeral)}
                </span>
              </div>

              <Button
                type="button"
                onClick={handleSalvarOrcamento}
                disabled={isSaving}
                className={cn(
                  'h-9 px-4 gap-2 text-xs font-bold rounded-xl transition-all shadow-sm hidden sm:inline-flex',
                  isSavedSuccessfully
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900',
                )}
              >
                {isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : isSavedSuccessfully ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Salvo</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Salvar Orçamento</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </TooltipProvider>
  )
}
