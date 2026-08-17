import React, { useState } from 'react'
import {
  MoreVertical,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  FileSpreadsheet,
  Coins,
  TrendingUp,
  Boxes,
  HelpCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BudgetItem } from '@/data/mockData'
import { cn } from '@/lib/utils'

interface PricingTableProps {
  items: BudgetItem[]
  onUpdateItem: (index: number, updated: BudgetItem) => void
  onDeleteItem: (index: number) => void
  onAddNewManualItem: () => void
}

export const PricingTable: React.FC<PricingTableProps> = ({
  items,
  onUpdateItem,
  onDeleteItem,
  onAddNewManualItem,
}) => {
  // Editing state for inline edits
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<BudgetItem | null>(null)

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val)
  }

  const handleStartEdit = (index: number) => {
    setEditingIndex(index)
    setEditForm({ ...items[index] })
  }

  const handleCancelEdit = () => {
    // If cancelling a newly added empty row
    if (editingIndex !== null && !items[editingIndex].description) {
      onDeleteItem(editingIndex)
    }
    setEditingIndex(null)
    setEditForm(null)
  }

  const handleSaveEdit = (index: number) => {
    if (!editForm) return

    // Recalculate sale price based on totalCost and markup
    const markupMultiplier = 1 + (Number(editForm.markup) || 0) / 100
    const calculatedSale = (Number(editForm.totalCost) || 0) * markupMultiplier

    const updated: BudgetItem = {
      ...editForm,
      unitCost: Number(editForm.unitCost) || 0,
      totalCost: Number(editForm.totalCost) || 0,
      markup: Number(editForm.markup) || 0,
      salePrice: Number(calculatedSale.toFixed(2)),
      isEditing: false,
    }

    onUpdateItem(index, updated)
    setEditingIndex(null)
    setEditForm(null)
  }

  const handleFieldChange = (field: keyof BudgetItem, value: any) => {
    if (!editForm) return
    const next = { ...editForm, [field]: value }

    // Auto compute totalCost if unitCost changes (assume 2 units or 1 based on description)
    if (field === 'unitCost') {
      const uCost = parseFloat(value) || 0
      next.totalCost = uCost * 2 // standard 2 qty or existing ratio
    }

    // Auto compute sale price
    if (field === 'totalCost' || field === 'markup' || field === 'unitCost') {
      const tCost = parseFloat(next.totalCost as any) || 0
      const mk = parseFloat(next.markup as any) || 0
      next.salePrice = Number((tCost * (1 + mk / 100)).toFixed(2))
    }

    setEditForm(next)
  }

  // Totals
  const totalCostSum = items.reduce((acc, it) => acc + (Number(it.totalCost) || 0), 0)
  const totalSaleSum = items.reduce((acc, it) => acc + (Number(it.salePrice) || 0), 0)
  const averageMarkup = totalCostSum > 0 ? ((totalSaleSum - totalCostSum) / totalCostSum) * 100 : 0
  const totalProfit = totalSaleSum - totalCostSum

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
              {items.length} {items.length === 1 ? 'item' : 'itens'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Custo Total Fabril
            </p>
            <p className="text-lg font-bold text-slate-900 font-mono">
              {formatCurrency(totalCostSum)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/40 to-white p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">
              Valor Total de Venda
            </p>
            <p className="text-lg font-bold text-emerald-700 font-mono">
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
                <th className="py-3.5 px-4 text-right font-semibold">Custo Unitário (R$)</th>
                <th className="py-3.5 px-4 text-right font-semibold">Custo Total (R$)</th>
                <th className="py-3.5 px-4 text-right font-semibold">Markup (%)</th>
                <th className="py-3.5 px-4 text-right font-semibold text-emerald-800">
                  Valor de Venda (R$)
                </th>
                <th className="py-3.5 px-4 text-center w-14">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => {
                const isEditing = editingIndex === idx || item.isEditing

                if (isEditing) {
                  const curr = editForm || item
                  return (
                    <tr key={item.id || idx} className="bg-emerald-50/30">
                      <td className="py-3 px-4">
                        <Input
                          value={curr.description}
                          onChange={(e) => handleFieldChange('description', e.target.value)}
                          placeholder="Ex: Prateleira MDF 18mm 800x400mm"
                          className="h-8 text-xs font-medium"
                          autoFocus
                        />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Input
                          type="number"
                          step="0.01"
                          value={curr.unitCost}
                          onChange={(e) => handleFieldChange('unitCost', e.target.value)}
                          className="h-8 text-xs font-mono text-right w-28 ml-auto"
                        />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Input
                          type="number"
                          step="0.01"
                          value={curr.totalCost}
                          onChange={(e) => handleFieldChange('totalCost', e.target.value)}
                          className="h-8 text-xs font-mono text-right w-28 ml-auto"
                        />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            value={curr.markup}
                            onChange={(e) => handleFieldChange('markup', e.target.value)}
                            className="h-8 text-xs font-mono text-right w-20"
                          />
                          <span className="text-xs text-slate-500 font-bold">%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        {formatCurrency(curr.salePrice || 0)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => handleSaveEdit(idx)}
                            className="h-7 w-7 text-emerald-600 hover:bg-emerald-100"
                            title="Salvar"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={handleCancelEdit}
                            className="h-7 w-7 text-rose-600 hover:bg-rose-100"
                            title="Cancelar"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                }

                return (
                  <tr
                    key={item.id || idx}
                    className={cn(
                      'transition-colors hover:bg-slate-50/80',
                      idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white',
                    )}
                  >
                    <td className="py-3.5 px-4 font-medium text-slate-900 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      {item.description}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                      {formatCurrency(item.unitCost)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-800">
                      {formatCurrency(item.totalCost)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Badge
                        variant="secondary"
                        className="bg-slate-100 text-slate-700 font-mono font-semibold text-xs px-2 py-0.5 rounded-full"
                      >
                        {item.markup}%
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                      {formatCurrency(item.salePrice)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-slate-800 rounded-lg"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem
                            onClick={() => handleStartEdit(idx)}
                            className="cursor-pointer text-xs flex items-center gap-2"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                            Editar Linha
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDeleteItem(idx)}
                            className="cursor-pointer text-xs text-rose-600 focus:text-rose-600 flex items-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                )
              })}
            </tbody>

            {/* Total Summary Footer Row */}
            <tfoot>
              <tr className="bg-slate-100/80 border-t-2 border-slate-200 font-semibold text-slate-900">
                <td className="py-4 px-4 text-slate-800">
                  <span className="font-bold uppercase tracking-wider text-xs">
                    Totais do Módulo ({items.length} itens)
                  </span>
                </td>
                <td className="py-4 px-4 text-right text-xs text-slate-500">—</td>
                <td className="py-4 px-4 text-right font-mono font-bold text-slate-900 text-base">
                  {formatCurrency(totalCostSum)}
                </td>
                <td className="py-4 px-4 text-right font-mono text-xs text-slate-600">
                  Méd. {averageMarkup.toFixed(0)}%
                </td>
                <td className="py-4 px-4 text-right font-mono font-extrabold text-emerald-700 text-lg">
                  {formatCurrency(totalSaleSum)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Mobile Card Layout */}
      <div className="block md:hidden space-y-3">
        {items.map((item, idx) => {
          const isEditing = editingIndex === idx || item.isEditing

          if (isEditing) {
            const curr = editForm || item
            return (
              <div
                key={item.id || idx}
                className="bg-emerald-50/50 border border-emerald-300 rounded-xl p-4 space-y-3"
              >
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 uppercase">
                    Descrição
                  </label>
                  <Input
                    value={curr.description}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    placeholder="Descrição da peça"
                    className="h-9 text-xs mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 uppercase">
                      Custo Unit. (R$)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={curr.unitCost}
                      onChange={(e) => handleFieldChange('unitCost', e.target.value)}
                      className="h-9 text-xs mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 uppercase">
                      Custo Total (R$)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={curr.totalCost}
                      onChange={(e) => handleFieldChange('totalCost', e.target.value)}
                      className="h-9 text-xs mt-1 font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 uppercase">
                      Markup (%)
                    </label>
                    <Input
                      type="number"
                      value={curr.markup}
                      onChange={(e) => handleFieldChange('markup', e.target.value)}
                      className="h-9 text-xs mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 uppercase">
                      Valor Venda (R$)
                    </label>
                    <div className="h-9 flex items-center px-3 bg-white border border-slate-200 rounded-md font-mono font-bold text-emerald-700 text-xs mt-1">
                      {formatCurrency(curr.salePrice || 0)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                    onClick={() => handleSaveEdit(idx)}
                  >
                    <Check className="w-3.5 h-3.5 mr-1" /> Salvar Peça
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-xs h-8"
                    onClick={handleCancelEdit}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )
          }

          return (
            <div
              key={item.id || idx}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-sm text-slate-900">{item.description}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 -mr-2">
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handleStartEdit(idx)}
                      className="text-xs cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-2" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDeleteItem(idx)}
                      className="text-xs text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Remover
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
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
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mt-0.5">
                    {item.markup}%
                  </Badge>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Valor Venda</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    {formatCurrency(item.salePrice)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}

        {/* Mobile Total Card */}
        <div className="bg-slate-900 text-white rounded-xl p-4 shadow-md space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>Custo Total Fabril</span>
            <span className="font-mono font-semibold text-white">
              {formatCurrency(totalCostSum)}
            </span>
          </div>
          <div className="flex items-center justify-between text-base font-bold pt-2 border-t border-slate-800">
            <span>Total de Venda</span>
            <span className="font-mono text-emerald-400 text-lg">
              {formatCurrency(totalSaleSum)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
