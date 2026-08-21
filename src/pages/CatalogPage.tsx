import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Star,
  Loader2,
  AlertCircle,
  Package,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  fetchCatalogoMateriais,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  CATEGORIAS_MATERIAL,
  UNIDADES_MATERIAL,
  type CatalogoMaterial,
} from '@/services/catalogo'

/** Estilos de badge por categoria (cores conforme especificação). */
const CATEGORIA_BADGE: Record<string, string> = {
  'MDF 15mm': 'bg-blue-100 text-blue-700 border-blue-200',
  'MDF 18mm': 'bg-slate-200 text-slate-800 border-slate-300',
  'MDF 6mm': 'bg-purple-100 text-purple-700 border-purple-200',
  'Fita de Borda': 'bg-orange-100 text-orange-700 border-orange-200',
  Ferragem: 'bg-slate-700 text-white border-slate-700',
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(val) || 0)

interface FormState {
  nome_material: string
  categoria: string
  unidade: string
  preco_custo: string
  nivel_padrao: 'padrao' | 'premium'
}

const EMPTY_FORM: FormState = {
  nome_material: '',
  categoria: 'MDF 15mm',
  unidade: 'm²',
  preco_custo: '',
  nivel_padrao: 'padrao',
}

export default function CatalogPage() {
  const [materiais, setMateriais] = useState<CatalogoMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todos')

  // Modal de cadastro/edição
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Dialog de exclusão
  const [deleteTarget, setDeleteTarget] = useState<CatalogoMaterial | null>(null)
  const [deleting, setDeleting] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCatalogoMateriais()
      if (data === null) {
        setError('Não foi possível carregar o catálogo. Verifique sua conexão com o servidor.')
        setMateriais([])
      } else {
        setMateriais(data)
      }
    } catch (err) {
      console.error('Erro ao carregar catálogo:', err)
      setError('Ocorreu um erro inesperado ao carregar o catálogo.')
      setMateriais([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Filtro no frontend (busca por nome + categoria)
  const materiaisFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return materiais.filter((m) => {
      const matchBusca = !termo || m.nome_material.toLowerCase().includes(termo)
      const matchCategoria = categoriaFiltro === 'todos' || m.categoria === categoriaFiltro
      return matchBusca && matchCategoria
    })
  }, [materiais, busca, categoriaFiltro])

  const abrirModalNovo = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const abrirModalEdicao = (m: CatalogoMaterial) => {
    setEditingId(m.id)
    setForm({
      nome_material: m.nome_material,
      categoria: m.categoria,
      unidade: m.unidade,
      preco_custo: String(m.preco_custo),
      nivel_padrao: m.nivel_padrao === 'premium' ? 'premium' : 'padrao',
    })
    setModalOpen(true)
  }

  const handleSalvar = async () => {
    if (!form.nome_material.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe o nome do material.',
        variant: 'destructive',
      })
      return
    }
    const preco = Number(form.preco_custo.replace(',', '.'))
    if (Number.isNaN(preco) || preco < 0) {
      toast({
        title: 'Preço inválido',
        description: 'Informe um preço de custo válido.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    const payload = {
      nome_material: form.nome_material.trim(),
      categoria: form.categoria,
      unidade: form.unidade,
      preco_custo: preco,
      nivel_padrao: form.nivel_padrao,
    }

    try {
      const result = editingId
        ? await updateMaterial(editingId, payload)
        : await createMaterial(payload)

      if (!result) {
        toast({
          title: 'Erro ao salvar',
          description: editingId
            ? 'Não foi possível atualizar o material. Verifique os dados e tente novamente.'
            : 'Não foi possível criar o material. Verifique os dados e tente novamente.',
          variant: 'destructive',
        })
        return
      }

      toast({
        title: editingId ? 'Material atualizado!' : 'Material cadastrado!',
        description: `${payload.nome_material} foi salvo no catálogo com sucesso.`,
      })
      setModalOpen(false)
      await carregar()
    } catch (err) {
      console.error('Exceção ao salvar material:', err)
      toast({
        title: 'Erro inesperado',
        description: 'Ocorreu um erro ao tentar salvar o material.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmarExclusao = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const ok = await deleteMaterial(deleteTarget.id)
      if (!ok) {
        toast({
          title: 'Erro ao excluir',
          description: 'Não foi possível excluir o material. Tente novamente.',
          variant: 'destructive',
        })
        return
      }
      toast({
        title: 'Material excluído',
        description: `${deleteTarget.nome_material} foi removido do catálogo.`,
      })
      setDeleteTarget(null)
      await carregar()
    } catch (err) {
      console.error('Exceção ao excluir material:', err)
      toast({
        title: 'Erro inesperado',
        description: 'Ocorreu um erro ao tentar excluir o material.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Catálogo de Materiais
          </h2>
          <p className="text-sm text-slate-500">
            Gerencie chapas, ferragens, fitas de borda e acabamentos
          </p>
        </div>
        <Button
          onClick={abrirModalNovo}
          className="bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-xl h-11 px-5 shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Novo Material
        </Button>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome do material..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-11 rounded-xl pl-9 border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20"
          />
        </div>
        <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
          <SelectTrigger className="h-11 rounded-xl border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="todos">Todas as categorias</SelectItem>
            {CATEGORIAS_MATERIAL.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Conteúdo: estados */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="h-4 flex-1 rounded bg-slate-200" />
                <div className="h-5 w-20 rounded-full bg-slate-200" />
                <div className="h-4 w-10 rounded bg-slate-200" />
                <div className="h-4 w-20 rounded bg-slate-200" />
                <div className="h-4 w-16 rounded bg-slate-200" />
                <div className="h-8 w-16 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-8 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-800">{error}</p>
          <Button variant="outline" onClick={carregar} className="rounded-xl">
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Tentar novamente
          </Button>
        </div>
      ) : materiaisFiltrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 shadow-sm p-10 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
            <Package className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-bold text-slate-800">
              {materiais.length === 0 ? 'Nenhum material cadastrado' : 'Nenhum material encontrado'}
            </p>
            <p className="text-sm text-slate-500 max-w-md">
              {materiais.length === 0
                ? 'Comece adicionando o primeiro material ao catálogo.'
                : 'Ajuste os filtros de busca para encontrar materiais.'}
            </p>
          </div>
          {materiais.length === 0 ? (
            <Button
              onClick={abrirModalNovo}
              className="bg-slate-700 hover:bg-slate-800 text-white rounded-xl"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Adicionar primeiro material
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                setBusca('')
                setCategoriaFiltro('todos')
              }}
              className="rounded-xl"
            >
              Limpar filtros
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="min-w-[220px]">Nome do Material</TableHead>
                  <TableHead className="min-w-[140px]">Categoria</TableHead>
                  <TableHead className="min-w-[80px]">Unidade</TableHead>
                  <TableHead className="min-w-[120px] text-right">Preço de Custo</TableHead>
                  <TableHead className="min-w-[120px]">Nível</TableHead>
                  <TableHead className="min-w-[120px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materiaisFiltrados.map((m) => (
                  <TableRow key={m.id} className="hover:bg-slate-50/60">
                    <TableCell className="font-medium text-slate-900">{m.nome_material}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'font-semibold border',
                          CATEGORIA_BADGE[m.categoria] ??
                            'bg-slate-100 text-slate-700 border-slate-200',
                        )}
                      >
                        {m.categoria}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">{m.unidade}</TableCell>
                    <TableCell className="text-right font-mono font-semibold text-slate-900">
                      {formatCurrency(m.preco_custo)}
                    </TableCell>
                    <TableCell>
                      {m.nivel_padrao === 'premium' ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-semibold text-sm">
                          <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                          <Star className="w-4 h-4 fill-amber-500 text-amber-500 -ml-1.5" />
                          Premium
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-600 font-semibold text-sm">
                          <Star className="w-4 h-4 fill-slate-300 text-slate-300" />
                          Padrão
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                          onClick={() => abrirModalEdicao(m)}
                          aria-label={`Editar ${m.nome_material}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-rose-700 hover:bg-rose-50"
                          onClick={() => setDeleteTarget(m)}
                          aria-label={`Excluir ${m.nome_material}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Modal de Cadastro/Edição */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Material' : 'Novo Material'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Atualize as informações do material do catálogo.'
                : 'Preencha os dados do novo material do catálogo.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Nome */}
            <div className="space-y-1.5">
              <Label htmlFor="mat-nome" className="text-xs font-bold uppercase tracking-wide">
                Nome do Material
              </Label>
              <Input
                id="mat-nome"
                placeholder="Ex.: MDF 15mm Branco TX"
                value={form.nome_material}
                onChange={(e) => setForm((prev) => ({ ...prev, nome_material: e.target.value }))}
                className="h-11 rounded-xl border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20"
              />
            </div>

            {/* Categoria + Unidade */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wide">Categoria</Label>
                <Select
                  value={form.categoria}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, categoria: v }))}
                >
                  <SelectTrigger className="h-11 rounded-xl border-slate-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {CATEGORIAS_MATERIAL.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wide">Unidade</Label>
                <Select
                  value={form.unidade}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, unidade: v }))}
                >
                  <SelectTrigger className="h-11 rounded-xl border-slate-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {UNIDADES_MATERIAL.map((un) => (
                      <SelectItem key={un} value={un}>
                        {un}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Preço */}
            <div className="space-y-1.5">
              <Label htmlFor="mat-preco" className="text-xs font-bold uppercase tracking-wide">
                Preço de Custo (R$)
              </Label>
              <div className="relative">
                <Input
                  id="mat-preco"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={form.preco_custo}
                  onChange={(e) => setForm((prev) => ({ ...prev, preco_custo: e.target.value }))}
                  className="h-11 rounded-xl border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20 pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  R$
                </span>
              </div>
            </div>

            {/* Nível */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide">Nível</Label>
              <ToggleGroup
                type="single"
                value={form.nivel_padrao}
                onValueChange={(v) =>
                  v && setForm((prev) => ({ ...prev, nivel_padrao: v as 'padrao' | 'premium' }))
                }
                className="justify-start bg-slate-50 border border-slate-200 rounded-xl p-1 h-11 w-full"
              >
                <ToggleGroupItem
                  value="padrao"
                  className="flex-1 h-9 text-xs font-semibold data-[state=on]:bg-slate-700 data-[state=on]:text-white rounded-lg inline-flex items-center gap-1"
                >
                  <Star className="w-3.5 h-3.5" />
                  Padrão
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="premium"
                  className="flex-1 h-9 text-xs font-semibold data-[state=on]:bg-slate-700 data-[state=on]:text-white rounded-lg inline-flex items-center gap-1"
                >
                  <Star className="w-3.5 h-3.5" />
                  <Star className="w-3.5 h-3.5 -ml-1.5" />
                  Premium
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              className="rounded-xl"
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSalvar}
              disabled={saving}
              className="bg-slate-700 hover:bg-slate-800 text-white rounded-xl min-w-[120px]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir material?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir{' '}
              <strong className="text-slate-900">{deleteTarget?.nome_material}</strong>? O material
              será desativado do catálogo e não aparecerá mais nas cotações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl" disabled={deleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarExclusao}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
