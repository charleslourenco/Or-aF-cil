import React, { useState, useEffect, useMemo, useRef } from 'react'
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
  Plus,
  PlusCircle,
  Trash2,
  RotateCcw,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  RackPainel,
  RipadoPainel,
  PERDA_PERCENT_PADRAO,
} from '@/lib/pricing'
import { montarDescricaoNaturalModulo } from '@/lib/pdf'
import { CustomerDropzone, UploadedFileState } from '@/components/CustomerDropzone'
import { Switch } from '@/components/ui/switch'
import { supabase } from '@/lib/supabase/client'
import { fetchConfigEngenharia, ConfigEngenharia } from '@/services/engenharia'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { OrcamentoBOMItem } from '@/services/orcamentos'
import type { BudgetItem } from '@/data/mockData'
import { AddFromCatalogModal } from '@/components/AddFromCatalogModal'
import { AddCustomItemModal } from '@/components/AddCustomItemModal'
import { ensureUniqueBudgetItemId } from '@/lib/budgetItemUtils'

export interface ItemBOMOverride {
  description?: string
  metragem?: number
  unitCost?: number
  markup?: number
}

export interface AjustesBOMModulo {
  markupModulo?: number
  overrides?: Record<string, ItemBOMOverride>
  removedIds?: string[]
  valorUnitarioFixo?: number | null
}

export interface ModuloSalvoData {
  id?: string
  moduloId?: string
  nome: string
  descricaoTipo: string
  descricaoManual?: string
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
  composicao?: ComposicaoModuloSalva | null
  itensBOM: OrcamentoBOMItem[]
  ajustesBOM?: AjustesBOMModulo
}

/** Composição do módulo como é salva no orçamento (e recarregada para edição). */
export interface ComposicaoModuloSalva {
  portas?: { qtd?: number | null; tipo?: string | null } | null
  gavetas?: { qtd?: number | null } | null
  prateleiras?: { qtd?: number | null } | null
  cabideiro?: boolean | number | null
  qtdCabideiros?: number | null
  sapateira?: boolean | null
  iluminacaoLed?: boolean | null
  rackPainel?: RackPainel | null
  ripado?: RipadoPainel | null
}

const DIMENSOES_PADRAO: Dimensoes = { largura: 800, altura: 700, profundidade: 550 }
const RACK_PADRAO: RackPainel = { ativo: false, altura: 350, profundidade: 400, divisorias: 0 }
const RIPADO_PADRAO: RipadoPainel = { qtd: 0, largura: 40 }

interface ModuleEditDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ambienteNome: string
  initialData?: ModuloSalvoData | null
  configEngenharia?: ConfigEngenharia | null
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
  configEngenharia: configEngenhariaProp,
  onSaveModulo,
}) => {
  const [activeTab, setActiveTab] = useState<'foto-ia' | 'medidas-materiais' | 'engenharia-pecas'>(
    'foto-ia',
  )

  // Catálogos, templates e engenharia carregados do Supabase
  const [templates, setTemplates] = useState<TemplateEngenharia[]>([])
  const [catalogoMateriais, setCatalogoMateriais] = useState<CatalogoMaterial[]>([])
  const [configEngenhariaLocal, setConfigEngenhariaLocal] = useState<ConfigEngenharia | null>(null)
  const [loadingData, setLoadingData] = useState(false)

  // Usa config de engenharia passada via props (centralizada no OrcamentoV2) ou fallback local
  const configEngenharia = configEngenhariaProp ?? configEngenhariaLocal

  // Estado do módulo configurado
  const [nomeModulo, setNomeModulo] = useState('')
  const [descricaoManual, setDescricaoManual] = useState('')
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

  // Perfil "Aberto / Painel": rack inferior acoplado e ripado vertical
  const [rackPainel, setRackPainel] = useState<RackPainel>(RACK_PADRAO)
  const [ripado, setRipado] = useState<RipadoPainel>(RIPADO_PADRAO)
  // true quando o markup veio do módulo salvo ou foi digitado; enquanto false, o campo
  // acompanha o markup da engenharia (que pode carregar depois de o modal abrir)
  const markupDefinidoRef = useRef(false)
  // Valor unitário fixado: ao reabrir um módulo o catálogo pode ter mudado de preço;
  // o usuário pode manter o valor que já foi salvo/enviado ao cliente.
  const [valorUnitarioFixo, setValorUnitarioFixo] = useState<number | null>(null)

  // Seletores numéricos e alternadores da Aba 2
  const [portasCount, setPortasCount] = useState<number>(2)
  const [gavetasCount, setGavetasCount] = useState<number>(0)
  const [prateleirasCount, setPrateleirasCount] = useState<number>(1)
  const [cabideirosCount, setCabideirosCount] = useState<number>(0)
  const [iluminacaoLed, setIluminacaoLed] = useState<boolean>(false)

  // Markup do módulo (permite sobrescrever o padrão da engenharia)
  const [markupModuloInput, setMarkupModuloInput] = useState<string>('')
  // Camada de ajustes sobre a BOM (overrides por id e ids removidos)
  const [bomOverrides, setBomOverrides] = useState<Record<string, ItemBOMOverride>>({})
  const [removedBomIds, setRemovedBomIds] = useState<string[]>([])

  // Itens manuais/avulsos ou do catálogo adicionados ao módulo (Ajuste 1)
  const [manualItems, setManualItems] = useState<BudgetItem[]>([])
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false)
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false)

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

  // Carrega catálogo e templates quando o drawer abre pela primeira vez.
  // Engenharia vem centralizada via props (OrcamentoV2); só busca se não vier via props.
  useEffect(() => {
    if (open && templates.length === 0) {
      setLoadingData(true)
      const promises: [
        ReturnType<typeof fetchTemplatesEngenharia>,
        ReturnType<typeof fetchCatalogoMateriais>,
        Promise<any>,
      ] = [
        fetchTemplatesEngenharia(),
        fetchCatalogoMateriais(6000),
        configEngenhariaProp
          ? Promise.resolve({ config: configEngenhariaProp })
          : fetchConfigEngenharia(),
      ]

      Promise.all(promises)
        .then(([tplRes, matRes, engRes]) => {
          if (tplRes.data && tplRes.data.length > 0) {
            setTemplates(tplRes.data)
            // Correção 1.a: No modo de módulo novo, selectedTemplateId deve iniciar null/''
            // NADA de selecionar o primeiro template automaticamente (evita injetar o móvel curvo).
          }
          if (matRes) {
            setCatalogoMateriais(matRes)
          }
          if (!configEngenhariaProp && engRes?.config) {
            setConfigEngenhariaLocal(engRes.config)
          }
        })
        .catch((err) => {
          console.error('Erro ao carregar dados do módulo:', err)
        })
        .finally(() => setLoadingData(false))
    }
  }, [open, templates.length, configEngenhariaProp])

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
      setValorUnitarioFixo(null)

      if (initialData) {
        // Modo Edição: preserva o nome salvo e demais atributos
        setNomeModulo(initialData.nome || '')
        setDescricaoManual(initialData.descricaoManual || '')
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
        setMdfFundo(initialData.mdfFundo || 'MDF 6mm Branco TX')
        setRackPainel({ ...RACK_PADRAO, ...(initialData.composicao?.rackPainel || {}) })
        setRipado({ ...RIPADO_PADRAO, ...(initialData.composicao?.ripado || {}) })
        const initialPortas =
          initialData.portas ??
          (initialData.composicao?.portas?.qtd !== undefined
            ? initialData.composicao.portas.qtd
            : 2) ??
          2
        const initialGavetas =
          initialData.gavetas ??
          (initialData.composicao?.gavetas?.qtd !== undefined
            ? initialData.composicao.gavetas.qtd
            : 0) ??
          0
        const initialPrat =
          initialData.prateleiras ??
          (initialData.composicao?.prateleiras?.qtd !== undefined
            ? initialData.composicao.prateleiras.qtd
            : 1) ??
          1
        const initialCabideiros =
          initialData.cabideiros ??
          initialData.composicao?.qtdCabideiros ??
          (typeof initialData.composicao?.cabideiro === 'number'
            ? initialData.composicao.cabideiro
            : initialData.composicao?.cabideiro
              ? 1
              : 0)
        const initialLed = Boolean(
          initialData.iluminacaoLed ?? initialData.composicao?.iluminacaoLed,
        )

        setPortasCount(initialPortas)
        setGavetasCount(initialGavetas)
        setPrateleirasCount(initialPrat)
        setCabideirosCount(initialCabideiros)
        setIluminacaoLed(initialLed)

        // Restaura markup do módulo e camada de ajustes da BOM
        const savedMarkupModulo = initialData.ajustesBOM?.markupModulo
        if (typeof savedMarkupModulo === 'number' && savedMarkupModulo > 0) {
          markupDefinidoRef.current = true
          setMarkupModuloInput(savedMarkupModulo.toFixed(2))
        } else {
          markupDefinidoRef.current = false
          // Fallback para o markup padrão da engenharia
          const padrao =
            configEngenharia?.markup_padrao && typeof configEngenharia.markup_padrao === 'number'
              ? configEngenharia.markup_padrao
              : MARKUP_PADRAO
          setMarkupModuloInput(padrao.toFixed(2))
        }

        if (initialData.ajustesBOM?.overrides) {
          setBomOverrides(initialData.ajustesBOM.overrides)
        } else {
          setBomOverrides({})
        }

        if (Array.isArray(initialData.ajustesBOM?.removedIds)) {
          setRemovedBomIds(initialData.ajustesBOM.removedIds)
        } else {
          setRemovedBomIds([])
        }

        const fixo = initialData.ajustesBOM?.valorUnitarioFixo
        setValorUnitarioFixo(typeof fixo === 'number' && fixo > 0 ? fixo : null)

        // Carrega em manualItems os itens de initialData.itensBOM que sejam manuais/avulsos
        // (ID com prefixo manual-/catalog-/avulso- ou não gerados pela BOM paramétrica que usa prefixo bom-)
        if (initialData.itensBOM && Array.isArray(initialData.itensBOM)) {
          const loadedManuals: BudgetItem[] = initialData.itensBOM
            .filter((it) => {
              if (!it.id) return false
              const idLower = it.id.toLowerCase()
              return (
                idLower.startsWith('manual-') ||
                idLower.startsWith('catalog-') ||
                idLower.startsWith('catalogo-') ||
                idLower.startsWith('avulso-') ||
                !idLower.startsWith('bom-')
              )
            })
            .map((it) => ({
              id: ensureUniqueBudgetItemId(it.id, 'manual'),
              description: it.description,
              material: it.material,
              espessura: it.espessura,
              metragem: it.metragem,
              unidade: it.unidade,
              unitCost: it.unitCost,
              totalCost: it.totalCost,
              markup: it.markup,
              salePrice: it.salePrice,
              item_nao_cadastrado: it.item_nao_cadastrado,
              catalogo_id: it.catalogo_id,
            }))
          setManualItems(loadedManuals)
        } else {
          setManualItems([])
        }
      } else {
        // Modo Novo Módulo: SEMPRE vazio (decisão permanente do usuário)
        setNomeModulo('')
        setDescricaoManual('')
        setSelectedTemplateId('')
        setDimensoes(DIMENSOES_PADRAO)
        setPerfilConstrutivo('Fechado Envelopado')
        setPadraoProjeto('comercial')
        setMdfExterno({ cor: 'Branco TX', espessura: 18 })
        setMdfInterno({ cor: 'Branco TX', espessura: 15 })
        setMdfFundo('MDF 6mm Branco TX')
        setRackPainel(RACK_PADRAO)
        setRipado(RIPADO_PADRAO)
        setQuantidade(1)
        setPortasCount(2)
        setGavetasCount(0)
        setPrateleirasCount(1)
        setCabideirosCount(0)
        setIluminacaoLed(false)
        setManualItems([])
        setBomOverrides({})
        setRemovedBomIds([])

        markupDefinidoRef.current = false
        // Inicia markup com o padrão da engenharia do banco (fallback MARKUP_PADRAO)
        const padrao =
          configEngenharia?.markup_padrao && typeof configEngenharia.markup_padrao === 'number'
            ? configEngenharia.markup_padrao
            : MARKUP_PADRAO
        setMarkupModuloInput(padrao.toFixed(2))
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

  // Ajusta o MDF escolhido para um item real do catálogo quando o nome salvo não existe nele
  // (padrão "Branco TX" ou formato antigo "Branco TX (18mm)"), mantendo a espessura.
  useEffect(() => {
    if (!open || opcoesMdf.length === 0) return
    const espessuraDe = (m: CatalogoMaterial): number | null => {
      const txt = `${m.nome_material} ${m.categoria || ''}`
      if (/18\s*mm|mdf\s*18/i.test(txt)) return 18
      if (/15\s*mm|mdf\s*15/i.test(txt)) return 15
      return null
    }
    const ajustar = (spec: MdfSpec): MdfSpec | null => {
      if (opcoesMdf.some((m) => m.nome_material === spec.cor)) return null
      const cor = (spec.cor || '')
        .replace(/\(.*?\)/g, '')
        .replace(/mdf|\d+\s*mm/gi, '')
        .trim()
        .toLowerCase()
      const mesmaEspessura = opcoesMdf.filter((m) => espessuraDe(m) === spec.espessura)
      const escolhido =
        (cor && mesmaEspessura.find((m) => m.nome_material.toLowerCase().includes(cor))) ||
        mesmaEspessura[0]
      return escolhido ? { cor: escolhido.nome_material, espessura: spec.espessura } : null
    }
    const novoExt = ajustar(mdfExterno)
    if (novoExt) setMdfExterno(novoExt)
    const novoInt = ajustar(mdfInterno)
    if (novoInt) setMdfInterno(novoInt)
  }, [open, opcoesMdf, mdfExterno, mdfInterno])

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
        description: 'Faça upload de uma ou mais fotos do móvel antes de analisar.',
        variant: 'destructive',
      })
      return
    }

    setIsAnalyzingIA(true)
    setIsMatchConfirmed(false)
    setIaDetectedNotice(null)

    try {
      // Converte todas as imagens para Base64 (máx ~5)
      const imagensBase64 = await Promise.all(
        uploadedFiles.slice(0, 5).map((fileState) => fileStateToBase64(fileState)),
      )

      // Invoca a edge function analisar-imagem (que usa gpt-4o e a biblioteca real)
      const { data, error } = await supabase.functions.invoke('analisar-imagem', {
        body: {
          imagensBase64,
          imagemBase64: imagensBase64[0],
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
        // Correção 1.b: quando a edge function retornar codigo_modulo "MODULO-CUSTOM" ou e_customizado verdadeiro,
        // o selectedTemplateId deve ficar NULO/customizado (nunca reter o id de um template anterior)
        // e o perfil construtivo deve vir do retorno da IA (ex.: "Aberto / Painel" para painéis e cabeceiras).
        const isCustom =
          primeiro.codigo_modulo === 'MODULO-CUSTOM' ||
          primeiro.e_customizado === true ||
          !primeiro.codigo_modulo

        const foundInTemplates = !isCustom
          ? templates.find(
              (t) =>
                t.id === primeiro.codigo_modulo ||
                t.nome_template.toLowerCase() === (primeiro.nome || '').toLowerCase(),
            )
          : null

        // Perfil sugerido pela IA ou derivado do template encontrado
        const perfilRetornoIA: PerfilConstrutivo =
          (primeiro.perfil_construcao_sugerido as PerfilConstrutivo) ||
          (foundInTemplates?.perfil_construtivo as PerfilConstrutivo) ||
          'Fechado Envelopado'

        const matched: TemplateEngenharia = foundInTemplates || {
          id: 'mod-custom',
          nome_template: primeiro.nome || 'Módulo Sob Medida',
          perfil_construtivo: perfilRetornoIA,
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
    const { template, sugestoes, isLibraryMatch } = iaIdentifiedTemplate
    // Se for match de biblioteca usa o ID do template; se for customizado/virtual, mantém vazio
    setSelectedTemplateId(isLibraryMatch ? template.id : '')

    // Perfil construtivo do template ou retornado pela IA (não toca em nomeModulo)
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

  // Descrição automática gerada (natural como primária; fallback no perfil/composição)
  const descricaoAutomaticaGerada = useMemo(() => {
    const nomeLimpoParaDesc =
      nomeModulo.trim() ||
      (selectedTemplateId && selectedTemplate ? selectedTemplate.nome_template : '') ||
      'Módulo'

    const natural = montarDescricaoNaturalModulo({
      nome: nomeLimpoParaDesc,
      dimensoes,
      quantidade,
      mdfExterno,
      mdfInterno,
      composicao: {
        portas: { qtd: portasCount, tipo: portasCount > 0 ? 'abrir' : 'nenhum' },
        gavetas: { qtd: gavetasCount },
        prateleiras: { qtd: prateleirasCount },
        cabideiro: cabideirosCount > 0,
        iluminacaoLed,
      },
    })

    if (natural) return natural

    const detalhes: string[] = []
    detalhes.push(`${dimensoes.largura}×${dimensoes.altura}×${dimensoes.profundidade}mm`)
    if (portasCount > 0) detalhes.push(`${portasCount} ${portasCount === 1 ? 'porta' : 'portas'}`)
    if (gavetasCount > 0)
      detalhes.push(`${gavetasCount} ${gavetasCount === 1 ? 'gaveta' : 'gavetas'}`)
    if (prateleirasCount > 0)
      detalhes.push(`${prateleirasCount} ${prateleirasCount === 1 ? 'prateleira' : 'prateleiras'}`)
    if (cabideirosCount > 0)
      detalhes.push(`${cabideirosCount} ${cabideirosCount === 1 ? 'cabideiro' : 'cabideiros'}`)
    if (iluminacaoLed) detalhes.push('LED')

    return `${perfilConstrutivo} • ${detalhes.join(' • ')}`
  }, [
    nomeModulo,
    selectedTemplateId,
    selectedTemplate,
    dimensoes,
    quantidade,
    mdfExterno,
    mdfInterno,
    portasCount,
    gavetasCount,
    prateleirasCount,
    cabideirosCount,
    iluminacaoLed,
    perfilConstrutivo,
  ])

  // Markup padrão da engenharia financeira cadastrada no banco
  const markupEngenhariaPadrao = useMemo(() => {
    if (
      configEngenharia?.markup_padrao &&
      typeof configEngenharia.markup_padrao === 'number' &&
      configEngenharia.markup_padrao > 0
    ) {
      return configEngenharia.markup_padrao
    }
    return MARKUP_PADRAO
  }, [configEngenharia])

  useEffect(() => {
    if (open && !markupDefinidoRef.current) {
      setMarkupModuloInput(markupEngenhariaPadrao.toFixed(2))
    }
  }, [open, markupEngenhariaPadrao])

  // Markup efetivo do módulo (sobrescrevível pelo marceneiro)
  const markupModuloEfetivo = useMemo(() => {
    const parsed = parseFloat(markupModuloInput.replace(',', '.'))
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed
    }
    return markupEngenhariaPadrao
  }, [markupModuloInput, markupEngenhariaPadrao])

  // Alias para manter compatibilidade com modais de inclusão manual
  const markupEfetivo = markupModuloEfetivo

  // Fator de perda de material configurado (default 20%)
  const fatorPerdaMaterial = useMemo(() => {
    if (
      typeof configEngenharia?.perda_material_percent === 'number' &&
      configEngenharia.perda_material_percent >= 0
    ) {
      return configEngenharia.perda_material_percent
    }
    return PERDA_PERCENT_PADRAO
  }, [configEngenharia])

  // Cálculo da lista técnica interna (Aba 3: Engenharia & Peças) - Base geométrica do motor
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
      rackPainel: perfilConstrutivo === 'Aberto / Painel' ? rackPainel : null,
      ripado: perfilConstrutivo === 'Aberto / Painel' ? ripado : null,
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
      markupModuloEfetivo,
      1.0,
      composicao,
      fatorPerdaMaterial,
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
    markupModuloEfetivo,
    portasCount,
    gavetasCount,
    prateleirasCount,
    cabideirosCount,
    iluminacaoLed,
    rackPainel,
    ripado,
    fatorPerdaMaterial,
  ])

  // Lista consolidada de peças técnicas e itens manuais com aplicação da camada de ajustes (Aba 3)
  const listaConsolidadaBOM = useMemo(() => {
    const rawList = [...pecasBOM, ...manualItems]
    const removedSet = new Set(removedBomIds)

    return rawList
      .filter((item) => !removedSet.has(item.id))
      .map((item) => {
        const override = bomOverrides[item.id]
        const description =
          override?.description !== undefined ? override.description : item.description
        const metragem = override?.metragem !== undefined ? override.metragem : (item.metragem ?? 1)
        const unitCost = override?.unitCost !== undefined ? override.unitCost : (item.unitCost ?? 0)
        const markup =
          override?.markup !== undefined
            ? override.markup
            : typeof item.markup === 'number' && item.markup > 0
              ? item.markup
              : markupModuloEfetivo
        const totalCost = Math.round(metragem * unitCost * 100) / 100
        const salePrice = Math.round(totalCost * markup * 100) / 100

        return {
          ...item,
          description,
          metragem,
          unitCost,
          totalCost,
          markup,
          salePrice,
        }
      })
  }, [pecasBOM, manualItems, removedBomIds, bomOverrides, markupModuloEfetivo])

  // Custo técnico consolidado e valor de venda consolidado somando a lista inteira
  const totalCustoTecnico = useMemo(() => {
    return listaConsolidadaBOM.reduce((acc, p) => acc + (p.totalCost || 0), 0)
  }, [listaConsolidadaBOM])

  const totalVendaSugerido = useMemo(() => {
    return listaConsolidadaBOM.reduce((acc, p) => acc + (p.salePrice || 0), 0)
  }, [listaConsolidadaBOM])

  // Valor unitário que vai para a linha comercial: o fixado pelo usuário ou o recalculado
  const valorUnitarioEfetivo =
    valorUnitarioFixo !== null && valorUnitarioFixo > 0
      ? valorUnitarioFixo
      : Math.round(totalVendaSugerido * 100) / 100

  // Ao reabrir um módulo salvo, avisa se o recálculo (catálogo/markup atuais) mudou o valor
  const valorSalvoAnterior = initialData?.valorUnitario || 0
  const recalculoDivergente =
    Boolean(initialData) &&
    valorSalvoAnterior > 0 &&
    valorUnitarioFixo === null &&
    Math.abs(Math.round(totalVendaSugerido * 100) / 100 - valorSalvoAnterior) >= 0.01
  const handleAddManualItem = (item: BudgetItem) => {
    const uniqueItem: BudgetItem = {
      ...item,
      id: ensureUniqueBudgetItemId(item.id, 'manual'),
    }
    setManualItems((prev) => [...prev, uniqueItem])
    toast({
      title: 'Item adicionado',
      description: `"${uniqueItem.description}" foi incluído ao módulo.`,
    })
  }

  // Remoção de qualquer linha da lista consolidada (gerada pelo motor ou manual)
  const handleRemoveItemBOM = (item: BudgetItem) => {
    const isManual = manualItems.some((m) => m.id === item.id)
    if (isManual) {
      setManualItems((prev) => prev.filter((it) => it.id !== item.id))
    } else {
      setRemovedBomIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]))
    }
    // Remove também override se existir
    setBomOverrides((prev) => {
      if (!prev[item.id]) return prev
      const next = { ...prev }
      delete next[item.id]
      return next
    })
    toast({
      title: 'Item removido',
      description: `"${item.description}" foi removido do cálculo do módulo.`,
    })
  }

  // Restaura todas as peças geradas pelo motor que foram removidas ou editadas
  const handleResetAjustesBOM = () => {
    setRemovedBomIds([])
    setBomOverrides({})
    markupDefinidoRef.current = false
    const padrao =
      configEngenharia?.markup_padrao && typeof configEngenharia.markup_padrao === 'number'
        ? configEngenharia.markup_padrao
        : MARKUP_PADRAO
    setMarkupModuloInput(padrao.toFixed(2))
    toast({
      title: 'Engenharia redefinida',
      description: 'Peças do motor e markup foram restaurados para a configuração padrão.',
    })
  }

  // Edição inline de descrição de uma linha
  const handleUpdateItemDescription = (itemId: string, newDesc: string) => {
    if (manualItems.some((m) => m.id === itemId)) {
      setManualItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, description: newDesc } : it)),
      )
    } else {
      setBomOverrides((prev) => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          description: newDesc,
        },
      }))
    }
  }

  // Edição inline de metragem / quantidade de uma linha
  const handleUpdateItemMetragem = (itemId: string, newMetragemVal: number) => {
    const metragem = Math.max(0, Number.isNaN(newMetragemVal) ? 0 : newMetragemVal)
    if (manualItems.some((m) => m.id === itemId)) {
      setManualItems((prev) =>
        prev.map((it) => {
          if (it.id !== itemId) return it
          const unitCost = it.unitCost || 0
          const markup =
            typeof it.markup === 'number' && it.markup > 0 ? it.markup : markupModuloEfetivo
          const totalCost = Math.round(metragem * unitCost * 100) / 100
          const salePrice = Math.round(totalCost * markup * 100) / 100
          return {
            ...it,
            metragem,
            totalCost,
            salePrice,
          }
        }),
      )
    } else {
      setBomOverrides((prev) => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          metragem,
        },
      }))
    }
  }

  // Edição inline de custo unitário de uma linha
  const handleUpdateItemUnitCost = (itemId: string, newUnitCostVal: number) => {
    const unitCost = Math.max(0, Number.isNaN(newUnitCostVal) ? 0 : newUnitCostVal)
    if (manualItems.some((m) => m.id === itemId)) {
      setManualItems((prev) =>
        prev.map((it) => {
          if (it.id !== itemId) return it
          const metragem = it.metragem || 1
          const markup =
            typeof it.markup === 'number' && it.markup > 0 ? it.markup : markupModuloEfetivo
          const totalCost = Math.round(metragem * unitCost * 100) / 100
          const salePrice = Math.round(totalCost * markup * 100) / 100
          return {
            ...it,
            unitCost,
            totalCost,
            salePrice,
          }
        }),
      )
    } else {
      setBomOverrides((prev) => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          unitCost,
        },
      }))
    }
  }

  // Edição inline de markup de uma linha
  const handleUpdateItemMarkup = (itemId: string, newMarkupVal: number) => {
    const markup = Math.max(0.01, Number.isNaN(newMarkupVal) ? markupModuloEfetivo : newMarkupVal)
    if (manualItems.some((m) => m.id === itemId)) {
      setManualItems((prev) =>
        prev.map((it) => {
          if (it.id !== itemId) return it
          const totalCost = it.totalCost || 0
          const salePrice = Math.round(totalCost * markup * 100) / 100
          return {
            ...it,
            markup,
            salePrice,
          }
        }),
      )
    } else {
      setBomOverrides((prev) => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          markup,
        },
      }))
    }
  }

  // Salvar no Ambiente
  const handleSalvar = () => {
    // Correção 1.c: sem nome digitado e sem template legítimo confirmado, o nome padrão é
    // "Módulo Sob Medida (Personalizado)", nunca o nome de um template arbitrário da biblioteca.
    const nomeLimpo =
      nomeModulo.trim() ||
      (selectedTemplateId && selectedTemplate ? selectedTemplate.nome_template : '') ||
      'Módulo Sob Medida (Personalizado)'
    const unitPrice = valorUnitarioEfetivo > 0 ? valorUnitarioEfetivo : 0
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
    if (manualItems.length > 0)
      detalhesAba2.push(
        `${manualItems.length} ${manualItems.length === 1 ? 'acessório' : 'acessórios'}`,
      )

    const isPainel = perfilConstrutivo === 'Aberto / Painel'
    const composicaoSalva: ComposicaoModuloSalva = {
      portas: { qtd: portasCount, tipo: portasCount > 0 ? 'abrir' : 'nenhum' },
      gavetas: { qtd: gavetasCount },
      prateleiras: { qtd: prateleirasCount },
      cabideiro: cabideirosCount > 0,
      qtdCabideiros: cabideirosCount,
      iluminacaoLed,
      rackPainel: isPainel && rackPainel.ativo ? rackPainel : null,
      ripado: isPainel && ripado.qtd > 0 ? ripado : null,
    }
    if (isPainel && rackPainel.ativo) {
      detalhesAba2.push(
        `rack ${rackPainel.largura || dimensoes.largura}×${rackPainel.altura}×${rackPainel.profundidade}mm`,
      )
    }
    if (isPainel && ripado.qtd > 0) {
      detalhesAba2.push(`${ripado.qtd} ${ripado.qtd === 1 ? 'ripa' : 'ripas'}`)
    }

    // Converte listaConsolidadaBOM para OrcamentoBOMItem[] repassando todos os itens
    const todosItensConvertidos: OrcamentoBOMItem[] = listaConsolidadaBOM.map((p) => ({
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

    const descManualLimpa = descricaoManual.trim()

    // Ajustes persistidos junto ao módulo (payload jsonb e draft)
    const ajustesBOMPayload: AjustesBOMModulo = {
      markupModulo: markupModuloEfetivo,
      overrides: Object.keys(bomOverrides).length > 0 ? bomOverrides : undefined,
      removedIds: removedBomIds.length > 0 ? removedBomIds : undefined,
      valorUnitarioFixo:
        valorUnitarioFixo !== null && valorUnitarioFixo > 0 ? valorUnitarioFixo : null,
    }

    onSaveModulo({
      moduloId: selectedTemplateId || undefined,
      nome: nomeLimpo,
      descricaoTipo: `${perfilConstrutivo} • ${detalhesAba2.join(' • ')}`,
      descricaoManual: descManualLimpa || undefined,
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
      composicao: composicaoSalva,
      itensBOM: todosItensConvertidos,
      ajustesBOM: ajustesBOMPayload,
    })

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-6xl h-[90vh] max-h-[90vh] p-0 flex flex-col gap-0 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
        {/* Cabeçalho do Modal Centralizado */}
        <DialogHeader className="px-6 py-4 border-b border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-left shrink-0">
          <div className="flex items-center gap-2 pr-8">
            <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
              <Box className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                Configurar Módulo — {ambienteNome || 'Ambiente'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Defina foto/IA, dimensões, materiais e confira a engenharia deste móvel
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Corpo com seletor de 3 Abas */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
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
                  uploadedFiles={uploadedFiles.slice(0, 5)}
                  onFilesSelect={(files) => {
                    const limited = files ? files.slice(0, 5) : []
                    setUploadedFiles(limited)
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
                      {iaIdentifiedTemplate.isLibraryMatch
                        ? `Confiança ${iaIdentifiedTemplate.confiancaNivel === 'alta' ? 'alta' : iaIdentifiedTemplate.confiancaNivel === 'media' ? 'média' : 'baixa'}`
                        : 'Sem correspondência na biblioteca'}
                    </Badge>
                  </div>

                  {/* Aviso de medidas estimadas da foto */}
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      As medidas sugeridas são estimadas pela foto, que não tem escala. Confira a
                      largura, a altura e a profundidade reais na aba 2 antes de salvar.
                    </p>
                  </div>

                  {/* Informações do Módulo Identificado */}
                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        {iaIdentifiedTemplate.isLibraryMatch
                          ? 'Módulo da Biblioteca Identificado'
                          : 'Nenhum módulo da biblioteca corresponde — será calculado sob medida'}
                      </span>
                      {iaIdentifiedTemplate.isLibraryMatch && (
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {iaIdentifiedTemplate.template.nome_template}
                        </p>
                      )}
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
                      <span>
                        {iaIdentifiedTemplate.isLibraryMatch
                          ? isMatchConfirmed
                            ? 'Match Confirmado ✓'
                            : 'Confirmar Match'
                          : isMatchConfirmed
                            ? 'Sugestões Aplicadas ✓'
                            : 'Aplicar Sugestões da IA'}
                      </span>
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
              {/* Card 0: Campo de Descrição Editável (vence a descrição automática no card e no PDF) */}
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                  <Label
                    htmlFor="descricaoManualInput"
                    className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                  >
                    <span>Descrição do Módulo</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-normal border-slate-300 dark:border-slate-700 text-slate-500"
                    >
                      {descricaoManual.trim() ? 'Manual (personalizada)' : 'Automática'}
                    </Badge>
                  </Label>
                  {descricaoManual.trim() && (
                    <button
                      type="button"
                      onClick={() => setDescricaoManual('')}
                      className="text-[11px] text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                      title="Restaurar descrição automática gerada"
                    >
                      Restaurar automática
                    </button>
                  )}
                </div>

                <Textarea
                  id="descricaoManualInput"
                  value={descricaoManual}
                  onChange={(e) => setDescricaoManual(e.target.value)}
                  placeholder={
                    descricaoAutomaticaGerada ||
                    'Ex.: Balcão 2 portas e 3 gavetas em MDF Louro Freijó...'
                  }
                  rows={2}
                  className="text-xs sm:text-sm rounded-xl bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 focus:border-slate-600 resize-y min-h-[56px]"
                />

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Texto que aparece no card do ambiente e no PDF da Proposta Comercial. Se deixar em
                  branco, o sistema usa a descrição gerada automaticamente acima como padrão.
                </p>
              </div>

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

                {/* Perfil "Aberto / Painel": Rack / Caixa Inferior Acoplada e Ripado Vertical */}
                {perfilConstrutivo === 'Aberto / Painel' && (
                  <div className="p-4 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <Label
                          htmlFor="rackPainelAtivoSwitch"
                          className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Box className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>Rack / Caixa Inferior Acoplada</span>
                        </Label>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Tampo, base, laterais e nichos do rack. Portas e gavetas acima entram no
                          rack.
                        </p>
                      </div>
                      <Switch
                        id="rackPainelAtivoSwitch"
                        checked={rackPainel.ativo}
                        onCheckedChange={(checked) =>
                          setRackPainel((r) => ({ ...r, ativo: checked }))
                        }
                      />
                    </div>

                    {rackPainel.ativo && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-amber-200/70 dark:border-amber-900/40">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            Largura (0 = painel)
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            step={10}
                            value={rackPainel.largura ?? 0}
                            onChange={(e) =>
                              setRackPainel((r) => ({
                                ...r,
                                largura: Math.max(0, Number(e.target.value) || 0),
                              }))
                            }
                            className="h-9 text-xs font-mono rounded-lg bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            Altura (mm)
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            step={10}
                            value={rackPainel.altura}
                            onChange={(e) =>
                              setRackPainel((r) => ({
                                ...r,
                                altura: Math.max(0, Number(e.target.value) || 0),
                              }))
                            }
                            className="h-9 text-xs font-mono rounded-lg bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            Profundidade (mm)
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            step={10}
                            value={rackPainel.profundidade}
                            onChange={(e) =>
                              setRackPainel((r) => ({
                                ...r,
                                profundidade: Math.max(0, Number(e.target.value) || 0),
                              }))
                            }
                            className="h-9 text-xs font-mono rounded-lg bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            Divisórias / nichos
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={rackPainel.divisorias}
                            onChange={(e) =>
                              setRackPainel((r) => ({
                                ...r,
                                divisorias: Math.max(0, Number(e.target.value) || 0),
                              }))
                            }
                            className="h-9 text-xs font-mono rounded-lg bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-amber-200/70 dark:border-amber-900/40">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          Ripas / frisos verticais (qtd)
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={ripado.qtd}
                          onChange={(e) =>
                            setRipado((r) => ({
                              ...r,
                              qtd: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className="h-9 text-xs font-mono rounded-lg bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          Largura de cada ripa (mm)
                        </Label>
                        <Input
                          type="number"
                          min={10}
                          step={5}
                          value={ripado.largura}
                          onChange={(e) => {
                            const val = Number(e.target.value)
                            setRipado((r) => ({
                              ...r,
                              largura: Number.isNaN(val) || val <= 0 ? 40 : Math.max(10, val),
                            }))
                          }}
                          className="h-9 text-xs font-mono rounded-lg bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Barra de ações para adicionar itens do catálogo ou avulso ao módulo */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                      Insumos e Acessórios Manuais
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {manualItems.length > 0
                        ? `${manualItems.length} ${manualItems.length === 1 ? 'item adicionado' : 'itens adicionados'} a este móvel`
                        : 'Adicione ferragens especiais, perfis ou itens do catálogo diretamente ao móvel'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCatalogModalOpen(true)}
                      className="h-9 px-3 gap-1.5 text-xs font-semibold rounded-xl border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                    >
                      <Package className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                      <span>Item do Catálogo</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCustomModalOpen(true)}
                      className="h-9 px-3 gap-1.5 text-xs font-semibold rounded-xl border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                      <span>Item Avulso</span>
                    </Button>
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
                    <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      MDF Externo (Frentes / Envelopamento)
                    </Label>

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
                    <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      MDF Interno (Caixaria / Prateleiras)
                    </Label>

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
              {/* Banner informativo de uso técnico com controle do Markup do Módulo */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Settings2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>Engenharia & Decomposição de Peças</span>
                        <Badge
                          variant="outline"
                          className="border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-[10px]"
                        >
                          Perda: {fatorPerdaMaterial}%
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Edição total linha por linha. O motor <code>calcularBOM</code> gera a base e
                        suas alterações manuais são salvas junto ao módulo.
                      </p>
                    </div>
                  </div>

                  {/* Campo editável: Markup do Módulo */}
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shrink-0">
                    <Label
                      htmlFor="markupModuloGeralInput"
                      className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap"
                    >
                      Markup do Módulo:
                    </Label>
                    <div className="relative flex items-center">
                      <Input
                        id="markupModuloGeralInput"
                        type="number"
                        step="0.05"
                        min="0.1"
                        max="20"
                        value={markupModuloInput}
                        onChange={(e) => {
                          markupDefinidoRef.current = true
                          setMarkupModuloInput(e.target.value)
                        }}
                        placeholder={markupEngenhariaPadrao.toFixed(2)}
                        className="h-8 w-24 text-xs font-bold font-mono pr-6 text-center rounded-lg bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                      />
                      <span className="absolute right-2 text-xs font-bold text-slate-400 pointer-events-none">
                        ×
                      </span>
                    </div>
                    {(removedBomIds.length > 0 ||
                      Object.keys(bomOverrides).length > 0 ||
                      markupModuloInput !== markupEngenhariaPadrao.toFixed(2)) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleResetAjustesBOM}
                        className="h-8 px-2 text-[11px] text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg gap-1"
                        title="Restaurar peças originais do motor e markup padrão da engenharia"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Restaurar</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Status da lista com contador de itens ativos e modificações */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {listaConsolidadaBOM.length}{' '}
                      {listaConsolidadaBOM.length === 1 ? 'item ativo' : 'itens ativos'}
                    </span>
                    {removedBomIds.length > 0 && (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                      >
                        {removedBomIds.length} excluído(s)
                      </Badge>
                    )}
                    {Object.keys(bomOverrides).length > 0 && (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                      >
                        {Object.keys(bomOverrides).length} editado(s)
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setIsCatalogModalOpen(true)}
                      className="h-8 px-3 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 gap-1.5 shadow-xs transition-all"
                    >
                      <Package className="w-3.5 h-3.5 text-amber-400 dark:text-amber-600" />
                      <span>+ Item Catálogo</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setIsCustomModalOpen(true)}
                      className="h-8 px-3 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-700 gap-1.5 shadow-xs transition-all"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>+ Item Avulso</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Tabela Detalhada de Engenharia com Edição Total Linha por Linha */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-950 z-10">
                      <TableRow className="border-b border-slate-200 dark:border-slate-800 hover:bg-transparent">
                        <TableHead className="py-2.5 px-3 text-[11px] font-bold text-slate-700 dark:text-slate-300 min-w-[220px]">
                          Descrição da Peça / Insumo
                        </TableHead>
                        <TableHead className="py-2.5 px-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 text-center min-w-[110px]">
                          Metragem / Qtd
                        </TableHead>
                        <TableHead className="py-2.5 px-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 text-center min-w-[110px]">
                          Custo Unit. (R$)
                        </TableHead>
                        <TableHead className="py-2.5 px-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap min-w-[90px]">
                          Custo Total
                        </TableHead>
                        <TableHead className="py-2.5 px-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 text-center min-w-[95px]">
                          Markup
                        </TableHead>
                        <TableHead className="py-2.5 px-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap min-w-[100px]">
                          Valor de Venda
                        </TableHead>
                        <TableHead className="py-2.5 px-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 text-center w-10">
                          <span className="sr-only">Ações</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {listaConsolidadaBOM.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="py-8 text-center text-xs text-slate-400"
                          >
                            Nenhuma peça na lista. Adicione itens acima ou redefina a engenharia.
                          </TableCell>
                        </TableRow>
                      ) : (
                        listaConsolidadaBOM.map((peca) => {
                          const manual = manualItems.some((m) => m.id === peca.id)
                          const hasOverride = !manual && !!bomOverrides[peca.id]
                          const unidade = peca.unidade || 'un'
                          const stepMetragem =
                            unidade === 'm²' || unidade === 'm' || unidade === 'kg' ? '0.01' : '1'

                          return (
                            <TableRow
                              key={peca.id}
                              className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                            >
                              {/* Descrição da Peça (Editável inline) */}
                              <TableCell className="py-2 px-3 text-xs font-medium text-slate-800 dark:text-slate-200">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <Input
                                      value={peca.description}
                                      onChange={(e) =>
                                        handleUpdateItemDescription(peca.id, e.target.value)
                                      }
                                      className="h-7 text-xs font-medium rounded-md bg-transparent hover:bg-white dark:hover:bg-slate-950 focus:bg-white dark:focus:bg-slate-950 border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-slate-500 px-1.5"
                                    />
                                    {manual && (
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 font-semibold shrink-0"
                                      >
                                        Manual
                                      </Badge>
                                    )}
                                    {hasOverride && (
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 font-semibold shrink-0"
                                      >
                                        Ajustado
                                      </Badge>
                                    )}
                                  </div>
                                  {peca.material && (
                                    <span className="block text-[10px] text-slate-400 font-normal px-1.5">
                                      {peca.material}
                                    </span>
                                  )}
                                </div>
                              </TableCell>

                              {/* Metragem / Quantidade (Editável inline) */}
                              <TableCell className="py-2 px-2 text-xs text-center font-mono">
                                <div className="inline-flex items-center gap-1">
                                  <Input
                                    type="number"
                                    step={stepMetragem}
                                    min="0"
                                    value={peca.metragem ?? 0}
                                    onChange={(e) =>
                                      handleUpdateItemMetragem(
                                        peca.id,
                                        parseFloat(e.target.value.replace(',', '.')),
                                      )
                                    }
                                    className="h-7 w-20 text-xs font-mono text-center rounded-md bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 px-1"
                                  />
                                  <span className="text-[11px] text-slate-400 font-sans whitespace-nowrap">
                                    {unidade}
                                  </span>
                                </div>
                              </TableCell>

                              {/* Custo Unitário (Editável inline) */}
                              <TableCell className="py-2 px-2 text-xs text-center font-mono">
                                <div className="inline-flex items-center gap-1">
                                  <span className="text-[11px] text-slate-400 font-sans">R$</span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={peca.unitCost ?? 0}
                                    onChange={(e) =>
                                      handleUpdateItemUnitCost(
                                        peca.id,
                                        parseFloat(e.target.value.replace(',', '.')),
                                      )
                                    }
                                    className="h-7 w-20 text-xs font-mono text-right rounded-md bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 px-1"
                                  />
                                </div>
                              </TableCell>

                              {/* Custo Total (Recalculado = qtd × custo unitário) */}
                              <TableCell className="py-2 px-2 text-xs text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                {formatCurrency(peca.totalCost || 0)}
                              </TableCell>

                              {/* Markup (Editável inline linha por linha) */}
                              <TableCell className="py-2 px-2 text-xs text-center font-mono">
                                <div className="inline-flex items-center gap-0.5 justify-center">
                                  <Input
                                    type="number"
                                    step="0.05"
                                    min="0.1"
                                    max="20"
                                    value={
                                      typeof peca.markup === 'number'
                                        ? peca.markup
                                        : markupModuloEfetivo
                                    }
                                    onChange={(e) =>
                                      handleUpdateItemMarkup(
                                        peca.id,
                                        parseFloat(e.target.value.replace(',', '.')),
                                      )
                                    }
                                    className="h-7 w-16 text-xs font-mono text-center rounded-md bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 px-1"
                                  />
                                  <span className="text-[11px] text-slate-400 font-sans">×</span>
                                </div>
                              </TableCell>

                              {/* Valor de Venda da Linha (Recalculado = totalCost × markup) */}
                              <TableCell className="py-2 px-2 text-xs text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                {formatCurrency(peca.salePrice || 0)}
                              </TableCell>

                              {/* Lixeira em TODAS as linhas (peças geradas e manuais) */}
                              <TableCell className="py-2 px-2 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveItemBOM(peca)}
                                  className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                                  title={`Remover "${peca.description}"`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span className="sr-only">Remover</span>
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}

                      {/* Linha final para adição direta na lista técnica */}
                      <TableRow className="bg-slate-50/80 dark:bg-slate-950/60 border-t-2 border-dashed border-slate-200 dark:border-slate-800 hover:bg-slate-100/60 dark:hover:bg-slate-900/60 transition-colors">
                        <TableCell colSpan={7} className="py-3 px-4">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                              <span className="text-slate-400 font-mono text-sm">＋</span>
                              <span>Adicionar item na lista técnica:</span>
                              <span className="text-[11px] text-slate-400 font-normal hidden md:inline">
                                (entra como linha editável de engenharia e custo)
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => setIsCatalogModalOpen(true)}
                                className="h-8 px-3 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 gap-1.5 shadow-xs"
                              >
                                <Package className="w-3.5 h-3.5 text-amber-400 dark:text-amber-600" />
                                <span>+ Item Catálogo</span>
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => setIsCustomModalOpen(true)}
                                className="h-8 px-3 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-700 gap-1.5 shadow-xs"
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                                <span>+ Item Avulso</span>
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
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

        {/* Modais de inclusão: Catálogo e Avulso */}
        <AddFromCatalogModal
          isOpen={isCatalogModalOpen}
          onClose={() => setIsCatalogModalOpen(false)}
          catalogoMateriais={catalogoMateriais}
          markupEngenharia={markupEfetivo}
          onAddItem={handleAddManualItem}
        />

        <AddCustomItemModal
          isOpen={isCustomModalOpen}
          onClose={() => setIsCustomModalOpen(false)}
          markupEngenharia={markupEfetivo}
          onAddItem={handleAddManualItem}
        />

        {/* Avisos de divergência de recálculo ou valor unitário fixado */}
        {recalculoDivergente && (
          <div className="px-6 py-2.5 border-t text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0 border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            <span>
              Valor recalculado com os preços atuais: {formatCurrency(valorSalvoAnterior)} →{' '}
              {formatCurrency(totalVendaSugerido)} por unidade.
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setValorUnitarioFixo(valorSalvoAnterior)}
              className="h-7 px-3 text-[11px] font-semibold rounded-lg bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-800 hover:bg-amber-100/50 shrink-0 self-start sm:self-auto"
            >
              Manter {formatCurrency(valorSalvoAnterior)}
            </Button>
          </div>
        )}

        {valorUnitarioFixo !== null && (
          <div className="px-6 py-2.5 border-t text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0 border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200">
            <span>
              Valor unitário fixado em {formatCurrency(valorUnitarioFixo)}. As peças continuam sendo
              recalculadas, mas o preço de venda não muda.
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setValorUnitarioFixo(null)}
              className="h-7 px-3 text-[11px] font-semibold rounded-lg bg-white dark:bg-slate-900 border-sky-300 dark:border-sky-800 hover:bg-sky-100/50 shrink-0 self-start sm:self-auto"
            >
              Usar valor recalculado ({formatCurrency(totalVendaSugerido)})
            </Button>
          </div>
        )}

        {/* Rodapé fixo com o botão pedido: 'Salvar Módulo no Ambiente' */}
        <DialogFooter className="px-6 py-4 border-t border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 sm:space-x-0">
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
                {formatCurrency(valorUnitarioEfetivo * quantidade)}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
