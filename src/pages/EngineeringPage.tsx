import { useEffect, useMemo, useState } from 'react'
import { Trash2, Plus, Save, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  fetchConfigEngenharia,
  saveConfigEngenharia,
  type ConfigEngenharia,
  type CustoFixo,
  type ComissaoPersonalizada,
} from '@/services/engenharia'

// ----- Defaults -----
const DEFAULT_CONFIG: ConfigEngenharia = {
  id: '',
  meta_faturamento: 50000,
  impostos_percent: 10.0,
  comissoes_percent: 5.0,
  custo_financeiro_percent: 3.0,
  markup_padrao: 2.5,
  perda_material_percent: 20.0,
}

const DEFAULT_CUSTOS: CustoFixo[] = [
  { id: crypto.randomUUID(), config_id: '', descricao: 'Aluguel', valor: 3000 },
  { id: crypto.randomUUID(), config_id: '', descricao: 'Salários', valor: 8000 },
  { id: crypto.randomUUID(), config_id: '', descricao: 'Contador', valor: 500 },
]

const DEFAULT_COMISSOES: ComissaoPersonalizada[] = []

// ----- Formatação -----
const round2 = (n: number) => Math.round(n * 100) / 100

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })

const fmtPct = (n: number) =>
  `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`

const parseNum = (v: string): number => {
  const n = parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export default function EngineeringPage() {
  const [config, setConfig] = useState<ConfigEngenharia>(DEFAULT_CONFIG)
  const [custosFixos, setCustosFixos] = useState<CustoFixo[]>(DEFAULT_CUSTOS)
  const [comissoesPersonalizadas, setComissoesPersonalizadas] =
    useState<ComissaoPersonalizada[]>(DEFAULT_COMISSOES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Simulador DRE
  const [custoMaterialSimulador, setCustoMaterialSimulador] = useState(1000)
  const [markupSimulador, setMarkupSimulador] = useState(2.5)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError(null)
      const {
        config: cfg,
        custosFixos: cf,
        comissoesPersonalizadas: cps,
        error: err,
      } = await fetchConfigEngenharia()
      if (!active) return
      if (err) {
        setError(err)
      } else if (cfg) {
        setConfig(cfg)
        setCustosFixos(
          cf.length > 0 ? cf : DEFAULT_CUSTOS.map((c) => ({ ...c, config_id: cfg.id })),
        )
        setComissoesPersonalizadas(
          cps.length > 0 ? cps : DEFAULT_COMISSOES.map((c) => ({ ...c, config_id: cfg.id })),
        )
        setMarkupSimulador(cfg.markup_padrao)
      }
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [])
  // ----- Cálculos derivados (DRE) -----
  const dre = useMemo(() => {
    const totalCustosFixos = round2(custosFixos.reduce((s, c) => s + (Number(c.valor) || 0), 0))
    const meta = Number(config.meta_faturamento) || 0
    const indiceRateio = meta > 0 ? (totalCustosFixos / meta) * 100 : 0
    const indiceRateioNum = meta > 0 ? indiceRateio : null

    const custoMaterial = Number(custoMaterialSimulador) || 0
    const markup = Number(markupSimulador) || 0
    const precoVenda = round2(custoMaterial * markup)

    const rateio = round2((precoVenda * (indiceRateioNum ?? 0)) / 100)
    const impostos = round2(precoVenda * (config.impostos_percent / 100))
    const comissoes = round2(precoVenda * (config.comissoes_percent / 100))

    // Comissões/variáveis personalizadas — deduzidas em cascata
    const comissoesCustom = comissoesPersonalizadas.map((c) => ({
      id: c.id,
      nome: c.nome,
      percentual: Number(c.percentual) || 0,
      valor: round2(precoVenda * ((Number(c.percentual) || 0) / 100)),
    }))
    const totalComissoesCustom = round2(comissoesCustom.reduce((s, c) => s + c.valor, 0))

    const custoFinanceiro = round2(precoVenda * (config.custo_financeiro_percent / 100))

    const lucroLiquido = round2(
      precoVenda -
        custoMaterial -
        rateio -
        impostos -
        comissoes -
        totalComissoesCustom -
        custoFinanceiro,
    )
    const margemLiquida = precoVenda > 0 ? round2((lucroLiquido / precoVenda) * 100) : 0

    return {
      totalCustosFixos,
      indiceRateio,
      indiceRateioNum,
      custoMaterial,
      markup,
      precoVenda,
      rateio,
      impostos,
      comissoes,
      comissoesCustom,
      totalComissoesCustom,
      custoFinanceiro,
      lucroLiquido,
      margemLiquida,
    }
  }, [config, custosFixos, comissoesPersonalizadas, custoMaterialSimulador, markupSimulador])

  // ----- Handlers de custos fixos -----
  const addCustoFixo = () => {
    setCustosFixos((prev) => [
      ...prev,
      { id: crypto.randomUUID(), config_id: config.id, descricao: '', valor: 0 },
    ])
  }

  const removeCustoFixo = (id: string) => {
    setCustosFixos((prev) => prev.filter((c) => c.id !== id))
  }

  const updateCustoFixo = (id: string, field: 'descricao' | 'valor', value: string) => {
    setCustosFixos((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, [field]: field === 'valor' ? parseNum(value) : value } : c,
      ),
    )
  }

  const updateConfig = <K extends keyof ConfigEngenharia>(key: K, value: number) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  // ----- Handlers de comissões personalizadas -----
  const addComissaoPersonalizada = () => {
    setComissoesPersonalizadas((prev) => [
      ...prev,
      { id: crypto.randomUUID(), config_id: config.id, nome: '', percentual: 0 },
    ])
  }

  const removeComissaoPersonalizada = (id: string) => {
    setComissoesPersonalizadas((prev) => prev.filter((c) => c.id !== id))
  }

  const updateComissaoPersonalizada = (id: string, field: 'nome' | 'percentual', value: string) => {
    setComissoesPersonalizadas((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, [field]: field === 'percentual' ? parseNum(value) : value } : c,
      ),
    )
  }

  // ----- Salvar -----
  const handleSave = async () => {
    setSaving(true)
    const { success, error: err } = await saveConfigEngenharia(
      config,
      custosFixos,
      comissoesPersonalizadas,
    )
    setSaving(false)
    if (success) {
      toast({ title: 'Configurações salvas com sucesso!' })
    } else {
      toast({
        title: 'Erro ao salvar. Tente novamente.',
        description: err ?? undefined,
        variant: 'destructive',
      })
    }
  }

  const retry = () => {
    setLoading(true)
    setError(null)
    fetchConfigEngenharia().then(
      ({ config: cfg, custosFixos: cf, comissoesPersonalizadas: cps, error: err }) => {
        if (err) setError(err)
        else if (cfg) {
          setConfig(cfg)
          setCustosFixos(
            cf.length > 0 ? cf : DEFAULT_CUSTOS.map((c) => ({ ...c, config_id: cfg.id })),
          )
          setComissoesPersonalizadas(
            cps.length > 0 ? cps : DEFAULT_COMISSOES.map((c) => ({ ...c, config_id: cfg.id })),
          )
          setMarkupSimulador(cfg.markup_padrao)
        }
        setLoading(false)
      },
    )
  }

  // ----- Cor do lucro -----
  const lucroColorClass = useMemo(() => {
    if (dre.margemLiquida < 5) return 'bg-rose-50 text-rose-700 border-rose-200'
    if (dre.margemLiquida <= 15) return 'bg-amber-50 text-amber-700 border-amber-200'
    return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }, [dre.margemLiquida])

  // ===================== LOADING =====================
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-44" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Skeleton className="h-80 w-full rounded-2xl" />
            <Skeleton className="h-72 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-[28rem] w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  // ===================== ERRO =====================
  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Não foi possível carregar</h3>
              <p className="text-sm text-slate-500 mt-1">{error}</p>
            </div>
            <Button onClick={retry} variant="outline" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ===================== PÁGINA =====================
  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            💰 Engenharia Financeira
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Custeio por Absorção, Markup e Simulador de Rentabilidade (DRE)
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Configurações
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ============ COLUNA ESQUERDA ============ */}
        <div className="space-y-6">
          {/* Bloco 1 — Estrutura da Fábrica */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">🏭 Estrutura da Fábrica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Meta de Faturamento Mensal (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                    R$
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={config.meta_faturamento}
                    onChange={(e) => updateConfig('meta_faturamento', parseNum(e.target.value))}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-800">Custos Fixos da Operação</h4>

                <div className="space-y-2">
                  {custosFixos.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Input
                        type="text"
                        placeholder="Ex.: Aluguel"
                        value={c.descricao}
                        onChange={(e) => updateCustoFixo(c.id, 'descricao', e.target.value)}
                        className="flex-1"
                      />
                      <div className="relative w-36">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                          R$
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          value={c.valor}
                          onChange={(e) => updateCustoFixo(c.id, 'valor', e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCustoFixo(c.id)}
                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"
                        aria-label="Remover custo fixo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button variant="outline" onClick={addCustoFixo} className="gap-2 w-full sm:w-auto">
                  <Plus className="w-4 h-4" />
                  Adicionar Custo Fixo
                </Button>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
                <span className="text-sm font-medium text-slate-700">Total de Custos Fixos:</span>
                <span className="text-base font-bold text-slate-900">
                  {fmtBRL(dre.totalCustosFixos)}
                </span>
              </div>

              {/* Índice de Rateio */}
              <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/60 px-4 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-emerald-800">📐 Índice de Rateio</p>
                    <p className="text-xs text-emerald-600/80 mt-0.5">
                      (Total Custos Fixos ÷ Meta Faturamento)
                    </p>
                  </div>
                  <span className="text-2xl font-extrabold text-emerald-700">
                    {dre.indiceRateioNum === null ? '—' : fmtPct(dre.indiceRateio)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bloco 2 — Variáveis de Venda e Preço */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                📊 Variáveis de Venda e Preço
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Markup Padrão</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={config.markup_padrao}
                    onChange={(e) => updateConfig('markup_padrao', parseNum(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Impostos (%)</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={config.impostos_percent}
                    onChange={(e) => updateConfig('impostos_percent', parseNum(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Comissões (%)</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={config.comissoes_percent}
                    onChange={(e) => updateConfig('comissoes_percent', parseNum(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Custo Financeiro / Cartão (%)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={config.custo_financeiro_percent}
                    onChange={(e) =>
                      updateConfig('custo_financeiro_percent', parseNum(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Perda de Material (%)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={config.perda_material_percent}
                    onChange={(e) =>
                      updateConfig('perda_material_percent', parseNum(e.target.value))
                    }
                  />
                  <p className="text-xs text-slate-400">Informativo — não afeta o DRE.</p>
                </div>
              </div>

              {/* Subseção: Comissões e Variáveis Personalizadas */}
              <div className="mt-6 pt-5 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-800">
                    🏷️ Comissões e Variáveis Personalizadas
                  </h4>
                  <span className="text-xs text-slate-400 hidden sm:inline">
                    Deduzidas em cascata do Preço de Venda
                  </span>
                </div>

                <div className="space-y-2">
                  {comissoesPersonalizadas.map((c) => (
                    <div key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <Input
                        type="text"
                        placeholder="Ex: Comissão Vendedor"
                        value={c.nome}
                        onChange={(e) => updateComissaoPersonalizada(c.id, 'nome', e.target.value)}
                        className="flex-1"
                      />
                      <div className="relative sm:w-32">
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="0,0"
                          value={c.percentual}
                          onChange={(e) =>
                            updateComissaoPersonalizada(c.id, 'percentual', e.target.value)
                          }
                          className="pr-7"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                          %
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeComissaoPersonalizada(c.id)}
                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0 self-end sm:self-auto"
                        aria-label="Remover campo personalizado"
                      >
                        <span className="text-lg leading-none" aria-hidden="true">
                          ✕
                        </span>
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  onClick={addComissaoPersonalizada}
                  className="gap-2 w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Campo Personalizado
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ============ COLUNA DIREITA ============ */}
        <div className="space-y-6">
          {/* Bloco 3 — Simulador DRE */}
          <Card className="lg:sticky lg:top-20">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                🧮 Simulador de Rentabilidade (DRE)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Custo de Material (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      R$
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={custoMaterialSimulador}
                      onChange={(e) => setCustoMaterialSimulador(parseNum(e.target.value))}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Markup do Simulador</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={markupSimulador}
                    onChange={(e) => setMarkupSimulador(parseNum(e.target.value))}
                  />
                </div>
              </div>

              {/* Tabela DRE */}
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-sm min-w-[420px]">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 border-b border-slate-200">
                      <th className="py-2 pr-2 font-medium">Item</th>
                      <th className="py-2 px-2 font-medium">Fórmula</th>
                      <th className="py-2 pl-2 font-medium text-right">Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <DRELine
                      icon="➕"
                      label="Preço de Venda"
                      formula="Custo Material × Markup"
                      value={dre.precoVenda}
                      positive
                    />
                    <DRELine
                      icon="➖"
                      label="Custo do Material Direto"
                      formula="valor do input"
                      value={-dre.custoMaterial}
                    />
                    <DRELine
                      icon="➖"
                      label="Custo Fixo Absorvido (Rateio)"
                      formula="Preço de Venda × Índice de Rateio%"
                      value={-dre.rateio}
                    />
                    <DRELine
                      icon="➖"
                      label="Impostos"
                      formula="Preço de Venda × Impostos%"
                      value={-dre.impostos}
                    />
                    <DRELine
                      icon="➖"
                      label="Comissões"
                      formula="Preço de Venda × Comissões%"
                      value={-dre.comissoes}
                    />
                    {dre.comissoesCustom.map((c) => (
                      <DRELine
                        key={c.id}
                        icon="➖"
                        label={c.nome || 'Comissão Personalizada'}
                        formula={`Preço de Venda × ${fmtPct(c.percentual)}`}
                        value={-c.valor}
                      />
                    ))}
                    <DRELine
                      icon="➖"
                      label="Custo Financeiro"
                      formula="Preço de Venda × Custo Financeiro%"
                      value={-dre.custoFinanceiro}
                    />
                  </tbody>
                </table>
              </div>

              {/* Separador grosso */}
              <div className="h-1 rounded-full bg-slate-300" />

              {/* Destaque final */}
              <div className={cn('rounded-xl border px-4 py-5', lucroColorClass)}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">💵 Lucro Líquido</span>
                  <span className="text-2xl font-extrabold tabular-nums">
                    {fmtBRL(dre.lucroLiquido)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-semibold">📈 Margem Líquida</span>
                  <span className="text-xl font-bold tabular-nums">
                    {fmtPct(dre.margemLiquida)}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-400 text-center">
                Cenário A: Preço gerado pelo Markup, com dedução de Rateio para revelar o Lucro
                Líquido.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ----- Subcomponente de linha DRE -----
function DRELine({
  icon,
  label,
  formula,
  value,
  positive = false,
}: {
  icon: string
  label: string
  formula: string
  value: number
  positive?: boolean
}) {
  const isNeg = value < 0
  return (
    <tr className={positive ? 'bg-slate-50/60' : undefined}>
      <td className="py-2.5 pr-2">
        <span className="mr-1.5">{icon}</span>
        <span className="font-medium text-slate-700">{label}</span>
      </td>
      <td className="py-2.5 px-2 text-xs text-slate-400">{formula}</td>
      <td
        className={cn(
          'py-2.5 pl-2 text-right font-semibold tabular-nums',
          isNeg ? 'text-rose-600' : positive ? 'text-slate-900' : 'text-slate-700',
        )}
      >
        {fmtBRL(value)}
      </td>
    </tr>
  )
}
