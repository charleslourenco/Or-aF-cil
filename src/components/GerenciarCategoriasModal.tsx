import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tag, Trash2, Loader2, Plus, Info, AlertTriangle } from 'lucide-react'
import { excluirCategoriaPersonalizada, type CategoriaPersonalizada } from '@/services/catalogo'
import { toast } from '@/hooks/use-toast'

interface GerenciarCategoriasModalProps {
  isOpen: boolean
  onClose: () => void
  categoriasPersonalizadas: CategoriaPersonalizada[]
  onAbrirNovaCategoria: () => void
  onCategoriaExcluida: (id: string, nome: string) => void
}

export const GerenciarCategoriasModal: React.FC<GerenciarCategoriasModalProps> = ({
  isOpen,
  onClose,
  categoriasPersonalizadas,
  onAbrirNovaCategoria,
  onCategoriaExcluida,
}) => {
  const [categoriaParaExcluir, setCategoriaParaExcluir] = useState<CategoriaPersonalizada | null>(
    null,
  )
  const [excluindo, setExcluindo] = useState(false)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)

  const handleConfirmarExclusao = async () => {
    if (!categoriaParaExcluir) return
    setExcluindo(true)
    setErroExclusao(null)

    try {
      const res = await excluirCategoriaPersonalizada(
        categoriaParaExcluir.id,
        categoriaParaExcluir.nome,
      )

      if (!res.success) {
        setErroExclusao(res.error || 'Não foi possível excluir a categoria.')
        toast({
          title: 'Exclusão bloqueada',
          description: res.error || 'A categoria não pôde ser excluída.',
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Categoria excluída',
        description: `A categoria "${categoriaParaExcluir.nome}" foi removida com sucesso.`,
      })

      onCategoriaExcluida(categoriaParaExcluir.id, categoriaParaExcluir.nome)
      setCategoriaParaExcluir(null)
    } catch (err) {
      console.error('Erro ao excluir categoria:', err)
      const msg = err instanceof Error ? err.message : 'Erro inesperado ao excluir categoria.'
      setErroExclusao(msg)
      toast({
        title: 'Erro inesperado',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[520px] rounded-2xl p-6 bg-white dark:bg-slate-900 max-h-[85vh] flex flex-col">
          <DialogHeader className="space-y-1.5 pb-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100 flex items-center justify-center font-bold">
                  <Tag className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                </div>
                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Categorias Personalizadas
                </DialogTitle>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onClose()
                  onAbrirNovaCategoria()
                }}
                className="bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold h-9 px-3"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Nova Categoria
              </Button>
            </div>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Gerencie as categorias customizadas criadas para sua marcenaria. As 13 categorias
              fixas do sistema são reservadas e protegidas.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-3 space-y-2.5 min-h-[180px]">
            {categoriasPersonalizadas.length === 0 ? (
              <div className="text-center py-10 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                <Tag className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Nenhuma categoria personalizada
                </p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Você está utilizando as 13 categorias padrão do sistema. Clique em &quot;Nova
                  Categoria&quot; para cadastrar acabamentos customizados.
                </p>
              </div>
            ) : (
              categoriasPersonalizadas.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors"
                >
                  <div className="space-y-0.5 min-w-0 pr-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                        {cat.nome}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                      >
                        Personalizada
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Cadastrada em {new Date(cat.criada_em).toLocaleDateString('pt-BR')}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setErroExclusao(null)
                      setCategoriaParaExcluir(cat)
                    }}
                    className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg shrink-0"
                    title={`Excluir categoria ${cat.nome}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 shrink-0">
            <span className="flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              Categorias com materiais associados não podem ser excluídas.
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="rounded-xl h-8 text-xs border-slate-300"
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog
        open={!!categoriaParaExcluir}
        onOpenChange={(open) => !open && setCategoriaParaExcluir(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <AlertDialogTitle>Excluir categoria personalizada?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-2 pt-1 text-xs text-slate-600">
              <p>
                Tem certeza que deseja excluir a categoria{' '}
                <strong className="text-slate-900">{categoriaParaExcluir?.nome}</strong>?
              </p>
              <p className="text-slate-500">
                A exclusão só será autorizada se nenhum material do catálogo estiver utilizando esta
                categoria.
              </p>
              {erroExclusao && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {erroExclusao}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={excluindo} className="rounded-xl">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarExclusao}
              disabled={excluindo}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
            >
              {excluindo ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Verificando...
                </>
              ) : (
                'Confirmar Exclusão'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
