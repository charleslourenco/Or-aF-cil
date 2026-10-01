import React, { useState, useRef } from 'react'
import {
  UploadCloud,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Info,
  Image as ImageIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface UploadedFileState {
  file: File | null
  previewUrl: string | null
  name: string
  sizeFormatted: string
  isPdf: boolean
}

interface CustomerDropzoneProps {
  /** Múltiplas imagens enviadas pelo cliente. */
  uploadedFiles: UploadedFileState[]
  onFilesSelect: (files: UploadedFileState[] | null) => void
  error?: string | null
  onClearError?: () => void
  multiple?: boolean
  maxFiles?: number
}

const PERSPECTIVE_LABELS = [
  { index: 0, label: 'Frente' },
  { index: 1, label: 'Interno' },
  { index: 2, label: 'Detalhe' },
  { index: 3, label: 'Detalhe 2' },
  { index: 4, label: 'Detalhe 3' },
]

export const CustomerDropzone: React.FC<CustomerDropzoneProps> = ({
  uploadedFiles,
  onFilesSelect,
  error,
  onClearError,
  multiple = true,
  maxFiles = 5,
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [internalError, setInternalError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const buildFileState = (file: File): UploadedFileState | null => {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf']
    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'

    if (!validTypes.includes(file.type) && !file.name.match(/\.(png|jpe?g|webp|pdf)$/i)) {
      setInternalError(`Formato não suportado: ${file.name}. Use PNG, JPG, WEBP ou PDF.`)
      return null
    }

    if (file.size > 25 * 1024 * 1024) {
      setInternalError(`Arquivo muito grande: ${file.name}. O limite máximo é de 25MB.`)
      return null
    }

    let previewUrl: string | null = null
    if (isImage) {
      previewUrl = URL.createObjectURL(file)
    }

    return {
      file,
      previewUrl,
      name: file.name,
      sizeFormatted: formatFileSize(file.size),
      isPdf,
    }
  }

  const handleProcessFiles = (fileList: FileList | File[]) => {
    setInternalError(null)
    if (onClearError) onClearError()

    const incoming = Array.from(fileList)
    const valid: UploadedFileState[] = []

    for (const file of incoming) {
      const state = buildFileState(file)
      if (state) valid.push(state)
    }

    if (valid.length > 0) {
      if (!multiple) {
        onFilesSelect([valid[0]])
        setActiveIndex(0)
      } else {
        // Acumula os novos arquivos mantendo os existentes, respeitando o limite maxFiles (padrão 5)
        const combined = [...uploadedFiles, ...valid].slice(0, maxFiles)
        onFilesSelect(combined)
        setActiveIndex(Math.max(0, combined.length - 1))
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFiles(e.dataTransfer.files)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessFiles(e.target.files)
    }
  }

  const handleRemoveAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    uploadedFiles.forEach((f) => {
      if (f.previewUrl && f.previewUrl.startsWith('blob:')) URL.revokeObjectURL(f.previewUrl)
    })
    onFilesSelect(null)
    setActiveIndex(0)
    setInternalError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemoveOne = (e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    const target = uploadedFiles[index]
    if (target?.previewUrl && target.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(target.previewUrl)
    }
    const next = uploadedFiles.filter((_, idx) => idx !== index)
    onFilesSelect(next.length > 0 ? next : null)
    setActiveIndex((prev) => (prev >= next.length ? Math.max(0, next.length - 1) : prev))
  }

  const handleAddMore = (e: React.MouseEvent) => {
    e.stopPropagation()
    fileInputRef.current?.click()
  }

  // Sample quick test image loader (múltiplas perspectivas)
  const handleLoadSample = (e: React.MouseEvent) => {
    e.stopPropagation()
    setInternalError(null)
    if (onClearError) onClearError()

    const samples: UploadedFileState[] = [
      {
        file: null,
        previewUrl: 'https://img.usecurling.com/p/800/600?q=wardrobe%20closet%20wood',
        name: 'frente_closet.jpg',
        sizeFormatted: '1.4 MB',
        isPdf: false,
      },
      {
        file: null,
        previewUrl: 'https://img.usecurling.com/p/600/600?q=wardrobe%20interior%20shelf',
        name: 'interno_prateleiras.jpg',
        sizeFormatted: '1.1 MB',
        isPdf: false,
      },
      {
        file: null,
        previewUrl: 'https://img.usecurling.com/p/600/600?q=wood%20drawer%20detail',
        name: 'detalhe_gaveta.jpg',
        sizeFormatted: '0.9 MB',
        isPdf: false,
      },
    ]

    onFilesSelect(samples)
    setActiveIndex(0)
  }

  const activeError = internalError || error
  const hasFiles = uploadedFiles.length > 0
  const mainFile = hasFiles ? uploadedFiles[Math.min(activeIndex, uploadedFiles.length - 1)] : null

  return (
    <div className="flex flex-col h-full">
      {/* Hidden native input — aceita múltiplos arquivos quando multiple = true */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
        multiple={multiple}
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Main Dropzone Box */}
      <div
        onClick={() => !hasFiles && fileInputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative rounded-2xl p-6 transition-all duration-200 flex flex-col items-center justify-center text-center select-none',
          'border-2 border-dashed',
          !hasFiles &&
            !isDragOver &&
            !activeError &&
            'border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-600 hover:shadow-md cursor-pointer min-h-[280px]',
          isDragOver &&
            'border-slate-600 bg-slate-100/70 shadow-lg scale-[1.01] ring-4 ring-slate-600/20 cursor-pointer',
          hasFiles && 'border-slate-600/50 bg-white cursor-default shadow-sm',
          activeError && 'border-rose-500 bg-rose-50/40 animate-[shake_0.3s_ease-in-out]',
        )}
      >
        {hasFiles && mainFile ? (
          <div className="w-full h-full flex flex-col animate-fade-in">
            {/* Top Bar */}
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-slate-600" />
                <span className="text-xs font-semibold text-slate-800 uppercase tracking-wide">
                  {uploadedFiles.length}{' '}
                  {uploadedFiles.length === 1 ? 'imagem carregada' : 'imagens carregadas'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddMore}
                  className="h-8 px-2.5 text-xs text-slate-800 hover:text-slate-900 hover:bg-slate-100 font-medium rounded-lg"
                >
                  <UploadCloud className="w-3.5 h-3.5 mr-1" />
                  Adicionar mais
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveAll}
                  className="h-8 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-medium rounded-lg"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Limpar
                </Button>
              </div>
            </div>

            {/* Preview principal em destaque */}
            <div className="py-4 w-full">
              <div className="relative group w-full rounded-xl overflow-hidden shadow-md border border-slate-200 bg-slate-100 flex items-center justify-center">
                {mainFile.previewUrl ? (
                  <img
                    src={mainFile.previewUrl}
                    alt={`Preview ${activeIndex + 1}`}
                    className="w-full max-h-[320px] object-contain transition-transform group-hover:scale-105 duration-300"
                  />
                ) : mainFile.isPdf ? (
                  <div className="w-24 h-28 rounded-xl bg-rose-50 border border-rose-200 flex flex-col items-center justify-center text-rose-600 shadow-sm my-6">
                    <FileText className="w-10 h-10" />
                    <span className="text-[11px] font-bold mt-1">PDF DOC</span>
                  </div>
                ) : (
                  <div className="w-24 h-28 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-600 shadow-sm my-6">
                    <ImageIcon className="w-10 h-10" />
                    <span className="text-[11px] font-bold mt-1">IMAGEM</span>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3 pointer-events-none">
                  <span className="text-white text-[11px] font-medium flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5" />
                    {PERSPECTIVE_LABELS[activeIndex]?.label ||
                      `Perspectiva ${activeIndex + 1}`} •{' '}
                    {mainFile.name}
                  </span>
                </div>

                {/* Badge de índice */}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold">
                  {activeIndex + 1} / {uploadedFiles.length}
                </div>
              </div>

              {/* File info do ativo */}
              <div className="mt-2 text-center">
                <p className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">
                    {PERSPECTIVE_LABELS[activeIndex]?.label || `Perspectiva ${activeIndex + 1}`}
                  </span>
                  {' • '}
                  {mainFile.sizeFormatted}
                </p>
              </div>
            </div>

            {/* Grid de thumbnails */}
            {uploadedFiles.length > 1 && (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 pb-3">
                {uploadedFiles.map((file, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveIndex(idx)
                    }}
                    className={cn(
                      'relative aspect-square rounded-lg overflow-hidden border-2 transition-all group/thumb',
                      idx === activeIndex
                        ? 'border-slate-600 ring-2 ring-slate-600/30 scale-[1.02]'
                        : 'border-slate-200 hover:border-slate-500 opacity-80 hover:opacity-100',
                    )}
                    title={`${PERSPECTIVE_LABELS[idx]?.label || `Perspectiva ${idx + 1}`} — ${file.name}`}
                  >
                    {file.previewUrl ? (
                      <img
                        src={file.previewUrl}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-500">
                        <FileText className="w-5 h-5" />
                      </div>
                    )}

                    {/* Label da perspectiva */}
                    <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[9px] font-semibold py-0.5 px-1 truncate">
                      {PERSPECTIVE_LABELS[idx]?.label || `P${idx + 1}`}
                    </span>

                    {/* Remover individual */}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => handleRemoveOne(e, idx)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleRemoveOne(e as unknown as React.MouseEvent, idx)
                        }
                      }}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity hover:bg-rose-700 cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5" />
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Ready Badge Footer */}
            <div className="w-full pt-2 flex items-center justify-center gap-1.5 text-xs text-slate-800 bg-slate-100 py-2 rounded-lg border border-slate-200 font-medium">
              <CheckCircle2 className="w-4 h-4 text-slate-700" />
              <span>
                {uploadedFiles.length}{' '}
                {uploadedFiles.length === 1 ? 'perspectiva pronta' : 'perspectivas prontas'} para
                análise da IA
              </span>
            </div>
          </div>
        ) : isDragOver ? (
          <div className="flex flex-col items-center justify-center text-slate-800 animate-pulse py-10">
            <div className="w-16 h-16 rounded-2xl bg-slate-200 flex items-center justify-center mb-3">
              <UploadCloud className="w-9 h-9 text-slate-700" />
            </div>
            <h4 className="text-base font-bold">Solte para enviar</h4>
            <p className="text-xs text-slate-700 mt-1">
              Processando imagens do projeto do cliente...
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-600 py-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4 text-slate-700 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-8 h-8" />
            </div>

            <h4 className="text-sm sm:text-base font-semibold text-slate-900 mb-1">
              Arraste as fotos/projeto ou clique para fazer upload
            </h4>

            <p className="text-xs text-slate-500 mb-3 max-w-[280px]">
              Envie múltiplas perspectivas (frente, interno, detalhes) para a IA identificar o
              módulo automaticamente
            </p>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium mb-4">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              Formatos aceitos: PNG, JPG, WEBP, PDF (máx. 25MB cada)
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs font-semibold border-slate-300 text-slate-800 hover:bg-slate-100 hover:text-slate-900 rounded-lg shadow-2xs"
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
            >
              Procurar no Computador
            </Button>

            <button
              type="button"
              onClick={handleLoadSample}
              className="mt-3 text-[11px] text-slate-400 hover:text-slate-700 underline font-medium transition-colors inline-flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              Usar 3 fotos de exemplo para teste rápido
            </button>
          </div>
        )}
      </div>

      {activeError && (
        <div className="mt-2.5 flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium animate-fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
          <span>{activeError}</span>
        </div>
      )}
    </div>
  )
}
