import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText,
  DollarSign,
  CheckCircle2,
  Layers,
  TrendingUp,
  Plus,
  RefreshCw,
  AlertCircle,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  fetchOrcamentos,
  fetchOrcamentosCount,
  fetchOrcamentosSomaValor,
  fetchOrcamentosAprovadosCount,
  fetchTicketMedio,
  Orcamento,
} from '@/services/orcamentos'

const statusStyles: Record<string, string> = {
  Aprovado: 'bg-slate-200 text-slate-800',
  'Em Negociação': 'bg-amber-100 text-amber-700',
  Rascunho: 'bg-slate-100 text-slate-600',
}

interface KpiCardProps {
  icon: React.ElementType
  iconClassName: string
  iconBg: string
  label: string
  value: string
  loading?: boolean
  children?: React.ReactNode
}

function KpiCard({
  icon: Icon,
  iconClassName,
  iconBg,
  label,
  value,
  loading,
  children,
}: KpiCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', iconBg)}>
          <Icon className={cn('w-5 h-5', iconClassName)} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        {loading ? (
          <Skeleton className="h-8 w-28 rounded-md" />
        ) : (
          <span className="text-2xl font-bold text-slate-900 tracking-tight">{value}</span>
        )}
      </div>
      {children && <div className="mt-auto">{children}</div>}
    </div>
  )
}

function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val)
}

function formatDate(dateStr: string | null | undefined): string {
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

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [somaValor, setSomaValor] = useState<number | null>(null)
  const [aprovadosCount, setAprovadosCount] = useState<number | null>(null)
  const [ticketMedio, setTicketMedio] = useState<number | null>(null)
  const [quotes, setQuotes] = useState<Orcamento[] | null>(null)

  const loadDashboardData = useCallback(async () => {
    setLoading(true)
    setHasError(false)

    try {
      const [quotesRes, countRes, somaRes, aprovadosRes, ticketRes] = await Promise.all([
        fetchOrcamentos(),
        fetchOrcamentosCount(),
        fetchOrcamentosSomaValor(),
        fetchOrcamentosAprovadosCount(),
        fetchTicketMedio(),
      ])

      // Se todas as consultas de erro retornarem null, marcar erro global
      if (
        quotesRes === null &&
        countRes === null &&
        somaRes === null &&
        aprovadosRes === null &&
        ticketRes === null
      ) {
        setHasError(true)
      } else {
        setQuotes(quotesRes)
        setTotalCount(countRes)
        setSomaValor(somaRes)
        setAprovadosCount(aprovadosRes)
        setTicketMedio(ticketRes)
      }
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err)
      setHasError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // Formatação dos valores de KPI respeitando as regras especificadas
  const displayTotalCount = totalCount !== null ? totalCount.toString() : '—'
  const displaySomaValor = somaValor !== null ? formatCurrency(somaValor) : '—'
  const displayAprovados = aprovadosCount !== null ? aprovadosCount.toString() : '—'
  const displayTicketMedio = ticketMedio !== null ? formatCurrency(ticketMedio) : '—'

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Painel de Orçamentos</h2>
          <p className="text-sm text-slate-500">Visão geral das negociações e indicadores do mês</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboardData}
            disabled={loading}
            className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs"
            title="Atualizar dados"
          >
            <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', loading && 'animate-spin')} />
            Atualizar
          </Button>
          <Button
            asChild
            className="bg-slate-700 hover:bg-slate-800 text-white font-semibold shadow-sm rounded-lg text-xs"
          >
            <Link to="/novo-orcamento" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Criar Novo Orçamento
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={FileText}
          iconClassName="text-slate-700"
          iconBg="bg-slate-100"
          label="Total de Orçamentos (Mês)"
          value={displayTotalCount}
          loading={loading}
        >
          <div className="flex items-center gap-1 text-slate-700 text-xs font-semibold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+12% em relação ao mês anterior</span>
          </div>
        </KpiCard>

        <KpiCard
          icon={DollarSign}
          iconClassName="text-blue-600"
          iconBg="bg-blue-50"
          label="Valor Total Orçado"
          value={displaySomaValor}
          loading={loading}
        >
          <span className="text-xs text-slate-400 font-medium">
            Soma de todos os orçamentos do mês
          </span>
        </KpiCard>

        <KpiCard
          icon={CheckCircle2}
          iconClassName="text-slate-700"
          iconBg="bg-slate-100"
          label="Propostas Aprovadas"
          value={displayAprovados}
          loading={loading}
        >
          <Badge className="bg-slate-200 text-slate-800 hover:bg-slate-200 text-xs font-semibold rounded-full px-2.5 py-0.5">
            Aprovadas
          </Badge>
        </KpiCard>

        <KpiCard
          icon={Layers}
          iconClassName="text-amber-600"
          iconBg="bg-amber-50"
          label="Ticket Médio por Módulo"
          value={displayTicketMedio}
          loading={loading}
        >
          <span className="text-xs text-slate-400 font-medium">Valor médio por módulo orçado</span>
        </KpiCard>
      </div>

      {/* Recent Quotes Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Últimos Orçamentos Gerados</h3>
          {quotes && quotes.length > 0 && (
            <span className="text-xs font-medium text-slate-500">
              {quotes.length}{' '}
              {quotes.length === 1 ? 'orçamento encontrado' : 'orçamentos encontrados'}
            </span>
          )}
        </div>

        {/* Estado: Carregando (Skeleton) */}
        {loading && (
          <div className="p-5 space-y-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        )}

        {/* Estado: Erro na busca */}
        {!loading && (quotes === null || hasError) && (
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-900">
                Não foi possível carregar os orçamentos
              </h4>
              <p className="text-xs text-slate-500 max-w-sm">
                Ocorreu uma falha ao se comunicar com o banco de dados. Verifique a conexão e tente
                novamente.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadDashboardData}
              className="mt-2 border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Tentar Novamente
            </Button>
          </div>
        )}

        {/* Estado: Sem orçamentos (Empty State) */}
        {!loading && quotes !== null && quotes.length === 0 && (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
              <FileText className="w-7 h-7" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h4 className="text-base font-bold text-slate-900">Nenhum orçamento gerado ainda</h4>
              <p className="text-xs text-slate-500">
                Crie seu primeiro orçamento para começar a acompanhar os indicadores da sua
                marcenaria.
              </p>
            </div>
            <Button
              asChild
              className="mt-2 bg-slate-700 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-sm"
            >
              <Link to="/novo-orcamento" className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Criar Novo Orçamento
              </Link>
            </Button>
          </div>
        )}

        {/* Estado: Tabela com dados reais */}
        {!loading && quotes !== null && quotes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="text-left font-semibold px-5 py-3">Cliente</th>
                  <th className="text-left font-semibold px-5 py-3">Ambiente</th>
                  <th className="text-left font-semibold px-5 py-3">Módulo</th>
                  <th className="text-left font-semibold px-5 py-3">Data</th>
                  <th className="text-right font-semibold px-5 py-3">Valor Total (R$)</th>
                  <th className="text-left font-semibold px-5 py-3">Status</th>
                  <th className="text-right font-semibold px-5 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotes.map((quote) => {
                  const statusKey = quote.status || 'Rascunho'
                  const statusClass = statusStyles[statusKey] || 'bg-slate-100 text-slate-600'
                  const valorNum =
                    typeof quote.valor_total === 'number'
                      ? quote.valor_total
                      : quote.valor_total
                        ? parseFloat(quote.valor_total)
                        : 0

                  return (
                    <tr key={quote.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-900">
                        {quote.cliente_nome || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{quote.ambiente || '—'}</td>
                      <td className="px-5 py-3.5 text-slate-600">{quote.modulo || '—'}</td>
                      <td className="px-5 py-3.5 text-slate-600">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(quote.data || quote.created_at)}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-slate-900 font-mono">
                        {formatCurrency(valorNum)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                            statusClass,
                          )}
                        >
                          {statusKey}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="text-xs font-medium border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg"
                        >
                          <Link to={`/novo-orcamento?id=${quote.id}`}>Ver / Editar</Link>
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
