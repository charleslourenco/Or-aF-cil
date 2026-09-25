import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  FileDown,
  User,
  Calendar,
  FolderPlus,
  Layers,
  Plus,
  Pencil,
  Check,
  X,
  Trash2,
  ChevronDown,
  Box,
  ChevronRight,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

// Estrutura comercial estrita de módulo: NUNCA expor ferragens, parafusos, chapas ou fitas
export interface ModuloComercialV2 {
  id: string
  modulo: string
  descricaoTipo: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
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

  // Estado local para Dados do Cliente (sem persistência em banco nesta etapa)
  const [nomeCliente, setNomeCliente] = useState('')
  const [dataOrcamento, setDataOrcamento] = useState(() => {
    // Data atual no formato YYYY-MM-DD
    const today = new Date()
    return today.toISOString().split('T')[0]
  })

  // Estado dos ambientes do projeto
  const [ambientes, setAmbientes] = useState<AmbienteV2[]>([])
  // IDs dos ambientes abertos no accordion
  const [expandedAmbientes, setExpandedAmbientes] = useState<string[]>([])

  // Estado para renomear ambiente inline
  const [editingAmbienteId, setEditingAmbienteId] = useState<string | null>(null)
  const [editingAmbienteNome, setEditingAmbienteNome] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Estado para modal de inclusão com nome livre
  const [isCustomDialogOpen, setIsCustomDialogOpen] = useState(false)
  const [customAmbienteNome, setCustomAmbienteNome] = useState('')

  // Subtotal por ambiente e Valor Total Geral do projeto
  const subtotalPorAmbiente = useMemo(() => {
    const map = new Map<string, number>()
    for (const amb of ambientes) {
      const total = amb.modulos.reduce((acc, m) => acc + (Number(m.valorTotal) || 0), 0)
      map.set(amb.id, total)
    }
    return map
  }, [ambientes])

  const valorTotalGeral = useMemo(() => {
    let total = 0
    for (const sub of subtotalPorAmbiente.values()) {
      total += sub
    }
    return total
  }, [subtotalPorAmbiente])

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
    // Abre o novo ambiente automaticamente no accordion
    setExpandedAmbientes((prev) => [...prev, novoId])

    toast({
      title: 'Ambiente adicionado',
      description: `O ambiente "${nomeLimpo}" foi criado com sucesso.`,
    })
  }

  const handleConfirmCustomAmbiente = () => {
    const nome = customAmbienteNome.trim()
    if (!nome) return
    handleAddAmbiente(nome)
    setCustomAmbienteNome('')
    setIsCustomDialogOpen(false)
  }

  // Exclusão de ambiente
  const handleRemoveAmbiente = (ambienteId: string) => {
    const alvo = ambientes.find((a) => a.id === ambienteId)
    setAmbientes((prev) => prev.filter((a) => a.id !== ambienteId))
    setExpandedAmbientes((prev) => prev.filter((id) => id !== ambienteId))
    if (editingAmbienteId === ambienteId) {
      setEditingAmbienteId(null)
    }
    toast({
      title: 'Ambiente removido',
      description: `O ambiente "${alvo?.nome || ''}" foi removido do orçamento.`,
    })
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

  // Clique em "+ Adicionar Módulo neste Ambiente"
  const handleAddModuloClick = (ambienteNome: string) => {
    toast({
      title: '+ Adicionar Módulo',
      description: `A inclusão e parametrização de módulos em "${ambienteNome}" entrará na próxima etapa.`,
    })
  }

  return (
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
          <Button
            type="button"
            variant="outline"
            onClick={handleExportarPdf}
            className="h-9 px-4 gap-2 text-xs font-semibold border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl shadow-xs"
          >
            <FileDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>Exportar PDF</span>
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

          {/* Botão no topo do container: '+ Adicionar Novo Ambiente' com dropdown de pré-definidos */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                className="h-10 px-4 gap-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>+ Adicionar Novo Ambiente</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-70 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 rounded-xl border-slate-200 dark:border-slate-800 p-1.5 shadow-xl bg-white dark:bg-slate-950"
            >
              <DropdownMenuLabel className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-2 py-1.5">
                Opções Pré-definidas
              </DropdownMenuLabel>
              {OPCOES_PREDEFINIDAS_AMBIENTES.map((opcao) => (
                <DropdownMenuItem
                  key={opcao}
                  onClick={() => handleAddAmbiente(opcao)}
                  className="rounded-lg text-xs font-medium cursor-pointer py-2 px-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-2 shrink-0" />
                  <span>{opcao}</span>
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator className="my-1 border-slate-100 dark:border-slate-800" />

              <DropdownMenuItem
                onClick={() => {
                  setCustomAmbienteNome('')
                  setIsCustomDialogOpen(true)
                }}
                className="rounded-lg text-xs font-semibold cursor-pointer py-2 px-2.5 text-slate-900 dark:text-slate-100 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <Plus className="w-3.5 h-3.5 mr-2 text-slate-600 dark:text-slate-300" />
                <span>Outro nome personalizado…</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                Clique no botão acima para adicionar o primeiro ambiente do projeto (ex.: Cozinha,
                Quarto 01, Banheiro).
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 h-9 px-4 gap-2 text-xs font-semibold rounded-xl border-dashed border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 shadow-xs"
                >
                  <FolderPlus className="w-4 h-4 text-slate-500" />
                  <span>Escolher Ambiente</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="center"
                className="w-56 rounded-xl border-slate-200 dark:border-slate-800 p-1.5 shadow-xl bg-white dark:bg-slate-950"
              >
                <DropdownMenuLabel className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-2 py-1.5">
                  Opções Pré-definidas
                </DropdownMenuLabel>
                {OPCOES_PREDEFINIDAS_AMBIENTES.map((opcao) => (
                  <DropdownMenuItem
                    key={opcao}
                    onClick={() => handleAddAmbiente(opcao)}
                    className="rounded-lg text-xs font-medium cursor-pointer py-2 px-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-2 shrink-0" />
                    <span>{opcao}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="my-1 border-slate-100 dark:border-slate-800" />
                <DropdownMenuItem
                  onClick={() => {
                    setCustomAmbienteNome('')
                    setIsCustomDialogOpen(true)
                  }}
                  className="rounded-lg text-xs font-semibold cursor-pointer py-2 px-2.5 text-slate-900 dark:text-slate-100 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800"
                >
                  <Plus className="w-3.5 h-3.5 mr-2 text-slate-600 dark:text-slate-300" />
                  <span>Outro nome personalizado…</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          /* Lista de Cards Expansíveis (estilo Accordion) */
          <div className="space-y-3.5">
            {ambientes.map((amb) => {
              const isOpen = expandedAmbientes.includes(amb.id)
              const subtotalAmbiente = subtotalPorAmbiente.get(amb.id) || 0
              const qtdModulos = amb.modulos.length
              const isEditing = editingAmbienteId === amb.id

              return (
                <div
                  key={amb.id}
                  className={cn(
                    'rounded-2xl border transition-all duration-200 bg-white dark:bg-slate-900 overflow-hidden shadow-xs',
                    isOpen
                      ? 'border-slate-300 dark:border-slate-700 shadow-sm'
                      : 'border-slate-200/90 dark:border-slate-800 hover:border-slate-300',
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
                    className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3.5 text-left select-none cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Lado esquerdo: Chevron indicador, Nome editável e Badge de qtd de módulos */}
                    <div
                      className="flex items-center gap-3 min-w-0"
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
                        className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 transition-transform duration-200"
                      >
                        <ChevronRight
                          className={cn(
                            'w-4 h-4 transition-transform duration-200',
                            isOpen && 'rotate-90',
                          )}
                        />
                      </button>

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
                            className="h-8 text-sm font-bold w-48 sm:w-64 rounded-lg bg-white dark:bg-slate-950 border-slate-300"
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
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
                            {amb.nome}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleStartRename(amb)
                            }}
                            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
                            title="Editar nome do ambiente"
                            aria-label={`Editar nome de ${amb.nome}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700 shrink-0">
                            {qtdModulos} {qtdModulos === 1 ? 'módulo' : 'módulos'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Lado direito: Subtotal do ambiente e botão de excluir ambiente */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block">
                          Subtotal
                        </span>
                        <span className="text-sm sm:text-base font-bold font-mono text-slate-900 dark:text-slate-100">
                          {formatCurrency(subtotalAmbiente)}
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
                        className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg shrink-0"
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
                                    className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                                  >
                                    <TableCell className="py-3.5 px-4 font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                                      <div className="flex items-center gap-2">
                                        <Box className="w-4 h-4 text-slate-500 shrink-0" />
                                        <span>{mod.modulo}</span>
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
                                      {formatCurrency(mod.valorTotal)}
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

                      {/* Rodapé do card: botão '+ Adicionar Módulo neste Ambiente' */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddModuloClick(amb.nome)}
                          className="h-9 px-3.5 gap-2 text-xs font-semibold rounded-xl border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-2xs w-full sm:w-auto"
                        >
                          <Plus className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                          <span>+ Adicionar Módulo neste Ambiente</span>
                        </Button>

                        <span className="text-[11px] text-slate-400 dark:text-slate-500 text-center sm:text-right">
                          Módulos da biblioteca e perfil construtivo entrarão na próxima etapa
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

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
          </div>
        </div>
      </aside>
    </div>
  )
}
