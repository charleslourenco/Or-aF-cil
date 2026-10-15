import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  FileUp,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Package,
  Boxes,
  FileText,
  X,
} from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { createMaterial, type CatalogoMaterial } from '@/services/catalogo'
import type { TemplateEngenharia } from '@/services/templates'
import type { ConfigEngenharia } from '@/services/engenharia'
import type { ServicoAdicional } from '@/services/orcamentos'
import type { ModuloSalvoData } from '@/components/ModuleEditDrawer'
import {
  analisarProjetoPdf,
  converterItemExtraParaServico,
  converterModuloProjeto,
  markupPadraoEngenharia,
  type EtapaImportacao,
  type ItemExtraProjeto,
  type ProjetoExtraido,
} from '@/lib/importacaoProjeto'

/** Resultado entregue ao orçamento quando o usuário confirma a importação. */
export interface ResultadoImportacaoProjeto {
  titulo: string
  observacoes: string[]
  ambientes: { nome: string; modulos: ModuloSalvoData[] }[]
  servicos: ServicoAdicional[]
}

interface ImportarProjetoPdfModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalogo: CatalogoMaterial[]
  templates?: TemplateEngenharia[]
  configEngenharia?: ConfigEngenharia | null
  onImportar: (resultado: ResultadoImportacaoProjeto) => void
  /** Chamado quando um item é cadastrado no catálogo a partir da revisão. */
  onCatalogoAtualizado?: (novo: CatalogoMaterial) => void
  /** Nomes dos ambientes que já existem no orçamento (para inserir os módulos neles). */
  ambientesExistentes?: string[]
}

interface EdicaoExtra {
  quantidade?: number
  preco?: number
}

const ETAPA_LABEL: Record<EtapaImportacao, string> = {
  'lendo-pdf': 'Lendo o texto do PDF...',
  renderizando: 'Preparando as páginas para a IA...',
  'analisando-ia': 'Analisando a prancha com IA (pode levar até 1 minuto)...',
  concluido: 'Análise concluída.',
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

const parseNum = (v: string): number => {
  const n = parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export const ImportarProjetoPdfModal: React.FC<ImportarProjetoPdfModalProps> = ({
  open,
  onOpenChange,
  catalogo,
  templates = [],
  configEngenharia,
  onImportar,
  onCatalogoAtualizado,
  ambientesExistentes = [],
}) => {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [etapa, setEtapa] = useState<EtapaImportacao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [projeto, setProjeto] = useState<ProjetoExtraido | null>(null)
  const [nomesAmbientes, setNomesAmbientes] = useState<Record<number, string>>({})
  const [selecionados, setSelecionados] = useState<Record<string, boolean>>({})
  const [edicoes, setEdicoes] = useState<Record<string, EdicaoExtra>>({})
  const [catalogoLocal, setCatalogoLocal] = useState<CatalogoMaterial[]>(catalogo)
  const [cadastrando, setCadastrando] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const markup = markupPadraoEngenharia(configEngenharia)
  const analisando = etapa !== null && etapa !== 'concluido'

  useEffect(() => {
    setCatalogoLocal(catalogo)
  }, [catalogo])

  // Limpa tudo ao fechar
  useEffect(() => {
    if (!open) {
      setArquivo(null)
      setEtapa(null)
      setErro(null)
      setProjeto(null)
      setSelecionados({})
      setEdicoes({})
      setNomesAmbientes({})
      setCadastrando(null)
    }
  }, [open])

  const receberArquivo = (file: File | null) => {
    if (!file) return
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      setErro('Envie um arquivo PDF (prancha de detalhamento do projeto).')
      return
    }
    if (file.size > 40 * 1024 * 1024) {
      setErro('PDF muito grande (máx. 40MB).')
      return
    }
    setErro(null)
    setArquivo(file)
    setProjeto(null)
  }

  const handleAnalisar = async () => {
    if (!arquivo) return
    setErro(null)
    setProjeto(null)
    try {
      const resultado = await analisarProjetoPdf({
        file: arquivo,
        catalogo: catalogoLocal,
        templates,
        aoMudarEtapa: setEtapa,
      })
      setProjeto(resultado)
      // Seleciona tudo por padrão
      const sel: Record<string, boolean> = {}
      const nomes: Record<number, string> = {}
      // Se o orçamento já tem ambientes, sugere o existente como destino (evita duplicar
      // "Sala" / "Sala - Colaborativo" quando o projeto vem em várias pranchas)
      const destinoPadrao = ambientesExistentes.length === 1 ? ambientesExistentes[0] : null
      resultado.ambientes.forEach((amb, ai) => {
        const jaExiste = ambientesExistentes.find(
          (n) => n.trim().toLowerCase() === (amb.nome || '').trim().toLowerCase(),
        )
        nomes[ai] = jaExiste || destinoPadrao || amb.nome
        amb.modulos.forEach((mod, mi) => {
          sel[`m-${ai}-${mi}`] = true
          mod.itens_extras.forEach((_, ei) => {
            sel[`e-${ai}-${mi}-${ei}`] = true
          })
        })
      })
      resultado.itens_extras_gerais.forEach((_, gi) => {
        sel[`g-${gi}`] = true
      })
      setSelecionados(sel)
      setNomesAmbientes(nomes)
      const totalMod = resultado.ambientes.reduce((acc, a) => acc + a.modulos.length, 0)
      toast({
        title: 'Prancha analisada',
        description: `${totalMod} módulo(s) identificado(s). Revise e confirme a importação.`,
      })
    } catch (err: any) {
      console.error('Falha ao analisar o projeto em PDF:', err)
      setEtapa(null)
      setErro(err?.message || 'Não foi possível analisar o PDF.')
    }
  }

  const toggle = (key: string, value: boolean) =>
    setSelecionados((prev) => ({ ...prev, [key]: value }))

  const editar = (key: string, patch: EdicaoExtra) =>
    setEdicoes((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), ...patch } }))

  /** Aplica quantidade/preço editados e o catálogo local sobre um item extra. */
  const extraEfetivo = (extra: ItemExtraProjeto, key: string): ItemExtraProjeto => {
    const ed = edicoes[key] || {}
    const doCatalogo = extra.catalogo_id
      ? catalogoLocal.find((c) => c.id === extra.catalogo_id)
      : undefined
    return {
      ...extra,
      quantidade: ed.quantidade !== undefined ? ed.quantidade : extra.quantidade,
      preco_custo_estimado: doCatalogo
        ? Number(doCatalogo.preco_custo) || 0
        : ed.preco !== undefined
          ? ed.preco
          : extra.preco_custo_estimado,
    }
  }

  const atualizarExtraNoProjeto = (
    ai: number | null,
    mi: number | null,
    ei: number,
    patch: Partial<ItemExtraProjeto>,
  ) => {
    setProjeto((prev) => {
      if (!prev) return prev
      if (ai === null || mi === null) {
        const gerais = prev.itens_extras_gerais.map((e, i) => (i === ei ? { ...e, ...patch } : e))
        return { ...prev, itens_extras_gerais: gerais }
      }
      const ambientes = prev.ambientes.map((amb, a) => {
        if (a !== ai) return amb
        return {
          ...amb,
          modulos: amb.modulos.map((mod, m) => {
            if (m !== mi) return mod
            return {
              ...mod,
              itens_extras: mod.itens_extras.map((e, i) => (i === ei ? { ...e, ...patch } : e)),
            }
          }),
        }
      })
      return { ...prev, ambientes }
    })
  }

  const handleCadastrarNoCatalogo = async (
    extra: ItemExtraProjeto,
    key: string,
    ai: number | null,
    mi: number | null,
    ei: number,
  ) => {
    const efetivo = extraEfetivo(extra, key)
    setCadastrando(key)
    try {
      const criado = await createMaterial({
        nome_material: efetivo.descricao,
        categoria: efetivo.categoria_sugerida || 'Outro',
        unidade: efetivo.unidade || 'un',
        preco_custo: efetivo.preco_custo_estimado || 0,
        nivel_padrao: 'padrao',
        ativo: true,
      })
      if (!criado) throw new Error('O Supabase não confirmou o cadastro do material.')
      setCatalogoLocal((prev) => [...prev, criado])
      onCatalogoAtualizado?.(criado)
      atualizarExtraNoProjeto(ai, mi, ei, {
        catalogo_id: criado.id,
        catalogo_nome: criado.nome_material,
        item_nao_cadastrado: false,
        preco_custo_estimado: Number(criado.preco_custo) || 0,
      })
      toast({
        title: 'Item cadastrado no catálogo',
        description: `"${criado.nome_material}" agora faz parte do catálogo de materiais.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao cadastrar no catálogo',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setCadastrando(null)
    }
  }

  const resumoSelecao = useMemo(() => {
    if (!projeto) return { modulos: 0, extras: 0 }
    let modulos = 0
    let extras = 0
    projeto.ambientes.forEach((amb, ai) => {
      amb.modulos.forEach((mod, mi) => {
        if (!selecionados[`m-${ai}-${mi}`]) return
        modulos += 1
        mod.itens_extras.forEach((_, ei) => {
          if (selecionados[`e-${ai}-${mi}-${ei}`]) extras += 1
        })
      })
    })
    projeto.itens_extras_gerais.forEach((_, gi) => {
      if (selecionados[`g-${gi}`]) extras += 1
    })
    return { modulos, extras }
  }, [projeto, selecionados])

  const handleConfirmar = () => {
    if (!projeto) return
    const ambientes: ResultadoImportacaoProjeto['ambientes'] = []
    projeto.ambientes.forEach((amb, ai) => {
      const modulos: ModuloSalvoData[] = []
      amb.modulos.forEach((mod, mi) => {
        if (!selecionados[`m-${ai}-${mi}`]) return
        const extrasSelecionados = mod.itens_extras
          .map((e, ei) => ({ e, key: `e-${ai}-${mi}-${ei}` }))
          .filter(({ key }) => selecionados[key])
          .map(({ e, key }) => extraEfetivo(e, key))
        modulos.push(
          converterModuloProjeto({
            modulo: mod,
            catalogo: catalogoLocal,
            configEngenharia,
            templates,
            extrasSelecionados,
          }),
        )
      })
      if (modulos.length > 0) {
        ambientes.push({ nome: (nomesAmbientes[ai] || amb.nome || 'Ambiente').trim(), modulos })
      }
    })

    const servicos: ServicoAdicional[] = projeto.itens_extras_gerais
      .map((e, gi) => ({ e, key: `g-${gi}` }))
      .filter(({ key }) => selecionados[key])
      .map(({ e, key }) => converterItemExtraParaServico(extraEfetivo(e, key), markup))

    if (ambientes.length === 0 && servicos.length === 0) {
      toast({
        title: 'Nada selecionado',
        description: 'Marque ao menos um módulo ou item para importar.',
        variant: 'destructive',
      })
      return
    }

    onImportar({
      titulo: projeto.projeto.titulo,
      observacoes: projeto.projeto.observacoes || [],
      ambientes,
      servicos,
    })
    onOpenChange(false)
  }

  const renderExtra = (
    extra: ItemExtraProjeto,
    key: string,
    ai: number | null,
    mi: number | null,
    ei: number,
  ) => {
    const efetivo = extraEfetivo(extra, key)
    const marcado = Boolean(selecionados[key])
    const doCatalogo = Boolean(efetivo.catalogo_id)
    const subtotal = (efetivo.quantidade || 0) * (efetivo.preco_custo_estimado || 0)
    return (
      <div
        key={key}
        className={cn(
          'flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs',
          marcado
            ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
            : 'border-dashed border-slate-200 dark:border-slate-800 opacity-60',
        )}
      >
        <Checkbox
          checked={marcado}
          onCheckedChange={(v) => toggle(key, v === true)}
          aria-label={`Incluir ${efetivo.descricao}`}
        />
        <div className="flex-1 min-w-[180px]">
          <p className="font-semibold text-slate-800 dark:text-slate-100">{efetivo.descricao}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {efetivo.categoria_sugerida}
            {efetivo.origem_texto ? ` • "${efetivo.origem_texto}"` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-slate-500">Qtd</span>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={efetivo.quantidade}
            onChange={(e) => editar(key, { quantidade: parseNum(e.target.value) })}
            className="h-7 w-20 text-xs"
          />
          <span className="text-[11px] text-slate-500">{efetivo.unidade}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-slate-500">Custo un.</span>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={efetivo.preco_custo_estimado}
            disabled={doCatalogo}
            onChange={(e) => editar(key, { preco: parseNum(e.target.value) })}
            className="h-7 w-24 text-xs"
          />
        </div>
        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 w-24 text-right">
          {formatCurrency(subtotal)}
        </span>
        {doCatalogo ? (
          <Badge
            variant="outline"
            className="text-[10px] border-emerald-300 text-emerald-700 dark:text-emerald-300"
          >
            <Package className="w-3 h-3 mr-1" />
            {efetivo.catalogo_nome || 'No catálogo'}
          </Badge>
        ) : (
          <>
            <Badge
              variant="outline"
              className="text-[10px] border-amber-300 text-amber-700 dark:text-amber-300"
            >
              <AlertCircle className="w-3 h-3 mr-1" />
              Não cadastrado (custo estimado)
            </Badge>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={cadastrando === key}
              onClick={() => handleCadastrarNoCatalogo(extra, key, ai, mi, ei)}
              className="h-7 px-2 text-[11px]"
            >
              {cadastrando === key ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <PlusCircle className="w-3 h-3 mr-1" />
              )}
              Cadastrar no catálogo
            </Button>
          </>
        )}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !analisando && onOpenChange(v)}>
      <DialogContent className="w-[96vw] max-w-5xl h-[90vh] max-h-[90vh] p-0 flex flex-col gap-0 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-left shrink-0">
          <div className="flex items-center gap-2 pr-8">
            <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shrink-0">
              <FileUp className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                Importar projeto em PDF
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 truncate">
                A IA lê a prancha de detalhamento, identifica os módulos e os itens extras (tomadas,
                passa-fios, vidro, metal...) e você revisa antes de inserir no orçamento
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0 space-y-4">
          {/* Etapa 1: arquivo */}
          {!projeto && (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragOver(true)
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragOver(false)
                receberArquivo(e.dataTransfer.files?.[0] || null)
              }}
              className={cn(
                'rounded-2xl border-2 border-dashed p-8 text-center transition-colors',
                isDragOver
                  ? 'border-slate-900 dark:border-slate-100 bg-slate-100 dark:bg-slate-900'
                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/50',
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => receberArquivo(e.target.files?.[0] || null)}
              />
              {arquivo ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="w-10 h-10 text-slate-700 dark:text-slate-200" />
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {arquivo.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {(arquivo.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                  {!analisando && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setArquivo(null)}
                      className="h-7 text-xs"
                    >
                      <X className="w-3 h-3 mr-1" /> Trocar arquivo
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <FileUp className="w-10 h-10 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Arraste a prancha em PDF aqui
                  </p>
                  <p className="text-xs text-slate-500">
                    ou{' '}
                    <button
                      type="button"
                      className="underline font-semibold"
                      onClick={() => inputRef.current?.click()}
                    >
                      selecione o arquivo
                    </button>{' '}
                    (detalhamento de mobiliário do arquiteto, até 6 páginas analisadas)
                  </p>
                </div>
              )}
            </div>
          )}

          {analisando && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-slate-700 dark:text-slate-200" />
              <span className="text-slate-700 dark:text-slate-200">
                {etapa ? ETAPA_LABEL[etapa] : 'Processando...'}
              </span>
            </div>
          )}

          {erro && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* Etapa 2: revisão */}
          {projeto && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {projeto.projeto.titulo}
                  </p>
                </div>
                {projeto.resumo && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    {projeto.resumo}
                  </p>
                )}
                {(projeto.projeto.cliente || projeto.projeto.responsavel_tecnico) && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    {projeto.projeto.cliente ? `Cliente: ${projeto.projeto.cliente}` : ''}
                    {projeto.projeto.cliente && projeto.projeto.responsavel_tecnico ? ' • ' : ''}
                    {projeto.projeto.responsavel_tecnico
                      ? `Resp. técnico: ${projeto.projeto.responsavel_tecnico}`
                      : ''}
                  </p>
                )}
                {projeto.projeto.observacoes.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                    {projeto.projeto.observacoes.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                )}
              </div>

              {projeto.ambientes.map((amb, ai) => (
                <div
                  key={`amb-${ai}`}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
                >
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/60">
                    <Boxes className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                    <span className="text-[11px] uppercase tracking-wide text-slate-500">
                      Inserir no ambiente
                    </span>
                    {ambientesExistentes.length > 0 && (
                      <Select
                        value={
                          ambientesExistentes.includes(nomesAmbientes[ai] ?? amb.nome)
                            ? (nomesAmbientes[ai] ?? amb.nome)
                            : '__novo__'
                        }
                        onValueChange={(v) =>
                          setNomesAmbientes((prev) => ({
                            ...prev,
                            [ai]: v === '__novo__' ? amb.nome : v,
                          }))
                        }
                      >
                        <SelectTrigger className="h-7 w-56 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ambientesExistentes.map((n) => (
                            <SelectItem key={n} value={n} className="text-xs">
                              {n} (já existe)
                            </SelectItem>
                          ))}
                          <SelectItem value="__novo__" className="text-xs">
                            Novo ambiente…
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <Input
                      value={nomesAmbientes[ai] ?? amb.nome}
                      onChange={(e) =>
                        setNomesAmbientes((prev) => ({ ...prev, [ai]: e.target.value }))
                      }
                      className="h-7 max-w-xs text-sm font-semibold"
                    />
                    <span className="text-[11px] text-slate-400">(prancha: {amb.nome})</span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {amb.modulos.map((mod, mi) => {
                      const key = `m-${ai}-${mi}`
                      const marcado = Boolean(selecionados[key])
                      const c = mod.composicao
                      const partes: string[] = []
                      if (c.portas.qtd > 0)
                        partes.push(`${c.portas.qtd} porta(s) de ${c.portas.tipo}`)
                      if (c.gavetas.qtd > 0) partes.push(`${c.gavetas.qtd} gaveta(s)`)
                      if (c.prateleiras.qtd > 0) partes.push(`${c.prateleiras.qtd} prateleira(s)`)
                      if (c.divisorias.qtd > 0) partes.push(`${c.divisorias.qtd} divisória(s)`)
                      if (c.cabideiro) partes.push('cabideiro')
                      if (c.iluminacao_led) partes.push('LED')
                      if (c.puxadores.qtd > 0)
                        partes.push(
                          `${c.puxadores.qtd} puxador(es)${c.puxadores.tipo ? ` ${c.puxadores.tipo}` : ''}`,
                        )
                      if (c.tampo) partes.push(`tampo: ${c.tampo}`)
                      return (
                        <div key={key} className={cn('px-4 py-3', !marcado && 'opacity-60')}>
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={marcado}
                              onCheckedChange={(v) => toggle(key, v === true)}
                              className="mt-1"
                              aria-label={`Incluir módulo ${mod.nome}`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                  {mod.codigo ? `${mod.codigo} – ` : ''}
                                  {mod.nome}
                                </p>
                                <Badge variant="secondary" className="text-[10px]">
                                  {mod.tipo_movel === 'tampo_estrutura'
                                    ? 'Tampo sobre estrutura'
                                    : mod.tipo_movel === 'metalico'
                                      ? 'Metálico / sem MDF'
                                      : mod.perfil_construtivo}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-[10px]',
                                    mod.confianca === 'alta'
                                      ? 'border-emerald-300 text-emerald-700 dark:text-emerald-300'
                                      : mod.confianca === 'media'
                                        ? 'border-amber-300 text-amber-700 dark:text-amber-300'
                                        : 'border-red-300 text-red-700 dark:text-red-300',
                                  )}
                                >
                                  confiança {mod.confianca}
                                </Badge>
                                {mod.quantidade > 1 && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {mod.quantidade} un.
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                                {mod.dimensoes_mm.largura}×{mod.dimensoes_mm.altura}×
                                {mod.dimensoes_mm.profundidade} mm • Externo: {mod.mdf_externo.cor}{' '}
                                {mod.mdf_externo.espessura}mm • Interno: {mod.mdf_interno.cor}{' '}
                                {mod.mdf_interno.espessura}mm
                              </p>
                              {partes.length > 0 && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  {partes.join(' • ')}
                                </p>
                              )}
                              {mod.descricao && (
                                <p className="text-[11px] italic text-slate-500 dark:text-slate-400 mt-0.5">
                                  {mod.descricao}
                                </p>
                              )}
                              {mod.itens_extras.length > 0 && (
                                <div className="mt-2 space-y-1.5">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                    Itens extras lidos na prancha
                                  </p>
                                  {mod.itens_extras.map((extra, ei) =>
                                    renderExtra(extra, `e-${ai}-${mi}-${ei}`, ai, mi, ei),
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              {projeto.itens_extras_gerais.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Itens do projeto sem módulo (entram como serviços/complementos)
                  </p>
                  {projeto.itens_extras_gerais.map((extra, gi) =>
                    renderExtra(extra, `g-${gi}`, null, null, gi),
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex-row items-center justify-between gap-2">
          <div className="text-xs text-slate-500">
            {projeto
              ? `${resumoSelecao.modulos} módulo(s) e ${resumoSelecao.extras} item(ns) extra(s) selecionados`
              : 'A análise usa o catálogo atual para reconhecer os itens.'}
          </div>
          <div className="flex items-center gap-2">
            {projeto && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setProjeto(null)
                  setEtapa(null)
                }}
              >
                Analisar outro PDF
              </Button>
            )}
            {!projeto ? (
              <Button type="button" disabled={!arquivo || analisando} onClick={handleAnalisar}>
                {analisando ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                Analisar prancha
              </Button>
            ) : (
              <Button type="button" onClick={handleConfirmar}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Inserir no orçamento
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
