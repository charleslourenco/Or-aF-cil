import React, { useState, useEffect, useMemo } from 'react'
import {
  Ruler,
  Layers,
  Wrench,
  DollarSign,
  AlertTriangle,
  Info,
  CheckCircle2,
  Boxes,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  calcularModuloParametrico,
  type RegrasParametricasJson,
  type DimensoesParametricas,
  type ResultadoCalculoParametrico,
  type VinculoFerragemInfo,
  type MateriaisPrecoMap,
} from '@/lib/parametricEvaluator'
import { type PerfilConstrutivo, PERFIS_CONSTRUTIVOS_INFO } from '@/services/templates'

interface ParametricModuleCalculatorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  modulo: {
    id: string
    nome_template: string
    perfil_construtivo?: PerfilConstrutivo | string | null
    assinatura_visual?: string[]
    regras_json?: RegrasParametricasJson
  } | null
  vinculosMap: Map<string, VinculoFerragemInfo>
  onOpenVincularFerragem?: (nomeFerragem?: string) => void
}

export function ParametricModuleCalculatorModal({
  open,
  onOpenChange,
  modulo,
  vinculosMap,
  onOpenVincularFerragem,
}: ParametricModuleCalculatorModalProps) {
  // Dimensões do módulo
  const [largura, setLargura] = useState<number>(800)
  const [altura, setAltura] = useState<number>(750)
  const [profundidade, setProfundidade] = useState<number>(550)
  const [espessuraCaixaria, setEspessuraCaixaria] = useState<number>(18)

  // Materiais por slot
  const [matCaixaria, setMatCaixaria] = useState<string>('mdf18_branco')
  const [matFrentes, setMatFrentes] = useState<string>('mdf18_amadeirado')
  const [matFundo, setMatFundo] = useState<string>('mdf6_branco')

  // Ao abrir com um módulo, tenta extrair dimensões padrão se presentes nas regras ou nome
  useEffect(() => {
    if (modulo) {
      const nome = modulo.nome_template.toLowerCase()
      // Ex: "1200x900x600" ou números no nome
      const matchDim = nome.match(/(\d{3,4})\s*[xX*]\s*(\d{3,4})\s*[xX*]\s*(\d{2,4})/)
      if (matchDim) {
        setLargura(Number(matchDim[1]) || 800)
        setAltura(Number(matchDim[2]) || 750)
        setProfundidade(Number(matchDim[3]) || 550)
      } else {
        // Padrões ergonômicos gerais
        if (nome.includes('balc') || nome.includes('pia') || nome.includes('inferior')) {
          setLargura(800)
          setAltura(870)
          setProfundidade(580)
        } else if (nome.includes('aereo') || nome.includes('aéreo') || nome.includes('superior')) {
          setLargura(800)
          setAltura(700)
          setProfundidade(350)
        } else if (nome.includes('torre') || nome.includes('despenseiro')) {
          setLargura(700)
          setAltura(2200)
          setProfundidade(580)
        } else if (nome.includes('banheiro') || nome.includes('gabinete')) {
          setLargura(700)
          setAltura(650)
          setProfundidade(450)
        } else {
          setLargura(800)
          setAltura(750)
          setProfundidade(550)
        }
      }
      setEspessuraCaixaria(18)
    }
  }, [modulo])

  // Catálogo simplificado de opções de MDF para os slots
  const precosMdf: MateriaisPrecoMap = useMemo(() => {
    const mapaNomes: Record<string, { nome: string; precoM2: number }> = {
      mdf18_branco: { nome: 'MDF 18mm Branco TX', precoM2: 50.0 },
      mdf15_branco: { nome: 'MDF 15mm Branco TX', precoM2: 40.0 },
      mdf18_amadeirado: { nome: 'MDF 18mm Amadeirado / Cor Especial', precoM2: 75.0 },
      mdf18_ultra: { nome: 'MDF 18mm Ultra Naval (Resistente à Água)', precoM2: 95.0 },
      mdf6_branco: { nome: 'MDF 6mm Branco TX (Fundo)', precoM2: 25.0 },
      mdf6_amadeirado: { nome: 'MDF 6mm Amadeirado (Fundo)', precoM2: 38.0 },
    }

    return {
      caixaria_interna: mapaNomes[matCaixaria] || mapaNomes['mdf18_branco'],
      frentes_externas: mapaNomes[matFrentes] || mapaNomes['mdf18_amadeirado'],
      fundo: mapaNomes[matFundo] || mapaNomes['mdf6_branco'],
    }
  }, [matCaixaria, matFrentes, matFundo])

  // Execução do cálculo em tempo real via math.js
  const resultado: ResultadoCalculoParametrico = useMemo(() => {
    if (!modulo?.regras_json) {
      return {
        pecas: [],
        ferragens: [],
        resumoMateriais: {},
        custoTotalMdf: 0,
        custoTotalFerragens: 0,
        custoTotalGeral: 0,
        avisos: ['Módulo sem regras paramétricas cadastradas.'],
      }
    }

    const dimensoes: DimensoesParametricas = {
      largura,
      altura,
      profundidade,
      espessura_caixaria: espessuraCaixaria,
    }

    return calcularModuloParametrico(modulo.regras_json, dimensoes, precosMdf, vinculosMap)
  }, [modulo, largura, altura, profundidade, espessuraCaixaria, precosMdf, vinculosMap])

  if (!modulo) return null

  const isPromob = modulo.assinatura_visual?.some((t) => t.toLowerCase().includes('promob'))
  const perfilInfo =
    modulo.perfil_construtivo &&
    PERFIS_CONSTRUTIVOS_INFO[modulo.perfil_construtivo as PerfilConstrutivo]
      ? PERFIS_CONSTRUTIVOS_INFO[modulo.perfil_construtivo as PerfilConstrutivo]
      : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col p-6">
        {/* Cabeçalho */}
        <DialogHeader className="border-b border-slate-100 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-xl font-bold text-slate-900">
                  {modulo.nome_template}
                </DialogTitle>
                {isPromob && (
                  <Badge className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-[10px] tracking-wider uppercase">
                    Promob
                  </Badge>
                )}
                {modulo.perfil_construtivo && (
                  <Badge
                    variant="outline"
                    className="bg-sky-50 text-sky-800 border-sky-300 text-xs font-semibold"
                  >
                    ⚙️ {modulo.perfil_construtivo}
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs text-slate-500 mt-1">
                Avaliador de Engenharia Paramétrica — Fórmulas matemáticas resolvidas em tempo real
                via math.js.
              </DialogDescription>
            </div>

            {/* Totalizadores de Custo */}
            <div className="flex items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-xl shadow-xs self-start sm:self-auto">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <div className="text-right">
                <span className="text-[10px] text-slate-300 block uppercase font-mono">
                  Custo Estimado
                </span>
                <span className="text-sm font-bold text-emerald-400 font-mono">
                  R$ {resultado.custoTotalGeral.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 py-3 pr-1">
          {/* 1. Painel de Dimensões e Espessura */}
          <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                <Ruler className="w-4 h-4 text-slate-700" />
                Dimensões do Módulo (mm)
              </span>
              <span className="text-[11px] text-slate-500">
                Altere os valores para recalcular automaticamente todas as peças
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label htmlFor="dim_largura" className="text-xs font-semibold text-slate-700">
                  Largura (L)
                </Label>
                <div className="relative">
                  <Input
                    id="dim_largura"
                    type="number"
                    min={100}
                    max={4000}
                    step={10}
                    value={largura}
                    onChange={(e) => setLargura(Number(e.target.value) || 0)}
                    className="h-8 text-xs font-mono font-bold bg-white pr-7"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                    mm
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="dim_altura" className="text-xs font-semibold text-slate-700">
                  Altura (A)
                </Label>
                <div className="relative">
                  <Input
                    id="dim_altura"
                    type="number"
                    min={100}
                    max={4000}
                    step={10}
                    value={altura}
                    onChange={(e) => setAltura(Number(e.target.value) || 0)}
                    className="h-8 text-xs font-mono font-bold bg-white pr-7"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                    mm
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="dim_profundidade" className="text-xs font-semibold text-slate-700">
                  Profundidade (P)
                </Label>
                <div className="relative">
                  <Input
                    id="dim_profundidade"
                    type="number"
                    min={100}
                    max={2000}
                    step={10}
                    value={profundidade}
                    onChange={(e) => setProfundidade(Number(e.target.value) || 0)}
                    className="h-8 text-xs font-mono font-bold bg-white pr-7"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                    mm
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="dim_espessura" className="text-xs font-semibold text-slate-700">
                  Espessura Caixaria
                </Label>
                <Select
                  value={String(espessuraCaixaria)}
                  onValueChange={(val) => setEspessuraCaixaria(Number(val) || 18)}
                >
                  <SelectTrigger id="dim_espessura" className="h-8 text-xs font-mono bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 mm</SelectItem>
                    <SelectItem value="18">18 mm (Padrão)</SelectItem>
                    <SelectItem value="25">25 mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Configuração de Materiais por Slot */}
            <div className="pt-2 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-600">
                  Slot: Caixaria Interna
                </Label>
                <Select value={matCaixaria} onValueChange={setMatCaixaria}>
                  <SelectTrigger className="h-7 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mdf18_branco">MDF 18mm Branco (R$ 50/m²)</SelectItem>
                    <SelectItem value="mdf15_branco">MDF 15mm Branco (R$ 40/m²)</SelectItem>
                    <SelectItem value="mdf18_amadeirado">MDF 18mm Amadeirado (R$ 75/m²)</SelectItem>
                    <SelectItem value="mdf18_ultra">MDF 18mm Ultra Naval (R$ 95/m²)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-600">
                  Slot: Frentes Externas
                </Label>
                <Select value={matFrentes} onValueChange={setMatFrentes}>
                  <SelectTrigger className="h-7 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mdf18_amadeirado">MDF 18mm Amadeirado (R$ 75/m²)</SelectItem>
                    <SelectItem value="mdf18_branco">MDF 18mm Branco (R$ 50/m²)</SelectItem>
                    <SelectItem value="mdf18_ultra">MDF 18mm Ultra Naval (R$ 95/m²)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-600">Slot: Fundo</Label>
                <Select value={matFundo} onValueChange={setMatFundo}>
                  <SelectTrigger className="h-7 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mdf6_branco">MDF 6mm Branco (R$ 25/m²)</SelectItem>
                    <SelectItem value="mdf6_amadeirado">MDF 6mm Amadeirado (R$ 38/m²)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Avisos de Fórmula ou Regra */}
          {resultado.avisos.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Avisos na resolução de fórmulas
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                {resultado.avisos.map((aviso, idx) => (
                  <li key={idx}>{aviso}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Abas: Peças de MDF, Ferragens e Resumo Financeiro */}
          <Tabs defaultValue="pecas" className="w-full">
            <TabsList className="grid grid-cols-3 bg-slate-100 p-1 rounded-xl">
              <TabsTrigger value="pecas" className="text-xs font-semibold gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Peças Calculadas ({resultado.pecas.length})
              </TabsTrigger>
              <TabsTrigger value="ferragens" className="text-xs font-semibold gap-1.5">
                <Wrench className="w-3.5 h-3.5" />
                Ferragens ({resultado.ferragens.length})
              </TabsTrigger>
              <TabsTrigger value="resumo" className="text-xs font-semibold gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />
                Custo de Materiais
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Peças de MDF Calculadas */}
            <TabsContent value="pecas" className="mt-3">
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3">Descrição da Peça</th>
                      <th className="py-2.5 px-3">Slot Material</th>
                      <th className="py-2.5 px-3 text-right">Dimensões (A × L mm)</th>
                      <th className="py-2.5 px-3 text-center w-16">Qtd</th>
                      <th className="py-2.5 px-3 text-right w-20">Área (m²)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {resultado.pecas.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                          Nenhuma peça cadastrada nas regras deste módulo.
                        </td>
                      </tr>
                    ) : (
                      resultado.pecas.map((peca, idx) => {
                        const slotLabel =
                          peca.slot_material === 'caixaria_interna'
                            ? 'Caixaria Interna'
                            : peca.slot_material === 'frentes_externas'
                              ? 'Frentes Externas'
                              : peca.slot_material === 'fundo'
                                ? 'Fundo (6mm)'
                                : peca.slot_material

                        return (
                          <tr key={idx} className="hover:bg-slate-50/80">
                            <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-900">
                              {peca.descricao}
                              {peca.erro && (
                                <span className="block text-[10px] text-rose-500 font-normal">
                                  {peca.erro}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-medium ${
                                  peca.slot_material === 'frentes_externas'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : peca.slot_material === 'fundo'
                                      ? 'bg-slate-100 text-slate-700 border-slate-200'
                                      : 'bg-sky-50 text-sky-800 border-sky-200'
                                }`}
                              >
                                {slotLabel}
                              </Badge>
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                              {peca.alturaCalculada} × {peca.larguraCalculada}
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-slate-800">
                              {peca.quantidade}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600">
                              {peca.areaM2Total.toFixed(3)}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* TAB 2: Ferragens e Vínculos */}
            <TabsContent value="ferragens" className="mt-3">
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Nome Genérico (Regra)</th>
                      <th className="py-2.5 px-3">Item Vinculado no Catálogo</th>
                      <th className="py-2.5 px-3 text-center w-16">Qtd</th>
                      <th className="py-2.5 px-3 text-right w-24">Unitário</th>
                      <th className="py-2.5 px-3 text-right w-24">Subtotal</th>
                      <th className="py-2.5 px-3 text-center w-24">Estoque</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {resultado.ferragens.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                          Nenhuma ferragem cadastrada para este módulo.
                        </td>
                      </tr>
                    ) : (
                      resultado.ferragens.map((ferr, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="py-2 px-3 font-semibold text-slate-900">{ferr.item}</td>
                          <td className="py-2 px-3">
                            {ferr.vinculado ? (
                              <div className="flex items-center gap-1.5 text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span className="font-medium">{ferr.nomeCatalogo}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className="bg-amber-50 text-amber-700 border-amber-300 text-[10px]"
                                >
                                  Não vinculada
                                </Badge>
                                {onOpenVincularFerragem && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onOpenVincularFerragem(ferr.item)}
                                    className="h-6 px-1.5 text-[10px] text-slate-600 hover:text-slate-900"
                                  >
                                    Vincular agora
                                  </Button>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-slate-800">
                            {ferr.quantidade}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700">
                            {ferr.precoUnitario !== null
                              ? `R$ ${ferr.precoUnitario.toFixed(2)}`
                              : '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                            {ferr.subtotal !== null ? `R$ ${ferr.subtotal.toFixed(2)}` : '—'}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-slate-600 text-[11px]">
                            {ferr.estoqueQtd !== null && ferr.estoqueQtd !== undefined
                              ? ferr.estoqueQtd
                              : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* TAB 3: Resumo Financeiro & Área de MDF */}
            <TabsContent value="resumo" className="mt-3 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Resumo por Material de MDF */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-slate-700" />
                    Consumo de Chapas de MDF
                  </h4>

                  <div className="space-y-2">
                    {Object.values(resultado.resumoMateriais).map((mat) => (
                      <div
                        key={mat.slot}
                        className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">{mat.nomeMaterial}</p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {mat.areaTotalM2.toFixed(3)} m² × R$ {mat.precoM2.toFixed(2)}/m²
                          </p>
                        </div>
                        <span className="font-mono font-bold text-slate-900">
                          R$ {mat.custoTotal.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-700">Subtotal MDF:</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      R$ {resultado.custoTotalMdf.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Subtotais e Total Geral */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      Consolidação de Custos
                    </h4>

                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex justify-between items-center py-1 border-b border-slate-200">
                        <span className="text-slate-600">Peças de MDF:</span>
                        <span className="font-mono font-semibold text-slate-900">
                          R$ {resultado.custoTotalMdf.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-slate-200">
                        <span className="text-slate-600">Ferragens e Acessórios:</span>
                        <span className="font-mono font-semibold text-slate-900">
                          R$ {resultado.custoTotalFerragens.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900 text-white p-3 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-mono">
                        Custo Total Estimado
                      </span>
                      <span className="text-base font-bold text-emerald-400 font-mono">
                        R$ {resultado.custoTotalGeral.toFixed(2)}
                      </span>
                    </div>
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                      Engenharia Pronta
                    </Badge>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Rodapé */}
        <DialogFooter className="border-t border-slate-100 pt-3 flex sm:justify-between items-center w-full gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs font-semibold"
          >
            Fechar
          </Button>

          <div className="flex items-center gap-2">
            {onOpenVincularFerragem && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenVincularFerragem()}
                className="text-xs border-slate-300"
              >
                <Wrench className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
                Vincular Ferragens
              </Button>
            )}

            <Button
              asChild
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
            >
              <a
                href={`/orcamento-v2?template=${encodeURIComponent(modulo.id)}&l=${largura}&a=${altura}&p=${profundidade}`}
              >
                Usar no Orçamento
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </a>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
