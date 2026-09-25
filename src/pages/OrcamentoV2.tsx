import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileDown, User, Calendar, FolderPlus, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'

export default function OrcamentoV2() {
  const navigate = useNavigate()

  // Estado local para Dados do Cliente (sem persistência em banco nesta etapa)
  const [nomeCliente, setNomeCliente] = useState('')
  const [dataOrcamento, setDataOrcamento] = useState(() => {
    // Data atual no formato YYYY-MM-DD
    const today = new Date()
    return today.toISOString().split('T')[0]
  })

  const handleVoltar = () => {
    navigate('/orcamentos')
  }

  const handleExportarPdf = () => {
    toast({
      title: 'Exportar PDF',
      description: 'A exportação de PDF estará disponível nas próximas etapas.',
    })
  }

  return (
    <div className="relative min-h-[calc(100vh-10rem)] pb-28 space-y-6">
      {/* 1. Cabeçalho principal com nome do sistema, botão Voltar e botão Exportar PDF */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleVoltar}
            className="h-9 px-3 gap-1.5 text-xs font-semibold border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar</span>
          </Button>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                OrçaFácil 3.0
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                v2
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Novo fluxo de elaboração de orçamentos sob medida
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            type="button"
            variant="outline"
            onClick={handleExportarPdf}
            className="h-9 px-4 gap-2 text-xs font-semibold border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl shadow-xs"
          >
            <FileDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>Exportar PDF</span>
          </Button>
        </div>
      </header>

      {/* 2. Card de Dados do Cliente: Nome do Cliente e Data */}
      <Card className="border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <CardTitle className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs">
              1
            </div>
            <span>Dados do Cliente</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label
                htmlFor="clientNameV2"
                className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5"
              >
                <User className="w-3.5 h-3.5 text-slate-500" />
                Nome do Cliente
              </Label>
              <Input
                id="clientNameV2"
                type="text"
                placeholder="Ex.: Maria Oliveira"
                value={nomeCliente}
                onChange={(e) => setNomeCliente(e.target.value)}
                className="h-11 rounded-xl text-sm border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="quoteDateV2"
                className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                Data
              </Label>
              <Input
                id="quoteDateV2"
                type="date"
                value={dataOrcamento}
                onChange={(e) => setDataOrcamento(e.target.value)}
                className="h-11 rounded-xl text-sm border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Container Ambientes do Projeto */}
      <section aria-labelledby="ambientes-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs">
              2
            </div>
            <h2
              id="ambientes-heading"
              className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100"
            >
              Ambientes do Projeto
            </h2>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            0 ambientes adicionados
          </span>
        </div>

        {/* Área vazia pronta para receber ambientes futuramente */}
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-8 sm:p-12 flex flex-col items-center justify-center text-center gap-3 transition-colors">
          <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs text-slate-400 dark:text-slate-500 flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
          <div className="max-w-md space-y-1">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Nenhum ambiente adicionado
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              A inclusão de ambientes e organização dos módulos será configurada nas próximas
              etapas.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled
            className="mt-2 h-9 px-4 gap-2 text-xs font-semibold rounded-xl border-dashed border-slate-300 dark:border-slate-700 text-slate-400 opacity-60 cursor-not-allowed"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Adicionar Ambiente (em breve)</span>
          </Button>
        </div>
      </section>

      {/* 4. Barra fixa no rodapé com o Valor Total Geral zerado */}
      <aside
        aria-label="Resumo do Valor Total"
        className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Valor Total Geral
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">
                Soma de todos os ambientes e módulos
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tracking-tight">
                R$ 0,00
              </span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
