import React, { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, Package, Layers, DollarSign } from 'lucide-react'
import type { CatalogoMaterial } from '@/services/catalogo'
import type { BudgetItem } from '@/data/mockData'

interface AddFromCatalogModalProps {
  isOpen: boolean
  onClose: () => void
  catalogoMateriais: CatalogoMaterial[]
  markupEngenharia: number
  onAddItem: (item: BudgetItem) => void
}

export const AddFromCatalogModal: React.FC<AddFromCatalogModalProps> = ({
  isOpen,
  onClose,
  catalogoMateriais,
  markupEngenharia,
  onAddItem,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const filteredMateriais = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return catalogoMateriais
    return catalogoMateriais.filter(
      (m) =>
        m.nome_material.toLowerCase().includes(term) ||
        m.categoria.toLowerCase().includes(term) ||
        (m.unidade && m.unidade.toLowerCase().includes(term)),
    )
  }, [catalogoMateriais, searchTerm])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val)

  const handleQuantityChange = (id: string, value: string) => {
    const normalized = value.replace(',', '.')
    const parsed = parseFloat(normalized)
    const num = isNaN(parsed) || parsed <= 0 ? 0 : parsed
    setQuantities((prev) => ({ ...prev, [id]: num }))
  }

  const handleAdd = (material: CatalogoMaterial) => {
    const quantidade = quantities[material.id] ?? 1
    const unitCost = Number(material.preco_custo) || 0
    const totalCost = unitCost * quantidade
    const effectiveMarkup = markupEngenharia > 0 ? markupEngenharia : 2.5
    const salePrice = Math.round(totalCost * effectiveMarkup * 100) / 100

    const unidadeValida =
      material.unidade === 'm²' || material.unidade === 'm' || material.unidade === 'jogo'
        ? material.unidade
        : undefined

    const newItem: BudgetItem = {
      id: `catalogo-${material.id}-${Date.now()}`,
      description: material.nome_material,
      material: material.categoria,
      metragem: quantidade,
      unidade: unidadeValida,
      unitCost,
      totalCost,
      markup: effectiveMarkup,
      salePrice,
    }

    onAddItem(newItem)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col rounded-2xl p-6 bg-white">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
              <Package className="w-4 h-4 text-slate-700" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Adicionar do Catálogo de Materiais
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Selecione um item pré-cadastrado no catálogo da marcenaria para incluir no orçamento.
          </DialogDescription>
        </DialogHeader>

        {/* Campo de Busca */}
        <div className="relative my-3">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar por nome do material ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-11 rounded-xl text-sm border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20"
          />
        </div>

        {/* Lista Scrollável */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[220px]">
          {filteredMateriais.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-xl">
              <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">Nenhum material encontrado</p>
              <p className="text-xs text-slate-400 mt-1">
                Tente ajustar os termos de busca ou cadastre o item no Catálogo.
              </p>
            </div>
          ) : (
            filteredMateriais.map((mat) => {
              const currentQty = quantities[mat.id] ?? 1
              const unitCost = Number(mat.preco_custo) || 0
              const totalCost = unitCost * currentQty
              const effectiveMarkup = markupEngenharia > 0 ? markupEngenharia : 2.5
              const salePrice = totalCost * effectiveMarkup

              return (
                <div
                  key={mat.id}
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-slate-900">
                        {mat.nome_material}
                      </span>
                      <Badge
                        variant="outline"
                        className="bg-slate-100 text-slate-700 border-slate-300 text-[11px] px-2 py-0"
                      >
                        {mat.categoria}
                      </Badge>
                      <span className="text-xs text-slate-400">({mat.unidade})</span>
                    </div>

                    <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <span className="text-slate-400">Custo Unit:</span>
                        <strong className="font-mono text-slate-800">
                          {formatCurrency(unitCost)}
                        </strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-slate-400">Venda Estimada:</span>
                        <strong className="font-mono text-slate-900 font-bold">
                          {formatCurrency(salePrice)}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                    <div className="flex items-center gap-1.5">
                      <label htmlFor={`qty-${mat.id}`} className="text-xs text-slate-500">
                        Qtd:
                      </label>
                      <Input
                        id={`qty-${mat.id}`}
                        type="number"
                        step="any"
                        min="0.01"
                        value={currentQty}
                        onChange={(e) => handleQuantityChange(mat.id, e.target.value)}
                        className="w-20 h-9 rounded-lg text-xs font-mono font-bold text-center border-slate-300"
                      />
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleAdd(mat)}
                      className="h-9 px-3.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Rodapé */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>{filteredMateriais.length} materiais listados</span>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-xs h-8 text-slate-600 hover:text-slate-900"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
