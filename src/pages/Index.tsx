// OrçaFácil v0.0.61
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  User,
  Home,
  Box,
  Sparkles,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  HelpCircle,
  FileSpreadsheet,
  Ruler,
  ArrowUpDown,
  Star,
  Layers3,
  Package,
  CreditCard,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { AmbienteSelector } from '@/components/AmbienteSelector'
import { CustomerDropzone, UploadedFileState } from '@/components/CustomerDropzone'
import { LibraryMatchCard } from '@/components/LibraryMatchCard'
import { PricingTable } from '@/components/PricingTable'
import { FinalizeQuoteModal } from '@/components/FinalizeQuoteModal'
import { AddFromCatalogModal } from '@/components/AddFromCatalogModal'
import { AddCustomItemModal } from '@/components/AddCustomItemModal'
import { BudgetItem } from '@/data/mockData'
import { createOrcamento, updateOrcamento, fetchOrcamentoById } from '@/services/orcamentos'
import {
  fetchTemplatesEngenharia,
  TemplateEngenharia,
  type PerfilConstrutivo,
} from '@/services/templates'
import { toast } from '@/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import {
  calcularBOM,
  custoConsolidado,
  valorConsolidado,
  type PadraoProjeto,
  type ModuloComposicao,
} from '@/lib/pricing'
import { fetchCatalogoMateriais, type CatalogoMaterial } from '@/services/catalogo'
import { fetchPerfilEmpresa, type PerfilEmpresa } from '@/services/empresa'
import { fetchConfigEngenharia } from '@/services/engenharia'
import { gerarPropostaComercial, gerarAnaliseCusto, montarDescricaoNaturalModulo } from '@/lib/pdf'
import type {
  Orcamento,
  OrcamentoBOMItem,
  OrcamentoDRE,
  AmbienteOrcamento,
  ModuloOrcamento,
} from '@/services/orcamentos'
import { ChevronDown, ChevronUp, Trash2, FolderPlus, RotateCcw } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import {
  clearDraftStorage as clearDraftUtil,
  readDraftFromStorage,
  writeDraftToStorage,
  type DraftData,
} from '@/lib/draftStorage'

// Ambientes permitidos no Select (array estático conforme especificação).
const AMBIENTES = ['Cozinha', 'Quarto', 'Sala', 'Banheiro']

export default function Index() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const editingId = searchParams.get('id')

  // Form Identification Header state
  const [clientName, setClientName] = useState('')
  const [room, setRoom] = useState('')
  const [ambienteSelecionado, setAmbienteSelecionado] = useState<string>('')
  const [selectedModuleId, setSelectedModuleId] = useState<string>('')
  const [loadingEditingQuote, setLoadingEditingQuote] = useState<boolean>(false)

  // MULTI-AMBIENTE: Estrutura completa de ambientes e módulos adicionados
  // Orçamentos novos iniciam sem ambientes hardcodados ([]).
  const [ambientes, setAmbientes] = useState<AmbienteOrcamento[]>([])
  const [activeAmbienteId, setActiveAmbienteId] = useState<string>('')
  const [novoAmbienteNome, setNovoAmbienteNome] = useState<string>('')
  const [isAddingAmbiente, setIsAddingAmbiente] = useState<boolean>(false)

  // Módulos disponíveis — fetch 100% dinâmico do Supabase (tabela TemplatesEngenharia)
  const [modulosDisponiveis, setModulosDisponiveis] = useState<TemplateEngenharia[]>([])
  const [loadingModulos, setLoadingModulos] = useState<boolean>(true)

  // Catálogo de materiais (preços) — carregado do Supabase; fallback para CUSTOS_UNITARIOS.
  const [catalogoMateriais, setCatalogoMateriais] = useState<CatalogoMaterial[]>([])

  // Upload state — agora suporta MÚLTIPLAS imagens (array de perspectivas)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileState[]>([])

  // Estado de análise automática da IA (simulação da chamada OpenAI)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const analyzeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Justificativa retornada pela IA (GPT-4o Vision) sobre o match do módulo.
  const [matchJustificativa, setMatchJustificativa] = useState<string | null>(null)

  // Estados de comparação de escala e dimensões retornados pela IA
  const [fatorEscalaIA, setFatorEscalaIA] = useState<number | null>(null)
  const [dimensoesOriginaisIA, setDimensoesOriginaisIA] = useState<{
    largura: number
    altura: number
    profundidade: number
  } | null>(null)
  const [dimensoesEstimadasIA, setDimensoesEstimadasIA] = useState<{
    largura: number
    altura: number
    profundidade: number
  } | null>(null)
  const [isCustomModuleIA, setIsCustomModuleIA] = useState<boolean>(false)
  const [customModuleNameIA, setCustomModuleNameIA] = useState<string>('')
  const [adaptacoesIA, setAdaptacoesIA] = useState<string | null>(null)
  const [perfilSugeridoIA, setPerfilSugeridoIA] = useState<string | null>(null)
  const [confiancaIA, setConfiancaIA] = useState<'alta' | 'media' | 'baixa' | null>(null)
  const [isModuloConfirmado, setIsModuloConfirmado] = useState<boolean>(false)

  // 🗄️ DECOMPOSIÇÃO ESTRUTURADA DE MÓDULO (portas, gavetas, prateleiras, interior)
  const [composicaoModulo, setComposicaoModulo] = useState<ModuloComposicao>({
    portas: { qtd: 0, tipo: 'nenhum' },
    gavetas: { qtd: 0 },
    prateleiras: { qtd: 2 },
    cabideiro: false,
    sapateira: false,
    puxadores: 0,
  })

  // Validation errors
  const [errors, setErrors] = useState<{
    clientName?: string
    room?: string
    selectedModule?: string
    uploadedFile?: string
  }>({})

  // Loading & Results Visibility state
  const [isGenerating, setIsGenerating] = useState(false)
  const [showResults, setShowResults] = useState(false)

  // Itens manuais adicionados pelo usuário (somam-se à BOM dinâmica).
  const [manualItems, setManualItems] = useState<BudgetItem[]>([])

  // Modais de adição de itens
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false)
  const [isCustomItemModalOpen, setIsCustomItemModalOpen] = useState(false)

  // Modal confirmation state
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false)
  const [isSavingQuote, setIsSavingQuote] = useState(false)
  const [isQuoteSaved, setIsQuoteSaved] = useState(false)
  const [savedOrcamentoRecord, setSavedOrcamentoRecord] = useState<Orcamento | null>(null)

  // Perfil da Empresa (para PDFs)
  const [perfilEmpresa, setPerfilEmpresa] = useState<PerfilEmpresa | null>(null)

  // Configurações da Engenharia Financeira (markup, rateio, impostos, comissões)
  const [markupEngenharia, setMarkupEngenharia] = useState<number>(2.5)
  const [configEngenhariaCompleta, setConfigEngenhariaCompleta] = useState<{
    markup_padrao: number
    impostos_percent: number
    comissoes_percent: number
    custo_financeiro_percent: number
    indice_rateio: number
  } | null>(null)

  // 📐 DIMENSÕES REAIS DO MÓDULO (inputs manuais — defaults paramétricos).
  const [dimensoes, setDimensoes] = useState({
    largura: 1800,
    altura: 2200,
    profundidade: 600,
  })

  // 🎨 ESPECIFICAÇÃO DE MATERIAIS (acabamento do módulo).
  const [padraoProjeto, setPadraoProjeto] = useState<PadraoProjeto>('comercial')
  const [mdfExterno, setMdfExterno] = useState<{ cor: string; espessura: 15 | 18 }>({
    cor: 'Branco TX',
    espessura: 18,
  })
  const [mdfInterno, setMdfInterno] = useState<{ cor: string; espessura: 15 | 18 }>({
    cor: 'Branco TX',
    espessura: 15,
  })
  const [mdfFundo, setMdfFundo] = useState<string>('MDF 6mm Branco TX')

  // Estado para armazenar itens carregados diretamente do banco (preserva cotação original)
  const [savedLoadedItems, setSavedLoadedItems] = useState<BudgetItem[] | null>(null)

  // 💳 TERMOS COMERCIAIS
  const [formaPagamento, setFormaPagamento] = useState('')
  const [observacoes, setObservacoes] = useState('')

  // 📝 RASCUNHO AUTOMÁTICO (localStorage)
  const [hasRestoredDraft, setHasRestoredDraft] = useState<boolean>(false)
  const [draftRestoredTime, setDraftRestoredTime] = useState<string | null>(null)
  // ID do orçamento ao qual o rascunho atual está vinculado (se houver)
  const [draftLinkedOrcamentoId, setDraftLinkedOrcamentoId] = useState<string | null>(null)
  const isDraftInitializedRef = useRef<boolean>(false)

  // Section references for scrolling
  const topRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const matchCardRef = useRef<HTMLDivElement>(null)

  // Função para limpar rascunho com segurança
  const clearDraftStorage = () => {
    clearDraftUtil(user?.id)
    setDraftLinkedOrcamentoId(null)
  }

  // Função para restaurar o formulário zerado ao descartar rascunho
  const handleDiscardDraft = () => {
    clearDraftStorage()
    setHasRestoredDraft(false)
    setDraftRestoredTime(null)
    setDraftLinkedOrcamentoId(null)
    setClientName('')
    setRoom('')
    setAmbienteSelecionado('')
    setSelectedModuleId('')
    setAmbientes([])
    setActiveAmbienteId('')
    setDimensoes({ largura: 1800, altura: 2200, profundidade: 600 })
    setComposicaoModulo({
      portas: { qtd: 0, tipo: 'nenhum' },
      gavetas: { qtd: 0 },
      prateleiras: { qtd: 2 },
      cabideiro: false,
      sapateira: false,
      puxadores: 0,
      semTamponamento: false,
      tampoPedra: false,
    })
    setPadraoProjeto('comercial')
    setMdfExterno({ cor: 'Branco TX', espessura: 18 })
    setMdfInterno({ cor: 'Branco TX', espessura: 15 })
    setMdfFundo('MDF 6mm Branco TX')
    setFormaPagamento('')
    setObservacoes('')
    setShowResults(false)
    setManualItems([])
    setUploadedFiles([])
    setErrors({})
    toast({
      title: 'Rascunho descartado',
      description: 'O formulário foi reiniciado do zero.',
    })
  }

  // EFEITO: Restauração do rascunho ao montar a tela (se não estiver em modo edição ?id=)
  useEffect(() => {
    if (editingId) return // Não restaura rascunho quando está editando orçamento específico
    if (isDraftInitializedRef.current) return
    isDraftInitializedRef.current = true

    let isCancelled = false

    const initDraft = async () => {
      try {
        const parsed = readDraftFromStorage(user?.id)
        if (!parsed) return

        // 1. SE O RASCUNHO ESTIVER VINCULADO A UM ORÇAMENTO, VALIDA SE ELE AINDA EXISTE NO BANCO
        if (parsed.orcamentoId) {
          const { data: existingRecord, error } = await supabase
            .from('Orcamentos')
            .select('id')
            .eq('id', parsed.orcamentoId)
            .maybeSingle()

          if (isCancelled) return

          // Se deu erro ou o orçamento não existe mais no banco, descarta o rascunho silenciosamente
          if (error || !existingRecord) {
            clearDraftUtil(user?.id)
            return
          }
        }

        // 2. Verifica se o rascunho tem algum dado preenchido
        const hasContent =
          Boolean(parsed.clientName?.trim()) ||
          Boolean(parsed.selectedModuleId) ||
          (Array.isArray(parsed.ambientes) && parsed.ambientes.length > 0) ||
          (Array.isArray(parsed.manualItems) && parsed.manualItems.length > 0)

        if (!hasContent) return

        if (parsed.clientName) setClientName(parsed.clientName)
        if (parsed.room) setRoom(parsed.room)
        if (parsed.ambienteSelecionado) setAmbienteSelecionado(parsed.ambienteSelecionado)
        if (parsed.selectedModuleId) setSelectedModuleId(parsed.selectedModuleId)
        if (Array.isArray(parsed.ambientes)) setAmbientes(parsed.ambientes)
        if (parsed.activeAmbienteId) setActiveAmbienteId(parsed.activeAmbienteId)
        if (parsed.dimensoes) setDimensoes(parsed.dimensoes)
        if (parsed.composicaoModulo) setComposicaoModulo(parsed.composicaoModulo)
        if (parsed.padraoProjeto) setPadraoProjeto(parsed.padraoProjeto)
        if (parsed.mdfExterno) setMdfExterno(parsed.mdfExterno)
        if (parsed.mdfInterno) setMdfInterno(parsed.mdfInterno)
        if (parsed.mdfFundo) setMdfFundo(parsed.mdfFundo)
        if (parsed.formaPagamento) setFormaPagamento(parsed.formaPagamento)
        if (parsed.observacoes) setObservacoes(parsed.observacoes)
        if (typeof parsed.showResults === 'boolean') setShowResults(parsed.showResults)
        if (Array.isArray(parsed.manualItems)) setManualItems(parsed.manualItems)
        if (parsed.orcamentoId) setDraftLinkedOrcamentoId(parsed.orcamentoId)

        if (Array.isArray(parsed.uploadedFilesMeta) && parsed.uploadedFilesMeta.length > 0) {
          const restoredUploads: UploadedFileState[] = parsed.uploadedFilesMeta.map((meta) => ({
            file: new File([], meta.name, { type: 'image/jpeg' }),
            previewUrl: meta.previewUrl || '',
            name: meta.name,
            sizeFormatted: meta.size > 0 ? `${(meta.size / 1024).toFixed(1)} KB` : '0 B',
            isPdf: meta.name.toLowerCase().endsWith('.pdf'),
          }))
          setUploadedFiles(restoredUploads)
        }

        setHasRestoredDraft(true)
        const dateStr = parsed.savedAt
          ? new Date(parsed.savedAt).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })
          : null
        setDraftRestoredTime(dateStr)
      } catch (err) {
        console.warn('Erro ao restaurar rascunho de orcamento:', err)
      }
    }

    initDraft()

    return () => {
      isCancelled = true
    }
  }, [editingId, user?.id])

  // EFEITO: Autosave com debounce (~500ms) quando os estados mudam
  useEffect(() => {
    // Se estiver editando um orçamento específico (?id=), vincula as alterações a esse ID
    const effectiveOrcamentoId = editingId || draftLinkedOrcamentoId || null

    const timer = setTimeout(() => {
      try {
        // Checa se há algo para salvar
        const hasContent =
          Boolean(clientName.trim()) ||
          Boolean(selectedModuleId) ||
          ambientes.length > 0 ||
          manualItems.length > 0 ||
          showResults

        if (!hasContent) {
          return
        }

        const draftPayload: DraftData = {
          version: 1,
          savedAt: Date.now(),
          orcamentoId: effectiveOrcamentoId,
          clientName,
          room,
          ambienteSelecionado,
          selectedModuleId,
          ambientes,
          activeAmbienteId,
          dimensoes,
          composicaoModulo,
          padraoProjeto,
          mdfExterno,
          mdfInterno,
          mdfFundo,
          formaPagamento,
          observacoes,
          showResults,
          manualItems,
          uploadedFilesMeta: uploadedFiles.map((f, idx) => ({
            id: `upload-${idx}-${f.name}`,
            name: f.name || f.file?.name || 'arquivo',
            size: f.file?.size || 0,
            previewUrl:
              f.previewUrl && !f.previewUrl.startsWith('blob:') && f.previewUrl.length < 500000
                ? f.previewUrl
                : undefined,
          })),
        }

        writeDraftToStorage(draftPayload, user?.id)
      } catch (err) {
        // Blindagem contra QuotaExceededError ou JSON circular
        console.warn('Falha ao persistir rascunho no localStorage:', err)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [
    editingId,
    draftLinkedOrcamentoId,
    user?.id,
    clientName,
    room,
    ambienteSelecionado,
    selectedModuleId,
    ambientes,
    activeAmbienteId,
    dimensoes,
    composicaoModulo,
    padraoProjeto,
    mdfExterno,
    mdfInterno,
    mdfFundo,
    formaPagamento,
    observacoes,
    showResults,
    manualItems,
    uploadedFiles,
  ])

  // FETCH REAL DO SUPABASE — carrega os módulos da tabela TemplatesEngenharia.
  useEffect(() => {
    let active = true
    setLoadingModulos(true)

    fetchTemplatesEngenharia()
      .then(({ data: modulos, error }) => {
        if (!active) return
        if (error) {
          console.error('Falha ao carregar módulos disponíveis:', error)
          return
        }
        setModulosDisponiveis(modulos)

        // Suporte a pré-preenchimento via query param ?modulo=<id> (se não estiver em modo edição)
        const modParam = searchParams.get('modulo')
        const idParam = searchParams.get('id')
        if (modParam && !idParam) {
          const encontrado = modulos.find((m) => m.id === modParam)
          if (encontrado) {
            setSelectedModuleId(encontrado.id)
          }
        }
      })
      .finally(() => {
        if (active) setLoadingModulos(false)
      })

    return () => {
      active = false
    }
  }, [searchParams])

  // FETCH DE ORÇAMENTO EXISTENTE QUANDO ?id= ESTÁ PRESENTE
  useEffect(() => {
    let active = true
    const quoteId = searchParams.get('id')
    if (!quoteId) return

    setLoadingEditingQuote(true)
    fetchOrcamentoById(quoteId)
      .then((orcamento) => {
        if (!active) return
        if (!orcamento) {
          toast({
            title: 'Orçamento não encontrado',
            description: `Não foi possível carregar o orçamento #${quoteId.slice(-6)}.`,
            variant: 'destructive',
          })
          return
        }

        // Vincula o rascunho ao ID do orçamento em edição
        setDraftLinkedOrcamentoId(quoteId)

        // Preenche campos principais
        setClientName(orcamento.cliente_nome || '')
        const amb = orcamento.ambiente || ''
        setAmbienteSelecionado(amb)
        setRoom(amb)

        if (orcamento.forma_pagamento) {
          setFormaPagamento(orcamento.forma_pagamento)
        }
        if (orcamento.observacoes) {
          setObservacoes(orcamento.observacoes)
        }

        // Restaura dimensões salvas (se disponíveis)
        if (orcamento.dimensoes_json && typeof orcamento.dimensoes_json === 'object') {
          const dim = orcamento.dimensoes_json as {
            largura?: number
            altura?: number
            profundidade?: number
          }
          setDimensoes({
            largura: Number(dim.largura) || 1800,
            altura: Number(dim.altura) || 2200,
            profundidade: Number(dim.profundidade) || 600,
          })
        }

        // Restaura MDF externo salvo
        if (orcamento.mdf_externo) {
          try {
            if (orcamento.mdf_externo.startsWith('{')) {
              const parsed = JSON.parse(orcamento.mdf_externo)
              setMdfExterno({
                cor: parsed.cor || 'Branco TX',
                espessura: parsed.espessura === 15 ? 15 : 18,
              })
            } else {
              setMdfExterno({
                cor: orcamento.mdf_externo,
                espessura: 18,
              })
            }
          } catch {
            setMdfExterno({ cor: orcamento.mdf_externo, espessura: 18 })
          }
        }

        // Restaura MDF interno salvo
        if (orcamento.mdf_interno) {
          try {
            if (orcamento.mdf_interno.startsWith('{')) {
              const parsed = JSON.parse(orcamento.mdf_interno)
              setMdfInterno({
                cor: parsed.cor || 'Branco TX',
                espessura: parsed.espessura === 18 ? 18 : 15,
              })
            } else {
              setMdfInterno({
                cor: orcamento.mdf_interno,
                espessura: 15,
              })
            }
          } catch {
            setMdfInterno({ cor: orcamento.mdf_interno, espessura: 15 })
          }
        }

        // Restaura MDF fundo salvo
        if (orcamento.mdf_fundo) {
          setMdfFundo(orcamento.mdf_fundo)
        }

        // Restaura Padrão de Projeto salvo
        if (orcamento.padrao_projeto === 'premium' || orcamento.padrao_projeto === 'comercial') {
          setPadraoProjeto(orcamento.padrao_projeto)
        }

        // MULTI-AMBIENTE: Se orcamento.ambientes_json existir e tiver ambientes, restaura integralmente
        const hasAmbientesJson =
          orcamento.ambientes_json &&
          Array.isArray(orcamento.ambientes_json) &&
          orcamento.ambientes_json.length > 0

        if (hasAmbientesJson) {
          const restoredAmbientes: AmbienteOrcamento[] = (
            orcamento.ambientes_json as AmbienteOrcamento[]
          ).map((a, aIdx) => ({
            id: a.id || `amb-${aIdx}-${Date.now()}`,
            nome: a.nome || `Ambiente ${aIdx + 1}`,
            subtotal: Number(a.subtotal) || 0,
            modulos: (a.modulos || []).map((m, mIdx) => ({
              id: m.id || `mod-${mIdx}-${Date.now()}`,
              modulo_id: m.modulo_id,
              nome: m.nome || 'Módulo Planejado',
              dimensoes: m.dimensoes,
              mdf_externo: m.mdf_externo,
              mdf_interno: m.mdf_interno,
              mdf_fundo: m.mdf_fundo,
              padrao_projeto: m.padrao_projeto,
              composicao: m.composicao,
              perfil_construtivo: m.perfil_construtivo || m.composicao?.perfilConstrutivo,
              adaptacoes: m.adaptacoes,
              imagem_url: m.imagem_url,
              subtotal: Number(m.subtotal) || 0,
              itens: (m.itens || []).map((it, itIdx) => ({
                id: it.id || `it-${itIdx}`,
                description: it.description || 'Item',
                material: it.material,
                espessura: it.espessura,
                metragem: it.metragem,
                unidade: it.unidade,
                unitCost: Number(it.unitCost) || 0,
                totalCost: Number(it.totalCost) || 0,
                markup: Number(it.markup) || 2.5,
                salePrice: Number(it.salePrice) || 0,
              })),
            })),
          }))
          setAmbientes(restoredAmbientes)
          if (restoredAmbientes.length > 0) {
            setActiveAmbienteId(restoredAmbientes[0].id)
            setAmbienteSelecionado(restoredAmbientes[0].nome)
            setRoom(restoredAmbientes[0].nome)

            // Restaura dimensões e composição do primeiro módulo salvo se existir
            const primMod = restoredAmbientes[0].modulos[0]
            if (primMod?.dimensoes) {
              setDimensoes({
                largura: Number(primMod.dimensoes.largura) || 1800,
                altura: Number(primMod.dimensoes.altura) || 2200,
                profundidade: Number(primMod.dimensoes.profundidade) || 600,
              })
            }
            if (primMod?.composicao) {
              setComposicaoModulo(primMod.composicao)
            }
            if (primMod?.adaptacoes) {
              setAdaptacoesIA(primMod.adaptacoes)
            }
          }
        }

        // Tenta associar o módulo se o nome coincidir com algum template da biblioteca
        if (orcamento.modulo) {
          const modEncontrado = modulosDisponiveis.find(
            (m) =>
              m.nome_template.toLowerCase() === orcamento.modulo?.toLowerCase() ||
              m.id === orcamento.modulo,
          )
          if (modEncontrado) {
            setSelectedModuleId(modEncontrado.id)
          } else if (modulosDisponiveis.length > 0) {
            setSelectedModuleId(modulosDisponiveis[0].id)
          }
        } else if (hasAmbientesJson && (orcamento.ambientes_json as any[])[0]?.modulos?.[0]) {
          const primeiroModulo = (orcamento.ambientes_json as any[])[0].modulos[0]
          if (primeiroModulo.modulo_id) {
            setSelectedModuleId(primeiroModulo.modulo_id)
          } else if (primeiroModulo.nome) {
            const modEncontrado = modulosDisponiveis.find(
              (m) => m.nome_template.toLowerCase() === primeiroModulo.nome?.toLowerCase(),
            )
            if (modEncontrado) setSelectedModuleId(modEncontrado.id)
          }
        }

        // BUG 2: Restaurar TODOS os itens do bom_json, preservando o orçamento original salvo
        if (
          orcamento.bom_json &&
          Array.isArray(orcamento.bom_json) &&
          orcamento.bom_json.length > 0
        ) {
          const loadedTodosItens: BudgetItem[] = orcamento.bom_json.map((item, index) => {
            const itId = String(item.id || `loaded-${index}`)
            const unidadeValida =
              item.unidade === 'm²' || item.unidade === 'm' || item.unidade === 'jogo'
                ? item.unidade
                : undefined

            return {
              id: itId,
              description: item.description || 'Item Salvo',
              material: item.material,
              espessura: item.espessura,
              metragem:
                item.metragem !== undefined && item.metragem !== null
                  ? Number(item.metragem)
                  : undefined,
              unidade: unidadeValida,
              unitCost: Number(item.unitCost) || 0,
              totalCost: Number(item.totalCost) || 0,
              markup: Number(item.markup) || 2.5,
              salePrice: Number(item.salePrice) || 0,
            }
          })
          setSavedLoadedItems(loadedTodosItens)
        } else if (hasAmbientesJson) {
          // Se não veio bom_json na raiz mas veio em ambientes_json, extrai itens do primeiro módulo
          const primMod = (orcamento.ambientes_json as any[])[0]?.modulos?.[0]
          if (primMod && Array.isArray(primMod.itens) && primMod.itens.length > 0) {
            setSavedLoadedItems(primMod.itens)
          }
        }

        // Se for orçamento antigo (sem ambientes_json), popula o primeiro ambiente com esse módulo
        if (!hasAmbientesJson) {
          const totalAntigo = Number(orcamento.valor_total) || 0
          setAmbientes([
            {
              id: `amb-legado-${Date.now()}`,
              nome: orcamento.ambiente || 'Ambiente Principal',
              subtotal: totalAntigo,
              modulos: [
                {
                  id: `mod-legado-${Date.now()}`,
                  modulo_id: orcamento.modulo || undefined,
                  nome: orcamento.modulo || 'Módulo Planejado',
                  dimensoes: orcamento.dimensoes_json as any,
                  mdf_externo: orcamento.mdf_externo || undefined,
                  mdf_interno: orcamento.mdf_interno || undefined,
                  mdf_fundo: orcamento.mdf_fundo || undefined,
                  padrao_projeto: orcamento.padrao_projeto || undefined,
                  subtotal: totalAntigo,
                  perfil_construtivo: undefined,
                  itens: orcamento.bom_json,
                },
              ],
            },
          ])
        }

        // Registra o registro salvo para downloads de PDF e abre a exibição dos resultados
        setSavedOrcamentoRecord(orcamento)
        const hasAnySavedItens =
          (Array.isArray(orcamento.bom_json) && orcamento.bom_json.length > 0) ||
          (Array.isArray(orcamento.ambientes_json) &&
            orcamento.ambientes_json.some((a: any) =>
              (a.modulos || []).some((m: any) => (m.itens || []).length > 0),
            ))

        if (hasAnySavedItens) {
          setShowResults(true)
        }

        // BUG 1: Ao carregar um orçamento salvo, NÃO injetar placeholder fake.
        setUploadedFiles([])

        toast({
          title: 'Orçamento Carregado',
          description: `Editando orçamento de ${orcamento.cliente_nome}.`,
        })
      })
      .catch((err) => {
        console.error('Erro ao carregar orçamento por ID:', err)
        toast({
          title: 'Erro ao carregar orçamento',
          description: 'Falha ao buscar os dados do orçamento no banco.',
          variant: 'destructive',
        })
      })
      .finally(() => {
        if (active) setLoadingEditingQuote(false)
      })

    return () => {
      active = false
    }
  }, [searchParams, modulosDisponiveis.length])

  // FETCH DO CATÁLOGO DE MATERIAIS — preços reais vindos do Supabase.
  // Em caso de erro ou catálogo vazio, o motor de cálculo usa CUSTOS_UNITARIOS (fallback).
  useEffect(() => {
    let active = true
    fetchCatalogoMateriais()
      .then((materiais) => {
        if (!active) return
        if (materiais && materiais.length > 0) {
          setCatalogoMateriais(materiais)
        } else if (materiais === null) {
          console.warn(
            'Catálogo de materiais retornou nulo (erro ou timeout). Usando tabela de custos padrão.',
          )
        }
      })
      .catch((err) => {
        console.error('Falha ao carregar catálogo de materiais:', err)
      })
    return () => {
      active = false
    }
  }, [])

  // FETCH DO PERFIL DA EMPRESA (para dados do cabeçalho dos relatórios em PDF)
  useEffect(() => {
    let active = true
    fetchPerfilEmpresa().then(({ data }) => {
      if (active && data) {
        setPerfilEmpresa(data)
      }
    })
    return () => {
      active = false
    }
  }, [])

  // FETCH DA CONFIGURAÇÃO DA ENGENHARIA FINANCEIRA (markup, rateio, custos fixos e variáveis)
  useEffect(() => {
    let active = true
    fetchConfigEngenharia()
      .then(({ config, custosFixos, custosVariaveis, error }) => {
        if (!active) return
        if (error || !config) {
          console.warn(
            'Não foi possível carregar as configurações de engenharia financeira. Usando fallback markup 2.5x:',
            error,
          )
          return
        }

        const totalCustosFixos = custosFixos.reduce((s, c) => s + (Number(c.valor) || 0), 0)
        const totalCustosVariaveis = custosVariaveis.reduce((s, c) => s + (Number(c.valor) || 0), 0)
        const totalCustosEmpresa = totalCustosFixos + totalCustosVariaveis
        const meta = Number(config.meta_faturamento) || 0
        const indiceRateio = meta > 0 ? (totalCustosEmpresa / meta) * 100 : 8.0

        const markup =
          typeof config.markup_padrao === 'number' && config.markup_padrao > 0
            ? config.markup_padrao
            : 2.5

        setMarkupEngenharia(markup)
        setConfigEngenhariaCompleta({
          markup_padrao: markup,
          impostos_percent: config.impostos_percent ?? 10.0,
          comissoes_percent: config.comissoes_percent ?? 5.0,
          custo_financeiro_percent: config.custo_financeiro_percent ?? 3.0,
          indice_rateio: Math.round(indiceRateio * 100) / 100,
        })
      })
      .catch((err) => {
        console.warn('Erro ao buscar Engenharia Financeira. Fallback markup 2.5x:', err)
      })

    return () => {
      active = false
    }
  }, [])

  // Listas de opções derivadas dinamicamente do catálogo real de materiais
  const opcoesMdfEstrutural = useMemo(() => {
    return catalogoMateriais.filter((m) => m.categoria === 'MDF 15mm' || m.categoria === 'MDF 18mm')
  }, [catalogoMateriais])

  const opcoesMdfFundo = useMemo(() => {
    return catalogoMateriais.filter((m) => m.categoria === 'MDF 6mm')
  }, [catalogoMateriais])

  // Objeto do módulo selecionado (id + nome_template) derivado do estado dinâmico.
  // Suporte a MODULO-CUSTOM quando a IA não encontra correspondente idêntico na biblioteca.
  const selectedModuleObj: TemplateEngenharia | null = useMemo(() => {
    if (selectedModuleId === 'MODULO-CUSTOM') {
      return {
        id: 'MODULO-CUSTOM',
        nome_template: customModuleNameIA || 'Módulo Personalizado (Análise IA)',
        categoria: 'Personalizado',
        dimensoes: dimensoesEstimadasIA
          ? `${dimensoesEstimadasIA.largura}x${dimensoesEstimadasIA.altura}x${dimensoesEstimadasIA.profundidade}`
          : `${dimensoes.largura}x${dimensoes.altura}x${dimensoes.profundidade}`,
        descricao: 'Módulo identificado pela IA que não possui correspondente na biblioteca.',
        material: 'MDF conforme especificação',
      }
    }
    return modulosDisponiveis.find((m) => m.id === selectedModuleId) ?? null
  }, [selectedModuleId, modulosDisponiveis, customModuleNameIA, dimensoesEstimadasIA, dimensoes])

  // ============================================================================
  // 🧮 MOTOR DE CÁLCULO GEOMÉTRICO E PRECIFICAÇÃO DINÂMICA
  // A BOM é recalculada em tempo real via useMemo sempre que qualquer um dos
  // parâmetros relevantes (dimensões, materiais, padrão, módulo) muda.
  // ============================================================================
  // Catálogo efetivo para precificação: se vazio, usa undefined para que o
  // motor caia no fallback CUSTOS_UNITARIOS (tratado dentro de calcularBOM).
  const catalogoParaPricing = catalogoMateriais.length > 0 ? catalogoMateriais : undefined

  const bomItems = useMemo(
    () =>
      calcularBOM(
        selectedModuleObj
          ? {
              id: selectedModuleObj.id,
              nome_template: selectedModuleObj.nome_template,
              perfil_construtivo: selectedModuleObj.perfil_construtivo,
            }
          : null,
        dimensoes,
        mdfExterno,
        mdfInterno,
        mdfFundo,
        padraoProjeto,
        catalogoParaPricing,
        markupEngenharia,
        fatorEscalaIA ?? 1.0,
        composicaoModulo,
      ),
    [
      selectedModuleObj,
      dimensoes,
      mdfExterno,
      mdfInterno,
      mdfFundo,
      padraoProjeto,
      catalogoParaPricing,
      markupEngenharia,
      fatorEscalaIA,
      composicaoModulo,
    ],
  )

  // Lista final de itens exibida:
  // Se savedLoadedItems estiver presente (carregado de orçamento existente), preserva os itens salvos + itens adicionados manualmente.
  // Caso contrário, usa a BOM recalculada dinamicamente via useMemo + itens manuais.
  const pricingItems = useMemo<BudgetItem[]>(() => {
    if (savedLoadedItems !== null) {
      return [...savedLoadedItems, ...manualItems]
    }
    return [...bomItems, ...manualItems]
  }, [savedLoadedItems, bomItems, manualItems])

  // Lista de itens não cadastrados no catálogo (adicionados por estimativa)
  const itensNaoCadastrados = useMemo(() => {
    return pricingItems.filter((item) => Boolean(item.item_nao_cadastrado))
  }, [pricingItems])

  // Lista de itens consolidados de todos os ambientes e módulos já adicionados
  const itensConsolidadosResumo = useMemo<BudgetItem[]>(() => {
    const list: BudgetItem[] = []
    ambientes.forEach((amb) => {
      ;(amb.modulos || []).forEach((mod) => {
        ;(mod.itens || []).forEach((it) => {
          list.push({
            id: it.id,
            description: `${amb.nome} · ${mod.nome}: ${it.description}`,
            material: it.material,
            espessura: it.espessura,
            metragem: it.metragem,
            unidade: it.unidade,
            unitCost: it.unitCost,
            totalCost: it.totalCost,
            markup: it.markup,
            salePrice: it.salePrice,
          })
        })
      })
    })
    return list
  }, [ambientes])

  const hasConsolidatedItems = itensConsolidadosResumo.length > 0

  // Há módulo ativo sendo configurado na tela atualmente
  const hasCurrentModuleEditing =
    Boolean(selectedModuleId) ||
    (savedLoadedItems !== null && savedLoadedItems.length > 0) ||
    manualItems.length > 0

  // Se há módulo ativo sendo configurado na tela, a tabela mostra os pricingItems do módulo atual.
  // Se o módulo atual foi adicionado ao ambiente (tela limpa para o próximo módulo), mas há módulos consolidados,
  // mostra o resumo dos itens consolidados para não deixar a tela vazia nem dar a sensação de perda de dados.
  const effectiveDisplayItems = useMemo<BudgetItem[]>(() => {
    if (hasCurrentModuleEditing) {
      return pricingItems
    }
    if (hasConsolidatedItems) {
      return itensConsolidadosResumo
    }
    return pricingItems
  }, [hasCurrentModuleEditing, hasConsolidatedItems, pricingItems, itensConsolidadosResumo])

  // Determina se a seção de resultados deve ficar visível:
  // Regra de exibição:
  // - Fica visível sempre que houver itens calculados/manuais com módulo em configuração (pricingItems com selectedModuleObj ou manualItems)
  // - OU quando showResults estiver explicitamente ligado (após Gerar Orçamento ou carregar orçamento existente com itens)
  // - OU quando houver itens nos ambientes consolidados (mesmo após "+ Adicionar Outro Módulo ao Ambiente")
  // - OU quando houver itens salvos carregados (savedLoadedItems)
  // - Mantém OCULTO quando for orçamento novo zerado sem ação do usuário (sem módulo selecionado e sem consolidados).
  const hasActiveConfiguredItems =
    (Boolean(selectedModuleObj) && pricingItems.length > 0) || manualItems.length > 0

  const shouldShowResultsSection =
    showResults ||
    hasActiveConfiguredItems ||
    hasConsolidatedItems ||
    (savedLoadedItems !== null && savedLoadedItems.length > 0)

  // Totais consolidados (custo e valor de venda).
  const totalCusto = useMemo(() => custoConsolidado(pricingItems), [pricingItems])
  const totalVenda = useMemo(() => valorConsolidado(pricingItems), [pricingItems])

  // Flag de validação: módulo selecionado e dimensões preenchidas.
  const dimensoesValidas =
    !!selectedModuleObj &&
    dimensoes.largura > 0 &&
    dimensoes.altura > 0 &&
    dimensoes.profundidade > 0

  // Clear errors when fields update
  const handleClientNameChange = (val: string) => {
    setClientName(val)
    if (errors.clientName) {
      setErrors((prev) => ({ ...prev, clientName: undefined }))
    }
  }

  const handleRoomChange = (val: string) => {
    setRoom(val)
    setAmbienteSelecionado(val)
    if (errors.room) {
      setErrors((prev) => ({ ...prev, room: undefined }))
    }
  }

  const handleAmbienteSelecionadoChange = (val: string) => {
    setAmbienteSelecionado(val)
    setRoom(val)
    if (errors.room) {
      setErrors((prev) => ({ ...prev, room: undefined }))
    }
  }

  const handleModuleChange = (val: string) => {
    setSelectedModuleId(val)
    // Se o usuário explicitamente trocar de módulo, libera o recálculo dinâmico
    setSavedLoadedItems(null)
    // Troca manual de módulo ⇒ reseta dados exclusivos da IA se trocou para módulo da biblioteca.
    if (val !== 'MODULO-CUSTOM') {
      setIsCustomModuleIA(false)
      setFatorEscalaIA(1.0)
      setDimensoesOriginaisIA(null)
    }
    setMatchJustificativa(null)
    if (errors.selectedModule) {
      setErrors((prev) => ({ ...prev, selectedModule: undefined }))
    }

    // Atualiza o perfil construtivo na composição a partir do módulo selecionado
    const modEscolhido = modulosDisponiveis.find((m) => m.id === val)
    if (modEscolhido?.perfil_construtivo) {
      const perfilMod = modEscolhido.perfil_construtivo as PerfilConstrutivo
      setComposicaoModulo((prev) => ({
        ...prev,
        perfilConstrutivo: perfilMod,
        semTamponamento: perfilMod === 'Caixa Simples',
        tampoPedra: perfilMod === 'Balcão (tampo por conta do cliente)' ? true : prev.tampoPedra,
      }))
    } else if (val && val !== 'MODULO-CUSTOM') {
      // Se o módulo não tiver perfil explícito, remove override anterior para que o fallback funcione
      setComposicaoModulo((prev) => ({
        ...prev,
        perfilConstrutivo: undefined,
        semTamponamento: false,
      }))
    }

    // Auto-preenche o ambiente quando vazio, com base na categoria do módulo.
    const modulo = modulosDisponiveis.find((m) => m.id === val)
    if (!ambienteSelecionado && !room && modulo?.categoria) {
      const cat = modulo.categoria.toLowerCase()
      let autoAmb = ''
      if (cat.includes('quarto')) autoAmb = 'Quarto 01'
      else if (cat.includes('cozinha')) autoAmb = 'Cozinha Principal'
      else if (cat.includes('sala')) autoAmb = 'Sala de Estar'
      else if (cat.includes('banheiro')) autoAmb = 'Banheiro Social 01'

      if (autoAmb) {
        setAmbienteSelecionado(autoAmb)
        setRoom(autoAmb)
      }
    }
  }

  /**
   * Converte um UploadedFileState para Base64 (data URL) compatível com a API
   * Vision da OpenAI. Suporta tanto uploads reais (File) quanto imagens de
   * exemplo (URL pública via fetch → blob → Base64).
   */
  const fileToBase64 = (fileState: UploadedFileState): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Falha ao converter imagem para Base64.'))

      // Upload real: usa o File diretamente.
      if (fileState.file) {
        reader.readAsDataURL(fileState.file)
        return
      }

      // Imagem de exemplo (URL): baixa via fetch e converte para Base64.
      if (fileState.previewUrl) {
        fetch(fileState.previewUrl)
          .then((res) => {
            if (!res.ok) throw new Error('Falha ao baixar imagem de exemplo.')
            return res.blob()
          })
          .then((blob) => reader.readAsDataURL(blob))
          .catch((err) => reject(err))
        return
      }

      reject(new Error('Arquivo inválido para análise visual.'))
    })
  }

  /**
   * Executa o match via Edge Function 'analisar-imagem' do Supabase.
   * Retorna o payload com modulos_detectados, ferragens_obrigatorias e justificativa.
   */
  const runOpenAIVisionMatch = async (
    fileState: UploadedFileState,
    modulos: TemplateEngenharia[],
  ): Promise<{
    modulos_detectados?: Array<{
      codigo_modulo: string
      nome: string
      e_customizado?: boolean
      perfil_construcao_sugerido?: string
      dimensao_estimada?: { largura: number; altura: number; profundidade: number }
      dimensoes_originais?: { largura: number; altura: number; profundidade: number }
      fator_escala?: number
      adaptacoes?: string
      divisorias?: { qtd: number }
      portas?: { qtd: number; tipo: 'abrir' | 'correr' | 'batente' | 'nenhum' }
      gavetas?: { qtd: number }
      prateleiras?: { qtd: number }
      cabideiro?: boolean
      sapateira?: boolean
      puxadores?: number
    }>
    ferragens_obrigatorias?: Array<{
      catalogo_id: string | null
      descricao: string
      quantidade: number
      justificativa: string
      item_nao_cadastrado?: boolean
      preco_custo_estimado?: number
    }>
    justificativa?: string
    id_modulo_encontrado?: string | null
    idModulo?: string | null
  }> => {
    // Converte a primeira imagem para Base64.
    const imagemBase64 = await fileToBase64(fileState)

    const { data, error } = await supabase.functions.invoke('analisar-imagem', {
      body: { imagemBase64, modulos, catalogoMateriais },
    })

    if (error) {
      throw new Error(error.message || 'Erro ao chamar função de análise de imagem.')
    }

    if (data?.error) {
      throw new Error(data.error)
    }

    return data
  }

  /**
   * Fallback mock (sem API key ou em caso de erro da IA): simula a análise da
   * IA em 3 segundos e seleciona o primeiro módulo disponível.
   */
  const runMockMatch = (
    modulos: TemplateEngenharia[],
    description: string,
    variant?: 'default' | 'destructive',
  ) => {
    setIsAnalyzing(true)
    analyzeTimeoutRef.current = setTimeout(() => {
      if (modulos.length > 0) {
        setSelectedModuleId((prevSel) => prevSel || modulos[0].id)
      }
      setIsAnalyzing(false)
      analyzeTimeoutRef.current = null
      toast({
        title: '✓ Match Automático Concluído!',
        description,
        variant,
      })
    }, 3000)
  }

  const handleFilesSelect = (files: UploadedFileState[] | null) => {
    setUploadedFiles(files ?? [])
    // Limpa a justificativa anterior sempre que novos arquivos chegam.
    setMatchJustificativa(null)
    setAdaptacoesIA(null)
    setPerfilSugeridoIA(null)
    setFatorEscalaIA(null)
    setDimensoesOriginaisIA(null)
    setDimensoesEstimadasIA(null)
    setIsCustomModuleIA(false)
    setConfiancaIA(null)
    setIsModuloConfirmado(false)

    if (errors.uploadedFile) {
      setErrors((prev) => ({ ...prev, uploadedFile: undefined }))
    }

    // Limpa qualquer análise anterior pendente
    if (analyzeTimeoutRef.current) {
      clearTimeout(analyzeTimeoutRef.current)
      analyzeTimeoutRef.current = null
    }

    // Sem arquivos ⇒ reset do estado de análise
    if (!files || files.length === 0) {
      setIsAnalyzing(false)
      return
    }

    // Captura o estado atual dos módulos para usar de forma síncrona na IA.
    const modulosAtuais = modulosDisponiveis

    // 1. Verificação de biblioteca vazia antes da análise
    if (modulosAtuais.length === 0) {
      setIsAnalyzing(false)
      toast({
        variant: 'destructive',
        title: 'Biblioteca de Módulos Vazia',
        description:
          'Sua biblioteca de módulos está vazia. Cadastre pelo menos 1 módulo na página Biblioteca para gerar orçamentos.',
        action: (
          <ToastAction altText="Ir para Biblioteca" onClick={() => navigate('/biblioteca')}>
            Ir para Biblioteca
          </ToastAction>
        ),
      })
      return
    }

    // 🔄 FLUXO DE MATCH AUTOMÁTICO (IA):
    // Chama a Edge Function 'analisar-imagem' do Supabase
    setIsAnalyzing(true)

    const primeiraImagem = files[0]

    runOpenAIVisionMatch(primeiraImagem, modulosAtuais)
      .then((data) => {
        const modulosDetectados = data.modulos_detectados
        const ferragensObrigatorias = data.ferragens_obrigatorias ?? []
        const justificativaGeral =
          data.justificativa || 'Match identificado pela análise visual da IA.'

        if (Array.isArray(modulosDetectados) && modulosDetectados.length > 0) {
          // 1. Seleciona o primeiro módulo detectado
          const primeiroModulo = modulosDetectados[0]
          const codigoModulo = primeiroModulo.codigo_modulo
          const eCustom = Boolean(primeiroModulo.e_customizado || codigoModulo === 'MODULO-CUSTOM')
          if (primeiroModulo.perfil_construcao_sugerido) {
            setPerfilSugeridoIA(primeiroModulo.perfil_construcao_sugerido)
          }

          // Confiança da IA (alta | media | baixa)
          const conf =
            (primeiroModulo as { confianca?: 'alta' | 'media' | 'baixa' }).confianca ||
            (eCustom ? 'baixa' : 'alta')
          setConfiancaIA(conf)
          // Se for 'alta', confirmação não é exigida de antemão (fluxo direto)
          setIsModuloConfirmado(conf === 'alta')

          setIsCustomModuleIA(eCustom)
          setCustomModuleNameIA(primeiroModulo.nome || 'Módulo Personalizado (Análise IA)')

          let idFinal = ''
          if (eCustom) {
            idFinal = 'MODULO-CUSTOM'
          } else {
            let moduloEncontrado = modulosAtuais.find((m) => m.id === codigoModulo)
            if (!moduloEncontrado) {
              moduloEncontrado = modulosAtuais.find(
                (m) =>
                  m.nome_template.toLowerCase() === codigoModulo.toLowerCase() ||
                  m.nome_template.toLowerCase() === primeiroModulo.nome.toLowerCase(),
              )
            }
            idFinal = moduloEncontrado ? moduloEncontrado.id : 'MODULO-CUSTOM'
          }

          setSelectedModuleId(idFinal)

          // 2. Fator de escala e dimensões (originais vs estimadas)
          if (primeiroModulo.dimensao_estimada) {
            const { largura, altura, profundidade } = primeiroModulo.dimensao_estimada
            setDimensoes({
              largura: largura > 0 ? largura : 1800,
              altura: altura > 0 ? altura : 2200,
              profundidade: profundidade > 0 ? profundidade : 600,
            })
            setDimensoesEstimadasIA({
              largura: largura > 0 ? largura : 1800,
              altura: altura > 0 ? altura : 2200,
              profundidade: profundidade > 0 ? profundidade : 600,
            })
          }

          if (primeiroModulo.dimensoes_originais) {
            setDimensoesOriginaisIA(primeiroModulo.dimensoes_originais)
          } else {
            setDimensoesOriginaisIA(null)
          }

          const fator =
            typeof primeiroModulo.fator_escala === 'number' && primeiroModulo.fator_escala > 0
              ? primeiroModulo.fator_escala
              : 1.0
          setFatorEscalaIA(fator)

          // 2.1 Decomposição detectada pela IA (portas, gavetas, prateleiras, interior)
          if (primeiroModulo.adaptacoes) {
            setAdaptacoesIA(primeiroModulo.adaptacoes)
          }

          const divisoriasDetectadas = primeiroModulo.divisorias || { qtd: 0 }
          const portasDetectadas = primeiroModulo.portas || { qtd: 0, tipo: 'nenhum' }
          const gavetasDetectadas = primeiroModulo.gavetas || { qtd: 0 }
          const prateleirasDetectadas = primeiroModulo.prateleiras || { qtd: 2 }
          const cabideiroDetectado = Boolean(primeiroModulo.cabideiro)
          const sapateiraDetectada = Boolean(primeiroModulo.sapateira)
          const puxadoresDetectados =
            typeof primeiroModulo.puxadores === 'number'
              ? primeiroModulo.puxadores
              : portasDetectadas.qtd + gavetasDetectadas.qtd

          const qtdDiv = divisoriasDetectadas.qtd || 0
          const qtdCorposTotal = qtdDiv + 1

          // Inicializa corpos
          const corposIniciais = Array.from({ length: qtdCorposTotal }, (_, idx) => {
            const gavPorCorpo = Math.floor(gavetasDetectadas.qtd / qtdCorposTotal)
            const restoGav = gavetasDetectadas.qtd % qtdCorposTotal
            const pratPorCorpo = Math.floor(prateleirasDetectadas.qtd / qtdCorposTotal)
            const restoPrat = prateleirasDetectadas.qtd % qtdCorposTotal

            return {
              id: `corpo-${idx + 1}`,
              gavetas: gavPorCorpo + (idx === 0 ? restoGav : 0),
              prateleiras: pratPorCorpo + (idx === 0 ? restoPrat : 0),
              cabideiro: cabideiroDetectado,
              sapateira: idx === 0 ? sapateiraDetectada : false,
            }
          })

          // O perfil construtivo vem prioritariamente do módulo da biblioteca casado;
          // se for módulo customizado ou falhar match, usa a sugestão da IA.
          const moduloCasado = modulosAtuais.find((m) => m.id === idFinal)
          const perfilDoModulo =
            moduloCasado?.perfil_construtivo ||
            (eCustom ? primeiroModulo.perfil_construcao_sugerido : undefined)

          setComposicaoModulo({
            divisorias: {
              qtd: qtdDiv,
            },
            corpos: corposIniciais,
            portas: {
              qtd: portasDetectadas.qtd,
              tipo: portasDetectadas.tipo || 'abrir',
            },
            gavetas: {
              qtd: gavetasDetectadas.qtd,
            },
            prateleiras: {
              qtd: prateleirasDetectadas.qtd,
            },
            cabideiro: cabideiroDetectado,
            sapateira: sapateiraDetectada,
            puxadores: puxadoresDetectados,
            perfilConstrutivo: perfilDoModulo || undefined,
            semTamponamento: perfilDoModulo === 'Caixa Simples',
          })

          // 3. Adiciona cada ferragem obrigatória / material ausente como item manual
          if (ferragensObrigatorias.length > 0) {
            const effectiveMarkup = markupEngenharia > 0 ? markupEngenharia : 2.5
            // Filtrar ferragens que já são calculadas dinamicamente pelo motor da composição
            // (ex: corrediças e puxadores de gaveta, dobradiças e kits de correr de porta)
            // para evitar duplicações quando a composição do móvel já os incluir.
            const descLower = (f: { descricao?: string }) => (f.descricao || '').toLowerCase()
            const ferragensFiltradas = ferragensObrigatorias.filter((f) => {
              const d = descLower(f)
              if (
                gavetasDetectadas.qtd > 0 &&
                (d.includes('corrediça') || d.includes('corredica'))
              ) {
                return false
              }
              if (
                portasDetectadas.qtd > 0 &&
                portasDetectadas.tipo === 'correr' &&
                (d.includes('correr') || d.includes('trilho'))
              ) {
                return false
              }
              if (
                portasDetectadas.qtd > 0 &&
                portasDetectadas.tipo !== 'correr' &&
                (d.includes('dobradiça') || d.includes('dobradica'))
              ) {
                return false
              }
              if (puxadoresDetectados > 0 && d.includes('puxador')) {
                return false
              }
              return true
            })

            const novasFerragens: BudgetItem[] = ferragensFiltradas.map((f, idx) => {
              // Buscar preco_custo do catalogoMateriais pelo catalogo_id ou usar estimativa R$ 50,00
              const matNoCatalogo = catalogoMateriais.find(
                (c) =>
                  c.id === f.catalogo_id ||
                  c.nome_material.toLowerCase() === f.descricao.toLowerCase(),
              )

              const isAusente = Boolean(f.item_nao_cadastrado || !matNoCatalogo)
              const unitCost = matNoCatalogo
                ? Number(matNoCatalogo.preco_custo) || 0
                : Number(f.preco_custo_estimado) || 50.0
              const qtd = f.quantidade > 0 ? f.quantidade : 1
              const totalCost = unitCost * qtd
              const salePrice = Math.round(totalCost * effectiveMarkup * 100) / 100

              return {
                id: `ferragem-ia-${f.catalogo_id || 'avulso'}-${Date.now()}-${idx}`,
                description: f.descricao,
                material: matNoCatalogo?.categoria || 'Ferragem / Insumo',
                metragem: qtd,
                unidade:
                  matNoCatalogo?.unidade === 'm²' ||
                  matNoCatalogo?.unidade === 'm' ||
                  matNoCatalogo?.unidade === 'jogo' ||
                  matNoCatalogo?.unidade === 'un' ||
                  matNoCatalogo?.unidade === 'par'
                    ? matNoCatalogo.unidade
                    : 'un',
                unitCost,
                totalCost,
                markup: effectiveMarkup,
                salePrice,
                item_nao_cadastrado: isAusente,
                catalogo_id: matNoCatalogo ? matNoCatalogo.id : null,
              }
            })

            setManualItems((prev) => [...prev, ...novasFerragens])

            const countAusentes = novasFerragens.filter((i) => i.item_nao_cadastrado).length
            if (countAusentes > 0) {
              toast({
                title: 'Itens Estimados Adicionados',
                description: `⚠️ ${countAusentes} item(ns) não encontrado(s) no Catálogo foi(ram) adicionado(s) com custo estimado (R$ 50,00).`,
              })
            } else {
              toast({
                title: 'Ferragens Obrigatórias Adicionadas',
                description: `✓ IA adicionou ${novasFerragens.length} ferragens obrigatórias ao orçamento (ex: corrediças, puxadores)`,
              })
            }
          }

          // Se houver mais de 1 módulo detectado, mostra toast avisando
          if (modulosDetectados.length > 1) {
            toast({
              title: `IA detectou ${modulosDetectados.length} módulos no ambiente`,
              description: `O primeiro (${primeiroModulo.nome}) foi selecionado. Adicione os demais manualmente.`,
            })
          }

          setMatchJustificativa(justificativaGeral)
          setIsAnalyzing(false)

          toast({
            title: eCustom ? '✓ Módulo Personalizado Identificado!' : '✓ Match IA Concluído!',
            description: justificativaGeral,
          })
        } else {
          // Fallback sem módulos identificados: define como módulo personalizado
          setSelectedModuleId('MODULO-CUSTOM')
          setIsCustomModuleIA(true)
          setConfiancaIA('baixa')
          setIsModuloConfirmado(false)
          setCustomModuleNameIA('Módulo Personalizado (Análise IA)')
          setMatchJustificativa(justificativaGeral)
          setIsAnalyzing(false)

          toast({
            title: '✓ Módulo Personalizado Identificado',
            description: justificativaGeral,
          })
        }
      })
      .catch((err) => {
        console.error('Falha na análise visual da IA (Edge Function):', err)
        // Fallback para o mock em caso de erro na chamada da IA.
        setConfiancaIA('baixa')
        setIsModuloConfirmado(false)
        runMockMatch(
          modulosAtuais,
          '⚠️ A IA falhou, mas o match manual está disponível.',
          'destructive',
        )
      })
  }

  // Limpa o timeout pendente ao desmontar
  useEffect(() => {
    return () => {
      if (analyzeTimeoutRef.current) clearTimeout(analyzeTimeoutRef.current)
    }
  }, [])

  // Action: "⚙️ Gerar Orçamento do Módulo"
  const handleGenerateBudget = () => {
    // Se a IA encontrou match com confiança !== 'alta' e o usuário ainda não confirmou, bloqueia e rola até o card
    if (confiancaIA && confiancaIA !== 'alta' && !isModuloConfirmado) {
      toast({
        title: 'Confirmação do Módulo Necessária',
        description:
          'Por favor, confirme se o módulo identificado confere antes de gerar o orçamento.',
        variant: 'destructive',
      })
      matchCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    const newErrors: {
      clientName?: string
      room?: string
      selectedModule?: string
      uploadedFile?: string
    } = {}

    if (!clientName.trim()) {
      newErrors.clientName = 'Informe o nome do cliente'
    }

    const effectiveRoom = ambienteSelecionado || room
    if (!effectiveRoom) {
      newErrors.room = 'Selecione o ambiente do projeto'
    } else if (!room) {
      setRoom(effectiveRoom)
    }

    if (!selectedModuleId) {
      newErrors.selectedModule = 'Selecione um módulo da biblioteca'
    }

    // Foto é opcional se o usuário já selecionou um módulo da biblioteca ou está em modo edição.
    // Só é exigida se não houver nem arquivo nem módulo selecionado.
    if (uploadedFiles.length === 0 && !editingId && !selectedModuleId) {
      newErrors.uploadedFile =
        'Envie ao menos uma foto/projeto ou selecione um módulo da biblioteca'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast({
        title: 'Campos Obrigatórios Pendentes',
        description:
          'Preencha o nome do cliente e selecione o módulo ou anexe o arquivo correspondente.',
        variant: 'destructive',
      })
      return
    }

    // Libera o recálculo automático quando o usuário clica em "Gerar Orçamento do Módulo"
    setSavedLoadedItems(null)

    // Success validation -> trigger generation animation
    setIsGenerating(true)

    setTimeout(() => {
      setIsGenerating(false)
      setShowResults(true)

      toast({
        title: 'Orçamento Gerado com Sucesso!',
        description: 'Peças calculadas com base nas dimensões paramétricas do módulo.',
      })

      // Smooth scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
    }, 600)
  }

  // Ações de gerenciamento de múltiplos ambientes e módulos
  const targetAmbienteId = activeAmbienteId || ambientes[0]?.id

  const handleAddNovoAmbiente = (nomeDoAmbiente: string) => {
    const nomeLimpo = nomeDoAmbiente.trim()
    if (!nomeLimpo) {
      toast({
        title: 'Nome do ambiente obrigatório',
        description: 'Digite o nome do cômodo (ex: Suíte Casal, Varanda Gourmet).',
        variant: 'destructive',
      })
      return
    }
    const novoAmbiente: AmbienteOrcamento = {
      id: `amb-${Date.now()}`,
      nome: nomeLimpo,
      modulos: [],
      subtotal: 0,
    }
    setAmbientes((prev) => [...prev, novoAmbiente])
    setActiveAmbienteId(novoAmbiente.id)
    setAmbienteSelecionado(novoAmbiente.nome)
    setRoom(novoAmbiente.nome)
    setNovoAmbienteNome('')
    setIsAddingAmbiente(false)
    toast({
      title: 'Ambiente adicionado',
      description: `O ambiente "${nomeLimpo}" foi criado. Adicione módulos a ele.`,
    })
  }

  const handleRemoveAmbiente = (ambienteIdToRemove: string) => {
    const ambienteAlvo = ambientes.find((a) => a.id === ambienteIdToRemove)
    const restantes = ambientes.filter((a) => a.id !== ambienteIdToRemove)
    setAmbientes(restantes)
    if (activeAmbienteId === ambienteIdToRemove) {
      if (restantes.length > 0) {
        setActiveAmbienteId(restantes[0].id)
        setAmbienteSelecionado(restantes[0].nome)
        setRoom(restantes[0].nome)
      } else {
        setActiveAmbienteId('')
        setAmbienteSelecionado('')
        setRoom('')
      }
    }
    toast({
      title: 'Ambiente removido',
      description: `O ambiente "${ambienteAlvo?.nome || ''}" foi excluído.`,
    })
  }

  const handleRemoveModulo = (ambienteId: string, moduloIdToRemove: string) => {
    setAmbientes((prev) =>
      prev.map((amb) => {
        if (amb.id !== ambienteId) return amb
        const novosModulos = amb.modulos.filter((m) => m.id !== moduloIdToRemove)
        const novoSubtotal = novosModulos.reduce((acc, m) => acc + (m.subtotal || 0), 0)
        return {
          ...amb,
          modulos: novosModulos,
          subtotal: novoSubtotal,
        }
      }),
    )
    toast({
      title: 'Módulo removido',
      description: 'O módulo foi removido do ambiente.',
    })
  }

  // Action: "+ Adicionar Outro Módulo" (ADICIONA O MÓDULO ATUAL AO AMBIENTE ATIVO E PREPARA O PRÓXIMO)
  const handleAddAnotherModule = () => {
    // Se não houver módulo configurado nem itens na tabela, avisa via toast
    const hasModuleToCommit = Boolean(selectedModuleObj) || pricingItems.length > 0
    if (!hasModuleToCommit) {
      toast({
        title: 'Nenhum módulo configurado',
        description: 'Selecione e configure um módulo antes de adicionar outro ao ambiente.',
        variant: 'destructive',
      })
      return
    }

    // 1. Salva este módulo no ambiente ativo
    const currentModuleSubtotal = totalVenda
    const perfilAtualModulo =
      (composicaoModulo?.perfilConstrutivo as PerfilConstrutivo) ||
      (selectedModuleObj?.perfil_construtivo as PerfilConstrutivo) ||
      (composicaoModulo?.semTamponamento ? 'Caixa Simples' : 'Fechado Envelopado')

    const novoModuloNoAmbiente: ModuloOrcamento = {
      id: `mod-${Date.now()}`,
      modulo_id: selectedModuleId || undefined,
      nome: currentModuleName,
      dimensoes: { ...dimensoes },
      mdf_externo: `${mdfExterno.cor} (${mdfExterno.espessura}mm)`,
      mdf_interno: `${mdfInterno.cor} (${mdfInterno.espessura}mm)`,
      mdf_fundo: mdfFundo,
      padrao_projeto: padraoProjeto,
      composicao: {
        ...composicaoModulo,
        perfilConstrutivo: perfilAtualModulo,
      },
      perfil_construtivo: perfilAtualModulo,
      adaptacoes: adaptacoesIA || undefined,
      subtotal: currentModuleSubtotal,
      itens: pricingItems.map((it) => ({
        id: it.id,
        description: it.description,
        material: it.material,
        espessura: it.espessura,
        metragem: it.metragem,
        unidade: it.unidade,
        unitCost: it.unitCost,
        totalCost: it.totalCost,
        markup: it.markup,
        salePrice: it.salePrice,
      })),
    }

    setAmbientes((prev) => {
      const ambIndex = prev.findIndex((a) => a.id === targetAmbienteId)
      if (ambIndex >= 0) {
        const ambAtual = prev[ambIndex]
        const modulosAtualizados = [...ambAtual.modulos, novoModuloNoAmbiente]
        const subtotalAtualizado = modulosAtualizados.reduce((acc, m) => acc + (m.subtotal || 0), 0)
        const novos = [...prev]
        novos[ambIndex] = {
          ...ambAtual,
          modulos: modulosAtualizados,
          subtotal: subtotalAtualizado,
        }
        return novos
      } else if (prev.length > 0) {
        const modulosAtualizados = [...prev[0].modulos, novoModuloNoAmbiente]
        const subtotalAtualizado = modulosAtualizados.reduce((acc, m) => acc + (m.subtotal || 0), 0)
        const novos = [...prev]
        novos[0] = {
          ...novos[0],
          modulos: modulosAtualizados,
          subtotal: subtotalAtualizado,
        }
        return novos
      } else {
        // Nenhum ambiente ainda: cria um ambiente padrão com o nome selecionado ou 'Ambiente 1'
        const novoNome = (ambienteSelecionado || room || '').trim() || 'Ambiente 1'
        const novoAmb: AmbienteOrcamento = {
          id: `amb-${Date.now()}`,
          nome: novoNome,
          modulos: [novoModuloNoAmbiente],
          subtotal: currentModuleSubtotal,
        }
        setActiveAmbienteId(novoAmb.id)
        return [novoAmb]
      }
    })

    toast({
      title: 'Módulo adicionado ao ambiente!',
      description: `"${currentModuleName}" foi incluído em ${ambienteSelecionado || room || 'Ambiente'}. Agora você pode configurar outro módulo.`,
    })

    // 2. Limpa APENAS os campos do próximo módulo
    setSelectedModuleId('')
    setUploadedFiles([])
    setSavedLoadedItems(null)
    setIsAnalyzing(false)
    setManualItems([])
    setMatchJustificativa(null)
    setAdaptacoesIA(null)
    setComposicaoModulo({
      divisorias: { qtd: 0 },
      corpos: [],
      portas: { qtd: 0, tipo: 'nenhum' },
      gavetas: { qtd: 0 },
      prateleiras: { qtd: 2 },
      cabideiro: false,
      sapateira: false,
      puxadores: 0,
      semTamponamento: false,
      tampoPedra: false,
    })
    setFatorEscalaIA(null)
    setDimensoesOriginaisIA(null)
    setDimensoesEstimadasIA(null)
    setIsCustomModuleIA(false)
    setCustomModuleNameIA('')
    if (analyzeTimeoutRef.current) {
      clearTimeout(analyzeTimeoutRef.current)
      analyzeTimeoutRef.current = null
    }
    setErrors({})
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Action: "Finalizar Orçamento"
  const handleFinalizeClick = () => {
    if (!clientName.trim()) {
      setErrors((prev) => ({ ...prev, clientName: 'Informe o nome do cliente antes de finalizar' }))
      topRef.current?.scrollIntoView({ behavior: 'smooth' })
      toast({
        title: 'Nome do cliente ausente',
        description: 'Por favor, informe o nome do cliente no cabeçalho.',
        variant: 'destructive',
      })
      return
    }

    setIsQuoteSaved(false)
    setSavedOrcamentoRecord(null)
    setIsFinalizeModalOpen(true)
  }

  const currentModuleName = selectedModuleObj?.nome_template || 'Módulo Padrão'

  // Consolida todos os ambientes e módulos (incluindo o que está sendo editado na tela, se houver)
  const ambientesConsolidados = useMemo<AmbienteOrcamento[]>(() => {
    // Se o usuário tem itens na tabela ou módulo configurado na tela que ainda não foram adicionados
    // explicitamente via "+ Adicionar Outro Módulo", inclui esse módulo atual no ambiente selecionado
    const hasCurrentModule = Boolean(selectedModuleObj) || pricingItems.length > 0
    const currentSubtotal = totalVenda

    // Se a lista de ambientes estiver totalmente vazia e houver módulo configurado na tela,
    // cria um ambiente temporário consolidado com o módulo da tela
    if (ambientes.length === 0 && hasCurrentModule) {
      const nomeAmbPadrao = (ambienteSelecionado || room || '').trim() || 'Ambiente Principal'
      return [
        {
          id: 'amb-tela-temporario',
          nome: nomeAmbPadrao,
          subtotal: currentSubtotal,
          modulos: [
            {
              id: 'mod-tela-ativo',
              modulo_id: selectedModuleId || undefined,
              nome: currentModuleName,
              dimensoes: { ...dimensoes },
              mdf_externo: `${mdfExterno.cor} (${mdfExterno.espessura}mm)`,
              mdf_interno: `${mdfInterno.cor} (${mdfInterno.espessura}mm)`,
              mdf_fundo: mdfFundo,
              padrao_projeto: padraoProjeto,
              composicao: {
                ...composicaoModulo,
                perfilConstrutivo:
                  composicaoModulo?.perfilConstrutivo ||
                  selectedModuleObj?.perfil_construtivo ||
                  (composicaoModulo?.semTamponamento ? 'Caixa Simples' : 'Fechado Envelopado'),
              },
              perfil_construtivo:
                (composicaoModulo?.perfilConstrutivo as PerfilConstrutivo) ||
                (selectedModuleObj?.perfil_construtivo as PerfilConstrutivo) ||
                (composicaoModulo?.semTamponamento ? 'Caixa Simples' : 'Fechado Envelopado'),
              adaptacoes: adaptacoesIA || undefined,
              subtotal: currentSubtotal,
              itens: pricingItems.map((it) => ({
                id: it.id,
                description: it.description,
                material: it.material,
                espessura: it.espessura,
                metragem: it.metragem,
                unidade: it.unidade,
                unitCost: it.unitCost,
                totalCost: it.totalCost,
                markup: it.markup,
                salePrice: it.salePrice,
              })),
            },
          ],
        },
      ]
    }

    return ambientes.map((amb) => {
      let modulosAmb = [...amb.modulos]
      const isActive = amb.id === targetAmbienteId

      // Se este for o ambiente ativo e houver módulo configurado na tela em tempo real,
      // ele deve SEMPRE entrar na consolidação/subtotal em tempo real, inclusive a partir do 2º módulo!
      if (isActive && hasCurrentModule) {
        modulosAmb.push({
          id: 'mod-tela-ativo',
          modulo_id: selectedModuleId || undefined,
          nome: `${currentModuleName} (em edição)`,
          dimensoes: { ...dimensoes },
          mdf_externo: `${mdfExterno.cor} (${mdfExterno.espessura}mm)`,
          mdf_interno: `${mdfInterno.cor} (${mdfInterno.espessura}mm)`,
          mdf_fundo: mdfFundo,
          padrao_projeto: padraoProjeto,
          composicao: {
            ...composicaoModulo,
            perfilConstrutivo:
              composicaoModulo?.perfilConstrutivo ||
              selectedModuleObj?.perfil_construtivo ||
              (composicaoModulo?.semTamponamento ? 'Caixa Simples' : 'Fechado Envelopado'),
          },
          perfil_construtivo:
            (composicaoModulo?.perfilConstrutivo as PerfilConstrutivo) ||
            (selectedModuleObj?.perfil_construtivo as PerfilConstrutivo) ||
            (composicaoModulo?.semTamponamento ? 'Caixa Simples' : 'Fechado Envelopado'),
          adaptacoes: adaptacoesIA || undefined,
          subtotal: currentSubtotal,
          itens: pricingItems.map((it) => ({
            id: it.id,
            description: it.description,
            material: it.material,
            espessura: it.espessura,
            metragem: it.metragem,
            unidade: it.unidade,
            unitCost: it.unitCost,
            totalCost: it.totalCost,
            markup: it.markup,
            salePrice: it.salePrice,
          })),
        })
      }

      const subtotalAmb = modulosAmb.reduce((acc, m) => acc + (m.subtotal || 0), 0)
      return {
        ...amb,
        modulos: modulosAmb,
        subtotal: subtotalAmb,
      }
    })
  }, [
    ambientes,
    targetAmbienteId,
    ambienteSelecionado,
    room,
    selectedModuleObj,
    selectedModuleId,
    currentModuleName,
    pricingItems,
    totalVenda,
    dimensoes,
    mdfExterno,
    mdfInterno,
    mdfFundo,
    padraoProjeto,
    composicaoModulo,
    adaptacoesIA,
  ])

  // Valor total geral do orçamento = soma de todos os subtotais de ambientes consolidados
  const valorTotalGeral = useMemo(() => {
    const soma = ambientesConsolidados.reduce((acc, a) => acc + (a.subtotal || 0), 0)
    // Se a soma der zero mas a tela atual tiver totalVenda, usa totalVenda
    return soma > 0 ? soma : totalVenda
  }, [ambientesConsolidados, totalVenda])

  // Custo total geral consolidado
  const custoTotalGeral = useMemo(() => {
    let custoTotal = 0
    let hasAnyModulos = false
    ambientesConsolidados.forEach((amb) => {
      amb.modulos.forEach((mod) => {
        hasAnyModulos = true
        mod.itens.forEach((it) => {
          custoTotal += Number(it.totalCost) || 0
        })
      })
    })
    return hasAnyModulos ? custoTotal : totalCusto
  }, [ambientesConsolidados, totalCusto])

  // Lista consolidada de todos os itens BOM de todos os módulos de todos os ambientes
  const bomConsolidada = useMemo<OrcamentoBOMItem[]>(() => {
    const todosItens: OrcamentoBOMItem[] = []
    ambientesConsolidados.forEach((amb) => {
      amb.modulos.forEach((mod) => {
        mod.itens.forEach((it) => {
          todosItens.push({
            id: it.id,
            description: `${amb.nome} - ${mod.nome}: ${it.description}`,
            material: it.material,
            espessura: it.espessura,
            metragem: it.metragem,
            unidade: it.unidade,
            unitCost: it.unitCost,
            totalCost: it.totalCost,
            markup: it.markup,
            salePrice: it.salePrice,
          })
        })
      })
    })
    return todosItens.length > 0
      ? todosItens
      : pricingItems.map((item) => ({
          id: item.id,
          description: item.description,
          material: item.material,
          espessura: item.espessura,
          metragem: item.metragem,
          unidade: item.unidade,
          unitCost: item.unitCost,
          totalCost: item.totalCost,
          markup: item.markup,
          salePrice: item.salePrice,
        }))
  }, [ambientesConsolidados, pricingItems])

  const handleConfirmFinalize = async () => {
    setIsSavingQuote(true)
    try {
      const totalSale = valorTotalGeral
      const totalCost = custoTotalGeral

      // Busca parâmetros reais da DRE de configuracoes_engenharia, custos fixos, variáveis e comissões
      let impostosPercent = 10.0
      let comissaoPercent = 5.0
      let custoFixoPercent = 8.0
      let markupConfig = 2.5

      try {
        const { config, custosFixos, custosVariaveis, comissoesPersonalizadas } =
          await fetchConfigEngenharia()

        if (config) {
          impostosPercent = Number(config.impostos_percent) || 10.0
          // Soma da comissão base + comissões personalizadas
          const comissaoBase = Number(config.comissoes_percent) || 0
          const comissoesExtras = (comissoesPersonalizadas ?? []).reduce(
            (s, c) => s + (Number(c.percentual) || 0),
            0,
          )
          comissaoPercent = comissaoBase + comissoesExtras || 5.0
          markupConfig = Number(config.markup_padrao) || 2.5

          // Cálculo do índice de rateio real da Engenharia Financeira
          const totalCustosFixos = (custosFixos ?? []).reduce(
            (s, c) => s + (Number(c.valor) || 0),
            0,
          )
          const totalCustosVariaveis = (custosVariaveis ?? []).reduce(
            (s, c) => s + (Number(c.valor) || 0),
            0,
          )
          const totalCustosEmpresa = totalCustosFixos + totalCustosVariaveis
          const meta = Number(config.meta_faturamento) || 0

          if (meta > 0) {
            custoFixoPercent = Math.round((totalCustosEmpresa / meta) * 100 * 100) / 100
          }
        } else if (configEngenhariaCompleta) {
          impostosPercent = configEngenhariaCompleta.impostos_percent
          comissaoPercent = configEngenhariaCompleta.comissoes_percent
          custoFixoPercent = configEngenhariaCompleta.indice_rateio
          markupConfig = configEngenhariaCompleta.markup_padrao
        } else {
          console.warn(
            'Configuração de engenharia não encontrada no Supabase. Usando defaults com aviso.',
          )
        }
      } catch (e) {
        console.warn('Erro ao buscar configuração da engenharia no finalize. Usando fallback:', e)
      }

      const impostosValor = Math.round(((totalSale * impostosPercent) / 100) * 100) / 100
      const comissaoValor = Math.round(((totalSale * comissaoPercent) / 100) * 100) / 100
      const custoFixoValor = Math.round(((totalSale * custoFixoPercent) / 100) * 100) / 100
      const lucroValor =
        Math.round((totalSale - totalCost - impostosValor - comissaoValor - custoFixoValor) * 100) /
        100
      const lucroPercent = totalSale > 0 ? (lucroValor / totalSale) * 100 : 0
      const markupEfetivo = totalCost > 0 ? totalSale / totalCost : markupConfig

      const dreJson: OrcamentoDRE = {
        custo_mp: totalCost,
        impostos: impostosValor,
        impostos_percent: impostosPercent,
        comissao: comissaoValor,
        comissao_percent: comissaoPercent,
        custo_fixo_rateado: custoFixoValor,
        custo_fixo_percent: custoFixoPercent,
        lucro_liquido: lucroValor,
        lucro_liquido_percent: Math.round(lucroPercent * 100) / 100,
        markup_efetivo: Math.round(markupEfetivo * 100) / 100,
        preco_final: totalSale,
      }

      // Limpa qualquer sufixo transitório "(em edição)" dos nomes dos módulos ao persistir
      const ambientesParaSalvar: AmbienteOrcamento[] = ambientesConsolidados.map((amb) => ({
        ...amb,
        modulos: (amb.modulos || []).map((m) => ({
          ...m,
          perfil_construtivo: m.perfil_construtivo || m.composicao?.perfilConstrutivo,
          composicao: m.composicao
            ? {
                ...m.composicao,
                perfilConstrutivo: m.perfil_construtivo || m.composicao.perfilConstrutivo,
              }
            : m.composicao,
          nome: m.nome.replace(/\s*\(em edição\)\s*/gi, '').trim() || m.nome,
        })),
      }))

      const bomJson: OrcamentoBOMItem[] = bomConsolidada.map((item) => ({
        ...item,
        description: item.description.replace(/\s*\(em edição\)\s*/gi, ''),
      }))

      let savedRecord: Orcamento | null = null

      const mdfExternoStr = JSON.stringify(mdfExterno)
      const mdfInternoStr = JSON.stringify(mdfInterno)

      // Nome do primeiro ambiente e primeiro módulo para compatibilidade legada
      const primeiroAmbienteNome =
        ambientesParaSalvar[0]?.nome || ambienteSelecionado || room || 'Ambiente Principal'
      const primeiroModuloNome = (
        ambientesParaSalvar[0]?.modulos[0]?.nome ||
        currentModuleName ||
        'Módulo Planejado'
      )
        .replace(/\s*\(em edição\)\s*/gi, '')
        .trim()

      if (editingId) {
        // Atualização de orçamento existente
        savedRecord = await updateOrcamento(editingId, {
          cliente_nome: clientName,
          ambiente: primeiroAmbienteNome,
          modulo: primeiroModuloNome,
          valor_total: totalSale,
          status: 'Aprovado',
          forma_pagamento: formaPagamento || null,
          observacoes: observacoes || null,
          bom_json: bomJson,
          dre_json: dreJson,
          ambientes_json: ambientesParaSalvar,
          dimensoes_json: dimensoes,
          mdf_externo: mdfExternoStr,
          mdf_interno: mdfInternoStr,
          mdf_fundo: mdfFundo,
          padrao_projeto: padraoProjeto,
        })
      } else {
        // Criação de novo orçamento
        savedRecord = await createOrcamento({
          cliente_nome: clientName,
          ambiente: primeiroAmbienteNome,
          modulo: primeiroModuloNome,
          valor_total: totalSale,
          status: 'Aprovado',
          forma_pagamento: formaPagamento || null,
          observacoes: observacoes || null,
          bom_json: bomJson,
          dre_json: dreJson,
          ambientes_json: ambientesParaSalvar,
          dimensoes_json: dimensoes,
          mdf_externo: mdfExternoStr,
          mdf_interno: mdfInternoStr,
          mdf_fundo: mdfFundo,
          padrao_projeto: padraoProjeto,
        })
      }

      if (savedRecord) {
        // Ao salvar com sucesso no banco, vincula o rascunho ao ID recém-salvo e limpa o estado
        clearDraftStorage()
        setDraftLinkedOrcamentoId(savedRecord.id)
        setHasRestoredDraft(false)
        setSavedOrcamentoRecord(savedRecord)
        setIsQuoteSaved(true)
        toast({
          title: editingId
            ? '✓ Orçamento Atualizado com Sucesso!'
            : '✓ Orçamento Salvo com Sucesso!',
          description: `Orçamento de ${clientName} ${editingId ? 'atualizado' : 'registrado'}. Escolha os relatórios em PDF para download.`,
        })
      } else {
        clearDraftStorage()
        setDraftLinkedOrcamentoId(null)
        setHasRestoredDraft(false)
        toast({
          title: 'Aviso',
          description: 'Orçamento processado. Redirecionando para a lista.',
        })
        navigate('/orcamentos')
      }
    } catch (err) {
      console.error('Erro ao finalizar orçamento:', err)
      toast({
        title: 'Erro ao salvar orçamento',
        description: 'Ocorreu um erro ao gravar os dados. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSavingQuote(false)
    }
  }

  // Handlers para gerar os PDFs no Modal após a finalização
  const handleDownloadProposta = async () => {
    try {
      const totalSale = valorTotalGeral
      const numSeq = savedOrcamentoRecord?.numero_sequencial
      const codigoFormatado =
        numSeq !== undefined && numSeq !== null
          ? String(numSeq).padStart(3, '0')
          : (savedOrcamentoRecord?.id || editingId || '').slice(-6).toUpperCase() || undefined

      const gruposFormatados = ambientesConsolidados.map((amb) => ({
        nome: amb.nome,
        subtotal: amb.subtotal ?? 0,
        itens: (amb.modulos || []).map((m) => {
          const nomeLimpo = m.nome.replace(/\s*\(em edição\)\s*/gi, '').trim() || m.nome
          const descNatural = montarDescricaoNaturalModulo({
            nome: nomeLimpo,
            dimensoes: m.dimensoes,
            mdfExterno: m.mdf_externo || `${mdfExterno.cor} (${mdfExterno.espessura}mm)`,
            composicao: m.composicao,
          })
          return {
            nome: nomeLimpo,
            descricao: descNatural,
            quantidade: 1,
            valorUnitario: m.subtotal ?? 0,
            valorTotal: m.subtotal ?? 0,
          }
        }),
      }))

      await gerarPropostaComercial({
        orcamentoId: savedOrcamentoRecord?.id || editingId || undefined,
        numeroSequencial: numSeq,
        codigo: codigoFormatado,
        data: savedOrcamentoRecord?.data || new Date().toISOString(),
        cliente: {
          nome: clientName,
        },
        empresa: perfilEmpresa,
        ambientes: [],
        ambientesGrupos: gruposFormatados,
        valorTotal: totalSale,
        formaPagamento: formaPagamento,
        observacoes: observacoes,
      })
      toast({
        title: '✓ PDF da Proposta Gerado!',
        description: 'O download do documento comercial foi iniciado.',
      })
    } catch (err: unknown) {
      console.error('Erro ao gerar proposta comercial:', err)
      const errorMsg =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Não foi possível gerar a Proposta Comercial.'
      toast({
        title: 'Erro na geração da Proposta',
        description: errorMsg,
        variant: 'destructive',
      })
    }
  }

  const handleDownloadAnaliseCusto = async () => {
    try {
      const totalSale = valorTotalGeral
      const totalCost = custoTotalGeral

      const impPercent = configEngenhariaCompleta?.impostos_percent ?? 10.0
      const comPercent = configEngenhariaCompleta?.comissoes_percent ?? 5.0
      const fixoPercent = configEngenhariaCompleta?.indice_rateio ?? 8.0
      const markupConfig = configEngenhariaCompleta?.markup_padrao ?? markupEngenharia ?? 2.5

      const impVal = Math.round(((totalSale * impPercent) / 100) * 100) / 100
      const comVal = Math.round(((totalSale * comPercent) / 100) * 100) / 100
      const fixoVal = Math.round(((totalSale * fixoPercent) / 100) * 100) / 100
      const lucroVal = Math.round((totalSale - totalCost - impVal - comVal - fixoVal) * 100) / 100
      const lucroPct = totalSale > 0 ? (lucroVal / totalSale) * 100 : 0
      const markupEf = totalCost > 0 ? totalSale / totalCost : markupConfig

      const dre = savedOrcamentoRecord?.dre_json || {
        custo_mp: totalCost,
        impostos: impVal,
        impostos_percent: impPercent,
        comissao: comVal,
        comissao_percent: comPercent,
        custo_fixo_rateado: fixoVal,
        custo_fixo_percent: fixoPercent,
        lucro_liquido: lucroVal,
        lucro_liquido_percent: Math.round(lucroPct * 100) / 100,
        markup_efetivo: Math.round(markupEf * 100) / 100,
        preco_final: totalSale,
      }

      const numSeq = savedOrcamentoRecord?.numero_sequencial
      const codigoFormatado =
        numSeq !== undefined && numSeq !== null
          ? String(numSeq).padStart(3, '0')
          : (savedOrcamentoRecord?.id || editingId || '').slice(-6).toUpperCase() || undefined

      const ambientesParaPdf: AmbienteOrcamento[] = ambientesConsolidados.map((amb) => ({
        ...amb,
        modulos: (amb.modulos || []).map((m) => ({
          ...m,
          nome: m.nome.replace(/\s*\(em edição\)\s*/gi, '').trim() || m.nome,
        })),
      }))

      const bomParaPdf = bomConsolidada.map((item) => ({
        ...item,
        description: item.description.replace(/\s*\(em edição\)\s*/gi, ''),
      }))

      await gerarAnaliseCusto({
        orcamentoId: savedOrcamentoRecord?.id || editingId || undefined,
        numeroSequencial: numSeq,
        codigo: codigoFormatado,
        data: savedOrcamentoRecord?.data || new Date().toISOString(),
        cliente: {
          nome: clientName,
        },
        moduloNome:
          currentModuleName.replace(/\s*\(em edição\)\s*/gi, '').trim() || 'Módulo Planejado',
        ambienteNome: ambienteSelecionado || room || 'Ambiente',
        dimensoes: dimensoes,
        empresa: perfilEmpresa,
        dre: dre,
        bom: bomParaPdf,
        ambientes_json: ambientesParaPdf,
        valorTotalVenda: totalSale,
        valorTotalCusto: totalCost,
      })
      toast({
        title: '✓ PDF de Análise de Custo Gerado!',
        description: 'O relatório de engenharia foi baixado com sucesso.',
      })
    } catch (err: unknown) {
      console.error('Erro ao gerar análise de custo:', err)
      const errorMsg =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Não foi possível gerar a Análise de Custo.'
      toast({
        title: 'Erro na geração da Análise de Custo',
        description: errorMsg,
        variant: 'destructive',
      })
    }
  }

  // Formatador monetário pt-BR com 2 casas decimais.
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val)

  return (
    <div ref={topRef} className="space-y-8 pb-20">
      {/* Banner de Rascunho Restaurado */}
      {hasRestoredDraft && !editingId && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-fade-in">
          <div className="flex items-center gap-2.5">
            <RotateCcw className="w-4 h-4 text-amber-700 shrink-0" />
            <div className="text-xs sm:text-sm">
              <span className="font-bold">Rascunho automático restaurado</span>
              {draftRestoredTime && (
                <span className="text-amber-800 ml-1 opacity-90">
                  (salvo às {draftRestoredTime})
                </span>
              )}
              <span className="block sm:inline sm:ml-1 text-amber-700 text-xs">
                — Seus dados preenchidos anteriormente foram recuperados.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDiscardDraft}
              className="h-8 px-3 text-xs border-amber-300 bg-white hover:bg-amber-100 text-amber-900 font-semibold rounded-xl"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1 text-amber-700" />
              Descartar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setHasRestoredDraft(false)}
              className="h-8 px-2 text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded-xl"
            >
              Dispensar
            </Button>
          </div>
        </div>
      )}

      {/* 1. Header Hero Title */}
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-300 text-slate-800 text-xs font-semibold mb-1">
          <Sparkles className="w-3.5 h-3.5 text-slate-700" />
          <span>Comparador Visual Paramétrico</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {editingId ? 'Editar Orçamento de Marcenaria' : 'Novo Orçamento de Marcenaria'}
        </h2>
        <p className="text-sm sm:text-base text-slate-500 max-w-3xl leading-relaxed">
          {editingId
            ? `Editando dados do orçamento #${editingId.slice(-6).toUpperCase()} — ajuste peças, dimensões e condições comerciais.`
            : 'Compare o projeto do cliente com o módulo da biblioteca e gere a precificação automática com lista de peças e markup comercial.'}
        </p>
      </div>
      {/* 2. CABEÇALHO DE IDENTIFICAÇÃO E GESTÃO MULTI-AMBIENTE */}
      <section aria-labelledby="identificacao-heading">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-xs">
                1
              </div>
              <h3
                id="identificacao-heading"
                className="text-sm sm:text-base font-bold text-slate-900"
              >
                Identificação do Orçamento
              </h3>
              <span className="text-xs text-slate-400 font-normal hidden sm:inline">
                • Cliente e Gestão de Ambientes
              </span>
            </div>

            {/* Totalizadores rápidos do Orçamento */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className="bg-slate-50 text-slate-700 border-slate-300 font-semibold text-xs px-2.5 py-1"
              >
                {ambientesConsolidados.length}{' '}
                {ambientesConsolidados.length === 1 ? 'ambiente' : 'ambientes'} ·{' '}
                {ambientesConsolidados.reduce((acc, a) => acc + (a.modulos?.length || 0), 0)}{' '}
                {ambientesConsolidados.reduce((acc, a) => acc + (a.modulos?.length || 0), 0) === 1
                  ? 'módulo'
                  : 'módulos'}
              </Badge>
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-800 border-emerald-300 font-bold text-xs px-3 py-1 font-mono"
              >
                Total: {formatCurrency(valorTotalGeral)}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Input: Nome do Cliente */}
            <div className="space-y-1.5 md:col-span-2">
              <label
                htmlFor="clientName"
                className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
              >
                <User className="w-3.5 h-3.5 text-slate-700" />
                Nome do Cliente <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Input
                  id="clientName"
                  placeholder="Ex.: Maria Silva"
                  value={clientName}
                  onChange={(e) => handleClientNameChange(e.target.value)}
                  className={cn(
                    'h-11 rounded-xl text-sm transition-all',
                    errors.clientName
                      ? 'border-rose-500 ring-2 ring-rose-200 bg-rose-50/20'
                      : 'border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20',
                  )}
                />
              </div>
              {errors.clientName && (
                <p className="text-[11px] font-medium text-rose-600 flex items-center gap-1 pt-0.5 animate-fade-in">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.clientName}
                </p>
              )}
            </div>

            {/* Ação rápida: Adicionar Novo Ambiente */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                <FolderPlus className="w-3.5 h-3.5 text-slate-700" />
                Novo Ambiente
              </label>
              {!isAddingAmbiente ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddingAmbiente(true)}
                  className="w-full h-11 border-dashed border-slate-300 hover:border-slate-500 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4 text-slate-600" />+ Adicionar Ambiente
                </Button>
              ) : (
                <div className="flex items-center gap-1.5 animate-fade-in">
                  <Input
                    placeholder="Nome do cômodo..."
                    value={novoAmbienteNome}
                    onChange={(e) => setNovoAmbienteNome(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddNovoAmbiente(novoAmbienteNome)
                      }
                    }}
                    autoFocus
                    className="h-11 text-xs border-slate-300 rounded-xl"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleAddNovoAmbiente(novoAmbienteNome)}
                    className="h-11 px-3 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shrink-0"
                  >
                    Adicionar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsAddingAmbiente(false)
                      setNovoAmbienteNome('')
                    }}
                    className="h-11 px-2 text-slate-500 hover:text-slate-800 rounded-xl text-xs shrink-0"
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Abas / Cards expansíveis por Ambiente */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5 text-slate-700" />
                Ambientes do Projeto ({ambientesConsolidados.length})
              </span>
              <span className="text-xs text-slate-400">
                Clique na aba para selecionar o ambiente de trabalho
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {ambientesConsolidados.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-8 flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-2xs text-slate-400 flex items-center justify-center">
                    <Home className="w-6 h-6 text-slate-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-800">
                      Nenhum ambiente adicionado ainda
                    </p>
                    <p className="text-xs text-slate-500 max-w-sm">
                      Todo orçamento começa zerado. Adicione o primeiro ambiente (ex: Cozinha,
                      Quarto, Varanda) para organizar seus módulos.
                    </p>
                  </div>
                  {!isAddingAmbiente ? (
                    <Button
                      type="button"
                      onClick={() => setIsAddingAmbiente(true)}
                      className="bg-slate-700 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl h-10 px-4 shadow-xs flex items-center gap-2 mt-1"
                    >
                      <Plus className="w-4 h-4" />+ Adicionar Ambiente
                    </Button>
                  ) : null}
                </div>
              ) : (
                ambientesConsolidados.map((amb, index) => {
                  const isActive = amb.id === targetAmbienteId
                  const modulosCount = amb.modulos.length
                  return (
                    <div
                      key={amb.id}
                      className={cn(
                        'rounded-xl border transition-all overflow-hidden',
                        isActive
                          ? 'border-slate-400 bg-slate-50/50 shadow-sm ring-1 ring-slate-400/30'
                          : 'border-slate-200 bg-white hover:border-slate-300',
                      )}
                    >
                      {/* Header do Card de Ambiente */}
                      <div
                        onClick={() => {
                          setActiveAmbienteId(amb.id)
                          setAmbienteSelecionado(amb.nome)
                          setRoom(amb.nome)
                        }}
                        className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={cn(
                              'w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0',
                              isActive ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600',
                            )}
                          >
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-900 truncate">
                                {amb.nome}
                              </span>
                              {isActive && (
                                <Badge className="bg-slate-700 text-white text-[10px] px-1.5 py-0 font-medium">
                                  Ativo
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">
                              {modulosCount} {modulosCount === 1 ? 'módulo' : 'módulos'}{' '}
                              configurado(s)
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                              Subtotal Ambiente
                            </span>
                            <span className="text-sm font-bold font-mono text-slate-800">
                              {formatCurrency(amb.subtotal)}
                            </span>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveAmbiente(amb.id)
                            }}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                            title="Excluir este ambiente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Lista dos módulos já cadastrados dentro deste ambiente */}
                      {amb.modulos.length > 0 && (
                        <div className="px-3.5 pb-3.5 sm:px-4 sm:pb-4 border-t border-slate-200/60 pt-3">
                          <div className="space-y-2">
                            {amb.modulos.map((mod, mIdx) => (
                              <div
                                key={mod.id || mIdx}
                                className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white border border-slate-200 text-xs shadow-2xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <Box className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                                  <div className="min-w-0">
                                    <span className="font-bold text-slate-800 truncate block">
                                      {mod.nome}
                                    </span>
                                    {mod.dimensoes && (
                                      <span className="text-[11px] text-slate-500 font-mono">
                                        {mod.dimensoes.largura}L × {mod.dimensoes.altura}A ×{' '}
                                        {mod.dimensoes.profundidade}P mm
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-semibold font-mono text-slate-800">
                                    {formatCurrency(mod.subtotal)}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleRemoveModulo(amb.id, mod.id)
                                    }}
                                    className="h-6 w-6 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                    title="Remover módulo"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Configuração do Módulo para o Ambiente Ativo */}
          <div className="pt-2 border-t border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Ambiente Ativo Atual */}
              <div className="space-y-1.5">
                <label
                  htmlFor="ambiente-combobox-header"
                  className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
                >
                  <Home className="w-3.5 h-3.5 text-slate-700" />
                  Ambiente em Edição <span className="text-rose-500">*</span>
                </label>
                <AmbienteSelector
                  id="ambiente-combobox-header"
                  value={ambienteSelecionado || room}
                  onChange={(val) => {
                    handleAmbienteSelecionadoChange(val)
                    // Se não houver nenhum ambiente na lista mas o usuário selecionou/digitou um ambiente, cria o primeiro ambiente
                    setAmbientes((prev) => {
                      if (prev.length === 0) {
                        const newAmb: AmbienteOrcamento = {
                          id: `amb-${Date.now()}`,
                          nome: val,
                          modulos: [],
                          subtotal: 0,
                        }
                        setActiveAmbienteId(newAmb.id)
                        return [newAmb]
                      }
                      return prev.map((a) => (a.id === targetAmbienteId ? { ...a, nome: val } : a))
                    })
                  }}
                  error={errors.room}
                />
                {errors.room && (
                  <p className="text-[11px] font-medium text-rose-600 flex items-center gap-1 pt-0.5 animate-fade-in">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.room}
                  </p>
                )}
              </div>

              {/* Select: Módulo — 100% dinâmico do Supabase */}
              <div className="space-y-1.5">
                <label
                  htmlFor="moduleSelect"
                  className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
                >
                  <Box className="w-3.5 h-3.5 text-slate-700" />
                  Módulo a Configurar / Identificado <span className="text-rose-500">*</span>
                </label>
                <Select value={selectedModuleId} onValueChange={handleModuleChange}>
                  <SelectTrigger
                    id="moduleSelect"
                    className={cn(
                      'h-11 rounded-xl text-sm transition-all',
                      errors.selectedModule
                        ? 'border-rose-500 ring-2 ring-rose-200 bg-rose-50/20'
                        : 'border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20',
                    )}
                  >
                    <SelectValue
                      placeholder={loadingModulos ? 'Carregando módulos...' : 'Selecione o módulo'}
                    />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {selectedModuleId === 'MODULO-CUSTOM' && (
                      <SelectItem value="MODULO-CUSTOM" className="font-semibold text-amber-700">
                        ✨ {customModuleNameIA || 'Módulo Personalizado (Análise IA)'}
                      </SelectItem>
                    )}
                    {modulosDisponiveis.length === 0 && !loadingModulos && (
                      <div className="px-3 py-2 text-xs text-slate-500">
                        Nenhum módulo disponível na biblioteca.
                      </div>
                    )}
                    {modulosDisponiveis.map((modulo) => (
                      <SelectItem key={modulo.id} value={modulo.id}>
                        {modulo.nome_template}
                      </SelectItem>
                    ))}
                    {selectedModuleId !== 'MODULO-CUSTOM' && (
                      <SelectItem value="MODULO-CUSTOM" className="text-slate-600">
                        + Módulo Personalizado (Sob Medida)
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {errors.selectedModule && (
                  <p className="text-[11px] font-medium text-rose-600 flex items-center gap-1 pt-0.5 animate-fade-in">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.selectedModule}
                  </p>
                )}
              </div>
            </div>

            {/* Controles Construtivos do Módulo (Perfil e Overrides) */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4">
              <div className="text-xs bg-sky-50 text-sky-900 border border-sky-200 px-3 py-2 rounded-xl flex items-center gap-2">
                <span className="font-bold">Perfil Construtivo:</span>
                <span className="font-semibold">
                  {composicaoModulo?.perfilConstrutivo ||
                    selectedModuleObj?.perfil_construtivo ||
                    (composicaoModulo?.semTamponamento ? 'Caixa Simples' : 'Fechado Envelopado')}
                </span>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-50/80 hover:bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 transition-colors">
                <Checkbox
                  id="toggle-sem-tamponamento"
                  checked={Boolean(
                    composicaoModulo?.semTamponamento ||
                    composicaoModulo?.perfilConstrutivo === 'Caixa Simples',
                  )}
                  onCheckedChange={(checked) => {
                    setSavedLoadedItems(null)
                    setComposicaoModulo((prev) => ({
                      ...prev,
                      semTamponamento: Boolean(checked),
                      perfilConstrutivo: checked
                        ? 'Caixa Simples'
                        : selectedModuleObj?.perfil_construtivo || 'Fechado Envelopado',
                    }))
                  }}
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800 block">Móvel sem tamponamento</span>
                  <span className="text-[10px] text-slate-500 block">
                    {composicaoModulo?.semTamponamento ||
                    composicaoModulo?.perfilConstrutivo === 'Caixa Simples'
                      ? 'Override ativo: Caixa simples (sem laterais/teto/base internos)'
                      : 'Respeita o perfil do módulo (ex: caixa dupla envelopada ou estrutura aberta)'}
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-50/80 hover:bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 transition-colors">
                <Checkbox
                  id="toggle-tampo-pedra"
                  checked={Boolean(
                    composicaoModulo?.tampoPedra ||
                    composicaoModulo?.perfilConstrutivo === 'Balcão (tampo por conta do cliente)' ||
                    selectedModuleObj?.perfil_construtivo === 'Balcão (tampo por conta do cliente)',
                  )}
                  onCheckedChange={(checked) => {
                    setSavedLoadedItems(null)
                    setComposicaoModulo((prev) => ({
                      ...prev,
                      tampoPedra: Boolean(checked),
                    }))
                  }}
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800 block">Tampo de pedra / avulso</span>
                  <span className="text-[10px] text-slate-500 block">
                    Travessas no topo; nenhum tampo entra automaticamente no orçamento
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>
      </section>
      {/* 3. ÁREA CENTRAL: O MATCH LADO A LADO (Grid de 2 colunas) */}
      <section aria-labelledby="match-heading" className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-xs">
              2
            </div>
            <h3 id="match-heading" className="text-base sm:text-lg font-bold text-slate-900">
              Comparação Lado a Lado
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            Validação visual entre o desejo do cliente e os padrões construtivos
          </span>
        </div>

        {/* 2-Column Responsive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative items-stretch">
          {/* Left Column: Upload do Cliente */}
          <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <User className="w-4 h-4 text-slate-700" />
                  Upload do Cliente (Croqui / Foto)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Projeto de referência enviado para cotar
                </p>
              </div>
            </div>

            <div className="flex-1 min-h-[300px]">
              <CustomerDropzone
                uploadedFiles={uploadedFiles}
                onFilesSelect={handleFilesSelect}
                error={errors.uploadedFile}
                onClearError={() => setErrors((prev) => ({ ...prev, uploadedFile: undefined }))}
              />
            </div>
          </div>

          {/* Mobile Connection Indicator */}
          <div className="lg:hidden flex items-center justify-center my-[-10px] z-10">
            <div className="w-10 h-10 rounded-full bg-slate-700 text-white flex items-center justify-center shadow-lg ring-4 ring-white">
              <ArrowDown className="w-5 h-5 animate-bounce" />
            </div>
          </div>

          {/* Right Column: Match da Biblioteca */}
          <div ref={matchCardRef} className="flex flex-col h-full">
            <LibraryMatchCard
              selectedModule={selectedModuleObj}
              isAnalyzing={isAnalyzing}
              dimensoes={dimensoes}
              dimensoesOriginais={dimensoesOriginaisIA}
              dimensoesEstimadas={dimensoesEstimadasIA}
              fatorEscala={fatorEscalaIA}
              isCustomModule={isCustomModuleIA || selectedModuleId === 'MODULO-CUSTOM'}
              onOpenLibraryModal={() => navigate('/biblioteca')}
              modulosDisponiveis={modulosDisponiveis}
              selectedModuleId={selectedModuleId}
              justificativa={matchJustificativa}
              composicao={composicaoModulo}
              onComposicaoChange={(updater) => {
                setComposicaoModulo(updater)
                setSavedLoadedItems(null)
              }}
              adaptacoes={adaptacoesIA}
              perfilSugeridoIA={perfilSugeridoIA}
              confiancaIA={confiancaIA}
              isModuloConfirmado={isModuloConfirmado}
              onConfirmarModulo={() => {
                setIsModuloConfirmado(true)
                toast({
                  title: 'Módulo confirmado!',
                  description: 'Você já pode prosseguir para gerar o orçamento.',
                })
              }}
              onTratarPersonalizado={() => {
                setSelectedModuleId('MODULO-CUSTOM')
                setIsCustomModuleIA(true)
                setCustomModuleNameIA('Módulo Personalizado (Análise IA)')
                setIsModuloConfirmado(true)
                toast({
                  title: 'Definido como Módulo Personalizado',
                  description: 'O móvel será orçado com perfil sob medida.',
                })
              }}
              onModuleChange={(id) => {
                // Troca manual de gabarito: atualiza o card, confirma o módulo e reseta o estado de análise.
                handleModuleChange(id)
                setIsModuloConfirmado(true)
                setIsAnalyzing(false)
                if (analyzeTimeoutRef.current) {
                  clearTimeout(analyzeTimeoutRef.current)
                  analyzeTimeoutRef.current = null
                }
                toast({
                  title: 'Módulo trocado manualmente',
                  description: 'Gabarito atualizado para o módulo escolhido.',
                })
              }}
            />
          </div>
        </div>
      </section>
      {/* 3a. PAINEL DE DIMENSÕES REAIS DO MÓDULO */}
      <section aria-labelledby="dimensoes-heading" className="space-y-3">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-800 flex items-center justify-center">
                <Ruler className="w-4 h-4" />
              </div>
              <h3 id="dimensoes-heading" className="text-sm sm:text-base font-bold text-slate-900">
                Dimensões Reais do Módulo
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              Ajuste fino das medidas para o plano de corte
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            {/* Largura */}
            <div className="space-y-1.5">
              <Label
                htmlFor="dim-largura"
                className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
              >
                <ArrowRight className="w-3.5 h-3.5 text-slate-700" />
                Largura (L)
              </Label>
              <div className="relative">
                <Input
                  id="dim-largura"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={dimensoes.largura}
                  onChange={(e) =>
                    setDimensoes((prev) => ({
                      ...prev,
                      largura: Number(e.target.value) || 0,
                    }))
                  }
                  className="h-11 rounded-xl text-sm font-mono font-semibold border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20 pr-12"
                />{' '}
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  mm
                </span>
              </div>
            </div>

            {/* Altura */}
            <div className="space-y-1.5">
              <Label
                htmlFor="dim-altura"
                className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-700" />
                Altura (A)
              </Label>
              <div className="relative">
                <Input
                  id="dim-altura"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={dimensoes.altura}
                  onChange={(e) =>
                    setDimensoes((prev) => ({
                      ...prev,
                      altura: Number(e.target.value) || 0,
                    }))
                  }
                  className="h-11 rounded-xl text-sm font-mono font-semibold border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20 pr-12"
                />{' '}
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  mm
                </span>
              </div>
            </div>

            {/* Profundidade */}
            <div className="space-y-1.5">
              <Label
                htmlFor="dim-profundidade"
                className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
              >
                <ArrowDown className="w-3.5 h-3.5 text-slate-700" />
                Profundidade (P)
              </Label>
              <div className="relative">
                <Input
                  id="dim-profundidade"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={dimensoes.profundidade}
                  onChange={(e) =>
                    setDimensoes((prev) => ({
                      ...prev,
                      profundidade: Number(e.target.value) || 0,
                    }))
                  }
                  className="h-11 rounded-xl text-sm font-mono font-semibold border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20 pr-12"
                />{' '}
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  mm
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* 3b. CARD DE ESPECIFICAÇÃO DE MATERIAIS */}
      <section aria-labelledby="materiais-heading" className="space-y-3">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-800 flex items-center justify-center">
                <Layers3 className="w-4 h-4" />
              </div>
              <h3 id="materiais-heading" className="text-sm sm:text-base font-bold text-slate-900">
                Especificação de Materiais
              </h3>
            </div>
            <span className="text-xs text-slate-500">Acabamento e espessuras do MDF</span>
          </div>

          <div className="space-y-5 pt-4">
            {/* Padrão do Projeto — Radio Cards visuais */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Padrão do Projeto
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPadraoProjeto('comercial')}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-xl border text-left transition-all',
                    padraoProjeto === 'comercial'
                      ? 'border-slate-600 bg-slate-100/70 ring-2 ring-slate-600/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white',
                  )}
                >
                  <Star
                    className={cn(
                      'w-5 h-5 mt-0.5 shrink-0',
                      padraoProjeto === 'comercial'
                        ? 'text-slate-700 fill-slate-600'
                        : 'text-slate-300',
                    )}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900">Padrão (Comercial)</div>
                    <div className="text-[11px] text-slate-500 leading-snug">
                      Materiais e acabamentos de mercado, custo otimizado.
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPadraoProjeto('premium')}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-xl border text-left transition-all',
                    padraoProjeto === 'premium'
                      ? 'border-slate-600 bg-slate-100/70 ring-2 ring-slate-600/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white',
                  )}
                >
                  <div className="flex mt-0.5 shrink-0">
                    <Star
                      className={cn(
                        'w-5 h-5',
                        padraoProjeto === 'premium'
                          ? 'text-slate-700 fill-slate-600'
                          : 'text-slate-300',
                      )}
                    />
                    <Star
                      className={cn(
                        'w-5 h-5 -ml-1',
                        padraoProjeto === 'premium'
                          ? 'text-slate-700 fill-slate-600'
                          : 'text-slate-300',
                      )}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900">Premium (Alto Padrão)</div>
                    <div className="text-[11px] text-slate-500 leading-snug">
                      Acabamentos nobres, ferragens e detalhamento superior.
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* MDF Externo */}
            <div className="space-y-2 p-3 rounded-xl bg-slate-50/60 border border-slate-100">
              <div className="flex items-center gap-1.5">
                <Box className="w-4 h-4 text-slate-700" />
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  MDF Externo
                </Label>
                <span className="text-[11px] text-slate-400 font-normal">
                  Frentes / caixaria vista
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Material / Cor</span>
                  <Select
                    value={mdfExterno.cor}
                    onValueChange={(v) => {
                      const mat = opcoesMdfEstrutural.find((item) => item.nome_material === v)
                      const espessura: 15 | 18 = mat?.categoria === 'MDF 15mm' ? 15 : 18
                      setMdfExterno({ cor: v, espessura })
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-lg text-sm bg-white border-slate-300">
                      <SelectValue placeholder="Selecione o MDF externo" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {opcoesMdfEstrutural.length === 0 ? (
                        <SelectItem value="Branco TX">Branco TX</SelectItem>
                      ) : (
                        opcoesMdfEstrutural.map((mat) => (
                          <SelectItem key={mat.id} value={mat.nome_material}>
                            {mat.nome_material}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Espessura</span>
                  <ToggleGroup
                    type="single"
                    value={String(mdfExterno.espessura)}
                    onValueChange={(v) =>
                      v && setMdfExterno((prev) => ({ ...prev, espessura: Number(v) as 15 | 18 }))
                    }
                    className="justify-start bg-white border border-slate-300 rounded-lg p-1 h-10 w-full"
                  >
                    <ToggleGroupItem
                      value="15"
                      className="flex-1 h-8 text-xs font-semibold data-[state=on]:bg-slate-700 data-[state=on]:text-white rounded-md"
                    >
                      15 mm
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="18"
                      className="flex-1 h-8 text-xs font-semibold data-[state=on]:bg-slate-700 data-[state=on]:text-white rounded-md"
                    >
                      18 mm
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
            </div>

            {/* MDF Interno */}
            <div className="space-y-2 p-3 rounded-xl bg-slate-50/60 border border-slate-100">
              <div className="flex items-center gap-1.5">
                <Layers3 className="w-4 h-4 text-slate-700" />
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  MDF Interno
                </Label>
                <span className="text-[11px] text-slate-400 font-normal">
                  Prateleiras / divisórias / gavetas
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Material / Cor</span>
                  <Select
                    value={mdfInterno.cor}
                    onValueChange={(v) => {
                      const mat = opcoesMdfEstrutural.find((item) => item.nome_material === v)
                      const espessura: 15 | 18 = mat?.categoria === 'MDF 18mm' ? 18 : 15
                      setMdfInterno({ cor: v, espessura })
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-lg text-sm bg-white border-slate-300">
                      <SelectValue placeholder="Selecione o MDF interno" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {opcoesMdfEstrutural.length === 0 ? (
                        <SelectItem value="Branco TX">Branco TX</SelectItem>
                      ) : (
                        opcoesMdfEstrutural.map((mat) => (
                          <SelectItem key={mat.id} value={mat.nome_material}>
                            {mat.nome_material}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Espessura</span>
                  <ToggleGroup
                    type="single"
                    value={String(mdfInterno.espessura)}
                    onValueChange={(v) =>
                      v && setMdfInterno((prev) => ({ ...prev, espessura: Number(v) as 15 | 18 }))
                    }
                    className="justify-start bg-white border border-slate-300 rounded-lg p-1 h-10 w-full"
                  >
                    <ToggleGroupItem
                      value="15"
                      className="flex-1 h-8 text-xs font-semibold data-[state=on]:bg-slate-700 data-[state=on]:text-white rounded-md"
                    >
                      15 mm
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="18"
                      className="flex-1 h-8 text-xs font-semibold data-[state=on]:bg-slate-700 data-[state=on]:text-white rounded-md"
                    >
                      18 mm
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
            </div>

            {/* MDF Fundo */}
            <div className="space-y-2 p-3 rounded-xl bg-slate-50/60 border border-slate-100">
              <div className="flex items-center gap-1.5">
                <Package className="w-4 h-4 text-slate-700" />
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  MDF Fundo
                </Label>
                <span className="text-[11px] text-slate-400 font-normal">
                  Espessura / cor do fundo
                </span>
              </div>
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-500">Opção</span>
                <Select value={mdfFundo} onValueChange={setMdfFundo}>
                  <SelectTrigger className="h-10 rounded-lg text-sm bg-white border-slate-300">
                    <SelectValue placeholder="Selecione o MDF de fundo" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {opcoesMdfFundo.length === 0 ? (
                      <SelectItem value="MDF 6mm Branco TX">MDF 6mm Branco TX</SelectItem>
                    ) : (
                      opcoesMdfFundo.map((mat) => (
                        <SelectItem key={mat.id} value={mat.nome_material}>
                          {mat.nome_material}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* 4. BOTÃO DE AÇÃO PRINCIPAL */}
      <div className="flex flex-col items-center justify-center pt-2 pb-4">
        <Button
          type="button"
          size="lg"
          onClick={handleGenerateBudget}
          disabled={isGenerating}
          className="w-full max-w-md h-14 bg-slate-700 hover:bg-slate-800 active:scale-[0.98] text-white font-bold text-base rounded-2xl shadow-lg shadow-slate-700/25 transition-all flex items-center justify-center gap-2.5 group"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Processando Parâmetros e Peças...</span>
            </>
          ) : (
            <>
              <span className="text-xl group-hover:rotate-45 transition-transform duration-300">
                ⚙️
              </span>
              <span>Gerar Orçamento do Módulo</span>
            </>
          )}
        </Button>
        <p className="text-xs text-slate-400 mt-2 text-center">
          Calcula automaticamente caixaria, frentes, puxadores e margem comercial
        </p>
      </div>
      {/* 5. RESULTADOS: TABELA DE PRECIFICAÇÃO DINÂMICA */}
      {shouldShowResultsSection && (
        <section
          ref={resultsRef}
          aria-labelledby="resultados-heading"
          className="space-y-4 pt-4 animate-slide-up"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-slate-700 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                3
              </div>
              <h3 id="resultados-heading" className="text-lg sm:text-xl font-bold text-slate-900">
                Peças e Precificação do Módulo
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              Módulo:{' '}
              <strong className="text-slate-800">
                {hasCurrentModuleEditing
                  ? currentModuleName
                  : itensConsolidadosResumo.length > 0
                    ? `${ambientesConsolidados.reduce((acc, a) => acc + (a.modulos?.length || 0), 0)} módulo(s) consolidado(s)`
                    : currentModuleName}
              </strong>{' '}
              ({room || ambienteSelecionado || 'Ambiente'})
            </span>
          </div>

          {effectiveDisplayItems.length > 0 ? (
            <PricingTable
              items={effectiveDisplayItems}
              dimensoes={dimensoes}
              moduleName={hasCurrentModuleEditing ? currentModuleName : 'Módulos Consolidados'}
            />
          ) : dimensoesValidas ? (
            <PricingTable
              items={pricingItems}
              dimensoes={dimensoes}
              moduleName={currentModuleName}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <HelpCircle className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                Selecione um módulo e preencha as dimensões para gerar a precificação.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                A tabela de peças é calculada em tempo real a partir das medidas e materiais
                informados acima.
              </p>
            </div>
          )}

          {/* ⚠️ ALERTA AMARELO: ITENS NÃO CADASTRADOS NO CATÁLOGO (ADICIONADOS POR ESTIMATIVA) */}
          {itensNaoCadastrados.length > 0 && (
            <div className="space-y-2 pt-1 animate-fade-in">
              {itensNaoCadastrados.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="flex items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border text-xs leading-relaxed"
                  style={{
                    backgroundColor: '#FEF3C7',
                    borderColor: '#F59E0B',
                    color: '#92400E',
                  }}
                >
                  <div className="flex items-start sm:items-center gap-2.5">
                    <span className="text-base leading-none shrink-0 mt-0.5 sm:mt-0">⚠️</span>
                    <div>
                      <span className="font-bold">
                        Item &quot;{item.description}&quot; adicionado por estimativa
                      </span>
                      <span className="text-[11px] opacity-90 block sm:inline sm:ml-1">
                        (Custo estimado: {formatCurrency(item.unitCost)}). Cadastre este item no
                        Catálogo de Materiais para precisão de custo.
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/catalogo')}
                    className="shrink-0 h-7 text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 border-amber-400 text-amber-900 rounded-lg px-2.5 shadow-2xs"
                  >
                    Ir ao Catálogo
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* 🌟 BOTÕES DE ADIÇÃO MANUAL DE ITENS */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCatalogModalOpen(true)}
              className="flex-1 h-11 border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-800 font-semibold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2"
            >
              <Package className="w-4 h-4 text-slate-700" />+ Adicionar do Catálogo
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCustomItemModalOpen(true)}
              className="flex-1 h-11 border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-800 font-semibold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4 text-slate-700" />+ Item Avulso (Fora do Catálogo)
            </Button>
          </div>

          {/* Rodapé de Totais Consolidados — exibido quando há itens na tabela */}
          {(dimensoesValidas || effectiveDisplayItems.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
                      Custo Consolidado
                    </p>
                    <p className="text-[11px] text-amber-700/70">
                      {hasCurrentModuleEditing
                        ? 'Soma de todos os custos do módulo'
                        : 'Soma de todos os custos dos módulos consolidados'}
                    </p>
                  </div>
                </div>
                <p className="text-xl font-extrabold text-amber-800 font-mono">
                  {formatCurrency(
                    hasCurrentModuleEditing ? totalCusto : custoConsolidado(effectiveDisplayItems),
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-300 bg-gradient-to-br from-slate-100 to-white p-5 shadow-sm flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-700 text-white flex items-center justify-center shadow-md shadow-slate-700/20">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-900 uppercase tracking-wider">
                      Valor Consolidado
                    </p>
                    <p className="text-[11px] text-slate-800/70">
                      {hasCurrentModuleEditing
                        ? 'Soma de todos os valores de venda do módulo'
                        : 'Soma de todos os valores dos módulos consolidados'}
                    </p>
                  </div>
                </div>
                <p className="text-xl font-extrabold text-slate-800 font-mono">
                  {formatCurrency(
                    hasCurrentModuleEditing ? totalVenda : valorConsolidado(effectiveDisplayItems),
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Card: Termos Comerciais */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2 pb-2">
              <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-800 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-bold text-slate-900">Termos Comerciais</h4>
                <p className="text-xs text-slate-500">
                  Condições de pagamento e observações contratuais para a proposta
                </p>
              </div>
            </div>

            {/* Campo 1: Forma de Pagamento */}
            <div className="space-y-2">
              <Label
                htmlFor="forma-pagamento"
                className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
              >
                <CreditCard className="w-3.5 h-3.5 text-slate-700" />
                Forma de Pagamento
              </Label>
              <Input
                id="forma-pagamento"
                placeholder="Ex.: 30% de entrada + 4x no cartão"
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
                className="h-11 rounded-xl text-sm border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20"
              />
            </div>

            <Separator className="bg-slate-100" />

            {/* Campo 2: Observações / Termos */}
            <div className="space-y-2">
              <Label
                htmlFor="observacoes-termos"
                className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
              >
                <FileText className="w-3.5 h-3.5 text-slate-700" />
                Observações / Termos
              </Label>
              <Textarea
                id="observacoes-termos"
                placeholder="Ex.: Prazo de entrega: 30 dias. Frete incluso para Grande São Paulo. Garantia de 5 anos."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
                className="rounded-xl text-sm border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20 resize-y min-h-[90px]"
              />
            </div>
          </div>
        </section>
      )}
      {/* 6. RODAPÉ DE AÇÕES FIXO (Sticky Bottom Bar) */}
      <aside
        aria-label="Ações do Orçamento"
        className="sticky bottom-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-xl"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Secondary Action Buttons (Left) */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto text-xs font-semibold border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl h-10 shadow-2xs inline-flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4 text-slate-500" />+ Adicionar Item Manualmente
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="top"
                className="w-56 p-1.5 rounded-xl shadow-lg border-slate-200"
              >
                <DropdownMenuItem
                  onClick={() => setIsCatalogModalOpen(true)}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer rounded-lg"
                >
                  <Package className="w-4 h-4 text-slate-600" />
                  <span>📄 Do Catálogo</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsCustomItemModalOpen(true)}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer rounded-lg"
                >
                  <Plus className="w-4 h-4 text-slate-600" />
                  <span>✏️ Item Avulso</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              type="button"
              variant="outline"
              onClick={handleAddAnotherModule}
              className="w-full sm:w-auto text-xs font-semibold border-slate-400 bg-slate-100 text-slate-800 hover:bg-slate-200 rounded-xl h-10 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5 text-slate-700" />+ Adicionar Outro Módulo ao
              Ambiente
            </Button>
          </div>

          {/* Primary Action Button (Right) & Total */}
          <div className="w-full sm:w-auto flex items-center justify-end gap-3">
            <div className="hidden md:block text-right">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                Total Geral ({ambientesConsolidados.length} amb)
              </span>
              <span className="text-base font-bold font-mono text-slate-900">
                {formatCurrency(valorTotalGeral)}
              </span>
            </div>

            <Button
              type="button"
              onClick={handleFinalizeClick}
              className="w-full sm:w-auto h-11 px-6 bg-slate-700 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-md shadow-slate-700/25 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Finalizar Orçamento ({formatCurrency(valorTotalGeral)})
            </Button>
          </div>
        </div>
      </aside>
      {/* Modais de Adição de Itens */}
      <AddFromCatalogModal
        isOpen={isCatalogModalOpen}
        onClose={() => setIsCatalogModalOpen(false)}
        catalogoMateriais={catalogoMateriais}
        markupEngenharia={markupEngenharia}
        onAddItem={(item) => {
          setManualItems((prev) => [...prev, item])
          toast({
            title: 'Item adicionado',
            description: `${item.description} foi incluído no orçamento.`,
          })
        }}
      />

      <AddCustomItemModal
        isOpen={isCustomItemModalOpen}
        onClose={() => setIsCustomItemModalOpen(false)}
        markupEngenharia={markupEngenharia}
        onAddItem={(item) => {
          setManualItems((prev) => [...prev, item])
          toast({
            title: 'Item avulso adicionado',
            description: `${item.description} foi incluído no orçamento.`,
          })
        }}
      />

      {/* Finalize Confirmation Modal */}
      <FinalizeQuoteModal
        isOpen={isFinalizeModalOpen}
        onClose={() => {
          setIsFinalizeModalOpen(false)
          if (isQuoteSaved) {
            navigate('/orcamentos')
          }
        }}
        onConfirm={handleConfirmFinalize}
        onDownloadProposta={handleDownloadProposta}
        onDownloadAnaliseCusto={handleDownloadAnaliseCusto}
        clientName={clientName}
        room={
          ambientesConsolidados.length > 1
            ? `${ambientesConsolidados.length} ambientes (${ambientesConsolidados.map((a) => a.nome).join(', ')})`
            : ambienteSelecionado || room
        }
        moduleName={
          ambientesConsolidados.reduce((acc, a) => acc + (a.modulos?.length || 0), 0) > 1
            ? `${ambientesConsolidados.reduce((acc, a) => acc + (a.modulos?.length || 0), 0)} módulos`
            : currentModuleName
        }
        items={pricingItems}
        isSaved={isQuoteSaved}
        isSaving={isSavingQuote}
        ambientesCount={ambientesConsolidados.length}
        modulosCount={ambientesConsolidados.reduce((acc, a) => acc + (a.modulos?.length || 0), 0)}
      />
    </div>
  )
}
