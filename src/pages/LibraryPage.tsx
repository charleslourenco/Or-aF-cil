import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
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
  ImageIcon,
  X,
  CheckCircle2,
  Package,
  Wrench,
  Layers,
  Compass,
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
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase/client'
import {
  fetchTemplatesEngenharia,
  createTemplateEngenharia,
  updateTemplateEngenharia,
  deleteTemplateEngenharia,
  normalizeIconType,
  type TemplateEngenharia,
  type TemplateEngenhariaInput,
  type ModuleIconType,
  type PecaMdfItem,
  type FerragemItem,
  type PerfilConstrutivo,
  PERFIS_CONSTRUTIVOS_INFO,
} from '@/services/templates'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Trash2 } from 'lucide-react'

interface ModuleFormState {
  codigo: string
  nome_template: string
  categoria: string
  dimensoes: string
  material: string
  descricao: string
  assinatura_visual: string
  icon_type: ModuleIconType
  imagem_url: string
  perfil_construtivo: PerfilConstrutivo
}

const EMPTY_FORM: ModuleFormState = {
  codigo: '',
  nome_template: '',
  categoria: '',
  dimensoes: '',
  material: '',
  descricao: '',
  assinatura_visual: '',
  icon_type: 'wardrobe',
  imagem_url: '',
  perfil_construtivo: 'Fechado Envelopado',
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

  // Estado do modal de detalhes do módulo
  const [detailModalId, setDetailModalId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Estado do modal de criação/edição padrão
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ModuleFormState>(EMPTY_FORM)
  const [formPecasMdf, setFormPecasMdf] = useState<PecaMdfItem[] | null>(null)
  const [formFerragens, setFormFerragens] = useState<FerragemItem[] | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  // Estados do Modal de Importação de PDF
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importDragOver, setImportDragOver] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<ImportPdfResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSaving, setImportSaving] = useState(false)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)

  // Campos editáveis no preview de importação
  const [previewCodigo, setPreviewCodigo] = useState('')
  const [previewNome, setPreviewNome] = useState('')
  const [previewDimensoes, setPreviewDimensoes] = useState('')
  const [previewPerfil, setPreviewPerfil] = useState<PerfilConstrutivo>('Fechado Envelopado')
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

  const selectedDetailModule = modulos.find((m) => m.id === detailModalId) || null

  const filteredModules = modulos.filter((m) => {
    const term = searchTerm.toLowerCase()
    const tags = (m.assinatura_visual ?? []).join(' ').toLowerCase()
    const matchesSearch =
      (m.codigo ?? '').toLowerCase().includes(term) ||
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
    setFormPecasMdf(null)
    setFormFerragens(null)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (mod: TemplateEngenharia) => {
    setEditingId(mod.id)
    setForm({
      codigo: mod.codigo ?? '',
      nome_template: mod.nome_template ?? '',
      categoria: mod.categoria ?? '',
      dimensoes: mod.dimensoes ?? '',
      material: mod.material ?? '',
      descricao: mod.descricao ?? '',
      assinatura_visual: (mod.assinatura_visual ?? []).join(', '),
      icon_type: normalizeIconType(mod.icon_type),
      imagem_url: mod.imagem_url ?? '',
      perfil_construtivo: (mod.perfil_construtivo as PerfilConstrutivo) || 'Fechado Envelopado',
    })
    setFormPecasMdf(mod.pecas_mdf ?? null)
    setFormFerragens(mod.ferragens ?? null)
    setFormError(null)
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    setDeleting(true)
    const { error } = await deleteTemplateEngenharia(id)
    setDeleting(false)

    if (error) {
      toast({
        title: 'Erro ao excluir módulo',
        description: error,
        variant: 'destructive',
      })
      return
    }

    toast({
      title: 'Módulo excluído',
      description: 'O módulo foi removido da biblioteca com sucesso.',
    })

    setDeleteConfirmId(null)
    if (detailModalId === id) {
      setDetailModalId(null)
    }
    await loadModules()
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
      codigo: form.codigo.trim() || null,
      nome_template: form.nome_template.trim(),
      categoria: form.categoria.trim() || null,
      dimensoes: form.dimensoes.trim() || null,
      material: form.material.trim() || null,
      descricao: form.descricao.trim() || null,
      icon_type: form.icon_type,
      assinatura_visual: tags.length > 0 ? tags : null,
      pecas_mdf: formPecasMdf,
      ferragens: formFerragens,
      imagem_url: form.imagem_url.trim() || null,
      perfil_construtivo: form.perfil_construtivo,
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

    // Atualiza a lista localmente e recarrega
    await loadModules()

    toast({
      title: editingId !== null ? 'Módulo atualizado' : 'Módulo criado',
      description: `${payload.nome_template} foi salvo com sucesso.`,
    })
    setModalOpen(false)
  }

  // Configuração do Worker do PDF.js
  useEffect(() => {
    try {
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker
      }
    } catch (e) {
      console.error('Falha ao configurar worker pdfjs:', e)
    }
  }, [])

  // Converte todas as páginas de um PDF em um array de strings Base64 PNG (data URL) com resolução aprimorada (scale 2.5)
  const renderPdfPagesToBase64 = async (file: File): Promise<string[]> => {
    try {
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker
      }

      let arrayBuffer: ArrayBuffer
      try {
        arrayBuffer = await file.arrayBuffer()
      } catch (readErr) {
        throw new Error(
          `Falha ao ler o arquivo PDF do disco/navegador: ${readErr instanceof Error ? readErr.message : 'Erro de leitura.'}`,
        )
      }

      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
      const pdfDoc = await loadingTask.promise

      if (pdfDoc.numPages < 1) {
        throw new Error('O arquivo PDF não contém páginas legíveis.')
      }

      const pagesBase64: string[] = []
      // Lê até 5 páginas do PDF para capturar fichas técnicas extensas e listas de composição
      const maxPages = Math.min(pdfDoc.numPages, 5)

      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum)
        // Scale 2.5 garante nitidez perfeita para leitura de fontes pequenas em tabelas densas (como códigos BAS0242A)
        const viewport = page.getViewport({ scale: 2.5 })

        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        const context = canvas.getContext('2d')

        if (!context) {
          throw new Error('Não foi possível inicializar o canvas de renderização gráfica.')
        }

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        }

        await page.render(renderContext).promise
        const dataUrl = canvas.toDataURL('image/png')
        pagesBase64.push(dataUrl)
      }

      return pagesBase64
    } catch (err: unknown) {
      console.error('Erro na conversão do PDF para imagem:', err)
      const details =
        err instanceof Error ? err.message : 'Arquivo corrompido ou formato não suportado.'
      throw new Error(`Falha na renderização do PDF: ${details}`)
    }
  }

  // Converte imagem (PNG, JPG, JPEG) em string Base64 (data URL)
  const renderImageFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const resultStr = reader.result as string
        resolve(resultStr)
      }
      reader.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem selecionado.'))
      reader.readAsDataURL(file)
    })
  }

  // Converte Data URL Base64 para Blob binário
  const dataURLtoBlob = (dataUrl: string): Blob => {
    const arr = dataUrl.split(',')
    const mimeMatch = arr[0].match(/:(.*?);/)
    const mime = mimeMatch ? mimeMatch[1] : 'image/png'
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    return new Blob([u8arr], { type: mime })
  }

  // Realiza upload da imagem ou arquivo original para o bucket 'modulos-imagens' no Supabase Storage
  const uploadToStorage = async (file: File, renderedDataUrl?: string): Promise<string | null> => {
    try {
      const bucketName = 'modulos-imagens'
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(2, 8)

      let uploadBody: Blob | File = file
      let filePath = ''

      if (renderedDataUrl) {
        // Se temos a imagem renderizada (especialmente para PDF ou para garantir formato PNG/JPG para exibição de capa)
        uploadBody = dataURLtoBlob(renderedDataUrl)
        filePath = `modulo-${timestamp}-${randomStr}.png`
      } else {
        const cleanExt = file.name.split('.').pop()?.toLowerCase() || 'png'
        filePath = `modulo-${timestamp}-${randomStr}.${cleanExt}`
      }

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, uploadBody, {
          cacheControl: '3600',
          upsert: true,
          contentType: uploadBody.type || 'image/png',
        })

      if (uploadError) {
        console.warn('Erro ao fazer upload no storage modulos-imagens:', uploadError)
        return null
      }

      const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath)

      return publicUrlData?.publicUrl || null
    } catch (err) {
      console.warn('Exceção ao enviar imagem para o Supabase Storage:', err)
      return null
    }
  }

  // --- Handlers do Modal de Importação de PDF Promob ---
  const openImportModal = () => {
    setImportFile(null)
    setImportDragOver(false)
    setImportLoading(false)
    setImportResult(null)
    setImportError(null)
    setImportSaving(false)
    setUploadedImageUrl(null)
    setPreviewCodigo('')
    setPreviewNome('')
    setPreviewDimensoes('')
    setPreviewCategoria('Cozinha')
    setPreviewPerfil('Fechado Envelopado')
    setImportModalOpen(true)
  }

  const handleFileProcess = async (file: File) => {
    const fileName = file.name.toLowerCase()
    const isPdf = file.type === 'application/pdf' || fileName.endsWith('.pdf')
    const isImage =
      file.type.startsWith('image/') ||
      fileName.endsWith('.png') ||
      fileName.endsWith('.jpg') ||
      fileName.endsWith('.jpeg')

    if (!isPdf && !isImage) {
      const msg = 'Formato inválido. Por favor, envie um arquivo PDF, PNG ou JPG.'
      setImportError(msg)
      toast({
        title: 'Arquivo não suportado',
        description: msg,
        variant: 'destructive',
      })
      return
    }

    setImportFile(file)
    setImportError(null)
    setImportLoading(true)
    setImportResult(null)
    setUploadedImageUrl(null)

    try {
      // 1. Obtenção das imagens em Base64 (renderiza todas as páginas do PDF com scale 2.5 ou lê imagem direta)
      let pagesDataUrl: string[] = []
      try {
        if (isPdf) {
          pagesDataUrl = await renderPdfPagesToBase64(file)
        } else {
          const singleUrl = await renderImageFileToBase64(file)
          pagesDataUrl = [singleUrl]
        }
      } catch (renderErr) {
        const renderMsg =
          renderErr instanceof Error ? renderErr.message : 'Falha na renderização gráfica do PDF.'
        throw new Error(`[Etapa 1: Renderização] ${renderMsg}`)
      }

      if (!pagesDataUrl || pagesDataUrl.length === 0) {
        throw new Error(
          '[Etapa 1: Renderização] Não foi possível extrair nenhuma página visível do documento enviado.',
        )
      }

      // 2. Extrai base64 limpo (sem cabeçalho data:image/png;base64,) para cada página
      const paginasBase64Clean = pagesDataUrl.map((url) =>
        url.includes(',') ? url.split(',')[1] : url,
      )

      // 3. Upload da capa (página 1) para o Supabase Storage no bucket 'modulos-imagens' em background
      const publicUrlPromise = uploadToStorage(file, pagesDataUrl[0])

      // 4. Invocação da Edge Function do Supabase enviando todas as páginas renderizadas
      let invokeResponse: any
      try {
        invokeResponse = await supabase.functions.invoke('importar-pdf-modulo', {
          body: {
            paginasBase64: paginasBase64Clean,
            // Fallback de retrocompatibilidade
            imagemBase64: paginasBase64Clean[0],
            pdfBase64: paginasBase64Clean[0],
          },
        })
      } catch (netErr) {
        const netMsg =
          netErr instanceof Error ? netErr.message : 'Falha de comunicação com a Edge Function.'
        throw new Error(`[Etapa 2: Conexão IA] ${netMsg}`)
      }

      const { data, error } = invokeResponse
      const publicUrl = await publicUrlPromise.catch(() => null)

      if (publicUrl) {
        setUploadedImageUrl(publicUrl)
      }

      if (error) {
        throw new Error(
          `[Etapa 2: Análise IA] ${error.message || 'Erro reportado pelo servidor de IA.'}`,
        )
      }

      if (data?.error) {
        throw new Error(`[Etapa 2: Análise IA] ${data.error}`)
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
          throw new Error(
            '[Etapa 2: Análise IA] A resposta da IA não é um JSON válido (resposta incompleta ou truncada).',
          )
        }
      }

      if (!parsedData || typeof parsedData !== 'object') {
        throw new Error(
          '[Etapa 2: Análise IA] Não foi possível extrair dados estruturados da ficha técnica.',
        )
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

      // Infere categoria padrão se não informada
      let categoria = parsedData.categoria || ''
      if (!categoria) {
        const nomeUpper = (nome + ' ' + codigo).toUpperCase()
        if (
          nomeUpper.includes('ROUPEIRO') ||
          nomeUpper.includes('DORM') ||
          nomeUpper.includes('QUARTO') ||
          nomeUpper.includes('CABIDEIRO')
        ) {
          categoria = 'Quarto'
        } else if (
          nomeUpper.includes('BALCAO') ||
          nomeUpper.includes('BALCÃO') ||
          nomeUpper.includes('PIA') ||
          nomeUpper.includes('COZINHA')
        ) {
          categoria = 'Cozinha'
        } else if (
          nomeUpper.includes('PAINEL') ||
          nomeUpper.includes('RACK') ||
          nomeUpper.includes('SALA')
        ) {
          categoria = 'Sala'
        } else if (nomeUpper.includes('BANHEIRO') || nomeUpper.includes('LAVABO')) {
          categoria = 'Banheiro'
        } else {
          categoria = 'Quarto'
        }
      }

      setPreviewCodigo(codigo)
      setPreviewNome(nome)
      setPreviewDimensoes(dimensoes)
      setPreviewCategoria(categoria)

      // Respeita o perfil construtivo inferido pela IA se for válido, caso contrário usa regras heurísticas
      const perfilRetornado = (parsedData as any).perfil_construtivo as
        | PerfilConstrutivo
        | undefined
      if (
        perfilRetornado &&
        (perfilRetornado === 'Fechado Envelopado' ||
          perfilRetornado === 'Balcão (tampo por conta do cliente)' ||
          perfilRetornado === 'Aberto / Painel' ||
          perfilRetornado === 'Caixa Simples')
      ) {
        setPreviewPerfil(perfilRetornado)
      } else {
        const nomeLower = nome.toLowerCase()
        if (
          nomeLower.includes('painel') ||
          nomeLower.includes('tv') ||
          nomeLower.includes('rack') ||
          nomeLower.includes('estante')
        ) {
          setPreviewPerfil('Aberto / Painel')
        } else if (
          nomeLower.includes('balcão') ||
          nomeLower.includes('balcao') ||
          nomeLower.includes('pia') ||
          nomeLower.includes('bancada')
        ) {
          setPreviewPerfil('Balcão (tampo por conta do cliente)')
        } else if (nomeLower.includes('aereo') || nomeLower.includes('aéreo')) {
          setPreviewPerfil('Caixa Simples')
        } else {
          setPreviewPerfil('Fechado Envelopado')
        }
      }

      const totalPecas = (parsedData.pecas_mdf || parsedData.composicao_mdf || []).length
      const totalFerragens = (parsedData.ferragens || []).length

      toast({
        title: 'PDF processado com sucesso!',
        description: `Módulo ${codigo}: ${totalPecas} peças MDF e ${totalFerragens} ferragens extraídas.`,
      })
    } catch (err: unknown) {
      console.error('Erro na importação de PDF:', err)
      const msg =
        err instanceof Error
          ? err.message
          : 'Ocorreu um erro ao processar o PDF. Verifique se o arquivo é legível.'
      setImportError(msg)
      toast({
        title: 'Falha na importação do PDF',
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
    setUploadedImageUrl(null)
    setPreviewCodigo('')
    setPreviewNome('')
    setPreviewDimensoes('')
  }

  const handleSaveImportedModule = async () => {
    if (!previewNome.trim()) {
      setImportError('O nome do módulo é obrigatório.')
      return
    }

    setImportSaving(true)
    setImportError(null)

    try {
      const rawPecasList = importResult?.pecas_mdf || importResult?.composicao_mdf || []
      const rawFerragensList = importResult?.ferragens || []

      // Normalização das peças MDF para [{ codigo, descricao, quantidade }]
      const normalizedPecasMdf: PecaMdfItem[] = rawPecasList.map((peca, idx) => ({
        codigo:
          peca.codigo ||
          (peca.item !== undefined && peca.item !== null ? `ITEM-${peca.item}` : `P-${idx + 1}`),
        descricao: peca.descricao || peca.nome || 'Peça MDF Padrão',
        quantidade:
          typeof peca.quantidade === 'number'
            ? peca.quantidade
            : typeof peca.qtd === 'number'
              ? peca.qtd
              : Number(peca.quantidade || peca.qtd) || 1,
      }))

      // Normalização das ferragens para [{ item, descricao, quantidade, unidade }]
      const normalizedFerragens: FerragemItem[] = rawFerragensList.map((ferragem, idx) => ({
        item: ferragem.item || ferragem.ref || `FERR-${idx + 1}`,
        descricao: ferragem.descricao || ferragem.item || ferragem.ref || `Ferragem #${idx + 1}`,
        quantidade:
          typeof ferragem.quantidade === 'number'
            ? ferragem.quantidade
            : typeof ferragem.qtd === 'number'
              ? ferragem.qtd
              : Number(ferragem.quantidade || ferragem.qtd) || 1,
        unidade: ferragem.unidade || 'UN',
      }))

      const codigoFinal = previewCodigo.trim() || null
      const nomeFinal = previewNome.trim()

      const pecasCount = normalizedPecasMdf.length
      const ferragensCount = normalizedFerragens.length
      const descricao = `Módulo importado via PDF com ${pecasCount} peça(s) em MDF e ${ferragensCount} item(ns) de ferragens.`

      const catLimpa = previewCategoria.trim() || 'Cozinha'
      const iconType = inferIconTypeFromCategory(catLimpa)

      const payload: TemplateEngenhariaInput = {
        codigo: codigoFinal,
        nome_template: nomeFinal,
        categoria: catLimpa,
        dimensoes: previewDimensoes.trim() || '1200x900x600',
        material: importResult?.material || 'MDF (importado via PDF)',
        descricao: descricao,
        icon_type: iconType,
        assinatura_visual: [catLimpa],
        pecas_mdf: normalizedPecasMdf.length > 0 ? normalizedPecasMdf : null,
        ferragens: normalizedFerragens.length > 0 ? normalizedFerragens : null,
        imagem_url: uploadedImageUrl || null,
        perfil_construtivo: previewPerfil,
      }

      let result: { data: TemplateEngenharia | null; error: string | null }
      try {
        result = await createTemplateEngenharia(payload)
      } catch (saveDbErr) {
        const dbMsg =
          saveDbErr instanceof Error ? saveDbErr.message : 'Erro ao persistir no Supabase.'
        throw new Error(`[Etapa 3: Salvamento no Banco] ${dbMsg}`)
      }

      if (result.error || !result.data) {
        const errorMsg = result.error ?? 'Não foi possível salvar o módulo no banco de dados.'
        const fullMsg = `[Etapa 3: Salvamento no Banco] ${errorMsg}`
        setImportError(fullMsg)
        toast({
          title: 'Erro ao salvar módulo',
          description: fullMsg,
          variant: 'destructive',
        })
        return
      }

      // Fecha o modal de importação
      setImportModalOpen(false)

      // Recarrega a lista do banco
      await loadModules()

      toast({
        title: 'Módulo importado com sucesso!',
        description: `${nomeFinal} (${pecasCount} peças, ${ferragensCount} ferragens) adicionado à biblioteca.`,
      })
    } catch (err: unknown) {
      console.error('Erro ao salvar módulo importado:', err)
      const errorMsg =
        err instanceof Error
          ? err.message
          : '[Etapa 3: Salvamento no Banco] Ocorreu um erro inesperado ao salvar o módulo.'
      setImportError(errorMsg)
      toast({
        title: 'Erro ao salvar módulo',
        description: errorMsg,
        variant: 'destructive',
      })
    } finally {
      setImportSaving(false)
    }
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
            className="border-slate-700 text-slate-800 hover:bg-slate-100 font-semibold shadow-xs"
          >
            <FileUp className="w-4 h-4 mr-2 text-slate-700" />+ Importar Módulo (PDF Promob/Ficha
            Técnica)
          </Button>

          <Button
            onClick={openCreate}
            className="bg-slate-700 hover:bg-slate-800 text-white font-semibold shadow-sm"
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
                  ? 'bg-slate-700 text-white shadow-2xs'
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
      ) : modulos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-8 shadow-2xs">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4 text-slate-700 shadow-2xs">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Sua biblioteca de módulos está vazia</h3>
          <p className="text-sm text-slate-500 mt-1.5 max-w-md">
            Faça o upload das fichas técnicas em PDF ou imagem para povoar seu catálogo oficial de
            fábrica.
          </p>
          <Button
            onClick={openImportModal}
            className="mt-6 bg-slate-700 hover:bg-slate-800 text-white font-semibold shadow-sm h-10 px-5"
          >
            <FileUp className="w-4 h-4 mr-2" />+ Importar Primeiro Módulo
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
          <Button onClick={openCreate} className="mt-4 bg-slate-700 hover:bg-slate-800">
            <PlusCircle className="w-4 h-4 mr-2" />
            Criar novo módulo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredModules.map((mod) => {
            // Contagem segura de peças de MDF com suporte a pecas_mdf e composicao_mdf
            const pecasArr =
              (Array.isArray(mod.pecas_mdf) && mod.pecas_mdf.length > 0
                ? mod.pecas_mdf
                : Array.isArray((mod as any).composicao_mdf)
                  ? (mod as any).composicao_mdf
                  : null) ?? (Array.isArray(mod.pecas_mdf) ? mod.pecas_mdf : null)
            const pecasCount = pecasArr ? pecasArr.length : 0

            // Contagem segura de ferragens
            const ferragensArr =
              (Array.isArray(mod.ferragens) && mod.ferragens.length > 0
                ? mod.ferragens
                : Array.isArray((mod as any).ferragens_itens)
                  ? (mod as any).ferragens_itens
                  : null) ?? (Array.isArray(mod.ferragens) ? mod.ferragens : null)
            const ferragensCount = ferragensArr ? ferragensArr.length : 0

            // Extrai iniciais do nome se não houver código
            const codigoDisplay =
              mod.codigo && mod.codigo.trim().length > 0
                ? mod.codigo.trim()
                : mod.nome_template
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 3)
                    .map((w) => w[0]?.toUpperCase())
                    .join('') || 'MOD'

            return (
              <div
                key={mod.id}
                onClick={() => setDetailModalId(mod.id)}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-slate-400 transition-all overflow-hidden flex flex-col group cursor-pointer"
              >
                {/* Cabeçalho do card: Imagem real do módulo com fallback técnico */}
                <div className="relative w-full h-48 bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-100 rounded-t-2xl">
                  {mod.imagem_url ? (
                    <img
                      src={mod.imagem_url}
                      alt={mod.nome_template}
                      className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        // Fallback se a imagem falhar ao carregar
                        ;(e.target as HTMLImageElement).style.display = 'none'
                        const parent = (e.target as HTMLElement).parentElement
                        const fallback = parent?.querySelector('.image-fallback-container')
                        if (fallback) {
                          ;(fallback as HTMLElement).style.display = 'flex'
                        }
                      }}
                    />
                  ) : null}

                  {/* Fallback técnico blueprint quando não há imagem ou em caso de erro */}
                  <div
                    className={`image-fallback-container w-full h-full flex flex-col items-center justify-center p-4 bg-slate-100 text-slate-400 ${
                      mod.imagem_url ? 'hidden' : 'flex'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-slate-500 mb-2 group-hover:border-slate-400 group-hover:text-slate-700 transition-colors">
                      <Compass className="w-7 h-7" />
                    </div>
                    <span className="text-[11px] font-mono font-bold text-slate-600 tracking-wider">
                      {codigoDisplay}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5 font-medium">
                      Planta Técnica
                    </span>
                  </div>

                  {/* Badges flutuantes no topo da imagem */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                    <span className="px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-xs text-slate-500 font-mono text-xs font-bold border border-slate-700/60 shadow-xs">
                      {codigoDisplay}
                    </span>
                    {mod.categoria && (
                      <Badge
                        variant="secondary"
                        className="bg-white/90 backdrop-blur-xs text-slate-800 border-slate-200/80 text-[10px] font-semibold uppercase tracking-wider shadow-xs"
                      >
                        {mod.categoria}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Corpo do card */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    {/* Título do módulo */}
                    <h3 className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug group-hover:text-slate-800 transition-colors">
                      {mod.nome_template}
                    </h3>

                    {/* Tags em linha */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      {mod.categoria && (
                        <Badge
                          variant="outline"
                          className="bg-slate-100 text-slate-800 border-slate-300 text-[10px] font-semibold"
                        >
                          {mod.categoria}
                        </Badge>
                      )}
                      {mod.perfil_construtivo && (
                        <Badge
                          variant="outline"
                          className="bg-sky-50 text-sky-800 border-sky-300 text-[10px] font-semibold"
                          title="Perfil Construtivo"
                        >
                          ⚙️ {mod.perfil_construtivo}
                        </Badge>
                      )}
                      {mod.dimensoes && (
                        <Badge
                          variant="outline"
                          className="border-slate-200 bg-slate-50 text-slate-700 text-[10px] font-mono flex items-center gap-1"
                        >
                          <Ruler className="w-3 h-3 text-slate-700" />
                          {mod.dimensoes}
                        </Badge>
                      )}
                      {mod.material && (
                        <Badge
                          variant="outline"
                          className="border-slate-200 bg-slate-50 text-slate-700 text-[10px] flex items-center gap-1 max-w-[170px] truncate"
                          title={mod.material}
                        >
                          <Boxes className="w-3 h-3 text-slate-700" />
                          <span className="truncate">{mod.material}</span>
                        </Badge>
                      )}
                    </div>

                    {/* Resumo técnico com contadores reais de MDF e Ferragens */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-700 bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                        <span className="text-sm">🧱</span>
                        <span className="font-medium text-[11px] text-slate-800">
                          {pecasCount} peças de MDF
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-700 bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                        <span className="text-sm">🔩</span>
                        <span className="font-medium text-[11px] text-slate-800">
                          {ferragensCount} ferragens/acessórios
                        </span>
                      </div>
                    </div>

                    {mod.descricao && (
                      <p className="text-xs text-slate-500 line-clamp-2 pt-1">{mod.descricao}</p>
                    )}
                  </div>

                  {/* Ações no rodapé do card */}
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                    <Button
                      asChild
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-slate-900 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors"
                    >
                      <Link to={`/novo-orcamento?modulo=${mod.id}`}>
                        Usar no Orçamento
                        <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Detalhes ao Clicar no Card */}
      <Dialog
        open={detailModalId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailModalId(null)
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          {selectedDetailModule && (
            <>
              {/* Cabeçalho */}
              <DialogHeader className="border-b border-slate-100 pb-3">
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  {selectedDetailModule.imagem_url && (
                    <div className="w-full sm:w-32 h-24 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shrink-0 flex items-center justify-center">
                      <img
                        src={selectedDetailModule.imagem_url}
                        alt={selectedDetailModule.nome_template}
                        className="w-full h-full object-contain p-1"
                      />
                    </div>
                  )}
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                        {selectedDetailModule.codigo || 'S/ CÓDIGO'}
                      </span>
                      {selectedDetailModule.categoria && (
                        <Badge
                          variant="outline"
                          className="bg-slate-100 text-slate-700 border-slate-200 text-xs font-semibold"
                        >
                          {selectedDetailModule.categoria}
                        </Badge>
                      )}
                    </div>
                    <DialogTitle className="text-xl font-bold text-slate-900">
                      {selectedDetailModule.nome_template}
                    </DialogTitle>
                    {selectedDetailModule.descricao && (
                      <DialogDescription className="text-xs text-slate-500">
                        {selectedDetailModule.descricao}
                      </DialogDescription>
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
                      {selectedDetailModule.dimensoes && (
                        <span className="flex items-center gap-1 font-mono">
                          <Ruler className="w-3.5 h-3.5 text-slate-700" />
                          <strong>Dimensões:</strong> {selectedDetailModule.dimensoes}
                        </span>
                      )}
                      {selectedDetailModule.material && (
                        <span className="flex items-center gap-1">
                          <Boxes className="w-3.5 h-3.5 text-slate-700" />
                          <strong>Material:</strong> {selectedDetailModule.material}
                        </span>
                      )}
                      {selectedDetailModule.perfil_construtivo && (
                        <span className="flex items-center gap-1 font-semibold text-sky-800">
                          <strong>Perfil Construtivo:</strong>{' '}
                          {selectedDetailModule.perfil_construtivo}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </DialogHeader>

              {/* Corpo com seções Peças MDF e Ferragens */}
              <div className="flex-1 overflow-y-auto space-y-5 py-3 pr-1">
                {/* Seção 1 — Peças de MDF */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                      <Layers className="w-4 h-4 text-slate-700" />
                      Peças de MDF
                      <Badge variant="outline" className="text-[10px] ml-1 bg-white">
                        {Array.isArray(selectedDetailModule.pecas_mdf)
                          ? `${selectedDetailModule.pecas_mdf.length} itens`
                          : '0 itens'}
                      </Badge>
                    </h4>
                  </div>

                  {(() => {
                    const detailPecas =
                      (Array.isArray(selectedDetailModule.pecas_mdf) &&
                      selectedDetailModule.pecas_mdf.length > 0
                        ? selectedDetailModule.pecas_mdf
                        : Array.isArray((selectedDetailModule as any).composicao_mdf)
                          ? (selectedDetailModule as any).composicao_mdf
                          : null) ??
                      (Array.isArray(selectedDetailModule.pecas_mdf)
                        ? selectedDetailModule.pecas_mdf
                        : null)

                    return (
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3 w-12 text-center">Item (#)</th>
                              <th className="py-2.5 px-3 w-1/4">Código</th>
                              <th className="py-2.5 px-3">Descrição</th>
                              <th className="py-2.5 px-3 text-right w-16">Qtd</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {!detailPecas || detailPecas.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="py-6 text-center text-slate-400 italic">
                                  Nenhuma peça de MDF cadastrada para este módulo.
                                </td>
                              </tr>
                            ) : (
                              detailPecas.map((peca: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-50/80">
                                  <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                                    #{idx + 1}
                                  </td>
                                  <td className="py-2 px-3 font-mono font-semibold text-slate-900">
                                    {peca.codigo || `P-${idx + 1}`}
                                  </td>
                                  <td className="py-2 px-3">
                                    {peca.descricao || peca.nome || 'Peça MDF'}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                                    {peca.quantidade ?? peca.qtd ?? 1}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )
                  })()}
                </div>

                {/* Seção 2 — Ferragens */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                      <Wrench className="w-4 h-4 text-slate-700" />
                      Ferragens e Acessórios
                      <Badge variant="outline" className="text-[10px] ml-1 bg-white">
                        {Array.isArray(selectedDetailModule.ferragens)
                          ? `${selectedDetailModule.ferragens.length} itens`
                          : '0 itens'}
                      </Badge>
                    </h4>
                  </div>

                  {(() => {
                    const detailFerragens =
                      (Array.isArray(selectedDetailModule.ferragens) &&
                      selectedDetailModule.ferragens.length > 0
                        ? selectedDetailModule.ferragens
                        : Array.isArray((selectedDetailModule as any).ferragens_itens)
                          ? (selectedDetailModule as any).ferragens_itens
                          : null) ??
                      (Array.isArray(selectedDetailModule.ferragens)
                        ? selectedDetailModule.ferragens
                        : null)

                    return (
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3 w-1/4">Referência</th>
                              <th className="py-2.5 px-3">Descrição</th>
                              <th className="py-2.5 px-3 text-right w-16">Qtd</th>
                              <th className="py-2.5 px-3 text-center w-20">Unidade</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {!detailFerragens || detailFerragens.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="py-6 text-center text-slate-400 italic">
                                  Nenhuma ferragem cadastrada para este módulo.
                                </td>
                              </tr>
                            ) : (
                              detailFerragens.map((ferragem: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-50/80">
                                  <td className="py-2 px-3 font-mono font-semibold text-slate-900">
                                    {ferragem.item || ferragem.ref || `FERR-${idx + 1}`}
                                  </td>
                                  <td className="py-2 px-3">
                                    {ferragem.descricao || ferragem.item || 'Ferragem'}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                                    {ferragem.quantidade ?? ferragem.qtd ?? 1}
                                  </td>
                                  <td className="py-2 px-3 text-center text-slate-500 font-mono text-[11px]">
                                    {ferragem.unidade || 'un'}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )
                  })()}
                </div>
              </div>

              {/* Rodapé do modal de detalhes */}
              <DialogFooter className="pt-3 border-t border-slate-200 flex sm:justify-between items-center w-full gap-2">
                <Button
                  variant="destructive"
                  onClick={() => setDeleteConfirmId(selectedDetailModule.id)}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Excluir Módulo
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const mod = selectedDetailModule
                      setDetailModalId(null)
                      openEdit(mod)
                    }}
                    className="text-xs"
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
                    Editar Regras
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setDetailModalId(null)}
                    className="text-xs"
                  >
                    Fechar
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* AlertDialog de Confirmação de Exclusão */}
      <AlertDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900">
              Tem certeza que deseja excluir este módulo?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o módulo permanentemente da biblioteca de engenharia e não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={() => {
                if (deleteConfirmId) {
                  handleDelete(deleteConfirmId)
                }
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Sim, excluir módulo'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              <Label htmlFor="form_codigo" className="text-xs font-semibold">
                Código Técnico (ex: BAL0305A)
              </Label>
              <Input
                id="form_codigo"
                value={form.codigo}
                onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                placeholder="Ex.: BAL0305A"
                className="h-9 text-sm font-mono"
              />
            </div>

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

            <div className="space-y-1.5">
              <Label htmlFor="form_imagem_url" className="text-xs font-semibold">
                URL da Imagem de Capa (opcional)
              </Label>
              <Input
                id="form_imagem_url"
                value={form.imagem_url}
                onChange={(e) => setForm((f) => ({ ...f, imagem_url: e.target.value }))}
                placeholder="https://... ou caminho no storage"
                className="h-9 text-sm font-mono text-xs"
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

            {/* Campo Perfil Construtivo */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <Label
                htmlFor="form_perfil_construtivo"
                className="text-xs font-semibold text-slate-900"
              >
                Perfil Construtivo <span className="text-rose-500">*</span>
              </Label>
              <Select
                value={form.perfil_construtivo}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, perfil_construtivo: v as PerfilConstrutivo }))
                }
              >
                <SelectTrigger id="form_perfil_construtivo" className="h-9 text-xs bg-white">
                  <SelectValue placeholder="Selecione o perfil construtivo" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PERFIS_CONSTRUTIVOS_INFO) as PerfilConstrutivo[]).map((pk) => {
                    const info = PERFIS_CONSTRUTIVOS_INFO[pk]
                    return (
                      <SelectItem key={pk} value={pk} className="text-xs">
                        <div className="flex flex-col text-left py-0.5">
                          <span className="font-semibold">{info.label}</span>
                          <span className="text-[11px] text-slate-500">{info.descCurta}</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-500">
                {PERFIS_CONSTRUTIVOS_INFO[form.perfil_construtivo]?.descCurta} — Exemplo:{' '}
                <em>{PERFIS_CONSTRUTIVOS_INFO[form.perfil_construtivo]?.exemplo}</em>
              </p>
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
              className="bg-slate-700 hover:bg-slate-800 text-white"
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
              <FileUp className="w-5 h-5 text-slate-700" />
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
                    ? 'border-slate-600 bg-slate-100/70 scale-[0.99]'
                    : importFile
                      ? 'border-slate-500 bg-slate-100/30'
                      : 'border-slate-300 hover:border-slate-500 hover:bg-slate-50/80 bg-white'
                }`}
                onClick={() => {
                  const input = document.getElementById('pdf-file-input') as HTMLInputElement
                  input?.click()
                }}
              >
                <input
                  id="pdf-file-input"
                  type="file"
                  accept=".pdf, .png, .jpg, .jpeg"
                  className="hidden"
                  onChange={handleFileInputChange}
                />

                <div className="flex flex-col items-center justify-center space-y-3">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
                      importDragOver ? 'bg-slate-300 text-slate-900' : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    <FileUp className="w-7 h-7" />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {importDragOver
                        ? 'Solte para importar'
                        : 'Arraste o PDF ou a Imagem da Ficha Técnica (PDF, PNG ou JPG)'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Compatível com relatórios de engenharia Promob, CorteCloud e fichas técnicas
                      (PDF, PNG, JPG).
                    </p>
                  </div>

                  {importFile && (
                    <div
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-200 text-slate-900 text-xs font-semibold mt-2 border border-slate-400"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {importFile.name.toLowerCase().endsWith('.pdf') ? (
                        <FileText className="w-4 h-4 text-slate-800" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-slate-800" />
                      )}
                      <span>{importFile.name}</span>
                      <span className="text-[11px] text-slate-700 font-mono">
                        ({formatFileSize(importFile.size)})
                      </span>
                      <button
                        type="button"
                        onClick={handleResetImportFile}
                        className="text-slate-800 hover:text-rose-600 ml-1 p-0.5 rounded"
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
                  <div className="w-16 h-16 rounded-full border-4 border-slate-200 border-t-slate-700 animate-spin flex items-center justify-center" />
                  <Loader2 className="w-6 h-6 text-slate-700 absolute inset-0 m-auto animate-pulse" />
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
                    {importFile.name.toLowerCase().endsWith('.pdf') ? (
                      <FileText className="w-3.5 h-3.5 mr-1 text-slate-700" />
                    ) : (
                      <ImageIcon className="w-3.5 h-3.5 mr-1 text-slate-700" />
                    )}
                    {importFile.name}
                  </Badge>
                )}
              </div>
            )}

            {/* 3. Preview & Confirmation State */}
            {importResult && !importLoading && (
              <div className="space-y-5 animate-fade-in">
                {/* Header do preview com badge de sucesso */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 border border-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-slate-700 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-950">
                        Dados extraídos com sucesso do PDF!
                      </p>
                      <p className="text-[11px] text-slate-800">
                        Revise os campos abaixo antes de salvar na biblioteca.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetImportFile}
                    className="text-slate-900 hover:text-slate-950 text-xs h-8"
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

                  <div className="space-y-1 sm:col-span-2">
                    <Label
                      htmlFor="preview_perfil"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Perfil Construtivo
                    </Label>
                    <Select
                      value={previewPerfil}
                      onValueChange={(v) => setPreviewPerfil(v as PerfilConstrutivo)}
                    >
                      <SelectTrigger id="preview_perfil" className="h-9 text-xs bg-white">
                        <SelectValue placeholder="Selecione o perfil construtivo" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(PERFIS_CONSTRUTIVOS_INFO) as PerfilConstrutivo[]).map(
                          (pk) => (
                            <SelectItem key={pk} value={pk} className="text-xs">
                              {pk}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-slate-500">
                      {PERFIS_CONSTRUTIVOS_INFO[previewPerfil]?.descCurta}
                    </p>
                  </div>
                </div>

                {/* Tabela de Peças em MDF Extraídas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                      <Layers className="w-3.5 h-3.5 text-slate-700" />
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
                                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
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
                      <Wrench className="w-3.5 h-3.5 text-slate-700" />
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
                                <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
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
                className="bg-slate-700 hover:bg-slate-800 text-white font-semibold"
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
