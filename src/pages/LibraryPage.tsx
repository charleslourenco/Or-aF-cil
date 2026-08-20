import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  PlusCircle,
  Search,
  Ruler,
  Boxes,
  ArrowRight,
  Pencil,
  AlertCircle,
  FileUp,
  Loader2,
  FileText,
  X,
  CheckCircle2,
  Package,
  Wrench,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ModuloBlueprint2D, type ModuloDimensoes } from '@/components/ModuloBlueprint2D'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase/client'
import {
  fetchTemplatesEngenharia,
  createTemplateEngenharia,
  updateTemplateEngenharia,
  normalizeIconType,
  type TemplateEngenharia,
  type TemplateEngenhariaInput,
  type ModuleIconType,
} from '@/services/templates'

/**
 * Converte a string de dimensões do catálogo (ex.: "2000x1200x600 mm",
 * "2000 x 1200 x 600", "1800X2200X600") em `{ largura, altura, profundidade }`.
 * Ordem interpretada: L x A x P. Cai num fallback padrão se não houver 3 números.
 */
function parseDimensoes(raw?: string | null): ModuloDimensoes {
  const fallback: ModuloDimensoes = {
    largura: 1200,
    altura: 2000,
    profundidade: 600,
  }
  if (!raw) return fallback
  const nums = raw.match(/\d+(?:[.,]\d+)?/g)
  if (!nums || nums.length < 3) return fallback
  const toNum = (s: string) => Number(s.replace(',', '.'))
  return {
    largura: toNum(nums[0]),
    altura: toNum(nums[1]),
    profundidade: toNum(nums[2]),
  }
}

/** Paleta de cores variadas para os badges de tags. */
const TAG_COLORS: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  blue: 'bg-blue-100 text-blue-700 border-blue-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  purple: 'bg-purple-100 text-purple-700 border-purple-200',
  rose: 'bg-rose-100 text-rose-700 border-rose-200',
  cyan: 'bg-cyan-100 text-cyan-700 border-cyan-200',
}

/** Hash determinístico de string -> chave de cor, para cores variadas por tag. */
function colorForTag(tag: string): string {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = (hash << 5) - hash + tag.charCodeAt(i)
    hash |= 0
  }
  const keys = Object.keys(TAG_COLORS)
  return TAG_COLORS[keys[Math.abs(hash) % keys.length]]
}

interface ModuleFormState {
  nome_template: string
  categoria: string
  dimensoes: string
  material: string
  descricao: string
  assinatura_visual: string
  icon_type: ModuleIconType
}

const EMPTY_FORM: ModuleFormState = {
  nome_template: '',
  categoria: '',
  dimensoes: '',
  material: '',
  descricao: '',
  assinatura_visual: '',
  icon_type: 'wardrobe',
}

export interface ExtractedPecaMdf {
  codigo?: string
  descricao?: string
  quantidade?: number | string
  item?: number | string
  qtd?: number | string
  nome?: string
}

export interface ExtractedFerragem {
  item?: string
  descricao?: string
  ref?: string
  quantidade?: number | string
  qtd?: number | string
  unidade?: string
}

export interface ImportPdfResult {
  codigo?: string
  codigo_modulo?: string
  nome?: string
  nome_template?: string
  dimensoes?: string
  largura_padrao?: number | string
  altura_padrao?: number | string
  profundidade_padrao?: number | string
  categoria?: string
  material?: string
  pecas_mdf?: ExtractedPecaMdf[]
  composicao_mdf?: ExtractedPecaMdf[]
  ferragens?: ExtractedFerragem[]
  regras_parametricas?: Record<string, unknown>
}

const AMBIENTE_TABS = ['Todos', 'Cozinha', 'Quarto', 'Sala', 'Banheiro'] as const

function inferIconTypeFromCategory(categoria?: string | null): ModuleIconType {
  if (!categoria) return 'wardrobe'
  const cat = categoria.toLowerCase()
  if (cat.includes('cozinha')) return 'counter'
  if (cat.includes('quarto')) return 'wardrobe'
  if (cat.includes('sala')) return 'counter'
  if (cat.includes('banheiro')) return 'wardrobe'
  if (cat.includes('aereo') || cat.includes('aéreo')) return 'aerial'
  return 'wardrobe'
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default function LibraryPage() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos')
  const [modulos, setModulos] = useState<TemplateEngenharia[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Estado do modal de criação/edição padrão
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ModuleFormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)

  // Estados do Modal de Importação de PDF
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importDragOver, setImportDragOver] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<ImportPdfResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSaving, setImportSaving] = useState(false)

  // Campos editáveis no preview de importação
  const [previewCodigo, setPreviewCodigo] = useState('')
  const [previewNome, setPreviewNome] = useState('')
  const [previewDimensoes, setPreviewDimensoes] = useState('')
  const [previewCategoria, setPreviewCategoria] = useState('Cozinha')

  // FETCH REAL DO SUPABASE — catálogo de módulos da tabela TemplatesEngenharia.
  const loadModules = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    const { data, error } = await fetchTemplatesEngenharia()
    if (error) {
      setErrorMsg(error)
      setModulos([])
    } else {
      setModulos(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadModules()
  }, [loadModules])

  const filteredModules = modulos.filter((m) => {
    const term = searchTerm.toLowerCase()
    const tags = (m.assinatura_visual ?? []).join(' ').toLowerCase()
    const matchesSearch =
      m.nome_template.toLowerCase().includes(term) ||
      (m.descricao ?? '').toLowerCase().includes(term) ||
      (m.material ?? '').toLowerCase().includes(term) ||
      tags.includes(term)
    const matchesCat =
      selectedCategory === 'Todos' ||
      (m.categoria ?? '').toLowerCase().includes(selectedCategory.toLowerCase())
    return matchesSearch && matchesCat
  })

  // --- Handlers do Modal de Criação / Edição Padrão ---
  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (mod: TemplateEngenharia) => {
    setEditingId(mod.id)
    setForm({
      nome_template: mod.nome_template ?? '',
      categoria: mod.categoria ?? '',
      dimensoes: mod.dimensoes ?? '',
      material: mod.material ?? '',
      descricao: mod.descricao ?? '',
      assinatura_visual: (mod.assinatura_visual ?? []).join(', '),
      icon_type: normalizeIconType(mod.icon_type),
    })
    setFormError(null)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.nome_template.trim()) {
      setFormError('O nome do módulo é obrigatório.')
      return
    }

    const tags = form.assinatura_visual
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    const payload: TemplateEngenhariaInput = {
      nome_template: form.nome_template.trim(),
      categoria: form.categoria.trim() || null,
      dimensoes: form.dimensoes.trim() || null,
      material: form.material.trim() || null,
      descricao: form.descricao.trim() || null,
      icon_type: form.icon_type,
      assinatura_visual: tags.length > 0 ? tags : null,
    }

    setSaving(true)
    const result =
      editingId !== null
        ? await updateTemplateEngenharia(editingId, payload)
        : await createTemplateEngenharia(payload)
    setSaving(false)

    if (result.error || !result.data) {
      setFormError(result.error ?? 'Não foi possível salvar o módulo.')
      toast({
        title: 'Erro ao salvar módulo',
        description: result.error ?? 'Tente novamente.',
        variant: 'destructive',
      })
      return
    }

    // Atualiza a lista localmente sem precisar re-fetchear tudo.
    setModulos((prev) => {
      const exists = prev.some((m) => m.id === result.data!.id)
      const next = exists
        ? prev.map((m) => (m.id === result.data!.id ? result.data! : m))
        : [...prev, result.data!]
      return next.sort((a, b) => a.nome_template.localeCompare(b.nome_template))
    })

    toast({
      title: editingId !== null ? 'Módulo atualizado' : 'Módulo criado',
      description: `${payload.nome_template} foi salvo com sucesso.`,
    })
    setModalOpen(false)
  }

  // --- Handlers do Modal de Importação de PDF Promob ---
  const openImportModal = () => {
    setImportFile(null)
    setImportDragOver(false)
    setImportLoading(false)
    setImportResult(null)
    setImportError(null)
    setImportSaving(false)
    setPreviewCodigo('')
    setPreviewNome('')
    setPreviewDimensoes('')
    setPreviewCategoria('Cozinha')
    setImportModalOpen(true)
  }

  const handleFileProcess = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setImportError('Formato inválido. Por favor, envie um arquivo .PDF.')
      toast({
        title: 'Arquivo inválido',
        description: 'Apenas arquivos PDF são aceitos para importação.',
        variant: 'destructive',
      })
      return
    }

    setImportFile(file)
    setImportError(null)
    setImportLoading(true)
    setImportResult(null)

    try {
      // Converte para Base64 puro
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const resultStr = reader.result as string
          // Remove prefixo data:*/*;base64, se houver
          const base64Clean = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr
          resolve(base64Clean)
        }
        reader.onerror = () => reject(new Error('Falha ao ler arquivo PDF.'))
        reader.readAsDataURL(file)
      })

      // Invocação da Edge Function do Supabase
      const { data, error } = await supabase.functions.invoke('importar-pdf-modulo', {
        body: { pdfBase64 },
      })

      if (error) {
        throw new Error(error.message || 'Erro ao conectar à função de importação.')
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      // Parse flexível da resposta
      let parsedData: ImportPdfResult = data
      if (typeof data === 'string') {
        try {
          const cleanStr = data
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim()
          parsedData = JSON.parse(cleanStr)
        } catch {
          throw new Error('A resposta da IA não é um JSON válido.')
        }
      }

      if (!parsedData || typeof parsedData !== 'object') {
        throw new Error('Não foi possível extrair dados estruturados do PDF.')
      }

      setImportResult(parsedData)

      // Extrai os campos com fallbacks flexíveis
      const codigo = parsedData.codigo || parsedData.codigo_modulo || 'MOD-01'
      const nome = parsedData.nome || parsedData.nome_template || 'Módulo Importado'

      let dimensoes = parsedData.dimensoes || ''
      if (
        !dimensoes &&
        (parsedData.largura_padrao || parsedData.altura_padrao || parsedData.profundidade_padrao)
      ) {
        const l = parsedData.largura_padrao ?? 0
        const a = parsedData.altura_padrao ?? 0
        const p = parsedData.profundidade_padrao ?? 0
        dimensoes = `${l}x${a}x${p}`
      }
      if (!dimensoes) dimensoes = '1200x900x600'

      const categoria = parsedData.categoria || 'Cozinha'

      setPreviewCodigo(codigo)
      setPreviewNome(nome)
      setPreviewDimensoes(dimensoes)
      setPreviewCategoria(categoria)

      toast({
        title: 'PDF processado com sucesso!',
        description: `Módulo ${codigo} extraído da ficha técnica.`,
      })
    } catch (err: unknown) {
      console.error('Erro na importação de PDF:', err)
      const msg =
        err instanceof Error ? err.message : 'Ocorreu um erro ao processar o PDF. Tente novamente.'
      setImportError(msg)
      toast({
        title: 'Erro na leitura do PDF',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setImportLoading(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setImportDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setImportDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setImportDragOver(false)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileProcess(e.target.files[0])
    }
  }

  const handleResetImportFile = () => {
    setImportFile(null)
    setImportResult(null)
    setImportError(null)
    setPreviewCodigo('')
    setPreviewNome('')
    setPreviewDimensoes('')
  }

  const handleSaveImportedModule = async () => {
    if (!previewNome.trim()) {
      setImportError('O nome do módulo é obrigatório.')
      return
    }

    const pecasList = importResult?.pecas_mdf || importResult?.composicao_mdf || []
    const ferragensList = importResult?.ferragens || []

    const nomeCompleto = previewCodigo.trim()
      ? `${previewCodigo.trim()} - ${previewNome.trim()}`
      : previewNome.trim()

    const pecasCount = pecasList.length
    const ferragensCount = ferragensList.length
    const descricao = `Módulo importado via PDF com ${pecasCount} peça(s) em MDF e ${ferragensCount} item(ns) de ferragens.`

    const catLimpa = previewCategoria.trim() || 'Cozinha'
    const iconType = inferIconTypeFromCategory(catLimpa)

    const payload: TemplateEngenhariaInput = {
      nome_template: nomeCompleto,
      categoria: catLimpa,
      dimensoes: previewDimensoes.trim() || '1200x900x600',
      material: importResult?.material || 'MDF (importado via PDF)',
      descricao: descricao,
      icon_type: iconType,
      assinatura_visual: [catLimpa],
    }

    setImportSaving(true)
    setImportError(null)

    const result = await createTemplateEngenharia(payload)
    setImportSaving(false)

    if (result.error || !result.data) {
      setImportError(result.error ?? 'Não foi possível salvar o módulo no banco de dados.')
      toast({
        title: 'Erro ao salvar módulo',
        description: result.error ?? 'Tente novamente.',
        variant: 'destructive',
      })
      return
    }

    // Recarrega a lista do banco
    await loadModules()

    toast({
      title: 'Módulo importado com sucesso!',
      description: `${nomeCompleto} adicionado à biblioteca de engenharia.`,
    })

    setImportModalOpen(false)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Biblioteca de Módulos Paramétricos
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Catálogo de módulos padrões com peças, ferragens e planos de corte pré-configurados.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={openImportModal}
            className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-semibold shadow-xs"
          >
            <FileUp className="w-4 h-4 mr-2 text-emerald-600" />+ Importar Módulo (PDF Promob/Ficha
            Técnica)
          </Button>

          <Button
            onClick={openCreate}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Novo Módulo
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar por nome, material, tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        {/* Abas fixas de ambiente */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {AMBIENTE_TABS.map((aba) => (
            <button
              key={aba}
              type="button"
              onClick={() => setSelectedCategory(aba)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                selectedCategory === aba
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {aba}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col"
            >
              <div className="p-4 bg-slate-50/50 border-b border-slate-100">
                <Skeleton className="h-44 w-full rounded-xl" />
              </div>
              <div className="p-5 space-y-3">
                <Skeleton className="h-4 w-1/3 rounded" />
                <Skeleton className="h-4 w-2/3 rounded" />
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-5/6 rounded" />
                <div className="flex gap-1.5 pt-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-9 w-full rounded-xl mt-2" />
              </div>
            </div>
          ))}
        </div>
      ) : errorMsg ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
          <p className="text-sm font-semibold text-slate-800">
            Não foi possível carregar a biblioteca de módulos.
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-md">{errorMsg}</p>
          <Button onClick={loadModules} variant="outline" className="mt-4">
            Tentar novamente
          </Button>
        </div>
      ) : filteredModules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Boxes className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-sm font-semibold text-slate-700">
            Nenhum módulo encontrado com os filtros atuais.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Ajuste a busca ou crie um novo módulo para o catálogo.
          </p>
          <Button onClick={openCreate} className="mt-4 bg-emerald-600 hover:bg-emerald-700">
            <PlusCircle className="w-4 h-4 mr-2" />
            Criar novo módulo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredModules.map((mod) => (
            <div
              key={mod.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col group"
            >
              {/* Blueprint preview */}
              <div className="p-4 bg-slate-50/50 border-b border-slate-100">
                <ModuloBlueprint2D
                  type={normalizeIconType(mod.icon_type)}
                  dimensoes={parseDimensoes(mod.dimensoes)}
                  corMdf={mod.material ?? undefined}
                  className="h-44"
                />
              </div>

              {/* Content */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    {mod.categoria && (
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold uppercase tracking-wider"
                      >
                        {mod.categoria}
                      </Badge>
                    )}
                    <button
                      type="button"
                      onClick={() => openEdit(mod)}
                      className="text-slate-400 hover:text-emerald-600 transition-colors p-1 rounded-md hover:bg-emerald-50"
                      aria-label={`Editar ${mod.nome_template}`}
                      title="Editar módulo"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>

                  <h3 className="font-bold text-base text-slate-900 mt-2 group-hover:text-emerald-700 transition-colors">
                    {mod.nome_template}
                  </h3>
                  {mod.descricao && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{mod.descricao}</p>
                  )}

                  {/* Tags / assinatura_visual */}
                  {mod.assinatura_visual && mod.assinatura_visual.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {mod.assinatura_visual.map((tag) => (
                        <span
                          key={tag}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colorForTag(
                            tag,
                          )}`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Specs */}
                <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
                  {mod.dimensoes && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Ruler className="w-3.5 h-3.5 text-emerald-600" /> Dimensões:
                      </span>
                      <span className="font-mono font-bold text-slate-800">{mod.dimensoes}</span>
                    </div>
                  )}
                  {mod.material && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Boxes className="w-3.5 h-3.5 text-emerald-600" /> Material:
                      </span>
                      <span
                        className="font-medium text-slate-700 truncate max-w-[170px]"
                        title={mod.material}
                      >
                        {mod.material}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action */}
                <Button
                  asChild
                  className="w-full bg-slate-900 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl transition-colors"
                >
                  <Link to={`/novo-orcamento?modulo=${mod.id}`}>
                    Usar no Orçamento
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Criação/Edição */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId !== null ? 'Editar Módulo' : 'Novo Módulo'}</DialogTitle>
            <DialogDescription>
              {editingId !== null
                ? 'Atualize os dados do módulo do catálogo.'
                : 'Preencha os dados para adicionar um novo módulo à biblioteca.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label htmlFor="nome_template" className="text-xs font-semibold">
                Nome do módulo <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="nome_template"
                value={form.nome_template}
                onChange={(e) => setForm((f) => ({ ...f, nome_template: e.target.value }))}
                placeholder="Ex.: Roupeiro 2 Portas"
                className="h-9 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="categoria" className="text-xs font-semibold">
                  Categoria
                </Label>
                <Input
                  id="categoria"
                  value={form.categoria}
                  onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
                  placeholder="Ex.: Cozinha / Sala"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="icon_type" className="text-xs font-semibold">
                  Tipo de ícone
                </Label>
                <Select
                  value={form.icon_type}
                  onValueChange={(v) => setForm((f) => ({ ...f, icon_type: v as ModuleIconType }))}
                >
                  <SelectTrigger id="icon_type" className="h-9 text-sm">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wardrobe">Roupeiro (wardrobe)</SelectItem>
                    <SelectItem value="counter">Balcão (counter)</SelectItem>
                    <SelectItem value="aerial">Aéreo (aerial)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dimensoes" className="text-xs font-semibold">
                Dimensões
              </Label>
              <Input
                id="dimensoes"
                value={form.dimensoes}
                onChange={(e) => setForm((f) => ({ ...f, dimensoes: e.target.value }))}
                placeholder="L x A x P mm"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="material" className="text-xs font-semibold">
                Material
              </Label>
              <Input
                id="material"
                value={form.material}
                onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))}
                placeholder="Ex.: MDF 18mm Ultra"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="descricao" className="text-xs font-semibold">
                Descrição
              </Label>
              <Textarea
                id="descricao"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Descrição curta do módulo..."
                className="text-sm min-h-[80px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="assinatura_visual" className="text-xs font-semibold">
                Tags (separadas por vírgula)
              </Label>
              <Input
                id="assinatura_visual"
                value={form.assinatura_visual}
                onChange={(e) => setForm((f) => ({ ...f, assinatura_visual: e.target.value }))}
                placeholder="Ex.: Cozinha, Balcão, 2 Portas"
                className="h-9 text-sm"
              />
              <p className="text-[11px] text-slate-400">
                As tags viram badges coloridas no card e também são usadas na busca.
              </p>
            </div>

            {formError && (
              <p className="text-xs text-rose-600 font-medium flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                {formError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? 'Salvando...' : editingId !== null ? 'Salvar alterações' : 'Criar módulo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Importação de PDF Promob / Ficha Técnica */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 text-lg font-bold">
              <FileUp className="w-5 h-5 text-emerald-600" />
              Importar Módulo de Ficha Técnica (PDF Promob)
            </DialogTitle>
            <DialogDescription>
              Faça upload do PDF da ficha técnica para extrair automaticamente a composição de MDF,
              dimensões e ferragens via inteligência de engenharia.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 py-3 space-y-5">
            {/* 1. Drag and Drop Zone */}
            {!importResult && !importLoading && (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                  importDragOver
                    ? 'border-emerald-500 bg-emerald-50/70 scale-[0.99]'
                    : importFile
                      ? 'border-emerald-400 bg-emerald-50/30'
                      : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50/80 bg-white'
                }`}
                onClick={() => {
                  const input = document.getElementById('pdf-file-input') as HTMLInputElement
                  input?.click()
                }}
              >
                <input
                  id="pdf-file-input"
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={handleFileInputChange}
                />

                <div className="flex flex-col items-center justify-center space-y-3">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
                      importDragOver
                        ? 'bg-emerald-200 text-emerald-800'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    <FileUp className="w-7 h-7" />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {importDragOver
                        ? 'Solte para importar'
                        : 'Arraste o PDF da ficha técnica ou clique para selecionar'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Compatível com relatórios de engenharia Promob, CorteCloud e fichas técnicas
                      (PDF).
                    </p>
                  </div>

                  {importFile && (
                    <div
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-semibold mt-2 border border-emerald-300"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FileText className="w-4 h-4 text-emerald-700" />
                      <span>{importFile.name}</span>
                      <span className="text-[11px] text-emerald-600 font-mono">
                        ({formatFileSize(importFile.size)})
                      </span>
                      <button
                        type="button"
                        onClick={handleResetImportFile}
                        className="text-emerald-700 hover:text-rose-600 ml-1 p-0.5 rounded"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. Loading State */}
            {importLoading && (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin flex items-center justify-center" />
                  <Loader2 className="w-6 h-6 text-emerald-600 absolute inset-0 m-auto animate-pulse" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800">
                    Lendo composição de MDF e lista de ferragens do PDF...
                  </p>
                  <p className="text-xs text-slate-500 max-w-sm">
                    A IA de engenharia está estruturando as peças, cortes e componentes para a
                    biblioteca paramétrica.
                  </p>
                </div>
                {importFile && (
                  <Badge variant="outline" className="text-xs text-slate-600 bg-white">
                    <FileText className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    {importFile.name}
                  </Badge>
                )}
              </div>
            )}

            {/* 3. Preview & Confirmation State */}
            {importResult && !importLoading && (
              <div className="space-y-5 animate-fade-in">
                {/* Header do preview com badge de sucesso */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-emerald-900">
                        Dados extraídos com sucesso do PDF!
                      </p>
                      <p className="text-[11px] text-emerald-700">
                        Revise os campos abaixo antes de salvar na biblioteca.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetImportFile}
                    className="text-emerald-800 hover:text-emerald-950 text-xs h-8"
                  >
                    Trocar arquivo
                  </Button>
                </div>

                {/* Formulário de Identificação do Módulo Extraído */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="space-y-1">
                    <Label
                      htmlFor="preview_codigo"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Código do Módulo
                    </Label>
                    <Input
                      id="preview_codigo"
                      value={previewCodigo}
                      onChange={(e) => setPreviewCodigo(e.target.value)}
                      placeholder="Ex: BAL0305A"
                      className="h-9 text-xs font-mono font-bold bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="preview_nome" className="text-xs font-semibold text-slate-700">
                      Nome do Módulo <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="preview_nome"
                      value={previewNome}
                      onChange={(e) => setPreviewNome(e.target.value)}
                      placeholder="Ex: Balcão 2 Portas"
                      className="h-9 text-xs font-semibold bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label
                      htmlFor="preview_dimensoes"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Dimensões Padrão (L x A x P em mm)
                    </Label>
                    <Input
                      id="preview_dimensoes"
                      value={previewDimensoes}
                      onChange={(e) => setPreviewDimensoes(e.target.value)}
                      placeholder="Ex: 1200x900x600"
                      className="h-9 text-xs font-mono bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label
                      htmlFor="preview_categoria"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Ambiente / Categoria
                    </Label>
                    <Select value={previewCategoria} onValueChange={setPreviewCategoria}>
                      <SelectTrigger id="preview_categoria" className="h-9 text-xs bg-white">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cozinha">Cozinha</SelectItem>
                        <SelectItem value="Quarto">Quarto</SelectItem>
                        <SelectItem value="Sala">Sala</SelectItem>
                        <SelectItem value="Banheiro">Banheiro</SelectItem>
                        <SelectItem value="Lavanderia">Lavanderia</SelectItem>
                        <SelectItem value="Geral">Geral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Tabela de Peças em MDF Extraídas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                      <Layers className="w-3.5 h-3.5 text-emerald-600" />
                      Peças em MDF extraídas
                      <Badge variant="outline" className="text-[10px] ml-1 bg-white">
                        {(importResult.pecas_mdf || importResult.composicao_mdf || []).length} itens
                      </Badge>
                    </h4>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/80 text-slate-600 font-semibold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3 w-1/4">Código</th>
                          <th className="py-2 px-3">Descrição da Peça</th>
                          <th className="py-2 px-3 text-right w-20">Qtd</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {(importResult.pecas_mdf || importResult.composicao_mdf || []).length ===
                        0 ? (
                          <tr>
                            <td colSpan={3} className="py-4 text-center text-slate-400 italic">
                              Nenhuma peça individual de MDF listada no relatório.
                            </td>
                          </tr>
                        ) : (
                          (importResult.pecas_mdf || importResult.composicao_mdf || []).map(
                            (peca, idx) => {
                              const cod =
                                peca.codigo ||
                                (peca.item !== undefined ? `ITEM-${peca.item}` : `P-${idx + 1}`)
                              const desc = peca.descricao || peca.nome || 'Peça MDF Padrão'
                              const qtd = peca.quantidade ?? peca.qtd ?? 1
                              return (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="py-2 px-3 font-mono font-medium text-slate-900">
                                    {cod}
                                  </td>
                                  <td className="py-2 px-3 font-normal">{desc}</td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                                    {qtd}
                                  </td>
                                </tr>
                              )
                            },
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tabela de Ferragens Extraídas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                      <Wrench className="w-3.5 h-3.5 text-emerald-600" />
                      Ferragens extraídas
                      <Badge variant="outline" className="text-[10px] ml-1 bg-white">
                        {(importResult.ferragens || []).length} itens
                      </Badge>
                    </h4>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/80 text-slate-600 font-semibold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Item / Descrição</th>
                          <th className="py-2 px-3 text-right w-24">Quantidade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {(importResult.ferragens || []).length === 0 ? (
                          <tr>
                            <td colSpan={2} className="py-4 text-center text-slate-400 italic">
                              Nenhuma ferragem identificada no arquivo.
                            </td>
                          </tr>
                        ) : (
                          (importResult.ferragens || []).map((ferragem, idx) => {
                            const desc =
                              ferragem.item ||
                              ferragem.descricao ||
                              ferragem.ref ||
                              `Ferragem #${idx + 1}`
                            const qtd = ferragem.quantidade ?? ferragem.qtd ?? 1
                            const un = ferragem.unidade ? ` ${ferragem.unidade}` : ''
                            return (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="py-2 px-3 font-normal text-slate-800">{desc}</td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                                  {qtd}
                                  {un}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Mensagem de Erro dentro do Modal */}
            {importError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-rose-900">Falha no processamento</p>
                  <p className="text-rose-700 mt-0.5">{importError}</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-slate-200 gap-2">
            <Button
              variant="outline"
              onClick={() => setImportModalOpen(false)}
              disabled={importSaving || importLoading}
            >
              Cancelar
            </Button>
            {importResult && (
              <Button
                onClick={handleSaveImportedModule}
                disabled={importSaving || importLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {importSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando na Biblioteca...
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4 mr-2" />
                    Salvar na Biblioteca
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
