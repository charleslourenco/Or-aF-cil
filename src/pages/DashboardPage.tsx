import { Link } from 'react-router-dom'
import { FileText, DollarSign, CheckCircle2, Layers, TrendingUp, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type QuoteStatus = 'Aprovado' | 'Em Negociação' | 'Rascunho'

interface Quote {
  cliente: string
  ambiente: string
  modulo: string
  data: string
  valor: string
  status: QuoteStatus
}

const recentQuotes: Quote[] = [
  {
    cliente: 'Maria Silva',
    ambiente: 'Cozinha',
    modulo: 'Roupeiro 2 Portas',
    data: '15/03/2025',
    valor: 'R$ 12.800,00',
    status: 'Aprovado',
  },
  {
    cliente: 'João Costa',
    ambiente: 'Quarto',
    modulo: 'Roupeiro 2 Portas',
    data: '12/03/2025',
    valor: 'R$ 9.450,00',
    status: 'Em Negociação',
  },
  {
    cliente: 'Ana Paula',
    ambiente: 'Sala',
    modulo: 'Balcão',
    data: '10/03/2025',
    valor: 'R$ 18.200,00',
    status: 'Aprovado',
  },
  {
    cliente: 'Carlos Lima',
    ambiente: 'Banheiro',
    modulo: 'Aéreo',
    data: '08/03/2025',
    valor: 'R$ 4.100,00',
    status: 'Rascunho',
  },
]

const statusStyles: Record<QuoteStatus, string> = {
  Aprovado: 'bg-green-100 text-green-700',
  'Em Negociação': 'bg-amber-100 text-amber-700',
  Rascunho: 'bg-slate-100 text-slate-600',
}

interface KpiCardProps {
  icon: React.ElementType
  iconClassName: string
  iconBg: string
  label: string
  value: string
  children?: React.ReactNode
}

function KpiCard({ icon: Icon, iconClassName, iconBg, label, value, children }: KpiCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', iconBg)}>
          <Icon className={cn('w-5 h-5', iconClassName)} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className="text-2xl font-bold text-slate-900 tracking-tight">{value}</span>
      </div>
      {children && <div className="mt-auto">{children}</div>}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Painel de Orçamentos</h2>
          <p className="text-sm text-slate-500">Visão geral das negociações e indicadores do mês</p>
        </div>
        <Button
          asChild
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm rounded-lg"
        >
          <Link to="/novo-orcamento" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Criar Novo Orçamento
          </Link>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={FileText}
          iconClassName="text-emerald-600"
          iconBg="bg-emerald-50"
          label="Total de Orçamentos (Mês)"
          value="14"
        >
          <div className="flex items-center gap-1 text-green-600 text-xs font-semibold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+12% em relação ao mês anterior</span>
          </div>
        </KpiCard>

        <KpiCard
          icon={DollarSign}
          iconClassName="text-blue-600"
          iconBg="bg-blue-50"
          label="Valor Total Orçado"
          value="R$ 85.400,00"
        >
          <span className="text-xs text-slate-400 font-medium">
            Soma de todos os orçamentos do mês
          </span>
        </KpiCard>

        <KpiCard
          icon={CheckCircle2}
          iconClassName="text-green-600"
          iconBg="bg-green-50"
          label="Propostas Aprovadas"
          value="6"
        >
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs font-semibold rounded-full px-2.5 py-0.5">
            Aprovadas
          </Badge>
        </KpiCard>

        <KpiCard
          icon={Layers}
          iconClassName="text-amber-600"
          iconBg="bg-amber-50"
          label="Ticket Médio por Módulo"
          value="R$ 6.100,00"
        >
          <span className="text-xs text-slate-400 font-medium">Valor médio por módulo orçado</span>
        </KpiCard>
      </div>

      {/* Recent Quotes Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">Últimos Orçamentos Gerados</h3>
        </div>
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
              {recentQuotes.map((quote) => (
                <tr key={quote.cliente} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-slate-900">{quote.cliente}</td>
                  <td className="px-5 py-3.5 text-slate-600">{quote.ambiente}</td>
                  <td className="px-5 py-3.5 text-slate-600">{quote.modulo}</td>
                  <td className="px-5 py-3.5 text-slate-600">{quote.data}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-slate-900">
                    {quote.valor}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                        statusStyles[quote.status],
                      )}
                    >
                      {quote.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="text-xs font-medium border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg"
                    >
                      <Link to="/novo-orcamento">Ver / Editar</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
