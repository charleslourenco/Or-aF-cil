import React from 'react'
import { CheckCircle, HelpCircle, Maximize2, Box, Layers, Ruler, FileCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ModuleBlueprint } from './ModuleBlueprint'
import { TemplateEngenharia, normalizeIconType } from '@/services/templates'
import { cn } from '@/lib/utils'

interface LibraryMatchCardProps {
  /** Módulo selecionado dinamicamente (do Supabase). `null` = estado padrão. */
  selectedModule: TemplateEngenharia | null
  onOpenLibraryModal?: () => void
}

export const LibraryMatchCard: React.FC<LibraryMatchCardProps> = ({
  selectedModule,
  onOpenLibraryModal,
}) => {
  const isMatched = !!selectedModule

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 p-6 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-2 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <Box className="w-4 h-4 text-emerald-600" />
              Módulo Identificado na Biblioteca
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Correspondência padrão cadastrada para corte e orçamentação
          </p>
        </div>

        {/* Match Status Badge */}
        {isMatched ? (
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold text-xs px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 shadow-2xs animate-fade-in"
          >
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />✓ Match Encontrado
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="bg-slate-100 text-slate-500 border-slate-200 font-medium text-xs px-2.5 py-1 rounded-full shrink-0"
          >
            Aguardando seleção
          </Badge>
        )}
      </div>

      {isMatched ? (
        <div className="flex-1 flex flex-col justify-between space-y-4 pt-4 animate-fade-in">
          {/* Visual Blueprint Representation — placeholder visual do módulo base */}
          <div className="w-full">
            <ModuleBlueprint
              type={normalizeIconType(selectedModule?.icon_type)}
              className="shadow-inner"
            />
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
          </div>

          {/* Technical Specs Pill Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 text-slate-700">
              <Ruler className="w-4 h-4 text-emerald-600 shrink-0" />
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
              <Layers className="w-4 h-4 text-emerald-600 shrink-0" />
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
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50/70 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-medium">
            <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Inclui plano de corte paramétrico e cálculo automático de fita de borda.</span>
          </div>

          {onOpenLibraryModal && (
            <button
              type="button"
              onClick={onOpenLibraryModal}
              className="self-start inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
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
