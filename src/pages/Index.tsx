import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  User,
  Home,
  Box,
  Layers,
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { LIBRARY_MODULES, BudgetItem } from '@/data/mockData'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export default function Index() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Form Identification Header state
  const [clientName, setClientName] = useState('')
  const [room, setRoom] = useState('')
  const [selectedModule, setSelectedModule] = useState<string>('')

  // Upload state
  const [uploadedFile, setUploadedFile] = useState<UploadedFileState | null>(null)

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
  // Pre-load default 2 mock rows as requested by user specification
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

  // Section references for scrolling
  const topRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Query parameter pre-fill support (e.g. ?modulo=roupeiro-2-portas)
  useEffect(() => {
    const modParam = searchParams.get('modulo')
    if (modParam && LIBRARY_MODULES[modParam]) {
      setSelectedModule(modParam)
      if (modParam === 'roupeiro-2-portas') setRoom('Quarto')
      if (modParam === 'balcao') setRoom('Cozinha')
      if (modParam === 'aereo') setRoom('Cozinha')
    }
  }, [searchParams])

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
    setSelectedModule(val)
    if (errors.selectedModule) {
      setErrors((prev) => ({ ...prev, selectedModule: undefined }))
    }

    // Auto update room if empty based on module default
    if (!room) {
      if (val === 'roupeiro-2-portas') setRoom('Quarto')
      if (val === 'balcao') setRoom('Cozinha')
      if (val === 'aereo') setRoom('Cozinha')
    }

    // If results are already showing, reload parts for selected module
    if (showResults && LIBRARY_MODULES[val]) {
      const parts = LIBRARY_MODULES[val].defaultParts.map((p, idx) => {
        const totalCost = p.unitCost * p.quantity
        const salePrice = totalCost * (1 + p.markup / 100)
        return {
          id: `part-${Date.now()}-${idx}`,
          description: p.description,
          unitCost: p.unitCost,
          totalCost: totalCost,
          markup: p.markup,
          salePrice: Number(salePrice.toFixed(2)),
        }
      })
      setPricingItems(parts)
    }
  }

  const handleFileSelect = (file: UploadedFileState | null) => {
    setUploadedFile(file)
    if (errors.uploadedFile) {
      setErrors((prev) => ({ ...prev, uploadedFile: undefined }))
    }
  }

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

    if (!selectedModule) {
      newErrors.selectedModule = 'Selecione um módulo da biblioteca'
    }

    if (!uploadedFile) {
      newErrors.uploadedFile = 'Envie a foto ou projeto do cliente para comparação'
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

      // If user selected a specific module, update the table parts or keep mock
      if (selectedModule && LIBRARY_MODULES[selectedModule]) {
        const parts = LIBRARY_MODULES[selectedModule].defaultParts.map((p, idx) => {
          const totalCost = p.unitCost * p.quantity
          const salePrice = totalCost * (1 + p.markup / 100)
          return {
            id: `part-${Date.now()}-${idx}`,
            description: p.description,
            unitCost: p.unitCost,
            totalCost: totalCost,
            markup: p.markup,
            salePrice: Number(salePrice.toFixed(2)),
          }
        })
        setPricingItems(parts)
      }

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
    setSelectedModule('')
    setUploadedFile(null)
    setErrors({})
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    toast({
      title: 'Pronto para novo módulo',
      description: 'Selecione o próximo módulo e faça o upload do croqui.',
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

  const currentModuleName =
    LIBRARY_MODULES[selectedModule]?.name || (selectedModule ? selectedModule : 'Módulo Padrão')

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
                  <SelectItem value="Cozinha">Cozinha</SelectItem>
                  <SelectItem value="Quarto">Quarto</SelectItem>
                  <SelectItem value="Sala">Sala de Estar / Jantar</SelectItem>
                  <SelectItem value="Banheiro">Banheiro</SelectItem>
                  <SelectItem value="Home Office">Home Office</SelectItem>
                  <SelectItem value="Lavanderia">Lavanderia</SelectItem>
                </SelectContent>
              </Select>
              {errors.room && (
                <p className="text-[11px] font-medium text-rose-600 flex items-center gap-1 pt-0.5 animate-fade-in">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.room}
                </p>
              )}
            </div>

            {/* Select: Módulo */}
            <div className="space-y-1.5">
              <label
                htmlFor="moduleSelect"
                className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
              >
                <Box className="w-3.5 h-3.5 text-emerald-600" />
                Módulo da Biblioteca <span className="text-rose-500">*</span>
              </label>
              <Select value={selectedModule} onValueChange={handleModuleChange}>
                <SelectTrigger
                  id="moduleSelect"
                  className={cn(
                    'h-11 rounded-xl text-sm transition-all',
                    errors.selectedModule
                      ? 'border-rose-500 ring-2 ring-rose-200 bg-rose-50/20'
                      : 'border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20',
                  )}
                >
                  <SelectValue placeholder="Selecione o módulo" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="roupeiro-2-portas">
                    Roupeiro 2 Portas (Linha Clássica)
                  </SelectItem>
                  <SelectItem value="balcao">Balcão de Cozinha 2 Portas e Gavetas</SelectItem>
                  <SelectItem value="aereo">Armário Aéreo Basculante 1 Porta</SelectItem>
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
                uploadedFile={uploadedFile}
                onFileSelect={handleFileSelect}
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
              selectedModuleId={selectedModule}
              onOpenLibraryModal={() => navigate('/biblioteca')}
            />
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
