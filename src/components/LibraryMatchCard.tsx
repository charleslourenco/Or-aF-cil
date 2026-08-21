import React, { useState } from 'react'
import {
  CheckCircle,
  HelpCircle,
  Maximize2,
  Box,
  Layers,
  Ruler,
  FileCheck,
  Loader2,
  Eye,
  Sparkles,
  Repeat2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TemplateEngenharia } from '@/services/templates'
import { cn } from '@/lib/utils'

interface LibraryMatchCardProps {
  /** Módulo selecionado dinamicamente (do Supabase). `null` = estado padrão. */
  selectedModule: TemplateEngenharia | null
  /** Quando true, exibe o esqueleto de análise da IA em vez do conteúdo. */
  isAnalyzing?: boolean
  onOpenLibraryModal?: () => void
  /** Lista de módulos disponíveis para o fallback manual "Trocar Módulo". */
  modulosDisponiveis?: TemplateEngenharia[]
  /** Id do módulo atualmente selecionado (para o select de troca). */
  selectedModuleId?: string
  /** Callback disparado ao escolher manualmente outro módulo. */
  onModuleChange?: (id: string) => void
  /** Dimensões reais (mm) opcionais passadas ao componente. */
  dimensoes?: { largura: number; altura: number; profundidade: number }
  /** Justificativa retornada pela IA (GPT-4o Vision) sobre o match do módulo. */
  justificativa?: string | null
}

export const LibraryMatchCard: React.FC<LibraryMatchCardProps> = ({
  selectedModule,
  isAnalyzing = false,
  onOpenLibraryModal,
  modulosDisponiveis = [],
  selectedModuleId = '',
  onModuleChange,
  dimensoes = { largura: 1800, altura: 2200, profundidade: 600 },
  justificativa = null,
}) => {
  const isMatched = !!selectedModule
  const [showSwap, setShowSwap] = useState(false)

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 p-6 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-2 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <Box className="w-4 h-4 text-slate-700" />
              Módulo Identificado na Biblioteca
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Correspondência padrão cadastrada para corte e orçamentação
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Botão de fallback: Trocar Módulo (manual) */}
          {onModuleChange && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSwap((v) => !v)}
              className={cn(
                'h-8 px-2.5 text-[11px] font-semibold rounded-full border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs',
                showSwap && 'bg-slate-100 border-slate-400 text-slate-800',
              )}
            >
              <Repeat2 className="w-3.5 h-3.5 mr-1" />
              Trocar Módulo
            </Button>
          )}

          {/* Match Status Badge */}
          {isAnalyzing ? (
            <Badge
              variant="outline"
              className="bg-violet-50 text-violet-700 border-violet-300 font-semibold text-xs px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs animate-fade-in"
            >
              <Loader2 className="w-3.5 h-3.5 text-violet-600 animate-spin" />
              Analisando...
            </Badge>
          ) : isMatched ? (
            <Badge
              variant="outline"
              className="bg-slate-100 text-slate-800 border-slate-400 font-semibold text-xs px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs animate-fade-in"
            >
              <CheckCircle className="w-3.5 h-3.5 text-slate-700" />✓ Match Encontrado
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-slate-100 text-slate-500 border-slate-200 font-medium text-xs px-2.5 py-1 rounded-full"
            >
              Aguardando seleção
            </Badge>
          )}
        </div>
      </div>

      {/* Select inline de "Trocar Módulo" — força a escolha manual de outro gabarito. */}
      {showSwap && onModuleChange && (
        <div className="flex items-center gap-2 px-3 py-2.5 mt-3 mb-1 bg-slate-100/60 border border-slate-300 rounded-xl animate-fade-in">
          <Box className="w-4 h-4 text-slate-700 shrink-0" />
          <span className="text-[11px] font-semibold text-slate-900 shrink-0 hidden sm:inline">
            Selecionar manualmente:
          </span>
          <Select
            value={selectedModuleId}
            onValueChange={(v) => {
              onModuleChange(v)
              setShowSwap(false)
            }}
          >
            <SelectTrigger className="h-9 rounded-lg text-xs flex-1 min-w-0 bg-white border-slate-300">
              <SelectValue placeholder="Escolha outro gabarito..." />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {modulosDisponiveis.length === 0 && (
                <div className="px-3 py-2 text-xs text-slate-500">Nenhum módulo disponível.</div>
              )}
              {modulosDisponiveis.map((modulo) => (
                <SelectItem key={modulo.id} value={modulo.id}>
                  {modulo.nome_template}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* ESTADO DE ANÁLISE — esqueleto pulsante da IA */}
      {isAnalyzing ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8 px-4">
          {/* Ícone girando com halo */}
          <div className="relative w-20 h-20 flex items-center justify-center mb-5">
            <div className="absolute inset-0 rounded-full bg-violet-100 animate-ping opacity-60" />
            <div className="absolute inset-2 rounded-full bg-violet-200/60 animate-pulse" />
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-slate-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Eye className="w-7 h-7 text-white" />
            </div>
          </div>

          {/* Texto brilhante */}
          <h4 className="text-sm sm:text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 via-slate-600 to-violet-600 bg-[length:200%_auto] animate-[shimmer_2s_linear_infinite] flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-violet-500" />
            👁️ IA analisando perspectivas e buscando gabarito na biblioteca...
          </h4>

          <p className="text-xs text-slate-500 mt-2 max-w-[280px]">
            Cruzando dimensões, materiais e perspectivas enviadas com os módulos cadastrados.
          </p>

          {/* Skeleton do conteúdo futuro */}
          <div className="w-full mt-6 space-y-3">
            <div className="h-28 rounded-xl bg-slate-100 animate-pulse" />
            <div className="flex gap-2">
              <div className="h-3 flex-1 rounded-full bg-slate-100 animate-pulse" />
              <div className="h-3 flex-1 rounded-full bg-slate-100 animate-pulse" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="h-12 rounded-lg bg-slate-100 animate-pulse" />
              <div className="h-12 rounded-lg bg-slate-100 animate-pulse" />
            </div>
          </div>
        </div>
      ) : isMatched ? (
        <div className="flex-1 flex flex-col justify-between space-y-4 pt-4 animate-fade-in">
          {/* Visual Representation — imagem real do módulo ou fallback limpo */}
          <div className="w-full">
            {selectedModule.imagem_url ? (
              <img
                src={selectedModule.imagem_url}
                alt={selectedModule.nome_template || 'Módulo'}
                className="w-full h-64 object-contain bg-slate-50 rounded-xl border border-slate-200"
              />
            ) : (
              <div className="w-full h-64 flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400 gap-2">
                <Box className="w-10 h-10" />
                <span className="text-xs font-medium">Sem imagem técnica</span>
                {selectedModule?.codigo && (
                  <span className="text-[10px] font-mono text-slate-300">
                    {selectedModule.codigo}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Nome do template selecionado no topo da área de detalhes */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-base font-bold text-slate-900">
                {selectedModule?.nome_template}
              </h4>
              {selectedModule?.categoria && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                  {selectedModule.categoria}
                </span>
              )}
            </div>

            {selectedModule?.descricao && (
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                {selectedModule.descricao}
              </p>
            )}

            {/* Balão de justificativa retornada pela IA (GPT-4o Vision) */}
            {justificativa && (
              <div className="mt-2.5 flex items-start gap-2 p-3 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 text-xs leading-relaxed animate-fade-in">
                <Sparkles className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
                <span>
                  <span className="font-bold">Justificativa da IA: </span>
                  {justificativa}
                </span>
              </div>
            )}
          </div>

          {/* Technical Specs Pill Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 text-slate-700">
              <Ruler className="w-4 h-4 text-slate-700 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                  Dimensões (AxLxP)
                </span>
                <span className="font-mono font-bold text-slate-800 text-[11px] truncate block">
                  {selectedModule?.dimensoes || '—'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 text-slate-700">
              <Layers className="w-4 h-4 text-slate-700 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                  Material Padrão
                </span>
                <span
                  className="font-medium text-slate-800 text-[11px] truncate block"
                  title={selectedModule?.material || ''}
                >
                  {selectedModule?.material || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick note on parts generation */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-100/70 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium">
            <FileCheck className="w-4 h-4 text-slate-700 shrink-0" />
            <span>Inclui plano de corte paramétrico e cálculo automático de fita de borda.</span>
          </div>

          {onOpenLibraryModal && (
            <button
              type="button"
              onClick={onOpenLibraryModal}
              className="self-start inline-flex items-center gap-1 text-[11px] font-semibold text-slate-800 hover:text-slate-900 transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Ver biblioteca completa
            </button>
          )}
        </div>
      ) : (
        /* Unmatched / Placeholder state */
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6 px-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
            <HelpCircle className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-700">
            Selecione um módulo para identificar o match
          </h4>
          <p className="text-xs text-slate-400 max-w-[260px] mt-1">
            Escolha um módulo no cabeçalho acima para carregar os parâmetros técnicos da biblioteca
            de engenharia.
          </p>
        </div>
      )}
    </div>
  )
}
