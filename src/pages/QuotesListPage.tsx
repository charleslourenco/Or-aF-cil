import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  FileSpreadsheet,
  PlusCircle,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  Calendar,
  Layers,
  FileText,
  Settings,
  RefreshCw,
  AlertCircle,
  Loader2,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from '@/hooks/use-toast'
import { fetchOrcamentos, deleteOrcamento, type Orcamento } from '@/services/orcamentos'
import { fetchPerfilEmpresa, type PerfilEmpresa } from '@/services/empresa'
import {
  downloadPropostaComercialFromOrcamento,
  downloadAnaliseCustoFromOrcamento,
} from '@/lib/pdf'

export default function QuotesListPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [loading, setLoading] = useState(true)
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [perfilEmpresa, setPerfilEmpresa] = useState<PerfilEmpresa | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [quotesRes, empresaRes] = await Promise.all([fetchOrcamentos(), fetchPerfilEmpresa()])
      setOrcamentos(quotesRes ?? [])
      if (empresaRes?.data) {
        setPerfilEmpresa(empresaRes.data)
      }
    } catch (err) {
      console.error('Erro ao buscar lista de orçamentos:', err)
      toast({
        title: 'Erro ao carregar orçamentos',
        description: 'Não foi possível buscar os orçamentos do banco de dados.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const formatCurrency = (val: number | string | null | undefined) => {
    const num = typeof val === 'number' ? val : parseFloat(String(val || 0)) || 0
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num)
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—'
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return dateStr
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(date)
    } catch {
      return dateStr
    }
  }

  const handleDownloadProposta = async (orcamento: Orcamento) => {
    setDownloadingId(`proposta-${orcamento.id}`)
    try {
      await downloadPropostaComercialFromOrcamento(orcamento, perfilEmpresa)
      toast({
        title: '✓ Proposta Comercial Gerada',
        description: `Download do PDF para ${orcamento.cliente_nome} concluído.`,
      })
    } catch (err: unknown) {
      console.error('Erro ao gerar proposta comercial:', err)
      const errorMsg =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Não foi possível gerar a Proposta Comercial.'
      toast({
        title: 'Erro ao gerar Proposta Comercial',
        description: errorMsg,
        variant: 'destructive',
      })
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDownloadAnaliseCusto = async (orcamento: Orcamento) => {
    setDownloadingId(`custo-${orcamento.id}`)
    try {
      await downloadAnaliseCustoFromOrcamento(orcamento, perfilEmpresa)
      toast({
        title: '✓ Análise de Custo Gerada',
        description: `Download do relatório técnico de ${orcamento.cliente_nome} concluído.`,
      })
    } catch (err: unknown) {
      console.error('Erro ao gerar análise de custo:', err)
      const errorMsg =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Não foi possível gerar a Análise de Custo.'
      toast({
        title: 'Erro ao gerar Análise de Custo',
        description: errorMsg,
        variant: 'destructive',
      })
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDelete = async (orcamento: Orcamento) => {
    const codigo = `#${String(orcamento.numero_sequencial ?? 0).padStart(3, '0')}`
    setDeletingId(orcamento.id)
    try {
      const success = await deleteOrcamento(orcamento.id)
      if (success) {
        toast({
          title: 'Orçamento excluído',
          description: `Orçamento ${codigo} excluído com sucesso.`,
        })
        await loadData()
      } else {
        toast({
          title: 'Erro ao excluir orçamento',
          description: 'Não foi possível excluir o orçamento.',
          variant: 'destructive',
        })
      }
    } catch (err) {
      console.error('Erro ao excluir orçamento:', err)
      toast({
        title: 'Erro ao excluir orçamento',
        description: 'Não foi possível excluir o orçamento.',
        variant: 'destructive',
      })
    } finally {
      setDeletingId(null)
    }
  }

  const filteredQuotes = orcamentos.filter((q) => {
    const term = searchTerm.toLowerCase()
    const matchesSearch =
      (q.cliente_nome || '').toLowerCase().includes(term) ||
      (q.ambiente || '').toLowerCase().includes(term) ||
      (q.modulo || '').toLowerCase().includes(term) ||
      (q.id || '').toLowerCase().includes(term)
    const matchesStatus = statusFilter === 'Todos' || q.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string | null | undefined) => {
    switch (status) {
      case 'Aprovado':
        return (
          <Badge className="bg-slate-200 text-slate-900 hover:bg-slate-200 border-none font-semibold text-[11px]">
            ✓ Aprovado
          </Badge>
        )
      case 'Em Negociação':
      case 'Em Análise':
        return (
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none font-semibold text-[11px]">
            ⏳ Em Negociação
          </Badge>
        )
      case 'Concluído':
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-none font-semibold text-[11px]">
            ★ Concluído
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-slate-600 font-semibold text-[11px]">
            Rascunho
          </Badge>
        )
    }
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Orçamentos do Sistema
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Histórico completo de projetos orçados no banco de dados com geração de PDF comercial
              e análise de custos fabris.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs h-10"
              title="Atualizar lista"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button
              asChild
              className="bg-slate-700 hover:bg-slate-800 text-white font-semibold shadow-sm rounded-xl text-xs h-10"
            >
              <Link to="/orcamento-v2">
                <PlusCircle className="w-4 h-4 mr-2" />
                Novo Orçamento
              </Link>
            </Button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar por cliente, ambiente ou módulo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Status filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {['Todos', 'Aprovado', 'Em Negociação', 'Rascunho'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  statusFilter === st
                    ? 'bg-slate-700 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Quotes Table Container */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Skeleton de Carregamento */}
          {loading && (
            <div className="p-5 space-y-3">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          )}

          {/* Estado Vazio (Sem orçamentos) */}
          {!loading && orcamentos.length === 0 && (
            <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <FileSpreadsheet className="w-7 h-7" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h4 className="text-base font-bold text-slate-900">Nenhum orçamento cadastrado</h4>
                <p className="text-xs text-slate-500">
                  Gere seu primeiro orçamento paramétrico com peças e precificação comercial.
                </p>
              </div>
              <Button
                asChild
                className="mt-2 bg-slate-700 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-sm"
              >
                <Link to="/orcamento-v2">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Criar Primeiro Orçamento
                </Link>
              </Button>
            </div>
          )}

          {/* Tabela de Dados Reais */}
          {!loading && orcamentos.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 font-semibold text-xs uppercase tracking-wider">
                    <th className="py-3.5 px-4">Código / Data</th>
                    <th className="py-3.5 px-4">Cliente</th>
                    <th className="py-3.5 px-4">Ambiente & Módulo</th>
                    <th className="py-3.5 px-4 text-right">Custo Fabril (MP)</th>
                    <th className="py-3.5 px-4 text-right text-slate-900">Valor de Venda</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-center">Exportar PDF</th>
                    <th className="py-3.5 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredQuotes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500 text-xs">
                        Nenhum orçamento corresponde aos filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredQuotes.map((q) => {
                      const codigo = `#${String(q.numero_sequencial ?? 0).padStart(3, '0')}`
                      const totalCost =
                        q.dre_json?.custo_mp ??
                        (q.bom_json ?? []).reduce((acc, it) => acc + (Number(it.totalCost) || 0), 0)

                      return (
                        <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-slate-900 block text-xs">
                              {codigo}
                            </span>
                            <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3" /> {formatDate(q.data || q.created_at)}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900 flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                                {q.cliente_nome ? q.cliente_nome.charAt(0).toUpperCase() : 'C'}
                              </div>
                              {q.cliente_nome}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {q.ambientes_json &&
                            Array.isArray(q.ambientes_json) &&
                            q.ambientes_json.length > 0 ? (
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Badge
                                    variant="outline"
                                    className="bg-slate-100 text-slate-800 border-slate-300 font-medium text-[11px] px-2 py-0.5"
                                  >
                                    {q.ambientes_json.length}{' '}
                                    {q.ambientes_json.length === 1 ? 'ambiente' : 'ambientes'} ·{' '}
                                    {q.ambientes_json.reduce(
                                      (acc, a) => acc + (a.modulos?.length || 0),
                                      0,
                                    )}{' '}
                                    {q.ambientes_json.reduce(
                                      (acc, a) => acc + (a.modulos?.length || 0),
                                      0,
                                    ) === 1
                                      ? 'módulo'
                                      : 'módulos'}
                                  </Badge>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-1 truncate max-w-[240px]">
                                  {q.ambientes_json.map((a) => a.nome).join(', ')}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="text-slate-800 font-medium">
                                  {q.modulo || 'Módulo Planejado'}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {q.ambiente || 'Ambiente'}{' '}
                                  {q.bom_json?.length ? `• ${q.bom_json.length} peças` : ''}
                                </div>
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono text-slate-600 text-xs">
                            {formatCurrency(totalCost)}
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800">
                            {formatCurrency(q.valor_total)}
                          </td>

                          <td className="py-3.5 px-4 text-center">{getStatusBadge(q.status)}</td>

                          {/* Botões de PDF na Tabela */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={downloadingId === `proposta-${q.id}`}
                                    onClick={() => handleDownloadProposta(q)}
                                    className="h-8 w-8 p-0 rounded-lg text-slate-800 border-slate-300 bg-slate-100 hover:bg-slate-200 hover:text-slate-900"
                                  >
                                    {downloadingId === `proposta-${q.id}` ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <FileText className="w-4 h-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  Proposta Comercial (PDF do Cliente)
                                </TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={downloadingId === `custo-${q.id}`}
                                    onClick={() => handleDownloadAnaliseCusto(q)}
                                    className="h-8 w-8 p-0 rounded-lg text-slate-700 border-slate-300 bg-slate-50 hover:bg-slate-100 hover:text-slate-900"
                                  >
                                    {downloadingId === `custo-${q.id}` ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Settings className="w-4 h-4 text-slate-600" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  Análise de Custo (PDF Interno de Engenharia)
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="text-xs h-8 border-slate-200 hover:bg-slate-100 hover:text-slate-800 hover:border-slate-400 rounded-lg"
                              >
                                <Link to={`/orcamento-v2?id=${q.id}`}>
                                  Abrir
                                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                                </Link>
                              </Button>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={deletingId === q.id}
                                    onClick={() => handleDelete(q)}
                                    className="h-8 w-8 p-0 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700"
                                    aria-label="Excluir orçamento"
                                  >
                                    {deletingId === q.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  Excluir orçamento
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
