import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Tag, AlertCircle } from 'lucide-react'
import {
  criarCategoriaPersonalizada,
  isCategoriaFixa,
  normalizarNomeCategoria,
  type CategoriaPersonalizada,
} from '@/services/catalogo'
import { toast } from '@/hooks/use-toast'

interface NovaCategoriaModalProps {
  isOpen: boolean
  onClose: () => void
  onCategoriaCriada: (novaCategoria: CategoriaPersonalizada) => void
  categoriasExistentes?: string[]
}

export const NovaCategoriaModal: React.FC<NovaCategoriaModalProps> = ({
  isOpen,
  onClose,
  onCategoriaCriada,
  categoriasExistentes = [],
}) => {
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const handleClose = () => {
    setNome('')
    setErro(null)
    onClose()
  }

  const handleSalvar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setErro(null)

    const normalizado = normalizarNomeCategoria(nome)
    if (!normalizado) {
      setErro('Informe o nome da nova categoria.')
      return
    }

    if (isCategoriaFixa(normalizado)) {
      setErro(`"${normalizado}" é uma categoria padrão do sistema e já existe.`)
      return
    }

    const jaExisteNaLista = categoriasExistentes.some(
      (c) => c.toLowerCase() === normalizado.toLowerCase(),
    )
    if (jaExisteNaLista) {
      setErro(`A categoria "${normalizado}" já existe na lista.`)
      return
    }

    setSalvando(true)
    try {
      const res = await criarCategoriaPersonalizada(normalizado)
      if (!res.success || !res.categoria) {
        setErro(res.error || 'Não foi possível cadastrar a categoria.')
        return
      }

      toast({
        title: 'Categoria criada com sucesso!',
        description: `A categoria "${res.categoria.nome}" agora está disponível no catálogo e orçamentos.`,
      })

      onCategoriaCriada(res.categoria)
      handleClose()
    } catch (err) {
      console.error('Erro ao salvar categoria:', err)
      setErro(err instanceof Error ? err.message : 'Erro ao cadastrar categoria.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[420px] rounded-2xl p-6 bg-white dark:bg-slate-900">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100 flex items-center justify-center font-bold">
              <Tag className="w-4 h-4 text-slate-700 dark:text-slate-200" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Nova Categoria de Material
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
            Crie uma categoria personalizada para organizar materiais especiais ou novos
            acabamentos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSalvar} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label
              htmlFor="nova-categoria-nome"
              className="text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              Nome da Categoria <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="nova-categoria-nome"
              placeholder="Ex.: Acrílicos e Vidros, Couro Sintético..."
              value={nome}
              autoFocus
              onChange={(e) => {
                setNome(e.target.value)
                if (erro) setErro(null)
              }}
              className="h-11 rounded-xl text-sm border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20"
            />
            {erro && (
              <p className="text-[11px] font-medium text-rose-600 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {erro}
              </p>
            )}
            <p className="text-[11px] text-slate-400">
              As 13 categorias fixas do sistema são reservadas e não podem ser duplicadas.
            </p>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={salvando}
              className="rounded-xl border-slate-300"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando}
              className="bg-slate-700 hover:bg-slate-800 text-white rounded-xl min-w-[120px]"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Criar Categoria
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
