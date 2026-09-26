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
import {
  Dimensoes,
  MdfSpec,
  PadraoProjeto,
  ModuloComposicao,
  calcularBOM,
  MARKUP_PADRAO,
} from '@/lib/pricing'
import { CustomerDropzone, UploadedFileState } from '@/components/CustomerDropzone'
import { Switch } from '@/components/ui/switch'
import { supabase } from '@/lib/supabase/client'
import { fetchConfigEngenharia, ConfigEngenharia } from '@/services/engenharia'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { OrcamentoBOMItem } from '@/services/orcamentos'

export interface ModuloSalvoData {
  id?: string
  moduloId?: string
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
  portas?: number
  gavetas?: number
  prateleiras?: number
  cabideiros?: number
  iluminacaoLed?: boolean
  itensBOM: OrcamentoBOMItem[]
}

interface ModuleEditDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ambienteNome: string
  initialData?: ModuloSalvoData | null
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
  initialData = null,
  onSaveModulo,
}) => {
  const [activeTab, setActiveTab] = useState<'foto-ia' | 'medidas-materiais' | 'engenharia-pecas'>(
    'foto-ia',
  )

  // Catálogos, templates e engenharia carregados do Supabase
  const [templates, setTemplates] = useState<TemplateEngenharia[]>([])
  const [catalogoMateriais, setCatalogoMateriais] = useState<CatalogoMaterial[]>([])
  const [configEngenharia, setConfigEngenharia] = useState<ConfigEngenharia | null>(null)
  const [loadingData, setLoadingData] = useState(false)

  // Estado do módulo configurado
  const [nomeModulo, setNomeModulo] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [dimensoes, setDimensoes] = useState<Dimensoes>({
    largura: 800,
    altura: 700,
    profundidade: 550,
  })
  const [quantidade, setQuantidade] = useState<number>(1)
  const [perfilConstrutivo, setPerfilConstrutivo] =
    useState<PerfilConstrutivo>('Fechado Envelopado')
  const [padraoProjeto, setPadraoProjeto] = useState<PadraoProjeto>('comercial')
  const [mdfExterno, setMdfExterno] = useState<MdfSpec>({ cor: 'Branco TX', espessura: 18 })
  const [mdfInterno, setMdfInterno] = useState<MdfSpec>({ cor: 'Branco TX', espessura: 15 })
  const [mdfFundo, setMdfFundo] = useState<string>('MDF 6mm Branco TX')

  // Seletores numéricos e alternadores da Aba 2
  const [portasCount, setPortasCount] = useState<number>(2)
  const [gavetasCount, setGavetasCount] = useState<number>(0)
  const [prateleirasCount, setPrateleirasCount] = useState<number>(1)
  const [cabideirosCount, setCabideirosCount] = useState<number>(0)
  const [iluminacaoLed, setIluminacaoLed] = useState<boolean>(false)

  // Aba 1 - Upload de Fotos & IA
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileState[]>([])
  const [isAnalyzingIA, setIsAnalyzingIA] = useState(false)
  const [iaDetectedNotice, setIaDetectedNotice] = useState<string | null>(null)
  const [iaIdentifiedTemplate, setIaIdentifiedTemplate] = useState<{
    template: TemplateEngenharia
    motivo: string
    confianca: number
    confiancaNivel?: 'alta' | 'media' | 'baixa'
    isLibraryMatch?: boolean
    matchJustificativa?: string
    sugestoes?: {
      largura?: number
      altura?: number
      profundidade?: number
      portas?: number
      gavetas?: number
      prateleiras?: number
      cabideiros?: number
    }
  } | null>(null)
  const [isMatchConfirmed, setIsMatchConfirmed] = useState(false)

  // Carrega catálogo, templates e engenharia quando o drawer abre pela primeira vez
  useEffect(() => {
    if (open && templates.length === 0) {
      setLoadingData(true)
      Promise.all([
        fetchTemplatesEngenharia(),
        fetchCatalogoMateriais(6000),
        fetchConfigEngenharia(),
      ])
        .then(([tplRes, matRes, engRes]) => {
          if (tplRes.data && tplRes.data.length > 0) {
            setTemplates(tplRes.data)
            if (!selectedTemplateId && !initialData) {
              const first = tplRes.data[0]
              if (first) {
                setSelectedTemplateId(first.id)
                // Regra permanente v2: NÃO autopreencher nomeModulo com nome_template da biblioteca.
                // Deve iniciar VAZIO para o usuário dar o nome que quer no PDF.
                if (first.perfil_construtivo) {
                  setPerfilConstrutivo(first.perfil_construtivo as PerfilConstrutivo)
                }
              }
            }
          }
          if (matRes) {
            setCatalogoMateriais(matRes)
          }
          if (engRes.config) {
            setConfigEngenharia(engRes.config)
          }
        })
        .catch((err) => {
          console.error('Erro ao carregar dados do módulo:', err)
        })
        .finally(() => setLoadingData(false))
    }
  }, [open, templates.length, selectedTemplateId, initialData])

  // Inicialização / Reset de estado quando o drawer abre:
  // - Se for NOVO módulo: campo 'Nome do Módulo' SEMPRE vazio, reseta seletores e tabs
  // - Se for EDIÇÃO (initialData): preenche com os dados salvos sem zerar o nome existente
  useEffect(() => {
    if (open) {
      setActiveTab('foto-ia')
      setIaDetectedNotice(null)
      setIaIdentifiedTemplate(null)
      setIsMatchConfirmed(false)
      setUploadedFiles([])

      if (initialData) {
        // Modo Edição: preserva o nome salvo e demais atributos
        setNomeModulo(initialData.nome || '')
        setSelectedTemplateId(initialData.moduloId || '')
        setDimensoes(
          initialData.dimensoes || {
            largura: 800,
            altura: 700,
            profundidade: 550,
          },
        )
        setQuantidade(initialData.quantidade || 1)
        if (initialData.perfilConstrutivo) {
          setPerfilConstrutivo(initialData.perfilConstrutivo)
        }
        if (initialData.padraoProjeto) {
          setPadraoProjeto(initialData.padraoProjeto)
        }
        if (initialData.mdfExterno) {
          setMdfExterno(initialData.mdfExterno)
        }
        if (initialData.mdfInterno) {
          setMdfInterno(initialData.mdfInterno)
        }
        if (initialData.mdfFundo) {
          setMdfFundo(initialData.mdfFundo)
        }
        setPortasCount(initialData.portas ?? 2)
        setGavetasCount(initialData.gavetas ?? 0)
        setPrateleirasCount(initialData.prateleiras ?? 1)
        setCabideirosCount(initialData.cabideiros ?? 0)
        setIluminacaoLed(Boolean(initialData.iluminacaoLed))
      } else {
        // Modo Novo Módulo: SEMPRE vazio (decisão permanente do usuário)
        setNomeModulo('')
        setQuantidade(1)
        setPortasCount(2)
        setGavetasCount(0)
        setPrateleirasCount(1)
        setCabideirosCount(0)
        setIluminacaoLed(false)
      }
    }
  }, [open, initialData])

  // Função auxiliar para derivar espessura (15 ou 18 mm) do material selecionado
  const extrairEspessuraMdf = (nomeOuCategoria: string, fallback: 15 | 18 = 15): 15 | 18 => {
    if (/18\s*mm|mdf\s*18/i.test(nomeOuCategoria)) return 18
    if (/15\s*mm|mdf\s*15/i.test(nomeOuCategoria)) return 15
    return fallback
  }

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
      // Regra permanente v2: NÃO autopreencher nomeModulo com nome_template
      if (tpl.perfil_construtivo) {
        setPerfilConstrutivo(tpl.perfil_construtivo as PerfilConstrutivo)
      }
    }
  }

  // Converte arquivo para Base64 (data URL)
  const fileStateToBase64 = (fileState: UploadedFileState): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Falha ao converter imagem para Base64.'))

      if (fileState.file) {
        reader.readAsDataURL(fileState.file)
        return
      }

      if (fileState.previewUrl) {
        fetch(fileState.previewUrl)
          .then((res) => {
            if (!res.ok) throw new Error('Falha ao baixar imagem do croqui.')
            return res.blob()
          })
          .then((blob) => reader.readAsDataURL(blob))
          .catch((err) => reject(err))
        return
      }

      reject(new Error('Arquivo inválido para análise visual.'))
    })
  }

  // Chamada REAL da OpenAI (gpt-4o, visão) via edge function 'analisar-imagem'
  const handleExecutarAnaliseIA = async () => {
    if (uploadedFiles.length === 0) {
      toast({
        title: 'Selecione uma imagem',
        description: 'Faça upload de uma foto ou croqui de um móvel antes de analisar.',
        variant: 'destructive',
      })
      return
    }

    const primeiraImagem = uploadedFiles[0]
    setIsAnalyzingIA(true)
    setIsMatchConfirmed(false)
    setIaDetectedNotice(null)

    try {
      const imagemBase64 = await fileStateToBase64(primeiraImagem)

      // Invoca a edge function analisar-imagem (que usa gpt-4o e a biblioteca real)
      const { data, error } = await supabase.functions.invoke('analisar-imagem', {
        body: {
          imagemBase64,
          modulos: templates,
          catalogoMateriais,
        },
      })

      if (error) {
        throw new Error(error.message || 'Erro ao chamar a Edge Function de análise visual.')
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      const modulosDetectados = data?.modulos_detectados ?? []
      const primeiro = modulosDetectados[0]

      if (primeiro) {
        // Encontra o template correspondente na biblioteca se não for customizado.
        // NUNCA usar fallback templates[0], pois vinculava indevidamente ao primeiro template alfabético da biblioteca ("Curvo").
        const isCustom =
          primeiro.codigo_modulo === 'MODULO-CUSTOM' ||
          primeiro.e_customizado ||
          !primeiro.codigo_modulo

        const foundInTemplates = !isCustom
          ? templates.find(
              (t) =>
                t.id === primeiro.codigo_modulo ||
                t.nome_template.toLowerCase() === (primeiro.nome || '').toLowerCase(),
            )
          : null

        const matched: TemplateEngenharia = foundInTemplates || {
          id: 'mod-custom',
          nome_template: primeiro.nome || 'Módulo Sob Medida',
          perfil_construtivo:
            (primeiro.perfil_construcao_sugerido as PerfilConstrutivo) || 'Fechado Envelopado',
          categoria: 'Personalizado',
          dimensoes: `${primeiro.dimensao_estimada?.largura || 800}x${primeiro.dimensao_estimada?.altura || 700}x${primeiro.dimensao_estimada?.profundidade || 550}`,
          material: 'MDF',
          descricao: 'Módulo analisado por IA',
          codigo: 'CUSTOM',
          pecas_mdf: null,
          ferragens: null,
          imagem_url: null,
          assinatura_visual: null,
        }

        const confiancaNivel: 'alta' | 'media' | 'baixa' =
          primeiro.confianca === 'alta'
            ? 'alta'
            : primeiro.confianca === 'media'
              ? 'media'
              : 'baixa'

        const confiancaNum = confiancaNivel === 'alta' ? 95 : confiancaNivel === 'media' ? 80 : 65

        const sugestoes = {
          largura: primeiro.dimensao_estimada?.largura ?? 800,
          altura: primeiro.dimensao_estimada?.altura ?? 700,
          profundidade: primeiro.dimensao_estimada?.profundidade ?? 550,
          portas: primeiro.portas?.qtd ?? 2,
          gavetas: primeiro.gavetas?.qtd ?? 0,
          prateleiras: primeiro.prateleiras?.qtd ?? 1,
          cabideiros: primeiro.cabideiro ? 1 : 0,
        }

        const isLibraryMatch = Boolean(foundInTemplates)

        const motivo =
          primeiro.match_justificativa ||
          data.justificativa ||
          primeiro.adaptacoes ||
          (isLibraryMatch
            ? 'Correspondência visual identificada via OpenAI gpt-4o com a biblioteca.'
            : 'Módulo sob medida detectado pela IA.')

        setIaIdentifiedTemplate({
          template: matched,
          motivo,
          confianca: confiancaNum,
          confiancaNivel,
          isLibraryMatch,
          matchJustificativa: primeiro.match_justificativa,
          sugestoes,
        })

        setIaDetectedNotice(
          `OpenAI gpt-4o identificou: "${matched.nome_template}" (${confiancaNum}% confiança). Clique em "Confirmar Match" para preencher a Aba 2.`,
        )

        toast({
          title: 'Análise de Imagem Concluída',
          description: `Módulo detectado: ${matched.nome_template} via gpt-4o`,
        })
      } else {
        toast({
          title: 'Nenhum módulo identificado',
          description: 'A IA não identificou um módulo com precisão suficiente.',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      console.error('Falha na chamada da OpenAI gpt-4o:', err)
      toast({
        title: 'Erro na Análise Visual',
        description:
          err.message ||
          'Não foi possível analisar a imagem via IA. Verifique as credenciais ou selecione manualmente.',
        variant: 'destructive',
      })
    } finally {
      setIsAnalyzingIA(false)
    }
  }

  // Confirmar Match do card de IA: preenche a Aba 2 (perfil construtivo, dimensões e seletores sugeridos)
  // Regra permanente v2: NUNCA autopreencher o campo 'Nome do Módulo' — deve continuar vazio
  const handleConfirmMatch = () => {
    if (!iaIdentifiedTemplate) return
    const { template, sugestoes } = iaIdentifiedTemplate
    setSelectedTemplateId(template.id)

    // Perfil construtivo do template (não toca em nomeModulo)
    if (template.perfil_construtivo) {
      setPerfilConstrutivo(template.perfil_construtivo as PerfilConstrutivo)
    }

    // Preenche dimensões sugeridas
    if (sugestoes) {
      setDimensoes({
        largura: sugestoes.largura ?? dimensoes.largura,
        altura: sugestoes.altura ?? dimensoes.altura,
        profundidade: sugestoes.profundidade ?? dimensoes.profundidade,
      })
      if (sugestoes.portas !== undefined) setPortasCount(sugestoes.portas)
      if (sugestoes.gavetas !== undefined) setGavetasCount(sugestoes.gavetas)
      if (sugestoes.prateleiras !== undefined) setPrateleirasCount(sugestoes.prateleiras)
      if (sugestoes.cabideiros !== undefined) setCabideirosCount(sugestoes.cabideiros)
    }

    setIsMatchConfirmed(true)
    setIaDetectedNotice(
      `Match confirmado! Aba 2 preenchida com as especificações de "${template.nome_template}".`,
    )
  }

  // Trocar módulo manualmente a partir do card de IA
  // Regra permanente v2: NUNCA autopreencher o campo 'Nome do Módulo' — deve continuar vazio
  const handleTrocarModuloManual = (tplId: string) => {
    const tpl = templates.find((t) => t.id === tplId)
    if (!tpl) return
    setSelectedTemplateId(tpl.id)
    // Não altera nomeModulo (mantém o que o usuário digitou ou vazio)
    if (tpl.perfil_construtivo) {
      setPerfilConstrutivo(tpl.perfil_construtivo as PerfilConstrutivo)
    }

    // Parse de dimensões se disponíveis
    if (tpl.dimensoes) {
      const dims = tpl.dimensoes.toLowerCase().replace(/,/g, '.').split('x')
      if (dims.length === 3) {
        const w = parseFloat(dims[0])
        const h = parseFloat(dims[1])
        const d = parseFloat(dims[2])
        setDimensoes({
          largura: !isNaN(w) && w > 0 ? Math.round(w) : dimensoes.largura,
          altura: !isNaN(h) && h > 0 ? Math.round(h) : dimensoes.altura,
          profundidade: !isNaN(d) && d > 0 ? Math.round(d) : dimensoes.profundidade,
        })
      }
    }

    if (iaIdentifiedTemplate) {
      setIaIdentifiedTemplate({
        ...iaIdentifiedTemplate,
        template: tpl,
        motivo: 'Módulo selecionado manualmente pelo projetista',
        confianca: 100,
        confiancaNivel: 'alta',
        isLibraryMatch: true,
      })
    }
  }

  // Markup efetivo da engenharia financeira cadastrada no banco
  const markupEfetivo = useMemo(() => {
    if (
      configEngenharia?.markup_padrao &&
      typeof configEngenharia.markup_padrao === 'number' &&
      configEngenharia.markup_padrao > 0
    ) {
      return configEngenharia.markup_padrao
    }
    return MARKUP_PADRAO
  }, [configEngenharia])

  // Fator de perda de material configurado (default 20%)
  const fatorPerdaMaterial = useMemo(() => {
    if (
      configEngenharia?.perda_material_percent &&
      typeof configEngenharia.perda_material_percent === 'number'
    ) {
      return configEngenharia.perda_material_percent
    }
    return 20.0
  }, [configEngenharia])

  // Cálculo da lista técnica interna (Aba 3: Engenharia & Peças)
  const pecasBOM = useMemo(() => {
    if (!dimensoes.largura || !dimensoes.altura || !dimensoes.profundidade) return []
    const moduloPayload = {
      id: selectedTemplateId || 'custom-v2',
      nome_template: nomeModulo || 'Módulo Sob Medida',
      perfil_construtivo: perfilConstrutivo,
    }
    const composicao: ModuloComposicao = {
      perfilConstrutivo,
      semTamponamento: perfilConstrutivo === 'Caixa Simples',
      tampoPedra: perfilConstrutivo === 'Balcão (tampo por conta do cliente)',
      portas: { qtd: portasCount, tipo: portasCount > 0 ? 'abrir' : 'nenhum' },
      gavetas: { qtd: gavetasCount },
      prateleiras: { qtd: prateleirasCount },
      cabideiro: cabideirosCount > 0,
      qtdCabideiros: cabideirosCount,
      iluminacaoLed: iluminacaoLed,
    }

    const catalogoEfetivo = catalogoMateriais.length > 0 ? catalogoMateriais : undefined

    return calcularBOM(
      moduloPayload,
      dimensoes,
      mdfExterno,
      mdfInterno,
      mdfFundo,
      padraoProjeto,
      catalogoEfetivo,
      markupEfetivo,
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
    markupEfetivo,
    portasCount,
    gavetasCount,
    prateleirasCount,
    cabideirosCount,
    iluminacaoLed,
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
    const nomeLimpo = nomeModulo.trim() || selectedTemplate?.nome_template || 'Módulo sem nome'
    const unitPrice = totalVendaSugerido > 0 ? Math.round(totalVendaSugerido * 100) / 100 : 0
    const total = Math.round(unitPrice * quantidade * 100) / 100

    // Descrição comercial rica com características selecionadas
    const detalhesAba2: string[] = []
    detalhesAba2.push(`${dimensoes.largura}×${dimensoes.altura}×${dimensoes.profundidade}mm`)
    if (portasCount > 0)
      detalhesAba2.push(`${portasCount} ${portasCount === 1 ? 'porta' : 'portas'}`)
    if (gavetasCount > 0)
      detalhesAba2.push(`${gavetasCount} ${gavetasCount === 1 ? 'gaveta' : 'gavetas'}`)
    if (prateleirasCount > 0)
      detalhesAba2.push(
        `${prateleirasCount} ${prateleirasCount === 1 ? 'prateleira' : 'prateleiras'}`,
      )
    if (cabideirosCount > 0)
      detalhesAba2.push(`${cabideirosCount} ${cabideirosCount === 1 ? 'cabideiro' : 'cabideiros'}`)
    if (iluminacaoLed) detalhesAba2.push('LED')

    // Converte pecasBOM para OrcamentoBOMItem[]
    const itensConvertidos: OrcamentoBOMItem[] = pecasBOM.map((p) => ({
      id: p.id,
      description: p.description,
      material: p.material,
      espessura: p.espessura,
      metragem: p.metragem,
      unidade: p.unidade,
      unitCost: p.unitCost,
      totalCost: p.totalCost,
      markup: p.markup,
      salePrice: p.salePrice,
      item_nao_cadastrado: p.item_nao_cadastrado,
      catalogo_id: p.catalogo_id,
    }))

    onSaveModulo({
      moduloId: selectedTemplateId || undefined,
      nome: nomeLimpo,
      descricaoTipo: `${perfilConstrutivo} • ${detalhesAba2.join(' • ')}`,
      quantidade,
      valorUnitario: unitPrice,
      valorTotal: total,
      dimensoes,
      perfilConstrutivo,
      padraoProjeto,
      mdfExterno,
      mdfInterno,
      mdfFundo,
      portas: portasCount,
      gavetas: gavetasCount,
      prateleiras: prateleirasCount,
      cabideiros: cabideirosCount,
      iluminacaoLed,
      itensBOM: itensConvertidos,
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
              {/* 1. Campo de texto para o Nome do Módulo (editável, ex: Balcão de Pia) */}
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1.5">
                <Label
                  htmlFor="nomeModuloInput"
                  className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                >
                  <Box className="w-3.5 h-3.5 text-slate-500" />
                  <span>Nome do Módulo</span>
                </Label>
                <Input
                  id="nomeModuloInput"
                  value={nomeModulo}
                  onChange={(e) => setNomeModulo(e.target.value)}
                  placeholder="Ex.: Balcão de Pia"
                  className="h-10 text-sm font-semibold rounded-xl bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 focus:border-slate-600"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Nome comercial que aparecerá na proposta do ambiente "{ambienteNome}".
                </p>
              </div>

              {/* Banner instrutivo de 1 móvel por vez */}
              <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="font-semibold">Regra de Análise por Módulo:</strong> Envie o
                  croqui ou fotos de <strong>apenas um móvel por vez</strong> (uma imagem/croqui por
                  análise). A IA identifica o gabarito correspondente na biblioteca e sugere perfil,
                  dimensões e ferragens.
                </div>
              </div>

              {/* 2. Área de Upload de Imagem (Drag & Drop) */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
                <CustomerDropzone
                  uploadedFiles={uploadedFiles}
                  onFilesSelect={(files) => {
                    const singleOrEmpty = files && files.length > 0 ? [files[files.length - 1]] : []
                    setUploadedFiles(singleOrEmpty)
                    setIaDetectedNotice(null)
                    setIaIdentifiedTemplate(null)
                    setIsMatchConfirmed(false)
                  }}
                />

                {/* Ação de Análise IA após upload */}
                {uploadedFiles.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 animate-fade-in">
                    <div className="space-y-0.5 text-center sm:text-left">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 justify-center sm:justify-start">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        Processar Imagem com IA
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Detecta perfil construtivo, medidas e módulo da biblioteca correspondente
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isAnalyzingIA}
                      onClick={handleExecutarAnaliseIA}
                      className="h-9 px-4 gap-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 shrink-0 w-full sm:w-auto shadow-xs"
                    >
                      {isAnalyzingIA ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Consultando OpenAI gpt-4o...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span>Analisar Módulo com IA (gpt-4o)</span>
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* 3. Card de 'Resultado da Análise IA' */}
              {iaIdentifiedTemplate && (
                <div className="p-4 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-sm space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                        Resultado da Análise IA
                      </h4>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700"
                    >
                      {iaIdentifiedTemplate.confianca}% match
                    </Badge>
                  </div>

                  {/* Informações do Módulo Identificado */}
                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Módulo da Biblioteca Identificado
                      </span>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {iaIdentifiedTemplate.template.nome_template}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1">
                      <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/60">
                        <span className="text-[10px] font-semibold text-slate-400 block">
                          Perfil Construtivo
                        </span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] truncate block">
                          {iaIdentifiedTemplate.template.perfil_construtivo || perfilConstrutivo}
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/60">
                        <span className="text-[10px] font-semibold text-slate-400 block">
                          Medidas Sugeridas
                        </span>
                        <span className="font-mono font-semibold text-slate-700 dark:text-slate-300 text-[11px] block">
                          {iaIdentifiedTemplate.sugestoes?.largura ?? dimensoes.largura}×
                          {iaIdentifiedTemplate.sugestoes?.altura ?? dimensoes.altura}×
                          {iaIdentifiedTemplate.sugestoes?.profundidade ?? dimensoes.profundidade}mm
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/60 col-span-2 sm:col-span-1">
                        <span className="text-[10px] font-semibold text-slate-400 block">
                          Detecção Interna
                        </span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] truncate block">
                          {iaIdentifiedTemplate.sugestoes?.portas ?? 2}p •{' '}
                          {iaIdentifiedTemplate.sugestoes?.gavetas ?? 0}g •{' '}
                          {iaIdentifiedTemplate.sugestoes?.prateleiras ?? 1}prat
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                      Motivo: {iaIdentifiedTemplate.motivo}
                    </p>
                  </div>

                  {/* Aviso de destaque quando a confiança for média/baixa com match de biblioteca */}
                  {iaIdentifiedTemplate.isLibraryMatch &&
                    (iaIdentifiedTemplate.confiancaNivel === 'media' ||
                      iaIdentifiedTemplate.confiancaNivel === 'baixa' ||
                      iaIdentifiedTemplate.confianca <= 80) && (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5 animate-fade-in">
                        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-semibold">
                            Atenção: Confiança{' '}
                            {iaIdentifiedTemplate.confiancaNivel === 'baixa' ? 'baixa' : 'média'} no
                            match de biblioteca.
                          </p>
                          <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                            Confira com atenção se a forma geométrica deste módulo realmente
                            corresponde à foto. Caso discorde, utilize o seletor "Trocar módulo
                            manualmente" abaixo antes de confirmar o match.
                          </p>
                        </div>
                      </div>
                    )}

                  {/* Ações: Confirmar Match ou Dropdown Trocar Módulo Manualmente */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
                        Trocar módulo manualmente
                      </Label>
                      <Select value={selectedTemplateId} onValueChange={handleTrocarModuloManual}>
                        <SelectTrigger className="h-9 rounded-xl text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700">
                          <SelectValue placeholder="Escolher outro módulo..." />
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

                    <Button
                      type="button"
                      size="sm"
                      onClick={handleConfirmMatch}
                      className={cn(
                        'h-9 px-4 gap-1.5 text-xs font-bold rounded-xl self-end sm:self-auto shrink-0 transition-all',
                        isMatchConfirmed
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900',
                      )}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isMatchConfirmed ? 'Match Confirmado ✓' : 'Confirmar Match'}</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Notificação de sucesso de detecção da IA */}
              {iaDetectedNotice && !iaIdentifiedTemplate && (
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
                  className="h-9 px-4 text-xs font-bold rounded-xl border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
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
              {/* Card 1: Três campos numéricos lado a lado: Largura, Altura, Profundidade (mm) */}
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">
                      Dimensões do Módulo
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase text-slate-400">
                      Quantidade:
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setQuantidade((prev) => Math.max(1, prev - 1))}
                        className="h-7 w-7 p-0 rounded-lg text-xs font-bold"
                      >
                        -
                      </Button>
                      <span className="w-8 text-center font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                        {quantidade}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setQuantidade((prev) => prev + 1)}
                        className="h-7 w-7 p-0 rounded-lg text-xs font-bold"
                      >
                        +
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 3 campos numéricos lado a lado */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="larguraInputMm"
                      className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate block"
                    >
                      Largura (mm)
                    </Label>
                    <Input
                      id="larguraInputMm"
                      type="number"
                      min={100}
                      step={10}
                      value={dimensoes.largura}
                      onChange={(e) =>
                        setDimensoes((prev) => ({ ...prev, largura: Number(e.target.value) || 0 }))
                      }
                      className="h-10 text-xs sm:text-sm font-mono font-bold rounded-xl bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 focus:border-slate-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="alturaInputMm"
                      className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate block"
                    >
                      Altura (mm)
                    </Label>
                    <Input
                      id="alturaInputMm"
                      type="number"
                      min={100}
                      step={10}
                      value={dimensoes.altura}
                      onChange={(e) =>
                        setDimensoes((prev) => ({ ...prev, altura: Number(e.target.value) || 0 }))
                      }
                      className="h-10 text-xs sm:text-sm font-mono font-bold rounded-xl bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 focus:border-slate-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="profundidadeInputMm"
                      className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate block"
                    >
                      Profundidade (mm)
                    </Label>
                    <Input
                      id="profundidadeInputMm"
                      type="number"
                      min={100}
                      step={10}
                      value={dimensoes.profundidade}
                      onChange={(e) =>
                        setDimensoes((prev) => ({
                          ...prev,
                          profundidade: Number(e.target.value) || 0,
                        }))
                      }
                      className="h-10 text-xs sm:text-sm font-mono font-bold rounded-xl bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 focus:border-slate-600"
                    />
                  </div>
                </div>

                {/* Perfil Construtivo do móvel */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Perfil Construtivo
                    </Label>
                    <span className="text-[10px] text-slate-400">
                      Regra de engenharia e fechamento
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

              {/* Card 2: Seletores Numéricos (Portas, Gavetas, Prateleiras, Cabideiros) + Alternador Iluminação/LED */}
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <Box className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">
                    Componentes Internos e Acessórios
                  </h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Seletor numérico: Portas */}
                  <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 flex flex-col items-center justify-between gap-2 text-center">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Portas
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPortasCount((prev) => Math.max(0, prev - 1))}
                        className="h-8 w-8 p-0 rounded-lg text-xs font-bold bg-white dark:bg-slate-900"
                        title="Diminuir portas"
                      >
                        -
                      </Button>
                      <span className="w-8 text-center font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                        {portasCount}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPortasCount((prev) => prev + 1)}
                        className="h-8 w-8 p-0 rounded-lg text-xs font-bold bg-white dark:bg-slate-900"
                        title="Aumentar portas"
                      >
                        +
                      </Button>
                    </div>
                    <span className="text-[10px] text-slate-400">folhas de abrir</span>
                  </div>

                  {/* Seletor numérico: Gavetas */}
                  <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 flex flex-col items-center justify-between gap-2 text-center">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Gavetas
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setGavetasCount((prev) => Math.max(0, prev - 1))}
                        className="h-8 w-8 p-0 rounded-lg text-xs font-bold bg-white dark:bg-slate-900"
                        title="Diminuir gavetas"
                      >
                        -
                      </Button>
                      <span className="w-8 text-center font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                        {gavetasCount}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setGavetasCount((prev) => prev + 1)}
                        className="h-8 w-8 p-0 rounded-lg text-xs font-bold bg-white dark:bg-slate-900"
                        title="Aumentar gavetas"
                      >
                        +
                      </Button>
                    </div>
                    <span className="text-[10px] text-slate-400">com corrediças</span>
                  </div>

                  {/* Seletor numérico: Prateleiras */}
                  <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 flex flex-col items-center justify-between gap-2 text-center">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Prateleiras
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPrateleirasCount((prev) => Math.max(0, prev - 1))}
                        className="h-8 w-8 p-0 rounded-lg text-xs font-bold bg-white dark:bg-slate-900"
                        title="Diminuir prateleiras"
                      >
                        -
                      </Button>
                      <span className="w-8 text-center font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                        {prateleirasCount}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPrateleirasCount((prev) => prev + 1)}
                        className="h-8 w-8 p-0 rounded-lg text-xs font-bold bg-white dark:bg-slate-900"
                        title="Aumentar prateleiras"
                      >
                        +
                      </Button>
                    </div>
                    <span className="text-[10px] text-slate-400">divisórias horizontais</span>
                  </div>

                  {/* Seletor numérico: Cabideiros */}
                  <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 flex flex-col items-center justify-between gap-2 text-center">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Cabideiros
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCabideirosCount((prev) => Math.max(0, prev - 1))}
                        className="h-8 w-8 p-0 rounded-lg text-xs font-bold bg-white dark:bg-slate-900"
                        title="Diminuir cabideiros"
                      >
                        -
                      </Button>
                      <span className="w-8 text-center font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                        {cabideirosCount}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCabideirosCount((prev) => prev + 1)}
                        className="h-8 w-8 p-0 rounded-lg text-xs font-bold bg-white dark:bg-slate-900"
                        title="Aumentar cabideiros"
                      >
                        +
                      </Button>
                    </div>
                    <span className="text-[10px] text-slate-400">tubos oblongos</span>
                  </div>
                </div>

                {/* Alternador (switch/toggle) para Iluminação/LED */}
                <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="iluminacaoLedToggle"
                      className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Iluminação / Fita LED Integrada</span>
                    </Label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Inclui perfil de alumínio embutido, fita LED e fonte slim no cálculo técnico
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {iluminacaoLed ? 'Ativado' : 'Desativado'}
                    </span>
                    <Switch
                      id="iluminacaoLedToggle"
                      checked={iluminacaoLed}
                      onCheckedChange={setIluminacaoLed}
                    />
                  </div>
                </div>
              </div>

              {/* Card 3: Padrão de MDF (espessura derivada automaticamente do material cadastrado no catálogo) */}
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">
                      Padrão de MDF
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      Acabamento:
                    </span>
                    <ToggleGroup
                      type="single"
                      value={padraoProjeto}
                      onValueChange={(v) => v && setPadraoProjeto(v as PadraoProjeto)}
                      className="h-7 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 bg-slate-50 dark:bg-slate-800"
                    >
                      <ToggleGroupItem
                        value="comercial"
                        className="h-6 px-2 text-[10px] font-semibold rounded data-[state=on]:bg-white dark:data-[state=on]:bg-slate-900 shadow-xs"
                      >
                        Comercial
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="premium"
                        className="h-6 px-2 text-[10px] font-semibold rounded data-[state=on]:bg-white dark:data-[state=on]:bg-slate-900 shadow-xs"
                      >
                        Premium
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Dropdown MDF Externo */}
                  <div className="p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/60 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        MDF Externo (Frentes / Envelopamento)
                      </Label>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 shrink-0"
                      >
                        {mdfExterno.espessura}mm
                      </Badge>
                    </div>

                    <Select
                      value={mdfExterno.cor}
                      onValueChange={(v) => {
                        const mat = opcoesMdf.find((m) => m.nome_material === v)
                        const novaEspessura = extrairEspessuraMdf(
                          `${v} ${mat?.categoria || ''}`,
                          mdfExterno.espessura,
                        )
                        setMdfExterno({ cor: v, espessura: novaEspessura })
                      }}
                    >
                      <SelectTrigger className="h-10 rounded-xl text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700">
                        <SelectValue placeholder="Selecione o padrão de MDF Externo..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl max-h-60">
                        {opcoesMdf.length === 0 ? (
                          <SelectItem value="Branco TX">Branco TX</SelectItem>
                        ) : (
                          opcoesMdf.map((m) => (
                            <SelectItem key={m.id} value={m.nome_material} className="text-xs">
                              {m.nome_material} ({m.categoria})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Dropdown MDF Interno */}
                  <div className="p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/60 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        MDF Interno (Caixaria / Prateleiras)
                      </Label>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 shrink-0"
                      >
                        {mdfInterno.espessura}mm
                      </Badge>
                    </div>

                    <Select
                      value={mdfInterno.cor}
                      onValueChange={(v) => {
                        const mat = opcoesMdf.find((m) => m.nome_material === v)
                        const novaEspessura = extrairEspessuraMdf(
                          `${v} ${mat?.categoria || ''}`,
                          mdfInterno.espessura,
                        )
                        setMdfInterno({ cor: v, espessura: novaEspessura })
                      }}
                    >
                      <SelectTrigger className="h-10 rounded-xl text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700">
                        <SelectValue placeholder="Selecione o padrão de MDF Interno..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl max-h-60">
                        {opcoesMdf.length === 0 ? (
                          <SelectItem value="Branco TX">Branco TX</SelectItem>
                        ) : (
                          opcoesMdf.map((m) => (
                            <SelectItem key={m.id} value={m.nome_material} className="text-xs">
                              {m.nome_material} ({m.categoria})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* MDF Fundo (Traseira) */}
                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    MDF de Fundo (Traseira)
                  </Label>
                  <Input
                    value={mdfFundo}
                    onChange={(e) => setMdfFundo(e.target.value)}
                    className="h-10 text-xs rounded-xl bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                    placeholder="MDF 6mm Branco TX"
                  />
                </div>
              </div>

              {/* Botão de avanço para a Aba 3 */}
              <div className="pt-2 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('engenharia-pecas')}
                  className="h-9 px-4 text-xs font-bold rounded-xl border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Conferir Engenharia & Peças →
                </Button>
              </div>
            </TabsContent>

            {/* ======================================================== */}
            {/* ABA 3: Engenharia & Peças (Consulta Técnica Interna)       */}
            {/* ======================================================== */}
            <TabsContent
              value="engenharia-pecas"
              className="mt-0 space-y-4 focus-visible:outline-none"
            >
              {/* Banner informativo de uso exclusivamente técnico/interno */}
              <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Settings2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong>Engenharia Financeira & Decomposição:</strong> Cálculo em tempo real via
                    motor <code>calcularBOM</code> com perda de material de {fatorPerdaMaterial}% e
                    markup efetivo de {markupEfetivo.toFixed(2)}x (configurações do banco).
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-amber-400 text-amber-900 dark:text-amber-200 font-bold text-[10px] shrink-0"
                >
                  {pecasBOM.length} {pecasBOM.length === 1 ? 'item' : 'itens'}
                </Badge>
              </div>

              {/* Tabela Detalhada de Engenharia (Decomposição do Móvel) */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
                <div className="max-h-80 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-950 z-10">
                      <TableRow className="border-b border-slate-200 dark:border-slate-800 hover:bg-transparent">
                        <TableHead className="py-2.5 px-3 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          Descrição da Peça
                        </TableHead>
                        <TableHead className="py-2.5 px-3 text-[11px] font-bold text-slate-700 dark:text-slate-300 text-center whitespace-nowrap">
                          Metragem/Qtd
                        </TableHead>
                        <TableHead className="py-2.5 px-3 text-[11px] font-bold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">
                          Custo Unitário
                        </TableHead>
                        <TableHead className="py-2.5 px-3 text-[11px] font-bold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">
                          Custo Total
                        </TableHead>
                        <TableHead className="py-2.5 px-3 text-[11px] font-bold text-slate-700 dark:text-slate-300 text-center whitespace-nowrap">
                          Markup
                        </TableHead>
                        <TableHead className="py-2.5 px-3 text-[11px] font-bold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">
                          Valor de Venda
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pecasBOM.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="py-8 text-center text-xs text-slate-400"
                          >
                            Nenhuma peça gerada. Verifique as dimensões na Aba 2.
                          </TableCell>
                        </TableRow>
                      ) : (
                        pecasBOM.map((peca) => {
                          const metragemFormatada =
                            typeof peca.metragem === 'number'
                              ? peca.unidade === 'm²' || peca.unidade === 'm'
                                ? `${peca.metragem.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })} ${peca.unidade}`
                                : `${peca.metragem} ${peca.unidade || 'un'}`
                              : '-'

                          return (
                            <TableRow
                              key={peca.id}
                              className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                            >
                              <TableCell className="py-2.5 px-3 text-xs font-medium text-slate-800 dark:text-slate-200">
                                <div className="space-y-0.5">
                                  <span>{peca.description}</span>
                                  {peca.material && (
                                    <span className="block text-[10px] text-slate-400 font-normal">
                                      {peca.material}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="py-2.5 px-3 text-xs text-center font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                {metragemFormatada}
                              </TableCell>
                              <TableCell className="py-2.5 px-3 text-xs text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                {formatCurrency(peca.unitCost || 0)}
                              </TableCell>
                              <TableCell className="py-2.5 px-3 text-xs text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                {formatCurrency(peca.totalCost || 0)}
                              </TableCell>
                              <TableCell className="py-2.5 px-3 text-xs text-center font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                {typeof peca.markup === 'number'
                                  ? `${peca.markup.toFixed(2)}x`
                                  : '-'}
                              </TableCell>
                              <TableCell className="py-2.5 px-3 text-xs text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                {formatCurrency(peca.salePrice || 0)}
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Blocos de Resumo do Módulo no final da aba */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                      Custo Consolidado
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    >
                      Soma dos custos
                    </Badge>
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900 dark:text-slate-100">
                    {formatCurrency(totalCustoTecnico)}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Custo direto de produção somando todas as peças e ferragens do módulo.
                  </p>
                </div>

                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase font-bold text-emerald-700 dark:text-emerald-300 tracking-wider">
                      Valor Consolidado
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50"
                    >
                      Soma dos valores de venda
                    </Badge>
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(totalVendaSugerido)}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Valor sugerido de venda com markup aplicado que alimenta a linha comercial.
                  </p>
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
