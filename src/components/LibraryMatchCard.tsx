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
  DoorClosed,
  FolderMinus,
  Grid3X3,
  Shirt,
  Footprints,
  SlidersHorizontal,
  Columns,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TemplateEngenharia,
  PerfilConstrutivo,
  PERFIS_CONSTRUTIVOS_INFO,
} from '@/services/templates'
import { type ModuloComposicao, type ComposicaoCorpo, type TipoAberturaPorta } from '@/lib/pricing'
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
  /** Dimensões estimadas da foto retornadas pela IA */
  dimensoesEstimadas?: { largura: number; altura: number; profundidade: number } | null
  /** Dimensões originais do módulo da biblioteca */
  dimensoesOriginais?: { largura: number; altura: number; profundidade: number } | null
  /** Fator de escala calculado entre a foto estimada e o gabarito original */
  fatorEscala?: number | null
  /** Indicador se o módulo atual é um módulo personalizado/customizado pela IA */
  isCustomModule?: boolean
  /** Justificativa retornada pela IA (GPT-4o Vision) sobre o match do módulo. */
  justificativa?: string | null
  /** Decomposição de módulos (portas, gavetas, interior) */
  composicao?: ModuloComposicao
  /** Callback ao editar a composição do móvel */
  onComposicaoChange?: (updater: (prev: ModuloComposicao) => ModuloComposicao) => void
  /** Texto descritivo de adaptações retornado pela IA */
  adaptacoes?: string | null
  /** Sugestão de perfil de construção da IA */
  perfilSugeridoIA?: string | null
}

export const LibraryMatchCard: React.FC<LibraryMatchCardProps> = ({
  selectedModule,
  isAnalyzing = false,
  onOpenLibraryModal,
  modulosDisponiveis = [],
  selectedModuleId = '',
  onModuleChange,
  dimensoes = { largura: 1800, altura: 2200, profundidade: 600 },
  dimensoesEstimadas = null,
  dimensoesOriginais = null,
  fatorEscala = null,
  isCustomModule = false,
  justificativa = null,
  composicao,
  onComposicaoChange,
  adaptacoes = null,
  perfilSugeridoIA = null,
}) => {
  const isMatched = !!selectedModule
  const [showSwap, setShowSwap] = useState(false)

  // Perfil efetivo em uso no cálculo
  const perfilEfetivo: PerfilConstrutivo =
    (composicao?.perfilConstrutivo as PerfilConstrutivo) ||
    (selectedModule?.perfil_construtivo as PerfilConstrutivo) ||
    (composicao?.semTamponamento ? 'Caixa Simples' : 'Fechado Envelopado')

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
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                ⚙️ {perfilEfetivo}
              </span>
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

            {/* Balão com adaptações e interior identificado pela IA */}
            {adaptacoes && (
              <div className="mt-2 flex items-start gap-2 p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-blue-950 text-xs leading-relaxed animate-fade-in">
                <SlidersHorizontal className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-blue-900">Composição & Interior Detectado: </span>
                  <span>{adaptacoes}</span>
                </div>
              </div>
            )}
          </div>

          {/* Technical Specs Pill Grid & Comparação Lado a Lado de Dimensões / Fator de Escala */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            {/* Comparação Dimensões Originais vs Dimensões Estimadas da Foto */}
            {(dimensoesOriginais || selectedModule?.dimensoes) &&
              (dimensoesEstimadas || dimensoes) && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Ruler className="w-3.5 h-3.5 text-slate-700" />
                      Comparação de Dimensões (Original vs Estimada)
                    </span>
                    {fatorEscala !== null && fatorEscala !== undefined && fatorEscala > 0 && (
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full',
                          fatorEscala > 1.05
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : fatorEscala < 0.95
                              ? 'bg-blue-50 text-blue-800 border-blue-300'
                              : 'bg-slate-100 text-slate-700 border-slate-300',
                        )}
                      >
                        Fator: {fatorEscala.toFixed(2)}x
                        {fatorEscala > 1.0
                          ? ` (+${Math.round((fatorEscala - 1) * 100)}%)`
                          : fatorEscala < 1.0
                            ? ` (${Math.round((fatorEscala - 1) * 100)}%)`
                            : ' (100%)'}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                        Dimensões Originais (Biblioteca)
                      </span>
                      <span className="font-mono font-bold text-slate-800 text-[11px] block mt-0.5">
                        {dimensoesOriginais
                          ? `${dimensoesOriginais.largura}L × ${dimensoesOriginais.altura}A × ${dimensoesOriginais.profundidade}P mm`
                          : selectedModule?.dimensoes || '—'}
                      </span>
                    </div>

                    <div className="p-2 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                        Dimensões Estimadas (Foto)
                      </span>
                      <span className="font-mono font-bold text-slate-800 text-[11px] block mt-0.5">
                        {dimensoesEstimadas
                          ? `${dimensoesEstimadas.largura}L × ${dimensoesEstimadas.altura}A × ${dimensoesEstimadas.profundidade}P mm`
                          : `${dimensoes.largura}L × ${dimensoes.altura}A × ${dimensoes.profundidade}P mm`}
                      </span>
                    </div>
                  </div>

                  {fatorEscala !== null &&
                    fatorEscala !== undefined &&
                    fatorEscala > 0 &&
                    Math.abs(fatorEscala - 1) >= 0.02 && (
                      <p className="text-[11px] text-slate-600 leading-snug">
                        📐 <strong>Fator de escala aplicado:</strong> {fatorEscala.toFixed(2)}x —
                        módulo{' '}
                        {fatorEscala > 1
                          ? `${Math.round((fatorEscala - 1) * 100)}% maior que o padrão (consumo de MDF e fita ajustado proporcionalmente).`
                          : `${Math.round((1 - fatorEscala) * 100)}% menor que o padrão (consumo de MDF e fita ajustado proporcionalmente).`}
                      </p>
                    )}
                </div>
              )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 text-slate-700">
                <Ruler className="w-4 h-4 text-slate-700 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    Gabarito Padrão
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
          </div>

          {/* DECOMPOSIÇÃO ESTRUTURADA DE MÓDULO (PORTAS, GAVETAS, INTERIOR & CORPOS) */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-slate-700" />
                Decomposição do Móvel & Interior
              </span>
              <Badge
                variant="outline"
                className="bg-white text-[10px] text-slate-600 border-slate-300 font-medium"
              >
                Recalcula BOM na hora
              </Badge>
            </div>

            {/* Linha 1: Divisórias (Corpos) e Portas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Divisórias Verticais (Corpos) */}
              <div className="space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 uppercase">
                    <Columns className="w-3.5 h-3.5 text-slate-600" />
                    Divisórias (Corpos)
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-slate-100 text-slate-700 font-mono"
                  >
                    {(composicao?.divisorias?.qtd ?? 0) + 1}{' '}
                    {(composicao?.divisorias?.qtd ?? 0) + 1 === 1 ? 'corpo' : 'corpos'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20">
                    <Label className="text-[10px] text-slate-500 font-medium">Divisórias</Label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={composicao?.divisorias?.qtd ?? 0}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value, 10) || 0)
                        onComposicaoChange?.((prev) => {
                          const novaQtdCorpos = val + 1
                          const corposAtuais = prev.corpos || []
                          let novosCorpos: ComposicaoCorpo[] = []

                          if (corposAtuais.length === novaQtdCorpos) {
                            novosCorpos = corposAtuais
                          } else if (corposAtuais.length < novaQtdCorpos) {
                            // Expande mantendo os existentes
                            novosCorpos = [...corposAtuais]
                            while (novosCorpos.length < novaQtdCorpos) {
                              novosCorpos.push({
                                id: `corpo-${novosCorpos.length + 1}`,
                                gavetas: 0,
                                prateleiras: 2,
                                cabideiro: Boolean(prev.cabideiro),
                                sapateira: false,
                              })
                            }
                          } else {
                            // Trunca para a nova quantidade
                            novosCorpos = corposAtuais.slice(0, novaQtdCorpos)
                          }

                          return {
                            ...prev,
                            divisorias: { qtd: val },
                            corpos: novosCorpos,
                          }
                        })
                      }}
                      className="h-8 text-xs font-bold font-mono px-2"
                    />
                  </div>
                  <div className="flex-1 min-w-0 text-[11px] text-slate-500 leading-tight pt-3">
                    {(composicao?.divisorias?.qtd ?? 0 === 0)
                      ? 'Vão único interior'
                      : `${(composicao?.divisorias?.qtd ?? 0) + 1} corpos com larguras independentes`}
                  </div>
                </div>
              </div>

              {/* Portas */}
              <div className="space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200">
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 uppercase">
                  <DoorClosed className="w-3.5 h-3.5 text-slate-600" />
                  Portas Externas
                </div>
                <div className="flex gap-2">
                  <div className="w-16">
                    <Label className="text-[10px] text-slate-500 font-medium">Qtd</Label>
                    <Input
                      type="number"
                      min={0}
                      max={20}
                      value={composicao?.portas?.qtd ?? 0}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value, 10) || 0)
                        onComposicaoChange?.((prev) => ({
                          ...prev,
                          portas: {
                            qtd: val,
                            tipo:
                              val === 0
                                ? 'nenhum'
                                : prev.portas?.tipo === 'nenhum'
                                  ? 'abrir'
                                  : prev.portas?.tipo || 'abrir',
                          },
                        }))
                      }}
                      className="h-8 text-xs font-bold font-mono px-2"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Label className="text-[10px] text-slate-500 font-medium">Tipo</Label>
                    <Select
                      value={composicao?.portas?.tipo || 'abrir'}
                      onValueChange={(val: TipoAberturaPorta) => {
                        onComposicaoChange?.((prev) => ({
                          ...prev,
                          portas: {
                            qtd: prev.portas?.qtd ?? 0,
                            tipo: val,
                          },
                        }))
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs px-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="abrir">Abrir</SelectItem>
                        <SelectItem value="correr">Correr</SelectItem>
                        <SelectItem value="batente">Batente</SelectItem>
                        <SelectItem value="nenhum">Nenhum</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Se houver divisórias (corpos > 1): EDIÇÃO POR CORPO */}
            {(composicao?.divisorias?.qtd ?? 0) > 0 ? (
              <div className="space-y-2 pt-1 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <Columns className="w-3.5 h-3.5 text-slate-700" />
                    Layout Interno por Corpo ({(composicao?.divisorias?.qtd ?? 0) + 1} corpos)
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Configure cada vão de forma assimétrica
                  </span>
                </div>

                <div className="space-y-2">
                  {(() => {
                    const qtdCorposTotal = (composicao?.divisorias?.qtd ?? 0) + 1
                    // Garante que a lista de corpos tenha exatamente qtdCorposTotal elementos
                    const corpos =
                      Array.isArray(composicao?.corpos) &&
                      composicao.corpos.length === qtdCorposTotal
                        ? composicao.corpos
                        : Array.from({ length: qtdCorposTotal }, (_, idx) => ({
                            id: `corpo-${idx + 1}`,
                            gavetas: idx === 0 ? (composicao?.gavetas?.qtd ?? 0) : 0,
                            prateleiras:
                              Math.round((composicao?.prateleiras?.qtd ?? 2) / qtdCorposTotal) || 1,
                            cabideiro: Boolean(composicao?.cabideiro),
                            sapateira: idx === 0 ? Boolean(composicao?.sapateira) : false,
                          }))

                    return corpos.map((corpo, idx) => (
                      <div
                        key={corpo.id || `corpo-${idx}`}
                        className="p-3 bg-white rounded-lg border border-slate-200 space-y-2 shadow-2xs"
                      >
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">
                              {idx + 1}
                            </span>
                            Corpo {idx + 1}{' '}
                            {idx === 0
                              ? '(Esquerdo)'
                              : idx === qtdCorposTotal - 1
                                ? '(Direito)'
                                : '(Central)'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Vão #{idx + 1}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {/* Gavetas do corpo */}
                          <div>
                            <Label className="text-[10px] text-slate-500 font-medium block">
                              Gavetas
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              max={20}
                              value={corpo.gavetas ?? 0}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value, 10) || 0)
                                onComposicaoChange?.((prev) => {
                                  const novos = [...corpos]
                                  novos[idx] = { ...novos[idx], gavetas: val }
                                  const totalG = novos.reduce((s, c) => s + c.gavetas, 0)
                                  return {
                                    ...prev,
                                    corpos: novos,
                                    gavetas: { qtd: totalG },
                                  }
                                })
                              }}
                              className="h-7 text-xs font-bold font-mono px-2"
                            />
                          </div>

                          {/* Prateleiras do corpo */}
                          <div>
                            <Label className="text-[10px] text-slate-500 font-medium block">
                              Prateleiras
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              max={20}
                              value={corpo.prateleiras ?? 0}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value, 10) || 0)
                                onComposicaoChange?.((prev) => {
                                  const novos = [...corpos]
                                  novos[idx] = { ...novos[idx], prateleiras: val }
                                  const totalP = novos.reduce((s, c) => s + c.prateleiras, 0)
                                  return {
                                    ...prev,
                                    corpos: novos,
                                    prateleiras: { qtd: totalP },
                                  }
                                })
                              }}
                              className="h-7 text-xs font-bold font-mono px-2"
                            />
                          </div>

                          {/* Cabideiro no corpo */}
                          <div className="flex items-end pb-0.5">
                            <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-medium text-slate-700">
                              <Checkbox
                                checked={Boolean(corpo.cabideiro)}
                                onCheckedChange={(checked) => {
                                  onComposicaoChange?.((prev) => {
                                    const novos = [...corpos]
                                    novos[idx] = { ...novos[idx], cabideiro: Boolean(checked) }
                                    const temAlgum = novos.some((c) => c.cabideiro)
                                    return {
                                      ...prev,
                                      corpos: novos,
                                      cabideiro: temAlgum,
                                    }
                                  })
                                }}
                              />
                              <Shirt className="w-3.5 h-3.5 text-slate-600" />
                              Cabideiro
                            </label>
                          </div>

                          {/* Sapateira no corpo */}
                          <div className="flex items-end pb-0.5">
                            <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-medium text-slate-700">
                              <Checkbox
                                checked={Boolean(corpo.sapateira)}
                                onCheckedChange={(checked) => {
                                  onComposicaoChange?.((prev) => {
                                    const novos = [...corpos]
                                    novos[idx] = { ...novos[idx], sapateira: Boolean(checked) }
                                    const temAlgum = novos.some((c) => c.sapateira)
                                    return {
                                      ...prev,
                                      corpos: novos,
                                      sapateira: temAlgum,
                                    }
                                  })
                                }}
                              />
                              <Footprints className="w-3.5 h-3.5 text-slate-600" />
                              Sapateira
                            </label>
                          </div>
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              </div>
            ) : (
              /* MÓDULO DE VÃO ÚNICO (0 divisórias): edição global compacta */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Gavetas */}
                <div className="space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 uppercase">
                    <FolderMinus className="w-3.5 h-3.5 text-slate-600" />
                    Gavetas
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500 font-medium">Qtd Gavetas</Label>
                    <Input
                      type="number"
                      min={0}
                      max={30}
                      value={composicao?.gavetas?.qtd ?? 0}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value, 10) || 0)
                        onComposicaoChange?.((prev) => ({
                          ...prev,
                          gavetas: { qtd: val },
                        }))
                      }}
                      className="h-8 text-xs font-bold font-mono px-2"
                    />
                  </div>
                </div>

                {/* Prateleiras */}
                <div className="space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 uppercase">
                    <Grid3X3 className="w-3.5 h-3.5 text-slate-600" />
                    Prateleiras
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500 font-medium">Qtd Internas</Label>
                    <Input
                      type="number"
                      min={0}
                      max={20}
                      value={composicao?.prateleiras?.qtd ?? 2}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value, 10) || 0)
                        onComposicaoChange?.((prev) => ({
                          ...prev,
                          prateleiras: { qtd: val },
                        }))
                      }}
                      className="h-8 text-xs font-bold font-mono px-2"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Acessórios Globais (Cabideiro/Sapateira quando vão único) e Puxadores */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {(composicao?.divisorias?.qtd ?? 0) === 0 ? (
                <>
                  <label className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                    <Checkbox
                      checked={Boolean(composicao?.cabideiro)}
                      onCheckedChange={(checked) => {
                        onComposicaoChange?.((prev) => ({
                          ...prev,
                          cabideiro: Boolean(checked),
                        }))
                      }}
                    />
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-800">
                      <Shirt className="w-3.5 h-3.5 text-slate-600" />
                      Varão Cabideiro
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                    <Checkbox
                      checked={Boolean(composicao?.sapateira)}
                      onCheckedChange={(checked) => {
                        onComposicaoChange?.((prev) => ({
                          ...prev,
                          sapateira: Boolean(checked),
                        }))
                      }}
                    />
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-800">
                      <Footprints className="w-3.5 h-3.5 text-slate-600" />
                      Sapateira
                    </div>
                  </label>
                </>
              ) : (
                <div className="sm:col-span-2 flex items-center p-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-600">
                  <span>
                    💡 <strong>Layout por corpos:</strong> Cabideiro e sapateira podem ser ativados
                    individualmente em cada corpo acima.
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200">
                <Label className="text-[11px] font-semibold text-slate-700 whitespace-nowrap">
                  Puxadores:
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={
                    composicao?.puxadores ??
                    (composicao?.portas?.qtd ?? 0) + (composicao?.gavetas?.qtd ?? 0)
                  }
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value, 10) || 0)
                    onComposicaoChange?.((prev) => ({
                      ...prev,
                      puxadores: val,
                    }))
                  }}
                  className="h-7 text-xs font-bold font-mono px-2"
                />
              </div>
            </div>

            {/* Opções Construtivas do Marceneiro: Perfil Construtivo + Overrides */}
            <div className="pt-2 border-t border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block">
                  Perfil Construtivo & Modelo
                </span>
                {perfilSugeridoIA && (
                  <span className="text-[10px] text-slate-500">
                    Sugestão IA: <em>{perfilSugeridoIA}</em>
                  </span>
                )}
              </div>

              {/* Seletor de Perfil Construtivo do Módulo */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="perfil-card-select" className="text-xs font-bold text-slate-800">
                    Perfil Aplicado no Cálculo:
                  </Label>
                  {composicao?.perfilConstrutivo &&
                    selectedModule?.perfil_construtivo &&
                    composicao.perfilConstrutivo !== selectedModule.perfil_construtivo && (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-amber-50 text-amber-800 border-amber-300"
                      >
                        Override Manual Ativo
                      </Badge>
                    )}
                </div>
                <Select
                  value={perfilEfetivo}
                  onValueChange={(val: PerfilConstrutivo) => {
                    onComposicaoChange?.((prev) => ({
                      ...prev,
                      perfilConstrutivo: val,
                      semTamponamento: val === 'Caixa Simples',
                    }))
                  }}
                >
                  <SelectTrigger
                    id="perfil-card-select"
                    className="h-8 text-xs font-semibold bg-slate-50"
                  >
                    <SelectValue placeholder="Selecione o perfil construtivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PERFIS_CONSTRUTIVOS_INFO) as PerfilConstrutivo[]).map((pk) => {
                      const info = PERFIS_CONSTRUTIVOS_INFO[pk]
                      return (
                        <SelectItem key={pk} value={pk} className="text-xs">
                          <span className="font-semibold">{info.label}</span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-500 leading-snug">
                  {PERFIS_CONSTRUTIVOS_INFO[perfilEfetivo]?.descCurta}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Toggle 1: Móvel sem tamponamento (Override direto para Caixa Simples) */}
                <label className="flex items-start gap-2.5 p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                  <Checkbox
                    checked={
                      perfilEfetivo === 'Caixa Simples' || Boolean(composicao?.semTamponamento)
                    }
                    onCheckedChange={(checked) => {
                      onComposicaoChange?.((prev) => ({
                        ...prev,
                        semTamponamento: Boolean(checked),
                        perfilConstrutivo: checked
                          ? 'Caixa Simples'
                          : (selectedModule?.perfil_construtivo as PerfilConstrutivo) ||
                            'Fechado Envelopado',
                      }))
                    }}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-800 block">
                      Móvel sem tamponamento
                    </span>
                    <span className="text-[10px] text-slate-500 leading-tight block">
                      Override manual: força Caixa Simples sem caixaria interna.
                    </span>
                  </div>
                </label>

                {/* Toggle 2: Tampo de pedra */}
                <label className="flex items-start gap-2.5 p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                  <Checkbox
                    checked={Boolean(
                      composicao?.tampoPedra ||
                      perfilEfetivo === 'Balcão (tampo por conta do cliente)',
                    )}
                    onCheckedChange={(checked) => {
                      onComposicaoChange?.((prev) => ({
                        ...prev,
                        tampoPedra: Boolean(checked),
                      }))
                    }}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-800 block">
                      Tampo de pedra / avulso
                    </span>
                    <span className="text-[10px] text-slate-500 leading-tight block">
                      Travessas no topo; nenhum tampo entra automaticamente.
                    </span>
                  </div>
                </label>
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
