import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle2, User, Home, Box, Receipt, ArrowRight, Printer, Share2 } from 'lucide-react'
import { BudgetItem } from '@/data/mockData'

interface FinalizeQuoteModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  clientName: string
  room: string
  moduleName: string
  items: BudgetItem[]
}

export const FinalizeQuoteModal: React.FC<FinalizeQuoteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  clientName,
  room,
  moduleName,
  items,
}) => {
  const totalCost = items.reduce((acc, it) => acc + (Number(it.totalCost) || 0), 0)
  const totalSale = items.reduce((acc, it) => acc + (Number(it.salePrice) || 0), 0)
  const totalProfit = totalSale - totalCost
  const quoteNumber =
    'ORC-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900)

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-2xl p-6 bg-white">
        <DialogHeader className="space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto sm:mx-0 shadow-xs">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900">
            Confirmar e Finalizar Orçamento
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Revise as informações do módulo antes de gerar o documento final para o cliente.
          </DialogDescription>
        </DialogHeader>

        {/* Summary Card */}
        <div className="space-y-4 my-2">
          {/* Metadata Grid */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-slate-500 font-medium">Código do Orçamento:</span>
              <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                {quoteNumber}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Cliente:
              </span>
              <span className="font-semibold text-slate-800">{clientName || 'Não informado'}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                <Home className="w-3.5 h-3.5 text-slate-400" />
                Ambiente:
              </span>
              <span className="font-semibold text-slate-800">{room || 'Não informado'}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                <Box className="w-3.5 h-3.5 text-slate-400" />
                Módulo Base:
              </span>
              <span className="font-semibold text-slate-800">{moduleName || 'Módulo'}</span>
            </div>
          </div>

          {/* Pricing Highlight */}
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white rounded-xl p-4 shadow-md space-y-2">
            <div className="flex items-center justify-between text-xs text-emerald-100">
              <span>Custo Fabril Total ({items.length} itens)</span>
              <span className="font-mono">{formatCurrency(totalCost)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-emerald-100">
              <span>Margem Bruta Estimada</span>
              <span className="font-mono">{formatCurrency(totalProfit)}</span>
            </div>
            <div className="flex items-center justify-between text-base font-bold pt-2 border-t border-emerald-500/50">
              <span className="text-white">Valor Final de Venda</span>
              <span className="font-mono text-xl text-white">{formatCurrency(totalSale)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto text-xs"
          >
            Voltar e Ajustar
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md shadow-emerald-600/20"
          >
            Confirmar e Emitir
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
