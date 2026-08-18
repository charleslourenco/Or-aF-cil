import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle, Search, Ruler, Boxes, ArrowRight, Pencil, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ModuleBlueprint } from '@/components/ModuleBlueprint'
import { useToast } from '@/hooks/use-toast'
import {
  fetchTemplatesEngenharia,
  createTemplateEngenharia,
  updateTemplateEngenharia,
  normalizeIconType,
  type TemplateEngenharia,
  type TemplateEngenhariaInput,
  type ModuleIconType,
} from '@/services/templates'

/** Paleta de cores variadas para os badges de tags. */
const TAG_COLORS: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  blue: 'bg-blue-100 text-blue-700 border-blue-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  purple: 'bg-purple-100 text-purple-700 border-purple-200',
  rose: 'bg-rose-100 text-rose-700 border-rose-200',
  cyan: 'bg-cyan-100 text-cyan-700 border-cyan-200',
}

/** Hash determinístico de string -> chave de cor, para cores variadas por tag. */
function colorForTag(tag: string): string {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = (hash << 5) - hash + tag.charCodeAt(i)
    hash |= 0
  }
  const keys = Object.keys(TAG_COLORS)
  return TAG_COLORS[keys[Math.abs(hash) % keys.length]]
}

interface ModuleFormState {
  nome_template: string
  categoria: string
  dimensoes: string
  material: string
  descricao: string
  assinatura_visual: string
  icon_type: ModuleIconType
}

const EMPTY_FORM: ModuleFormState = {
  nome_template: '',
  categoria: '',
  dimensoes: '',
  material: '',
  descricao: '',
  assinatura_visual: '',
  icon_type: 'wardrobe',
}

export default function LibraryPage() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos')
  const [modulos, setModulos] = useState<TemplateEngenharia[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Estado do modal de criação/edição
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ModuleFormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)

  // FETCH REAL DO SUPABASE — catálogo de módulos da tabela TemplatesEngenharia.
  const loadModules = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    const { data, error } = await fetchTemplatesEngenharia()
    if (error) {
      setErrorMsg(error)
      setModulos([])
    } else {
      setModulos(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadModules()
  }, [loadModules])

  // Categorias derivadas dinamicamente dos dados do Supabase.
  const categories = React.useMemo(() => {
    const cats = Array.from(
      new Set(
        modulos
          .map((m) => m.categoria)
          .filter((c): c is string => !!c)
          .flatMap((c) => c.split('/').map((s) => s.trim())),
      ),
    )
    return ['Todos', ...cats]
  }, [modulos])

  const filteredModules = modulos.filter((m) => {
    const term = searchTerm.toLowerCase()
    const tags = (m.assinatura_visual ?? []).join(' ').toLowerCase()
    const matchesSearch =
      m.nome_template.toLowerCase().includes(term) ||
      (m.descricao ?? '').toLowerCase().includes(term) ||
      (m.material ?? '').toLowerCase().includes(term) ||
      tags.includes(term)
    const matchesCat =
      selectedCategory === 'Todos' || (m.categoria ?? '').includes(selectedCategory)
    return matchesSearch && matchesCat
  })

  // --- Modal handlers ---
  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (mod: TemplateEngenharia) => {
    setEditingId(mod.id)
    setForm({
      nome_template: mod.nome_template ?? '',
      categoria: mod.categoria ?? '',
      dimensoes: mod.dimensoes ?? '',
      material: mod.material ?? '',
      descricao: mod.descricao ?? '',
      assinatura_visual: (mod.assinatura_visual ?? []).join(', '),
      icon_type: normalizeIconType(mod.icon_type),
    })
    setFormError(null)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.nome_template.trim()) {
      setFormError('O nome do módulo é obrigatório.')
      return
    }

    const tags = form.assinatura_visual
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    const payload: TemplateEngenhariaInput = {
      nome_template: form.nome_template.trim(),
      categoria: form.categoria.trim() || null,
      dimensoes: form.dimensoes.trim() || null,
      material: form.material.trim() || null,
      descricao: form.descricao.trim() || null,
      icon_type: form.icon_type,
      assinatura_visual: tags.length > 0 ? tags : null,
    }

    setSaving(true)
    const result =
      editingId !== null
        ? await updateTemplateEngenharia(editingId, payload)
        : await createTemplateEngenharia(payload)
    setSaving(false)

    if (result.error || !result.data) {
      setFormError(result.error ?? 'Não foi possível salvar o módulo.')
      toast({
        title: 'Erro ao salvar módulo',
        description: result.error ?? 'Tente novamente.',
        variant: 'destructive',
      })
      return
    }

    // Atualiza a lista localmente sem precisar re-fetchear tudo.
    setModulos((prev) => {
      const exists = prev.some((m) => m.id === result.data!.id)
      const next = exists
        ? prev.map((m) => (m.id === result.data!.id ? result.data! : m))
        : [...prev, result.data!]
      return next.sort((a, b) => a.nome_template.localeCompare(b.nome_template))
    })

    toast({
      title: editingId !== null ? 'Módulo atualizado' : 'Módulo criado',
      description: `${payload.nome_template} foi salvo com sucesso.`,
    })
    setModalOpen(false)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Biblioteca de Módulos Paramétricos
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Catálogo de módulos padrões com peças, ferragens e planos de corte pré-configurados.
          </p>
        </div>

        <Button
          onClick={openCreate}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          Novo Módulo
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar por nome, material, tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        {/* Category chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col"
            >
              <div className="p-4 bg-slate-50/50 border-b border-slate-100">
                <Skeleton className="h-44 w-full rounded-xl" />
              </div>
              <div className="p-5 space-y-3">
                <Skeleton className="h-4 w-1/3 rounded" />
                <Skeleton className="h-4 w-2/3 rounded" />
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-5/6 rounded" />
                <div className="flex gap-1.5 pt-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-9 w-full rounded-xl mt-2" />
              </div>
            </div>
          ))}
        </div>
      ) : errorMsg ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
          <p className="text-sm font-semibold text-slate-800">
            Não foi possível carregar a biblioteca de módulos.
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-md">{errorMsg}</p>
          <Button onClick={loadModules} variant="outline" className="mt-4">
            Tentar novamente
          </Button>
        </div>
      ) : filteredModules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Boxes className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-sm font-semibold text-slate-700">
            Nenhum módulo encontrado com os filtros atuais.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Ajuste a busca ou crie um novo módulo para o catálogo.
          </p>
          <Button onClick={openCreate} className="mt-4 bg-emerald-600 hover:bg-emerald-700">
            <PlusCircle className="w-4 h-4 mr-2" />
            Criar novo módulo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredModules.map((mod) => (
            <div
              key={mod.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col group"
            >
              {/* Blueprint preview */}
              <div className="p-4 bg-slate-50/50 border-b border-slate-100">
                <ModuleBlueprint type={normalizeIconType(mod.icon_type)} className="h-44" />
              </div>

              {/* Content */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    {mod.categoria && (
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold uppercase tracking-wider"
                      >
                        {mod.categoria}
                      </Badge>
                    )}
                    <button
                      type="button"
                      onClick={() => openEdit(mod)}
                      className="text-slate-400 hover:text-emerald-600 transition-colors p-1 rounded-md hover:bg-emerald-50"
                      aria-label={`Editar ${mod.nome_template}`}
                      title="Editar módulo"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>

                  <h3 className="font-bold text-base text-slate-900 mt-2 group-hover:text-emerald-700 transition-colors">
                    {mod.nome_template}
                  </h3>
                  {mod.descricao && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{mod.descricao}</p>
                  )}

                  {/* Tags / assinatura_visual */}
                  {mod.assinatura_visual && mod.assinatura_visual.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {mod.assinatura_visual.map((tag) => (
                        <span
                          key={tag}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colorForTag(
                            tag,
                          )}`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Specs */}
                <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
                  {mod.dimensoes && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Ruler className="w-3.5 h-3.5 text-emerald-600" /> Dimensões:
                      </span>
                      <span className="font-mono font-bold text-slate-800">{mod.dimensoes}</span>
                    </div>
                  )}
                  {mod.material && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Boxes className="w-3.5 h-3.5 text-emerald-600" /> Material:
                      </span>
                      <span
                        className="font-medium text-slate-700 truncate max-w-[170px]"
                        title={mod.material}
                      >
                        {mod.material}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action */}
                <Button
                  asChild
                  className="w-full bg-slate-900 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl transition-colors"
                >
                  <Link to={`/novo-orcamento?modulo=${mod.id}`}>
                    Usar no Orçamento
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Criação/Edição */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId !== null ? 'Editar Módulo' : 'Novo Módulo'}</DialogTitle>
            <DialogDescription>
              {editingId !== null
                ? 'Atualize os dados do módulo do catálogo.'
                : 'Preencha os dados para adicionar um novo módulo à biblioteca.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label htmlFor="nome_template" className="text-xs font-semibold">
                Nome do módulo <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="nome_template"
                value={form.nome_template}
                onChange={(e) => setForm((f) => ({ ...f, nome_template: e.target.value }))}
                placeholder="Ex.: Roupeiro 2 Portas"
                className="h-9 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="categoria" className="text-xs font-semibold">
                  Categoria
                </Label>
                <Input
                  id="categoria"
                  value={form.categoria}
                  onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
                  placeholder="Ex.: Cozinha / Sala"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="icon_type" className="text-xs font-semibold">
                  Tipo de ícone
                </Label>
                <Select
                  value={form.icon_type}
                  onValueChange={(v) => setForm((f) => ({ ...f, icon_type: v as ModuleIconType }))}
                >
                  <SelectTrigger id="icon_type" className="h-9 text-sm">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wardrobe">Roupeiro (wardrobe)</SelectItem>
                    <SelectItem value="counter">Balcão (counter)</SelectItem>
                    <SelectItem value="aerial">Aéreo (aerial)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dimensoes" className="text-xs font-semibold">
                Dimensões
              </Label>
              <Input
                id="dimensoes"
                value={form.dimensoes}
                onChange={(e) => setForm((f) => ({ ...f, dimensoes: e.target.value }))}
                placeholder="L x A x P mm"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="material" className="text-xs font-semibold">
                Material
              </Label>
              <Input
                id="material"
                value={form.material}
                onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))}
                placeholder="Ex.: MDF 18mm Ultra"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="descricao" className="text-xs font-semibold">
                Descrição
              </Label>
              <Textarea
                id="descricao"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Descrição curta do módulo..."
                className="text-sm min-h-[80px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="assinatura_visual" className="text-xs font-semibold">
                Tags (separadas por vírgula)
              </Label>
              <Input
                id="assinatura_visual"
                value={form.assinatura_visual}
                onChange={(e) => setForm((f) => ({ ...f, assinatura_visual: e.target.value }))}
                placeholder="Ex.: Cozinha, Balcão, 2 Portas"
                className="h-9 text-sm"
              />
              <p className="text-[11px] text-slate-400">
                As tags viram badges coloridas no card e também são usadas na busca.
              </p>
            </div>

            {formError && (
              <p className="text-xs text-rose-600 font-medium flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                {formError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? 'Salvando...' : editingId !== null ? 'Salvar alterações' : 'Criar módulo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
