import React, { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PlusCircle, AlertCircle } from 'lucide-react'
import type { BudgetItem } from '@/data/mockData'
import {
  listarCategoriasPersonalizadas,
  getListaCombinadaCategorias,
  type CategoriaPersonalizada,
} from '@/services/catalogo'
import { NovaCategoriaModal } from '@/components/NovaCategoriaModal'

interface AddCustomItemModalProps {
  isOpen: boolean
  onClose: () => void
  markupEngenharia: number
  onAddItem: (item: BudgetItem) => void
}

const UNIDADES_AVULSO = ['m²', 'm', 'jogo', 'un'] as const

export const AddCustomItemModal: React.FC<AddCustomItemModalProps> = ({
  isOpen,
  onClose,
  markupEngenharia,
  onAddItem,
}) => {
  const [nome, setNome] = useState('')
  const [categoria, setCategoria] = useState<string>('Ferragem')
  const [quantidade, setQuantidade] = useState<number>(1)
  const [categoriasPersonalizadas, setCategoriasPersonalizadas] = useState<
    CategoriaPersonalizada[]
  >([])
  const [novaCategoriaModalOpen, setNovaCategoriaModalOpen] = useState(false)
  const [unidade, setUnidade] = useState<string>('un')
  const [precoCusto, setPrecoCusto] = useState<string>('')
  const [errors, setErrors] = useState<{ nome?: string; precoCusto?: string }>({})

  useEffect(() => {
    if (isOpen) {
      listarCategoriasPersonalizadas().then((cats) => {
        setCategoriasPersonalizadas(cats || [])
      })
    }
  }, [isOpen])

  const listaCategoriasCombinada = useMemo(() => {
    return getListaCombinadaCategorias(categoriasPersonalizadas)
  }, [categoriasPersonalizadas])

  const resetForm = () => {
    setNome('')
    setCategoria('Ferragem')
    setQuantidade(1)
    setUnidade('un')
    setPrecoCusto('')
    setErrors({})
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: { nome?: string; precoCusto?: string } = {}
    if (!nome.trim()) {
      newErrors.nome = 'Informe o nome do item'
    }

    const custoNum = parseFloat(precoCusto.replace(',', '.'))
    if (isNaN(custoNum) || custoNum < 0) {
      newErrors.precoCusto = 'Informe um preço de custo válido'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const totalCost = custoNum * (quantidade > 0 ? quantidade : 1)
    const effectiveMarkup = markupEngenharia > 0 ? markupEngenharia : 2.5
    const salePrice = Math.round(totalCost * effectiveMarkup * 100) / 100

    const unidadeValida =
      unidade === 'm²' || unidade === 'm' || unidade === 'jogo' ? unidade : undefined

    const newItem: BudgetItem = {
      id: `avulso-${Date.now()}`,
      description: nome.trim(),
      material: categoria,
      metragem: quantidade,
      unidade: unidadeValida,
      unitCost: custoNum,
      totalCost,
      markup: effectiveMarkup,
      salePrice,
    }

    onAddItem(newItem)
    handleClose()
  }

  const custoCalculado = parseFloat(precoCusto.replace(',', '.')) || 0
  const custoTotalCalculado = custoCalculado * (quantidade > 0 ? quantidade : 1)
  const effectiveMarkup = markupEngenharia > 0 ? markupEngenharia : 2.5
  const vendaCalculada = custoTotalCalculado * effectiveMarkup

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-white">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
              <PlusCircle className="w-4 h-4 text-slate-700" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Adicionar Item Avulso
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Adicione serviços, insumos especiais ou itens fora do catálogo ao orçamento.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Nome do Item */}
          <div className="space-y-1.5">
            <Label htmlFor="item-nome" className="text-xs font-bold text-slate-700">
              Nome do Item <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="item-nome"
              placeholder="Ex.: Perfil LED Embutir 2m + Fonte Slim"
              value={nome}
              onChange={(e) => {
                setNome(e.target.value)
                if (errors.nome) setErrors((prev) => ({ ...prev, nome: undefined }))
              }}
              className="h-10 rounded-xl text-sm border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20"
            />
            {errors.nome && (
              <p className="text-[11px] font-medium text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.nome}
              </p>
            )}
          </div>

          {/* Categoria e Unidade */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="item-categoria" className="text-xs font-bold text-slate-700">
                Categoria
              </Label>
              <Select
                value={categoria}
                onValueChange={(v) => {
                  if (v === '__NOVA_CATEGORIA__') {
                    setNovaCategoriaModalOpen(true)
                  } else {
                    setCategoria(v)
                  }
                }}
              >
                <SelectTrigger
                  id="item-categoria"
                  className="h-10 rounded-xl text-sm bg-white border-slate-300"
                >
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-72">
                  {listaCategoriasCombinada.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                  <div className="pt-1.5 pb-1 px-1 border-t border-slate-100 mt-1">
                    <SelectItem
                      value="__NOVA_CATEGORIA__"
                      className="text-slate-900 font-semibold focus:bg-slate-100 cursor-pointer flex items-center"
                    >
                      <span className="flex items-center text-slate-800 font-medium">
                        ＋ Nova categoria…
                      </span>
                    </SelectItem>
                  </div>
                </SelectContent>{' '}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="item-unidade" className="text-xs font-bold text-slate-700">
                Unidade
              </Label>
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger
                  id="item-unidade"
                  className="h-10 rounded-xl text-sm bg-white border-slate-300"
                >
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {UNIDADES_AVULSO.map((un) => (
                    <SelectItem key={un} value={un}>
                      {un}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quantidade e Preço de Custo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="item-quantidade" className="text-xs font-bold text-slate-700">
                Quantidade
              </Label>
              <Input
                id="item-quantidade"
                type="number"
                min={0.01}
                step="any"
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value) || 1)}
                className="h-10 rounded-xl text-sm font-mono border-slate-300"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="item-custo" className="text-xs font-bold text-slate-700">
                Preço de Custo (R$) <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="item-custo"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={precoCusto}
                onChange={(e) => {
                  setPrecoCusto(e.target.value)
                  if (errors.precoCusto) setErrors((prev) => ({ ...prev, precoCusto: undefined }))
                }}
                className="h-10 rounded-xl text-sm font-mono border-slate-300"
              />
              {errors.precoCusto && (
                <p className="text-[11px] font-medium text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.precoCusto}
                </p>
              )}
            </div>
          </div>

          {/* Card Resumo de Valores */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5">
            <div className="flex justify-between text-slate-600">
              <span>Custo Total:</span>
              <strong className="font-mono text-slate-800">
                {formatCurrency(custoTotalCalculado)}
              </strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Markup da Engenharia:</span>
              <span className="font-mono text-slate-700">×{effectiveMarkup.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-900 pt-1 border-t border-slate-200 font-bold">
              <span>Preço de Venda:</span>
              <span className="font-mono text-slate-900">{formatCurrency(vendaCalculada)}</span>
            </div>
          </div>

          <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="w-full sm:w-auto text-xs border-slate-300 text-slate-700 rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-sm"
            >
              <PlusCircle className="w-4 h-4 mr-1" />
              Adicionar Item Avulso
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <NovaCategoriaModal
        isOpen={novaCategoriaModalOpen}
        onClose={() => setNovaCategoriaModalOpen(false)}
        categoriasExistentes={listaCategoriasCombinada}
        onCategoriaCriada={(novaCat) => {
          setCategoriasPersonalizadas((prev) => [...prev, novaCat])
          setCategoria(novaCat.nome)
        }}
      />
    </Dialog>
  )
}
