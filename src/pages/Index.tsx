import React, { useState, useEffect, useRef } from 'react'
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
  FileCheck2,
  HelpCircle,
  FileSpreadsheet,
  Ruler,
  ArrowUpDown,
  Star,
  Layers3,
  Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CustomerDropzone, UploadedFileState } from '@/components/CustomerDropzone'
import { LibraryMatchCard } from '@/components/LibraryMatchCard'
import { PricingTable } from '@/components/PricingTable'
import { FinalizeQuoteModal } from '@/components/FinalizeQuoteModal'
import { BudgetItem } from '@/data/mockData'
import { fetchTemplatesEngenharia, TemplateEngenharia } from '@/services/templates'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

// Ambientes permitidos no Select (array estático conforme especificação).
const AMBIENTES = ['Cozinha', 'Quarto', 'Sala', 'Banheiro']

// Opções de cor/padrão de MDF (lista de referência — catálogo comercial).
const MDF_EXTERNO_CORES = ['Branco TX', 'Louro Freijó', 'Grafito', 'Carvalho']
const MDF_INTERNO_CORES = ['Branco TX', 'Gianduia']
const MDF_FUNDO_OPCOES = ['MDF 6mm Branco TX', 'MDF 3mm Branco']

export default function Index() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Form Identification Header state
  const [clientName, setClientName] = useState('')
  const [room, setRoom] = useState('')
  const [selectedModuleId, setSelectedModuleId] = useState<string>('')

  // Módulos disponíveis — fetch 100% dinâmico do Supabase (tabela TemplatesEngenharia)
  const [modulosDisponiveis, setModulosDisponiveis] = useState<TemplateEngenharia[]>([])
  const [loadingModulos, setLoadingModulos] = useState<boolean>(true)

  // Upload state — agora suporta MÚLTIPLAS imagens (array de perspectivas)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileState[]>([])

  // Estado de análise automática da "Lupa Lu" (simulação da chamada OpenAI)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const analyzeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Pricing Table Items state
  // Pre-load default 2 mock rows as requested by user specification (mantida estática).
  const [pricingItems, setPricingItems] = useState<BudgetItem[]>([
    {
      id: 'item-1',
      description: 'Lateral MDP 18mm 2750x600mm',
      unitCost: 120.0,
      totalCost: 240.0,
      markup: 150,
      salePrice: 600.0,
    },
    {
      id: 'item-2',
      description: 'Porta MDF 18mm 2000x500mm (2 un.)',
      unitCost: 95.0,
      totalCost: 190.0,
      markup: 150,
      salePrice: 475.0,
    },
  ])

  // Modal confirmation state
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false)

  // 📐 DIMENSÕES REAIS DO MÓDULO (inputs manuais — defaults paramétricos).
  const [dimensoes, setDimensoes] = useState({
    largura: 1800,
    altura: 2200,
    profundidade: 600,
  })

  // 🎨 ESPECIFICAÇÃO DE MATERIAIS (acabamento do módulo).
  const [padraoProjeto, setPadraoProjeto] = useState<'comercial' | 'premium'>('comercial')
  const [mdfExterno, setMdfExterno] = useState<{ cor: string; espessura: 15 | 18 }>({
    cor: 'Branco TX',
    espessura: 18,
  })
  const [mdfInterno, setMdfInterno] = useState<{ cor: string; espessura: 15 | 18 }>({
    cor: 'Branco TX',
    espessura: 15,
  })
  const [mdfFundo, setMdfFundo] = useState<string>('MDF 6mm Branco TX')

  // Section references for scrolling
  const topRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // FETCH REAL DO SUPABASE — carrega os módulos da tabela TemplatesEngenharia.
  useEffect(() => {
    let active = true
    setLoadingModulos(true)

    fetchTemplatesEngenharia()
      .then((modulos) => {
        if (!active) return
        setModulosDisponiveis(modulos)

        // Suporte a pré-preenchimento via query param ?modulo=<id>
        const modParam = searchParams.get('modulo')
        if (modParam) {
          const encontrado = modulos.find((m) => m.id === modParam)
          if (encontrado) {
            setSelectedModuleId(encontrado.id)
          }
        }
      })
      .catch((err) => {
        // Erro de fetch já é logado via console.error no serviço.
        console.error('Falha ao carregar módulos disponíveis:', err)
      })
      .finally(() => {
        if (active) setLoadingModulos(false)
      })

    return () => {
      active = false
    }
  }, [searchParams])

  // Objeto do módulo selecionado (id + nome_template) derivado do estado dinâmico.
  const selectedModuleObj: TemplateEngenharia | null =
    modulosDisponiveis.find((m) => m.id === selectedModuleId) ?? null

  // Clear errors when fields update
  const handleClientNameChange = (val: string) => {
    setClientName(val)
    if (errors.clientName) {
      setErrors((prev) => ({ ...prev, clientName: undefined }))
    }
  }

  const handleRoomChange = (val: string) => {
    setRoom(val)
    if (errors.room) {
      setErrors((prev) => ({ ...prev, room: undefined }))
    }
  }

  const handleModuleChange = (val: string) => {
    setSelectedModuleId(val)
    if (errors.selectedModule) {
      setErrors((prev) => ({ ...prev, selectedModule: undefined }))
    }

    // Auto-preenche o ambiente quando vazio, com base na categoria do módulo.
    const modulo = modulosDisponiveis.find((m) => m.id === val)
    if (!room && modulo?.categoria) {
      const cat = modulo.categoria.toLowerCase()
      if (cat.includes('quarto')) setRoom('Quarto')
      else if (cat.includes('cozinha')) setRoom('Cozinha')
      else if (cat.includes('sala')) setRoom('Sala')
      else if (cat.includes('banheiro')) setRoom('Banheiro')
    }
  }

  const handleFilesSelect = (files: UploadedFileState[] | null) => {
    setUploadedFiles(files ?? [])

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

    // 🔄 FLUXO DE MATCH AUTOMÁTICO (simulação da IA "Lupa Lu"):
    // Dispara análise imediatamente após o upload concluir.
    setIsAnalyzing(true)

    // Limpa qualquer seleção manual anterior para o match automático tomar a frente.
    // (A seleção manual é o "Plano B" — Select rebaixado no cabeçalho.)
    // Não limamos aqui para preservar ajuste manual; o match só sobrescreve se vazio.
    if (!selectedModuleId) {
      // mantém selecionado se o usuário já ajustou manualmente
    }

    analyzeTimeoutRef.current = setTimeout(() => {
      // Pega o primeiro módulo disponível no estado vindo do Supabase.
      setModulosDisponiveis((currentModulos) => {
        if (currentModulos.length > 0) {
          // Só sobrescreve se não houver seleção manual prévia.
          setSelectedModuleId((prevSel) => prevSel || currentModulos[0].id)
        }
        return currentModulos
      })

      setIsAnalyzing(false)
      analyzeTimeoutRef.current = null

      toast({
        title: '✓ Match Automático Concluído!',
        description:
          'A Lupa Lu identificou o gabarito do módulo na biblioteca. Ajuste manual disponível no cabeçalho caso necessário.',
      })
    }, 3000)
  }

  // Limpa o timeout pendente ao desmontar
  useEffect(() => {
    return () => {
      if (analyzeTimeoutRef.current) clearTimeout(analyzeTimeoutRef.current)
    }
  }, [])

  // Action: "⚙️ Gerar Orçamento do Módulo"
  const handleGenerateBudget = () => {
    const newErrors: {
      clientName?: string
      room?: string
      selectedModule?: string
      uploadedFile?: string
    } = {}

    if (!clientName.trim()) {
      newErrors.clientName = 'Informe o nome do cliente'
    }

    if (!room) {
      newErrors.room = 'Selecione o ambiente do projeto'
    }

    if (!selectedModuleId) {
      newErrors.selectedModule = 'Selecione um módulo da biblioteca'
    }

    if (uploadedFiles.length === 0) {
      newErrors.uploadedFile = 'Envie ao menos uma foto ou projeto do cliente para comparação'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast({
        title: 'Campos Obrigatórios Pendentes',
        description:
          'Preencha o nome do cliente, anexe o arquivo e selecione o módulo correspondente.',
        variant: 'destructive',
      })
      return
    }

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

  // Update a single item in pricing table
  const handleUpdateItem = (index: number, updated: BudgetItem) => {
    setPricingItems((prev) => {
      const clone = [...prev]
      clone[index] = updated
      return clone
    })
    toast({
      title: 'Item Atualizado',
      description: 'Cálculos de markup e preço de venda recalculados.',
    })
  }

  // Delete item from pricing table
  const handleDeleteItem = (index: number) => {
    setPricingItems((prev) => prev.filter((_, idx) => idx !== index))
    toast({
      title: 'Item Removido',
      description: 'A peça foi retirada do orçamento.',
    })
  }

  // Action: "+ Adicionar Item Manualmente"
  const handleAddNewManualItem = () => {
    if (!showResults) {
      setShowResults(true)
    }

    const newItem: BudgetItem = {
      id: `manual-${Date.now()}`,
      description: 'Nova Peça em MDF 18mm',
      unitCost: 80.0,
      totalCost: 160.0,
      markup: 150,
      salePrice: 400.0,
      isEditing: true,
    }

    setPricingItems((prev) => [...prev, newItem])

    // Scroll to results if needed
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, 100)
  }

  // Action: "+ Adicionar Outro Módulo"
  const handleAddAnotherModule = () => {
    setSelectedModuleId('')
    setUploadedFiles([])
    setIsAnalyzing(false)
    if (analyzeTimeoutRef.current) {
      clearTimeout(analyzeTimeoutRef.current)
      analyzeTimeoutRef.current = null
    }
    setErrors({})
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    toast({
      title: 'Pronto para novo módulo',
      description: 'Faça o upload das fotos e a Lupa Lu identificará o módulo automaticamente.',
    })
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

    setIsFinalizeModalOpen(true)
  }

  const handleConfirmFinalize = () => {
    setIsFinalizeModalOpen(false)
    toast({
      title: '✓ Orçamento Finalizado com Sucesso!',
      description: `Orçamento de ${clientName} pronto para envio comercial.`,
    })
    navigate('/orcamentos')
  }

  const currentModuleName = selectedModuleObj?.nome_template || 'Módulo Padrão'

  return (
    <div ref={topRef} className="space-y-8 pb-20">
      {/* 1. Header Hero Title */}
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold mb-1">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>Comparador Visual Paramétrico</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Novo Orçamento de Marcenaria
        </h2>
        <p className="text-sm sm:text-base text-slate-500 max-w-3xl leading-relaxed">
          Compare o projeto do cliente com o módulo da biblioteca e gere a precificação automática
          com lista de peças e markup comercial.
        </p>
      </div>

      {/* 2. CABEÇALHO DE IDENTIFICAÇÃO */}
      <section aria-labelledby="identificacao-heading">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2 pb-4 mb-5 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
              1
            </div>
            <h3
              id="identificacao-heading"
              className="text-sm sm:text-base font-bold text-slate-900"
            >
              Identificação do Orçamento
            </h3>
            <span className="text-xs text-slate-400 font-normal">
              • Dados básicos do cliente e ambiente
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Input: Nome do Cliente */}
            <div className="space-y-1.5">
              <label
                htmlFor="clientName"
                className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
              >
                <User className="w-3.5 h-3.5 text-emerald-600" />
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
                      : 'border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20',
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

            {/* Select: Ambiente */}
            <div className="space-y-1.5">
              <label
                htmlFor="roomSelect"
                className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
              >
                <Home className="w-3.5 h-3.5 text-emerald-600" />
                Ambiente <span className="text-rose-500">*</span>
              </label>
              <Select value={room} onValueChange={handleRoomChange}>
                <SelectTrigger
                  id="roomSelect"
                  className={cn(
                    'h-11 rounded-xl text-sm transition-all',
                    errors.room
                      ? 'border-rose-500 ring-2 ring-rose-200 bg-rose-50/20'
                      : 'border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20',
                  )}
                >
                  <SelectValue placeholder="Selecione o ambiente" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {AMBIENTES.map((amb) => (
                    <SelectItem key={amb} value={amb}>
                      {amb}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <Box className="w-3.5 h-3.5 text-emerald-600" />
                Módulo Identificado (Ajuste Manual) <span className="text-rose-500">*</span>
              </label>
              <Select value={selectedModuleId} onValueChange={handleModuleChange}>
                <SelectTrigger
                  id="moduleSelect"
                  className={cn(
                    'h-11 rounded-xl text-sm transition-all',
                    errors.selectedModule
                      ? 'border-rose-500 ring-2 ring-rose-200 bg-rose-50/20'
                      : 'border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20',
                  )}
                >
                  <SelectValue
                    placeholder={loadingModulos ? 'Carregando módulos...' : 'Selecione o módulo'}
                  />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
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
        </div>
      </section>

      {/* 3. ÁREA CENTRAL: O MATCH LADO A LADO (Grid de 2 colunas) */}
      <section aria-labelledby="match-heading" className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
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
                  <User className="w-4 h-4 text-emerald-600" />
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
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg ring-4 ring-white">
              <ArrowDown className="w-5 h-5 animate-bounce" />
            </div>
          </div>

          {/* Right Column: Match da Biblioteca */}
          <div className="flex flex-col h-full">
            <LibraryMatchCard
              selectedModule={selectedModuleObj}
              isAnalyzing={isAnalyzing}
              onOpenLibraryModal={() => navigate('/biblioteca')}
              modulosDisponiveis={modulosDisponiveis}
              selectedModuleId={selectedModuleId}
              onModuleChange={(id) => {
                // Troca manual de gabarito: atualiza o card e reseta o estado de análise.
                handleModuleChange(id)
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
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
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
                <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
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
                  className="h-11 rounded-xl text-sm font-mono font-semibold border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 pr-12"
                />
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
                <ArrowUpDown className="w-3.5 h-3.5 text-emerald-600" />
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
                  className="h-11 rounded-xl text-sm font-mono font-semibold border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 pr-12"
                />
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
                <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
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
                  className="h-11 rounded-xl text-sm font-mono font-semibold border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 pr-12"
                />
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
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
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
                      ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white',
                  )}
                >
                  <Star
                    className={cn(
                      'w-5 h-5 mt-0.5 shrink-0',
                      padraoProjeto === 'comercial'
                        ? 'text-emerald-600 fill-emerald-500'
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
                      ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white',
                  )}
                >
                  <div className="flex mt-0.5 shrink-0">
                    <Star
                      className={cn(
                        'w-5 h-5',
                        padraoProjeto === 'premium'
                          ? 'text-emerald-600 fill-emerald-500'
                          : 'text-slate-300',
                      )}
                    />
                    <Star
                      className={cn(
                        'w-5 h-5 -ml-1',
                        padraoProjeto === 'premium'
                          ? 'text-emerald-600 fill-emerald-500'
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
                <Box className="w-4 h-4 text-emerald-600" />
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  MDF Externo
                </Label>
                <span className="text-[11px] text-slate-400 font-normal">
                  Frentes / caixaria vista
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Cor / Padrão</span>
                  <Select
                    value={mdfExterno.cor}
                    onValueChange={(v) => setMdfExterno((prev) => ({ ...prev, cor: v }))}
                  >
                    <SelectTrigger className="h-10 rounded-lg text-sm bg-white border-slate-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {MDF_EXTERNO_CORES.map((cor) => (
                        <SelectItem key={cor} value={cor}>
                          {cor}
                        </SelectItem>
                      ))}
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
                      className="flex-1 h-8 text-xs font-semibold data-[state=on]:bg-emerald-600 data-[state=on]:text-white rounded-md"
                    >
                      15 mm
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="18"
                      className="flex-1 h-8 text-xs font-semibold data-[state=on]:bg-emerald-600 data-[state=on]:text-white rounded-md"
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
                <Layers3 className="w-4 h-4 text-emerald-600" />
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  MDF Interno
                </Label>
                <span className="text-[11px] text-slate-400 font-normal">
                  Prateleiras / divisórias / gavetas
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Cor / Padrão</span>
                  <Select
                    value={mdfInterno.cor}
                    onValueChange={(v) => setMdfInterno((prev) => ({ ...prev, cor: v }))}
                  >
                    <SelectTrigger className="h-10 rounded-lg text-sm bg-white border-slate-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {MDF_INTERNO_CORES.map((cor) => (
                        <SelectItem key={cor} value={cor}>
                          {cor}
                        </SelectItem>
                      ))}
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
                      className="flex-1 h-8 text-xs font-semibold data-[state=on]:bg-emerald-600 data-[state=on]:text-white rounded-md"
                    >
                      15 mm
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="18"
                      className="flex-1 h-8 text-xs font-semibold data-[state=on]:bg-emerald-600 data-[state=on]:text-white rounded-md"
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
                <Package className="w-4 h-4 text-emerald-600" />
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
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {MDF_FUNDO_OPCOES.map((op) => (
                      <SelectItem key={op} value={op}>
                        {op}
                      </SelectItem>
                    ))}
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
          className="w-full max-w-md h-14 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-base rounded-2xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2.5 group"
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

      {/* 5. RESULTADOS: TABELA DE PRECIFICAÇÃO */}
      {showResults && (
        <section
          ref={resultsRef}
          aria-labelledby="resultados-heading"
          className="space-y-4 pt-4 animate-slide-up"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                3
              </div>
              <h3 id="resultados-heading" className="text-lg sm:text-xl font-bold text-slate-900">
                Peças e Precificação do Módulo
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              Módulo: <strong className="text-slate-800">{currentModuleName}</strong> ({room})
            </span>
          </div>

          {/* Pricing Table Component */}
          <PricingTable
            items={pricingItems}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
            onAddNewManualItem={handleAddNewManualItem}
          />
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
            <Button
              type="button"
              variant="outline"
              onClick={handleAddNewManualItem}
              className="w-full sm:w-auto text-xs font-semibold border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl h-10 shadow-2xs"
            >
              <Plus className="w-4 h-4 mr-1.5 text-slate-500" />+ Adicionar Item Manualmente
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleAddAnotherModule}
              className="w-full sm:w-auto text-xs font-semibold border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl h-10 shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-slate-500" />+ Adicionar Outro Módulo
            </Button>
          </div>

          {/* Primary Action Button (Right) */}
          <div className="w-full sm:w-auto">
            <Button
              type="button"
              onClick={handleFinalizeClick}
              className="w-full sm:w-auto h-11 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-600/25 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Finalizar Orçamento
            </Button>
          </div>
        </div>
      </aside>

      {/* Finalize Confirmation Modal */}
      <FinalizeQuoteModal
        isOpen={isFinalizeModalOpen}
        onClose={() => setIsFinalizeModalOpen(false)}
        onConfirm={handleConfirmFinalize}
        clientName={clientName}
        room={room}
        moduleName={currentModuleName}
        items={pricingItems}
      />
    </div>
  )
}
