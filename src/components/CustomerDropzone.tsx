import React, { useState, useRef } from 'react'
import {
  UploadCloud,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
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
  uploadedFile: UploadedFileState | null
  onFileSelect: (fileState: UploadedFileState | null) => void
  error?: string | null
  onClearError?: () => void
}

export const CustomerDropzone: React.FC<CustomerDropzoneProps> = ({
  uploadedFile,
  onFileSelect,
  error,
  onClearError,
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [internalError, setInternalError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const handleProcessFile = (file: File) => {
    setInternalError(null)
    if (onClearError) onClearError()

    // Libera a URL de preview anterior (blob) quando o arquivo é substituído,
    // evitando vazamento de memória.
    if (uploadedFile?.previewUrl && uploadedFile.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(uploadedFile.previewUrl)
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf']
    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'

    if (!validTypes.includes(file.type) && !file.name.match(/\.(png|jpe?g|webp|pdf)$/i)) {
      setInternalError('Formato de arquivo não suportado. Use PNG, JPG ou PDF.')
      return
    }

    if (file.size > 25 * 1024 * 1024) {
      setInternalError('Arquivo muito grande. O limite máximo é de 25MB.')
      return
    }

    let previewUrl: string | null = null
    if (isImage) {
      previewUrl = URL.createObjectURL(file)
    }

    onFileSelect({
      file,
      previewUrl,
      name: file.name,
      sizeFormatted: formatFileSize(file.size),
      isPdf,
    })
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
      handleProcessFile(e.dataTransfer.files[0])
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessFile(e.target.files[0])
    }
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (uploadedFile?.previewUrl) {
      URL.revokeObjectURL(uploadedFile.previewUrl)
    }
    onFileSelect(null)
    setInternalError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Sample quick test image loader
  const handleLoadSample = (e: React.MouseEvent) => {
    e.stopPropagation()
    setInternalError(null)
    if (onClearError) onClearError()
    onFileSelect({
      file: null,
      previewUrl: 'https://img.usecurling.com/p/800/600?q=wardrobe%20closet%20wood',
      name: 'croqui_projeto_cliente_quarto.jpg',
      sizeFormatted: '1.4 MB',
      isPdf: false,
    })
  }

  const activeError = internalError || error

  return (
    <div className="flex flex-col h-full">
      {/* Hidden native input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Main Dropzone Box */}
      <div
        onClick={() => !uploadedFile && fileInputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative flex-1 min-h-[280px] rounded-2xl p-6 transition-all duration-200 flex flex-col items-center justify-center text-center cursor-pointer select-none',
          'border-2 border-dashed',
          !uploadedFile &&
            !isDragOver &&
            !activeError &&
            'border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-emerald-500 hover:shadow-md',
          isDragOver &&
            'border-emerald-500 bg-emerald-50/70 shadow-lg scale-[1.01] ring-4 ring-emerald-500/20',
          uploadedFile && 'border-emerald-500/50 bg-white cursor-default shadow-sm',
          activeError && 'border-rose-500 bg-rose-50/40 animate-[shake_0.3s_ease-in-out]',
        )}
      >
        {/* With File state */}
        {uploadedFile ? (
          <div className="w-full h-full flex flex-col items-center justify-between animate-fade-in">
            {/* Top Bar with Status and Remove Button */}
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                  Arquivo Carregado
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                className="h-8 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-medium rounded-lg"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Remover
              </Button>
            </div>

            {/* Preview Area */}
            <div className="my-auto py-4 w-full flex flex-col items-center justify-center">
              {uploadedFile.previewUrl ? (
                <div className="relative group w-full h-full min-h-[240px] rounded-xl overflow-hidden shadow-md border border-slate-200 bg-slate-100 flex items-center justify-center">
                  <img
                    src={uploadedFile.previewUrl}
                    alt="Preview do projeto do cliente"
                    className="w-full h-full max-h-[340px] object-contain transition-transform group-hover:scale-105 duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3 pointer-events-none">
                    <span className="text-white text-[11px] font-medium flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5" /> Croqui / Foto Original
                    </span>
                  </div>
                </div>
              ) : uploadedFile.isPdf ? (
                <div className="w-24 h-28 rounded-xl bg-rose-50 border border-rose-200 flex flex-col items-center justify-center text-rose-600 shadow-sm">
                  <FileText className="w-10 h-10" />
                  <span className="text-[11px] font-bold mt-1">PDF DOC</span>
                </div>
              ) : (
                <div className="w-24 h-28 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-600 shadow-sm">
                  <ImageIcon className="w-10 h-10" />
                  <span className="text-[11px] font-bold mt-1">IMAGEM</span>
                </div>
              )}

              {/* File Info */}
              <div className="mt-3 text-center max-w-full px-2">
                <p
                  className="text-sm font-semibold text-slate-800 truncate max-w-[260px] mx-auto"
                  title={uploadedFile.name}
                >
                  {uploadedFile.name}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tamanho: {uploadedFile.sizeFormatted} • Pronto para análise
                </p>
              </div>
            </div>

            {/* Ready Badge Footer */}
            <div className="w-full pt-2 flex items-center justify-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 py-2 rounded-lg border border-emerald-100 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Pronto para comparar com a biblioteca</span>
            </div>
          </div>
        ) : isDragOver ? (
          /* Drag Over Active State */
          <div className="flex flex-col items-center justify-center text-emerald-700 animate-pulse">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mb-3">
              <UploadCloud className="w-9 h-9 text-emerald-600" />
            </div>
            <h4 className="text-base font-bold">Solte para enviar</h4>
            <p className="text-xs text-emerald-600 mt-1">
              Processando arquivo de projeto do cliente...
            </p>
          </div>
        ) : (
          /* Default Empty State */
          <div className="flex flex-col items-center justify-center text-slate-600 py-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4 text-emerald-600 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-8 h-8" />
            </div>

            <h4 className="text-sm sm:text-base font-semibold text-slate-900 mb-1">
              Arraste a foto/projeto ou clique para fazer upload
            </h4>

            <p className="text-xs text-slate-500 mb-3 max-w-[260px]">
              Envie a foto do ambiente, desenho à mão ou projeto executivo do cliente
            </p>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium mb-4">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              Formatos aceitos: PNG, JPG, PDF (máx. 25MB)
            </div>

            {/* Quick action button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs font-semibold border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg shadow-2xs"
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
            >
              Procurar no Computador
            </Button>

            {/* Quick Sample trigger */}
            <button
              type="button"
              onClick={handleLoadSample}
              className="mt-3 text-[11px] text-slate-400 hover:text-emerald-600 underline font-medium transition-colors"
            >
              Usar foto de exemplo para teste rápido
            </button>
          </div>
        )}
      </div>

      {/* Error Message */}
      {activeError && (
        <div className="mt-2.5 flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium animate-fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
          <span>{activeError}</span>
        </div>
      )}
    </div>
  )
}
