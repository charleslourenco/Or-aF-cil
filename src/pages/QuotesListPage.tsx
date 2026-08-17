import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FileSpreadsheet,
  PlusCircle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  MoreVertical,
  Calendar,
  User,
  DollarSign,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { MOCK_EXISTING_QUOTES, QuoteRecord } from '@/data/mockData'

export default function QuotesListPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val)
  }

  const filteredQuotes = MOCK_EXISTING_QUOTES.filter((q) => {
    const matchesSearch =
      q.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.room.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.moduleName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'Todos' || q.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: QuoteRecord['status']) => {
    switch (status) {
      case 'Aprovado':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none font-semibold text-[11px]">
            ✓ Aprovado
          </Badge>
        )
      case 'Em Análise':
        return (
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none font-semibold text-[11px]">
            ⏳ Em Análise
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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Orçamentos do Sistema
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Histórico completo de projetos orçados com cálculo paramétrico e margens comerciais.
          </p>
        </div>

        <Button
          asChild
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
        >
          <Link to="/">
            <PlusCircle className="w-4 h-4 mr-2" />
            Novo Orçamento
          </Link>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar por cliente, código ou ambiente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        {/* Status filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['Todos', 'Aprovado', 'Em Análise', 'Concluído'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                statusFilter === st
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Quotes Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 font-semibold text-xs uppercase tracking-wider">
                <th className="py-3.5 px-4">Código / Data</th>
                <th className="py-3.5 px-4">Cliente</th>
                <th className="py-3.5 px-4">Ambiente & Módulo</th>
                <th className="py-3.5 px-4 text-right">Custo Fabril</th>
                <th className="py-3.5 px-4 text-right text-emerald-800">Valor de Venda</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQuotes.map((q, idx) => (
                <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4">
                    <span className="font-mono font-bold text-slate-900 block text-xs">
                      {q.code}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3" /> {q.createdAt}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                        {q.clientName.charAt(0)}
                      </div>
                      {q.clientName}
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="text-slate-800 font-medium">{q.moduleName}</div>
                    <div className="text-[11px] text-slate-500">
                      {q.room} • {q.totalItems} peças
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-right font-mono text-slate-600 text-xs">
                    {formatCurrency(q.totalCost)}
                  </td>

                  <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                    {formatCurrency(q.totalSalePrice)}
                  </td>

                  <td className="py-3.5 px-4 text-center">{getStatusBadge(q.status)}</td>

                  <td className="py-3.5 px-4 text-right">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                    >
                      <Link to={`/?modulo=roupeiro-2-portas`}>
                        Visualizar
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Link>
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
