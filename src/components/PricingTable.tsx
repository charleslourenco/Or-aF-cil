import React from 'react'
import { Boxes, Coins, TrendingUp, Ruler } from 'lucide-react'
import { BudgetItem } from '@/data/mockData'
import { custoConsolidado, valorConsolidado } from '@/lib/pricing'
import { cn } from '@/lib/utils'

interface PricingTableProps {
  items: BudgetItem[]
  /** Quantidade de peças físicas representadas pela BOM. */
  totalPecas?: number
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val)

/** Formata metragem/quantidade conforme a unidade da peça. */
const formatMetragem = (item: BudgetItem): string => {
  const metragem = Number(item.metragem) || 0
  const unidade = item.unidade ?? 'm²'
  if (unidade === 'jogo') {
    return `${metragem} ${unidade}`
  }
  // m² ou m — 3 casas para m², 2 para m
  const casas = unidade === 'm²' ? 3 : 2
  return `${metragem.toFixed(casas)} ${unidade}`
}

export const PricingTable: React.FC<PricingTableProps> = ({ items, totalPecas }) => {
  const totalCostSum = custoConsolidado(items)
  const totalSaleSum = valorConsolidado(items)
  const totalLucro = totalSaleSum - totalCostSum
  const markupMedio = totalCostSum > 0 ? totalSaleSum / totalCostSum : 0

  const qtdPecas = totalPecas ?? items.length

  return (
    <div className="space-y-4">
      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total de Peças
            </p>
            <p className="text-lg font-bold text-slate-900 font-mono">
              {qtdPecas} {qtdPecas === 1 ? 'peça' : 'peças'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Custo Consolidado
            </p>
            <p className="text-lg font-bold text-slate-900 font-mono">
              {formatCurrency(totalCostSum)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-300 bg-gradient-to-br from-slate-100/40 to-white p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-slate-700 text-white flex items-center justify-center shadow-md shadow-slate-700/20">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-900 uppercase tracking-wider">
              Valor Consolidado
            </p>
            <p className="text-lg font-bold text-slate-800 font-mono">
              {formatCurrency(totalSaleSum)}
            </p>
          </div>
        </div>
      </div>

      {/* Desktop & Tablet Table */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 font-semibold text-xs uppercase tracking-wider">
                <th className="py-3.5 px-4 font-semibold">Descrição da Peça</th>
                <th className="py-3.5 px-4 text-right font-semibold">Metragem/Qtd</th>
                <th className="py-3.5 px-4 text-right font-semibold">Custo Unitário (R$)</th>
                <th className="py-3.5 px-4 text-right font-semibold">Custo Total (R$)</th>
                <th className="py-3.5 px-4 text-right font-semibold">Markup</th>
                <th className="py-3.5 px-4 text-right font-semibold text-slate-900">
                  Valor de Venda (R$)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => (
                <tr
                  key={item.id || idx}
                  className={cn(
                    'transition-colors hover:bg-slate-50/80',
                    idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white',
                  )}
                >
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900">{item.description}</div>
                        {item.material && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {item.material}
                            {item.espessura ? ` · ${item.espessura}mm` : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-600 text-xs">
                    {formatMetragem(item)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                    {formatCurrency(item.unitCost)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-800">
                    {formatCurrency(item.totalCost)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-semibold text-xs">
                      ×{Number(item.markup).toFixed(2)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800">
                    {formatCurrency(item.salePrice)}
                  </td>
                </tr>
              ))}
            </tbody>

            {/* Total Summary Footer Row */}
            <tfoot>
              <tr className="bg-slate-100/80 border-t-2 border-slate-200 font-semibold text-slate-900">
                <td className="py-4 px-4 text-slate-800" colSpan={3}>
                  <span className="font-bold uppercase tracking-wider text-xs">
                    Totais do Módulo ({items.length} itens)
                  </span>
                </td>
                <td className="py-4 px-4 text-right font-mono font-bold text-slate-900 text-base">
                  {formatCurrency(totalCostSum)}
                </td>
                <td className="py-4 px-4 text-right font-mono text-xs text-slate-600">
                  Méd. ×{markupMedio.toFixed(2)}
                </td>
                <td className="py-4 px-4 text-right font-mono font-extrabold text-slate-800 text-lg">
                  {formatCurrency(totalSaleSum)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Mobile Card Layout */}
      <div className="block md:hidden space-y-3">
        {items.map((item, idx) => (
          <div
            key={item.id || idx}
            className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="font-semibold text-sm text-slate-900 block">
                  {item.description}
                </span>
                {item.material && (
                  <span className="text-[11px] text-slate-400">
                    {item.material}
                    {item.espessura ? ` · ${item.espessura}mm` : ''}
                  </span>
                )}
              </div>
              <span className="font-mono font-bold text-slate-800 text-sm shrink-0">
                {formatCurrency(item.salePrice)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Metragem/Qtd</span>
                <span className="font-mono text-slate-700 font-medium">{formatMetragem(item)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Custo Unitário</span>
                <span className="font-mono text-slate-700 font-medium">
                  {formatCurrency(item.unitCost)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Custo Total</span>
                <span className="font-mono text-slate-800 font-semibold">
                  {formatCurrency(item.totalCost)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Markup</span>
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-semibold text-[10px]">
                  ×{Number(item.markup).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        ))}

        {/* Mobile Total Card */}
        <div className="bg-slate-900 text-white rounded-xl p-4 shadow-md space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>Custo Consolidado</span>
            <span className="font-mono font-semibold text-white">
              {formatCurrency(totalCostSum)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>Lucro Estimado (×{markupMedio.toFixed(2)})</span>
            <span className="font-mono font-semibold text-white">{formatCurrency(totalLucro)}</span>
          </div>
          <div className="flex items-center justify-between text-base font-bold pt-2 border-t border-slate-800">
            <span>Valor Consolidado</span>
            <span className="font-mono text-slate-300 text-lg">{formatCurrency(totalSaleSum)}</span>
          </div>
        </div>
      </div>

      {/* Rodapé de Totais Consolidados — blocos destacados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
                Custo Consolidado
              </p>
              <p className="text-[11px] text-amber-700/70">Soma de todos os custos totais</p>
            </div>
          </div>
          <p className="text-xl font-extrabold text-amber-800 font-mono">
            {formatCurrency(totalCostSum)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-300 bg-gradient-to-br from-slate-100 to-white p-5 shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-700 text-white flex items-center justify-center shadow-md shadow-slate-700/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-900 uppercase tracking-wider">
                Valor Consolidado
              </p>
              <p className="text-[11px] text-slate-800/70">Soma de todos os valores de venda</p>
            </div>
          </div>
          <p className="text-xl font-extrabold text-slate-800 font-mono">
            {formatCurrency(totalSaleSum)}
          </p>
        </div>
      </div>

      {/* Linha auxiliar de conferência de perímetro */}
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <Ruler className="w-3.5 h-3.5" />
        <span>
          Cálculo geométrico paramétrico com fator de perda ×1.20 e markup ×{MARKUP_DISPLAY}.
        </span>
      </div>
    </div>
  )
}

const MARKUP_DISPLAY = '2.50'
