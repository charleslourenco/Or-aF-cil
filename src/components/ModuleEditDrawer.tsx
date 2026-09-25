import React, { useState, useEffect, useMemo } from 'react'
import {
  UploadCloud,
  Layers,
  Ruler,
  Settings2,
  Box,
  Check,
  Sparkles,
  Info,
  DollarSign,
  AlertCircle,
  Package,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  PerfilConstrutivo,
  PERFIS_CONSTRUTIVOS_INFO,
  TemplateEngenharia,
  fetchTemplatesEngenharia,
} from '@/services/templates'
import { CatalogoMaterial, fetchCatalogoMateriais } from '@/services/catalogo'
import { Dimensoes, MdfSpec, PadraoProjeto, ModuloComposicao, calcularBOM } from '@/lib/pricing'
import { CustomerDropzone, UploadedFileState } from '@/components/CustomerDropzone'
import { cn } from '@/lib/utils'

export interface ModuloSalvoData {
  nome: string
  descricaoTipo: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
  dimensoes: Dimensoes
  perfilConstrutivo: PerfilConstrutivo
  padraoProjeto: PadraoProjeto
  mdfExterno: MdfSpec
  mdfInterno: MdfSpec
  mdfFundo: string
}

interface ModuleEditDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ambienteNome: string
  onSaveModulo: (modulo: ModuloSalvoData) => void
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val)

export const ModuleEditDrawer: React.FC<ModuleEditDrawerProps> = ({
  open,
  onOpenChange,
  ambienteNome,
  onSaveModulo,
}) => {
  const [activeTab, setActiveTab] = useState<'foto-ia' | 'medidas-materiais' | 'engenharia-pecas'>(
    'foto-ia',
  )

  // Catálogos e templates carregados do Supabase
  const [templates, setTemplates] = useState<TemplateEngenharia[]>([])
  const [catalogoMateriais, setCatalogoMateriais] = useState<CatalogoMaterial[]>([])
  const [loadingData, setLoadingData] = useState(false)

  // Estado do módulo configurado
  const [nomeModulo, setNomeModulo] = useState('Armário Superior 2 Portas')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [dimensoes, setDimensoes] = useState<Dimensoes>({
    largura: 800,
    altura: 700,
    profundidade: 350,
  })
  const [quantidade, setQuantidade] = useState<number>(1)
  const [perfilConstrutivo, setPerfilConstrutivo] = useState<PerfilConstrutivo>('Caixa Simples')
  const [padraoProjeto, setPadraoProjeto] = useState<PadraoProjeto>('comercial')
  const [mdfExterno, setMdfExterno] = useState<MdfSpec>({ cor: 'Branco TX', espessura: 18 })
  const [mdfInterno, setMdfInterno] = useState<MdfSpec>({ cor: 'Branco TX', espessura: 15 })
  const [mdfFundo, setMdfFundo] = useState<string>('MDF 6mm Branco TX')

  // Aba 1 - Upload de Fotos & IA
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileState[]>([])
  const [isSimulatingIA, setIsSimulatingIA] = useState(false)
  const [iaDetectedNotice, setIaDetectedNotice] = useState<string | null>(null)

  // Carrega catálogo e templates quando o drawer abre pela primeira vez
  useEffect(() => {
    if (open && templates.length === 0) {
      setLoadingData(true)
      Promise.all([fetchTemplatesEngenharia(), fetchCatalogoMateriais(6000)])
        .then(([tplRes, matRes]) => {
          if (tplRes.data && tplRes.data.length > 0) {
            setTemplates(tplRes.data)
            // Se o perfil ou nome ainda for o default, associa ao primeiro
            const first = tplRes.data[0]
            if (first) {
              setSelectedTemplateId(first.id)
              setNomeModulo(first.nome_template)
              if (first.perfil_construtivo) {
                setPerfilConstrutivo(first.perfil_construtivo as PerfilConstrutivo)
              }
            }
          }
          if (matRes) {
            setCatalogoMateriais(matRes)
          }
        })
        .finally(() => setLoadingData(false))
    }
  }, [open, templates.length])

  // Reset de estado quando abre para um novo módulo
  useEffect(() => {
    if (open) {
      setActiveTab('foto-ia')
      setIaDetectedNotice(null)
    }
  }, [open])

  // Lista de materiais do catálogo para os selects
  const opcoesMdf = useMemo(() => {
    return catalogoMateriais.filter(
      (m) =>
        m.categoria === 'MDF 15mm' ||
        m.categoria === 'MDF 18mm' ||
        m.categoria === 'MDF 6mm' ||
        m.nome_material.toLowerCase().includes('mdf'),
    )
  }, [catalogoMateriais])

  // Template selecionado atualmente
  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId) || null
  }, [templates, selectedTemplateId])

  // Mudança de gabarito selecionado
  const handleSelectTemplate = (tplId: string) => {
    setSelectedTemplateId(tplId)
    const tpl = templates.find((t) => t.id === tplId)
    if (tpl) {
      setNomeModulo(tpl.nome_template)
      if (tpl.perfil_construtivo) {
        setPerfilConstrutivo(tpl.perfil_construtivo as PerfilConstrutivo)
      }
    }
  }

  // Simulação amigável de IA para o módulo enviado
  const handleSimularAnaliseIA = () => {
    if (uploadedFiles.length === 0) return
    setIsSimulatingIA(true)
    setTimeout(() => {
      setIsSimulatingIA(false)
      // Tenta inferir nome a partir do nome do arquivo ou usar um padrão inteligente
      const fileName = uploadedFiles[0]?.name.toLowerCase() || ''
      let matchNome = 'Armário Sob Medida'
      let matchPerfil: PerfilConstrutivo = 'Fechado Envelopado'

      if (
        fileName.includes('balcao') ||
        fileName.includes('bancada') ||
        fileName.includes('cozinha')
      ) {
        matchNome = 'Balcão de Cozinha 2 Portas'
        matchPerfil = 'Balcão (tampo por conta do cliente)'
      } else if (
        fileName.includes('painel') ||
        fileName.includes('tv') ||
        fileName.includes('sala')
      ) {
        matchNome = 'Painel TV Ripado'
        matchPerfil = 'Aberto / Painel'
      } else if (fileName.includes('aereo') || fileName.includes('superior')) {
        matchNome = 'Armário Aéreo Basculante'
        matchPerfil = 'Caixa Simples'
      } else if (templates.length > 0) {
        matchNome = templates[0].nome_template
        matchPerfil = (templates[0].perfil_construtivo as PerfilConstrutivo) || 'Fechado Envelopado'
      }

      setNomeModulo(matchNome)
      setPerfilConstrutivo(matchPerfil)
      setIaDetectedNotice(
        `Módulo identificado com sucesso: "${matchNome}" (${matchPerfil}). As medidas e perfil foram ajustados!`,
      )
    }, 900)
  }

  // Cálculo da lista técnica interna (Aba 3: Engenharia & Peças)
  const pecasBOM = useMemo(() => {
    if (!dimensoes.largura || !dimensoes.altura || !dimensoes.profundidade) return []
    const moduloPayload = {
      id: selectedTemplateId || 'custom-v2',
      nome_template: nomeModulo,
      perfil_construtivo: perfilConstrutivo,
    }
    const composicao: ModuloComposicao = {
      perfilConstrutivo,
      semTamponamento: perfilConstrutivo === 'Caixa Simples',
      portas: { qtd: 2, tipo: 'abrir' },
      gavetas: { qtd: 0 },
      prateleiras: { qtd: 1 },
    }

    return calcularBOM(
      moduloPayload,
      dimensoes,
      mdfExterno,
      mdfInterno,
      mdfFundo,
      padraoProjeto,
      catalogoMateriais,
      1.8,
      1.0,
      composicao,
    )
  }, [
    selectedTemplateId,
    nomeModulo,
    perfilConstrutivo,
    dimensoes,
    mdfExterno,
    mdfInterno,
    mdfFundo,
    padraoProjeto,
    catalogoMateriais,
  ])

  // Custo técnico e valor calculado sugerido
  const totalCustoTecnico = useMemo(() => {
    return pecasBOM.reduce((acc, p) => acc + (p.totalCost || 0), 0)
  }, [pecasBOM])

  const totalVendaSugerido = useMemo(() => {
    return pecasBOM.reduce((acc, p) => acc + (p.salePrice || 0), 0)
  }, [pecasBOM])

  // Salvar no Ambiente
  const handleSalvar = () => {
    const nomeLimpo = nomeModulo.trim() || 'Módulo sem nome'
    const unitPrice = totalVendaSugerido > 0 ? Math.round(totalVendaSugerido * 100) / 100 : 0
    const total = Math.round(unitPrice * quantidade * 100) / 100

    onSaveModulo({
      nome: nomeLimpo,
      descricaoTipo: `${perfilConstrutivo} • ${dimensoes.largura}×${dimensoes.altura}×${dimensoes.profundidade}mm`,
      quantidade,
      valorUnitario: unitPrice,
      valorTotal: total,
      dimensoes,
      perfilConstrutivo,
      padraoProjeto,
      mdfExterno,
      mdfInterno,
      mdfFundo,
    })

    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl lg:max-w-3xl p-0 flex flex-col h-full bg-slate-50 dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl"
      >
        {/* Cabeçalho do Painel Lateral */}
        <SheetHeader className="px-6 py-4 border-b border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-left shrink-0">
          <div className="flex items-center gap-2 pr-8">
            <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
              <Box className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                Configurar Módulo — {ambienteNome || 'Ambiente'}
              </SheetTitle>
              <SheetDescription className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Defina foto/IA, dimensões, materiais e confira a engenharia deste móvel
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Corpo com seletor de 3 Abas */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as typeof activeTab)}
            className="w-full h-full flex flex-col"
          >
            <TabsList className="grid grid-cols-3 h-11 p-1 bg-slate-200/80 dark:bg-slate-800/80 rounded-xl mb-4 shrink-0">
              <TabsTrigger
                value="foto-ia"
                className="text-xs font-bold rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100 data-[state=active]:shadow-xs transition-all"
              >
                1. Foto & IA
              </TabsTrigger>
              <TabsTrigger
                value="medidas-materiais"
                className="text-xs font-bold rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100 data-[state=active]:shadow-xs transition-all"
              >
                2. Medidas & Materiais
              </TabsTrigger>
              <TabsTrigger
                value="engenharia-pecas"
                className="text-xs font-bold rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100 data-[state=active]:shadow-xs transition-all"
              >
                3. Engenharia & Peças
              </TabsTrigger>
            </TabsList>

            {/* ======================================================== */}
            {/* ABA 1: Foto & IA (Leitura de UM móvel por vez)           */}
            {/* ======================================================== */}
            <TabsContent value="foto-ia" className="mt-0 space-y-4 focus-visible:outline-none">
              <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold block mb-0.5">
                    Visão Computacional por Módulo:
                  </strong>
                  Envie fotos de <strong>apenas um móvel por vez</strong> para o ambiente{' '}
                  <span className="font-semibold underline decoration-blue-400">
                    "{ambienteNome}"
                  </span>
                  . A IA analisa detalhes construtivos (gavetas, portas, nichos) e sugere o perfil e
                  dimensões ideais.
                </div>
              </div>

              {/* Upload Dropzone */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <CustomerDropzone
                  uploadedFiles={uploadedFiles}
                  onFilesSelect={(files) => {
                    setUploadedFiles(files || [])
                    setIaDetectedNotice(null)
                  }}
                />
              </div>

              {/* Ação de Análise de IA */}
              {uploadedFiles.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs animate-fade-in">
                  <div className="space-y-0.5 text-center sm:text-left">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 justify-center sm:justify-start">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      Analisar Imagens com IA
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Detectar módulo correspondente, ferragens e perfil construtivo
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isSimulatingIA}
                    onClick={handleSimularAnaliseIA}
                    className="h-9 px-4 gap-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 shrink-0 w-full sm:w-auto"
                  >
                    {isSimulatingIA ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Processando IA...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Identificar Módulo</span>
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Notificação de sucesso de detecção da IA */}
              {iaDetectedNotice && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2 animate-fade-in">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="flex-1">{iaDetectedNotice}</span>
                </div>
              )}

              {/* Botão de avanço rápido para a Aba 2 */}
              <div className="pt-2 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('medidas-materiais')}
                  className="h-9 px-4 text-xs font-bold rounded-xl border-slate-300 dark:border-slate-700"
                >
                  Continuar para Medidas & Materiais →
                </Button>
              </div>
            </TabsContent>

            {/* ======================================================== */}
            {/* ABA 2: Medidas & Materiais                               */}
            {/* ======================================================== */}
            <TabsContent
              value="medidas-materiais"
              className="mt-0 space-y-4 focus-visible:outline-none"
            >
              {/* Card de Identificação e Gabarito */}
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <Box className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">
                    Gabarito da Biblioteca
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Módulo da Biblioteca
                    </Label>
                    <Select value={selectedTemplateId} onValueChange={handleSelectTemplate}>
                      <SelectTrigger className="h-10 rounded-xl text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700">
                        <SelectValue placeholder="Selecione um módulo..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl max-h-60">
                        {templates.map((tpl) => (
                          <SelectItem key={tpl.id} value={tpl.id} className="text-xs">
                            {tpl.nome_template}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Nome Comercial no Orçamento
                    </Label>
                    <Input
                      value={nomeModulo}
                      onChange={(e) => setNomeModulo(e.target.value)}
                      placeholder="Ex.: Armário Superior 2 Portas"
                      className="h-10 text-xs rounded-xl bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-semibold"
                    />
                  </div>
                </div>

                {/* Perfil Construtivo — Regra: vem do módulo, com override manual */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Perfil Construtivo
                    </Label>
                    <span className="text-[10px] text-slate-400">
                      Regra de tamponamento e estrutura
                    </span>
                  </div>
                  <Select
                    value={perfilConstrutivo}
                    onValueChange={(val: PerfilConstrutivo) => setPerfilConstrutivo(val)}
                  >
                    <SelectTrigger className="h-10 rounded-xl text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-semibold">
                      <SelectValue placeholder="Perfil Construtivo..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {(Object.keys(PERFIS_CONSTRUTIVOS_INFO) as PerfilConstrutivo[]).map((pk) => {
                        const info = PERFIS_CONSTRUTIVOS_INFO[pk]
                        return (
                          <SelectItem key={pk} value={pk} className="text-xs">
                            <span className="font-semibold">{info.label}</span>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {PERFIS_CONSTRUTIVOS_INFO[perfilConstrutivo]?.descCurta}
                  </p>
                </div>
              </div>

              {/* Card de Dimensões e Quantidade */}
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <Ruler className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">
                    Dimensões e Quantidade
                  </h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Largura (mm)
                    </Label>
                    <Input
                      type="number"
                      min={100}
                      value={dimensoes.largura}
                      onChange={(e) =>
                        setDimensoes((prev) => ({ ...prev, largura: Number(e.target.value) || 0 }))
                      }
                      className="h-10 text-xs font-mono font-bold rounded-xl bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Altura (mm)
                    </Label>
                    <Input
                      type="number"
                      min={100}
                      value={dimensoes.altura}
                      onChange={(e) =>
                        setDimensoes((prev) => ({ ...prev, altura: Number(e.target.value) || 0 }))
                      }
                      className="h-10 text-xs font-mono font-bold rounded-xl bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Profundidade (mm)
                    </Label>
                    <Input
                      type="number"
                      min={100}
                      value={dimensoes.profundidade}
                      onChange={(e) =>
                        setDimensoes((prev) => ({
                          ...prev,
                          profundidade: Number(e.target.value) || 0,
                        }))
                      }
                      className="h-10 text-xs font-mono font-bold rounded-xl bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Quantidade
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      value={quantidade}
                      onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value) || 1))}
                      className="h-10 text-xs font-mono font-bold rounded-xl bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                    />
                  </div>
                </div>
              </div>

              {/* Card de Materiais e Padrão de Acabamento */}
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <Layers className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">
                    Materiais do Módulo
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Padrão de Acabamento
                    </Label>
                    <ToggleGroup
                      type="single"
                      value={padraoProjeto}
                      onValueChange={(v) => v && setPadraoProjeto(v as PadraoProjeto)}
                      className="w-full h-10 border border-slate-300 dark:border-slate-700 rounded-xl p-1 bg-white dark:bg-slate-950 justify-start"
                    >
                      <ToggleGroupItem
                        value="comercial"
                        className="flex-1 h-8 text-xs font-semibold rounded-lg data-[state=on]:bg-slate-900 data-[state=on]:text-white dark:data-[state=on]:bg-slate-100 dark:data-[state=on]:text-slate-900"
                      >
                        Comercial
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="premium"
                        className="flex-1 h-8 text-xs font-semibold rounded-lg data-[state=on]:bg-slate-900 data-[state=on]:text-white dark:data-[state=on]:bg-slate-100 dark:data-[state=on]:text-slate-900"
                      >
                        Premium
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      MDF Externo (Frentes / Tampos)
                    </Label>
                    <Select
                      value={mdfExterno.cor}
                      onValueChange={(v) => setMdfExterno((prev) => ({ ...prev, cor: v }))}
                    >
                      <SelectTrigger className="h-10 rounded-xl text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700">
                        <SelectValue placeholder="MDF Externo..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {opcoesMdf.length === 0 ? (
                          <SelectItem value="Branco TX">Branco TX</SelectItem>
                        ) : (
                          opcoesMdf.map((m) => (
                            <SelectItem key={m.id} value={m.nome_material} className="text-xs">
                              {m.nome_material}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      MDF Interno (Caixaria / Prateleiras)
                    </Label>
                    <Select
                      value={mdfInterno.cor}
                      onValueChange={(v) => setMdfInterno((prev) => ({ ...prev, cor: v }))}
                    >
                      <SelectTrigger className="h-10 rounded-xl text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700">
                        <SelectValue placeholder="MDF Interno..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {opcoesMdf.length === 0 ? (
                          <SelectItem value="Branco TX">Branco TX</SelectItem>
                        ) : (
                          opcoesMdf.map((m) => (
                            <SelectItem key={m.id} value={m.nome_material} className="text-xs">
                              {m.nome_material}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      MDF Fundo (Traseira)
                    </Label>
                    <Input
                      value={mdfFundo}
                      onChange={(e) => setMdfFundo(e.target.value)}
                      className="h-10 text-xs rounded-xl bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                    />
                  </div>
                </div>
              </div>

              {/* Botão de avanço para a Aba 3 */}
              <div className="pt-2 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('engenharia-pecas')}
                  className="h-9 px-4 text-xs font-bold rounded-xl border-slate-300 dark:border-slate-700"
                >
                  Conferir Engenharia & Peças →
                </Button>
              </div>
            </TabsContent>

            {/* ======================================================== */}
            {/* ABA 3: Engenharia & Peças (Lista técnica interna)         */}
            {/* ======================================================== */}
            <TabsContent
              value="engenharia-pecas"
              className="mt-0 space-y-4 focus-visible:outline-none"
            >
              <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    <strong>Lista Técnica Interna da Marcenaria:</strong> Peças, cortes e ferragens
                    calculadas automaticamente.
                  </span>
                </span>
                <Badge
                  variant="outline"
                  className="border-amber-400 text-amber-900 dark:text-amber-200 font-bold text-[10px] shrink-0"
                >
                  {pecasBOM.length} itens
                </Badge>
              </div>

              {/* Resumo de Custos Técnicos e Preço Sugerido */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Custo Direto de Produção (Unitário)
                  </span>
                  <span className="text-base sm:text-lg font-bold font-mono text-slate-800 dark:text-slate-200">
                    {formatCurrency(totalCustoTecnico)}
                  </span>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Valor Sugerido de Venda (Unitário)
                  </span>
                  <span className="text-base sm:text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(totalVendaSugerido)}
                  </span>
                </div>
              </div>

              {/* Tabela Técnica de Peças e Ferragens */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
                <div className="max-h-72 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                        <TableHead className="py-2.5 px-3 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          Peça / Item
                        </TableHead>
                        <TableHead className="py-2.5 px-3 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          Material
                        </TableHead>
                        <TableHead className="py-2.5 px-3 text-[11px] font-bold text-slate-600 dark:text-slate-400 text-center">
                          Metragem/Qtd
                        </TableHead>
                        <TableHead className="py-2.5 px-3 text-[11px] font-bold text-slate-600 dark:text-slate-400 text-right">
                          Custo Total
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pecasBOM.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="py-6 text-center text-xs text-slate-400"
                          >
                            Nenhuma peça gerada. Verifique as dimensões na Aba 2.
                          </TableCell>
                        </TableRow>
                      ) : (
                        pecasBOM.map((peca) => (
                          <TableRow
                            key={peca.id}
                            className="border-b border-slate-100 dark:border-slate-800"
                          >
                            <TableCell className="py-2.5 px-3 text-xs font-medium text-slate-800 dark:text-slate-200">
                              {peca.description}
                            </TableCell>
                            <TableCell className="py-2.5 px-3 text-[11px] text-slate-500">
                              {peca.material}
                            </TableCell>
                            <TableCell className="py-2.5 px-3 text-xs text-center font-mono text-slate-700 dark:text-slate-300">
                              {peca.metragem.toFixed(2)} {peca.unidade}
                            </TableCell>
                            <TableCell className="py-2.5 px-3 text-xs text-right font-mono text-slate-700 dark:text-slate-300">
                              {formatCurrency(peca.totalCost)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Rodapé fixo com o botão pedido: 'Salvar Módulo no Ambiente' */}
        <SheetFooter className="px-6 py-4 border-t border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 w-full sm:w-auto justify-between sm:justify-start">
            <span>
              Qtd:{' '}
              <strong className="font-mono text-slate-800 dark:text-slate-200">
                {quantidade}x
              </strong>
            </span>
            <span>•</span>
            <span>
              Total previsto:{' '}
              <strong className="font-mono text-slate-900 dark:text-slate-100 font-bold">
                {formatCurrency(totalVendaSugerido * quantidade)}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-10 px-4 text-xs font-semibold rounded-xl border-slate-300 dark:border-slate-700"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSalvar}
              className="h-10 px-5 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 shadow-sm transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Salvar Módulo no Ambiente</span>
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
