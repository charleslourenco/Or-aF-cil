import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  User,
  Home,
  Box,
  Sparkles,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  HelpCircle,
  FileSpreadsheet,
  Ruler,
  ArrowUpDown,
  Star,
  Layers3,
  Package,
  CreditCard,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { AmbienteSelector } from '@/components/AmbienteSelector'
import { CustomerDropzone, UploadedFileState } from '@/components/CustomerDropzone'
import { LibraryMatchCard } from '@/components/LibraryMatchCard'
import { PricingTable } from '@/components/PricingTable'
import { FinalizeQuoteModal } from '@/components/FinalizeQuoteModal'
import { AddFromCatalogModal } from '@/components/AddFromCatalogModal'
import { AddCustomItemModal } from '@/components/AddCustomItemModal'
import { BudgetItem } from '@/data/mockData'
import { createOrcamento, updateOrcamento, fetchOrcamentoById } from '@/services/orcamentos'
import { fetchTemplatesEngenharia, TemplateEngenharia } from '@/services/templates'
import { toast } from '@/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { calcularBOM, custoConsolidado, valorConsolidado, type PadraoProjeto } from '@/lib/pricing'
import { fetchCatalogoMateriais, type CatalogoMaterial } from '@/services/catalogo'
import { fetchPerfilEmpresa, type PerfilEmpresa } from '@/services/empresa'
import { fetchConfigEngenharia } from '@/services/engenharia'
import { gerarPropostaComercial, gerarAnaliseCusto } from '@/lib/pdf'
import type { Orcamento, OrcamentoBOMItem, OrcamentoDRE } from '@/services/orcamentos'
import { supabase } from '@/lib/supabase/client'

// Ambientes permitidos no Select (array estático conforme especificação).
const AMBIENTES = ['Cozinha', 'Quarto', 'Sala', 'Banheiro']

export default function Index() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const editingId = searchParams.get('id')

  // Form Identification Header state
  const [clientName, setClientName] = useState('')
  const [room, setRoom] = useState('')
  const [ambienteSelecionado, setAmbienteSelecionado] = useState<string>('')
  const [selectedModuleId, setSelectedModuleId] = useState<string>('')
  const [loadingEditingQuote, setLoadingEditingQuote] = useState<boolean>(false)

  // Módulos disponíveis — fetch 100% dinâmico do Supabase (tabela TemplatesEngenharia)
  const [modulosDisponiveis, setModulosDisponiveis] = useState<TemplateEngenharia[]>([])
  const [loadingModulos, setLoadingModulos] = useState<boolean>(true)

  // Catálogo de materiais (preços) — carregado do Supabase; fallback para CUSTOS_UNITARIOS.
  const [catalogoMateriais, setCatalogoMateriais] = useState<CatalogoMaterial[]>([])

  // Upload state — agora suporta MÚLTIPLAS imagens (array de perspectivas)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileState[]>([])

  // Estado de análise automática da IA (simulação da chamada OpenAI)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const analyzeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Justificativa retornada pela IA (GPT-4o Vision) sobre o match do módulo.
  const [matchJustificativa, setMatchJustificativa] = useState<string | null>(null)

  // Validation errors
  const [errors, setErrors] = useState<{
    clientName?: string
    room?: string
    selectedModule?: string
    uploadedFile?: string
  }>({})

  // Loading & Results Visibility state
  const [isGenerating, setIsGenerating] = useState(false)
  const [showResults, setShowResults] = useState(false)

  // Itens manuais adicionados pelo usuário (somam-se à BOM dinâmica).
  const [manualItems, setManualItems] = useState<BudgetItem[]>([])

  // Modais de adição de itens
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false)
  const [isCustomItemModalOpen, setIsCustomItemModalOpen] = useState(false)

  // Modal confirmation state
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false)
  const [isSavingQuote, setIsSavingQuote] = useState(false)
  const [isQuoteSaved, setIsQuoteSaved] = useState(false)
  const [savedOrcamentoRecord, setSavedOrcamentoRecord] = useState<Orcamento | null>(null)

  // Perfil da Empresa (para PDFs)
  const [perfilEmpresa, setPerfilEmpresa] = useState<PerfilEmpresa | null>(null)

  // Configurações da Engenharia Financeira (markup, rateio, impostos, comissões)
  const [markupEngenharia, setMarkupEngenharia] = useState<number>(2.5)
  const [configEngenhariaCompleta, setConfigEngenhariaCompleta] = useState<{
    markup_padrao: number
    impostos_percent: number
    comissoes_percent: number
    custo_financeiro_percent: number
    indice_rateio: number
  } | null>(null)

  // 📐 DIMENSÕES REAIS DO MÓDULO (inputs manuais — defaults paramétricos).
  const [dimensoes, setDimensoes] = useState({
    largura: 1800,
    altura: 2200,
    profundidade: 600,
  })

  // 🎨 ESPECIFICAÇÃO DE MATERIAIS (acabamento do módulo).
  const [padraoProjeto, setPadraoProjeto] = useState<PadraoProjeto>('comercial')
  const [mdfExterno, setMdfExterno] = useState<{ cor: string; espessura: 15 | 18 }>({
    cor: 'Branco TX',
    espessura: 18,
  })
  const [mdfInterno, setMdfInterno] = useState<{ cor: string; espessura: 15 | 18 }>({
    cor: 'Branco TX',
    espessura: 15,
  })
  const [mdfFundo, setMdfFundo] = useState<string>('MDF 6mm Branco TX')

  // 💳 TERMOS COMERCIAIS
  const [formaPagamento, setFormaPagamento] = useState('')
  const [observacoes, setObservacoes] = useState('')

  // Section references for scrolling
  const topRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // FETCH REAL DO SUPABASE — carrega os módulos da tabela TemplatesEngenharia.
  useEffect(() => {
    let active = true
    setLoadingModulos(true)

    fetchTemplatesEngenharia()
      .then(({ data: modulos, error }) => {
        if (!active) return
        if (error) {
          console.error('Falha ao carregar módulos disponíveis:', error)
          return
        }
        setModulosDisponiveis(modulos)

        // Suporte a pré-preenchimento via query param ?modulo=<id> (se não estiver em modo edição)
        const modParam = searchParams.get('modulo')
        const idParam = searchParams.get('id')
        if (modParam && !idParam) {
          const encontrado = modulos.find((m) => m.id === modParam)
          if (encontrado) {
            setSelectedModuleId(encontrado.id)
          }
        }
      })
      .finally(() => {
        if (active) setLoadingModulos(false)
      })

    return () => {
      active = false
    }
  }, [searchParams])

  // FETCH DE ORÇAMENTO EXISTENTE QUANDO ?id= ESTÁ PRESENTE
  useEffect(() => {
    let active = true
    const quoteId = searchParams.get('id')
    if (!quoteId) return

    setLoadingEditingQuote(true)
    fetchOrcamentoById(quoteId)
      .then((orcamento) => {
        if (!active) return
        if (!orcamento) {
          toast({
            title: 'Orçamento não encontrado',
            description: `Não foi possível carregar o orçamento #${quoteId.slice(-6)}.`,
            variant: 'destructive',
          })
          return
        }

        // Preenche campos principais
        setClientName(orcamento.cliente_nome || '')
        const amb = orcamento.ambiente || ''
        setAmbienteSelecionado(amb)
        setRoom(amb)

        if (orcamento.forma_pagamento) {
          setFormaPagamento(orcamento.forma_pagamento)
        }
        if (orcamento.observacoes) {
          setObservacoes(orcamento.observacoes)
        }

        // Tenta associar o módulo se o nome coincidir com algum template da biblioteca
        if (orcamento.modulo) {
          // Busca nos módulos disponíveis se já carregados
          const modEncontrado = modulosDisponiveis.find(
            (m) =>
              m.nome_template.toLowerCase() === orcamento.modulo?.toLowerCase() ||
              m.id === orcamento.modulo,
          )
          if (modEncontrado) {
            setSelectedModuleId(modEncontrado.id)
          } else if (modulosDisponiveis.length > 0) {
            setSelectedModuleId(modulosDisponiveis[0].id)
          }
        }

        // Se houver bom_json gravado
        if (
          orcamento.bom_json &&
          Array.isArray(orcamento.bom_json) &&
          orcamento.bom_json.length > 0
        ) {
          const manual: BudgetItem[] = []
          orcamento.bom_json.forEach((item, index) => {
            const itId = String(item.id || `loaded-${index}`)
            // Se for um item manual adicionado anteriormente
            if (itId.startsWith('manual-')) {
              const unidadeValida =
                item.unidade === 'm²' || item.unidade === 'm' || item.unidade === 'jogo'
                  ? item.unidade
                  : undefined

              manual.push({
                id: itId,
                description: item.description || 'Item Manual',
                material: item.material,
                espessura: item.espessura,
                metragem: item.metragem,
                unidade: unidadeValida,
                unitCost: Number(item.unitCost) || 0,
                totalCost: Number(item.totalCost) || 0,
                markup: Number(item.markup) || 2.5,
                salePrice: Number(item.salePrice) || 0,
              })
            }
          })
          if (manual.length > 0) {
            setManualItems(manual)
          }
        }

        // Registra o registro salvo para downloads de PDF e abre a exibição dos resultados
        setSavedOrcamentoRecord(orcamento)
        setShowResults(true)

        // Adiciona um arquivo mock/indicador para não barrar validação se re-executado
        setUploadedFiles([
          {
            file: null,
            previewUrl: 'https://img.usecurling.com/p/800/600?q=wardrobe%20blueprint&color=emerald',
            name: `Projeto ${orcamento.cliente_nome}`,
            sizeFormatted: 'Carregado do Banco',
            isPdf: false,
          },
        ])

        toast({
          title: 'Orçamento Carregado',
          description: `Editando orçamento de ${orcamento.cliente_nome}.`,
        })
      })
      .catch((err) => {
        console.error('Erro ao carregar orçamento por ID:', err)
        toast({
          title: 'Erro ao carregar orçamento',
          description: 'Falha ao buscar os dados do orçamento no banco.',
          variant: 'destructive',
        })
      })
      .finally(() => {
        if (active) setLoadingEditingQuote(false)
      })

    return () => {
      active = false
    }
  }, [searchParams, modulosDisponiveis.length])

  // FETCH DO CATÁLOGO DE MATERIAIS — preços reais vindos do Supabase.
  // Em caso de erro ou catálogo vazio, o motor de cálculo usa CUSTOS_UNITARIOS (fallback).
  useEffect(() => {
    let active = true
    fetchCatalogoMateriais()
      .then((materiais) => {
        if (!active) return
        if (materiais && materiais.length > 0) {
          setCatalogoMateriais(materiais)
        }
      })
      .catch((err) => {
        console.error('Falha ao carregar catálogo de materiais:', err)
      })
    return () => {
      active = false
    }
  }, [])

  // FETCH DO PERFIL DA EMPRESA (para dados do cabeçalho dos relatórios em PDF)
  useEffect(() => {
    let active = true
    fetchPerfilEmpresa().then(({ data }) => {
      if (active && data) {
        setPerfilEmpresa(data)
      }
    })
    return () => {
      active = false
    }
  }, [])

  // FETCH DA CONFIGURAÇÃO DA ENGENHARIA FINANCEIRA (markup, rateio, custos fixos e variáveis)
  useEffect(() => {
    let active = true
    fetchConfigEngenharia()
      .then(({ config, custosFixos, custosVariaveis, error }) => {
        if (!active) return
        if (error || !config) {
          console.warn(
            'Não foi possível carregar as configurações de engenharia financeira. Usando fallback markup 2.5x:',
            error,
          )
          return
        }

        const totalCustosFixos = custosFixos.reduce((s, c) => s + (Number(c.valor) || 0), 0)
        const totalCustosVariaveis = custosVariaveis.reduce((s, c) => s + (Number(c.valor) || 0), 0)
        const totalCustosEmpresa = totalCustosFixos + totalCustosVariaveis
        const meta = Number(config.meta_faturamento) || 0
        const indiceRateio = meta > 0 ? (totalCustosEmpresa / meta) * 100 : 8.0

        const markup =
          typeof config.markup_padrao === 'number' && config.markup_padrao > 0
            ? config.markup_padrao
            : 2.5

        setMarkupEngenharia(markup)
        setConfigEngenhariaCompleta({
          markup_padrao: markup,
          impostos_percent: config.impostos_percent ?? 10.0,
          comissoes_percent: config.comissoes_percent ?? 5.0,
          custo_financeiro_percent: config.custo_financeiro_percent ?? 3.0,
          indice_rateio: Math.round(indiceRateio * 100) / 100,
        })
      })
      .catch((err) => {
        console.warn('Erro ao buscar Engenharia Financeira. Fallback markup 2.5x:', err)
      })

    return () => {
      active = false
    }
  }, [])

  // Listas de opções derivadas dinamicamente do catálogo real de materiais
  const opcoesMdfEstrutural = useMemo(() => {
    return catalogoMateriais.filter((m) => m.categoria === 'MDF 15mm' || m.categoria === 'MDF 18mm')
  }, [catalogoMateriais])

  const opcoesMdfFundo = useMemo(() => {
    return catalogoMateriais.filter((m) => m.categoria === 'MDF 6mm')
  }, [catalogoMateriais])

  // Objeto do módulo selecionado (id + nome_template) derivado do estado dinâmico.
  const selectedModuleObj: TemplateEngenharia | null =
    modulosDisponiveis.find((m) => m.id === selectedModuleId) ?? null

  // ============================================================================
  // 🧮 MOTOR DE CÁLCULO GEOMÉTRICO E PRECIFICAÇÃO DINÂMICA
  // A BOM é recalculada em tempo real via useMemo sempre que qualquer um dos
  // parâmetros relevantes (dimensões, materiais, padrão, módulo) muda.
  // ============================================================================
  // Catálogo efetivo para precificação: se vazio, usa undefined para que o
  // motor caia no fallback CUSTOS_UNITARIOS (tratado dentro de calcularBOM).
  const catalogoParaPricing = catalogoMateriais.length > 0 ? catalogoMateriais : undefined

  const bomItems = useMemo(
    () =>
      calcularBOM(
        selectedModuleObj
          ? { id: selectedModuleObj.id, nome_template: selectedModuleObj.nome_template }
          : null,
        dimensoes,
        mdfExterno,
        mdfInterno,
        mdfFundo,
        padraoProjeto,
        catalogoParaPricing,
        markupEngenharia,
      ),
    [
      selectedModuleObj,
      dimensoes,
      mdfExterno,
      mdfInterno,
      mdfFundo,
      padraoProjeto,
      catalogoParaPricing,
      markupEngenharia,
    ],
  )

  // Lista final de itens exibida: BOM dinâmica + itens manuais do usuário.
  const pricingItems = useMemo<BudgetItem[]>(() => {
    return [...bomItems, ...manualItems]
  }, [bomItems, manualItems])

  // Totais consolidados (custo e valor de venda).
  const totalCusto = useMemo(() => custoConsolidado(pricingItems), [pricingItems])
  const totalVenda = useMemo(() => valorConsolidado(pricingItems), [pricingItems])

  // Flag de validação: módulo selecionado e dimensões preenchidas.
  const dimensoesValidas =
    !!selectedModuleObj &&
    dimensoes.largura > 0 &&
    dimensoes.altura > 0 &&
    dimensoes.profundidade > 0

  // Clear errors when fields update
  const handleClientNameChange = (val: string) => {
    setClientName(val)
    if (errors.clientName) {
      setErrors((prev) => ({ ...prev, clientName: undefined }))
    }
  }

  const handleRoomChange = (val: string) => {
    setRoom(val)
    setAmbienteSelecionado(val)
    if (errors.room) {
      setErrors((prev) => ({ ...prev, room: undefined }))
    }
  }

  const handleAmbienteSelecionadoChange = (val: string) => {
    setAmbienteSelecionado(val)
    setRoom(val)
    if (errors.room) {
      setErrors((prev) => ({ ...prev, room: undefined }))
    }
  }

  const handleModuleChange = (val: string) => {
    setSelectedModuleId(val)
    // Troca manual de módulo ⇒ limpa a justificativa da IA.
    setMatchJustificativa(null)
    if (errors.selectedModule) {
      setErrors((prev) => ({ ...prev, selectedModule: undefined }))
    }

    // Auto-preenche o ambiente quando vazio, com base na categoria do módulo.
    const modulo = modulosDisponiveis.find((m) => m.id === val)
    if (!ambienteSelecionado && !room && modulo?.categoria) {
      const cat = modulo.categoria.toLowerCase()
      let autoAmb = ''
      if (cat.includes('quarto')) autoAmb = 'Quarto 01'
      else if (cat.includes('cozinha')) autoAmb = 'Cozinha Principal'
      else if (cat.includes('sala')) autoAmb = 'Sala de Estar'
      else if (cat.includes('banheiro')) autoAmb = 'Banheiro Social 01'

      if (autoAmb) {
        setAmbienteSelecionado(autoAmb)
        setRoom(autoAmb)
      }
    }
  }

  /**
   * Converte um UploadedFileState para Base64 (data URL) compatível com a API
   * Vision da OpenAI. Suporta tanto uploads reais (File) quanto imagens de
   * exemplo (URL pública via fetch → blob → Base64).
   */
  const fileToBase64 = (fileState: UploadedFileState): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Falha ao converter imagem para Base64.'))

      // Upload real: usa o File diretamente.
      if (fileState.file) {
        reader.readAsDataURL(fileState.file)
        return
      }

      // Imagem de exemplo (URL): baixa via fetch e converte para Base64.
      if (fileState.previewUrl) {
        fetch(fileState.previewUrl)
          .then((res) => {
            if (!res.ok) throw new Error('Falha ao baixar imagem de exemplo.')
            return res.blob()
          })
          .then((blob) => reader.readAsDataURL(blob))
          .catch((err) => reject(err))
        return
      }

      reject(new Error('Arquivo inválido para análise visual.'))
    })
  }

  /**
   * Executa o match via Edge Function 'analisar-imagem' do Supabase.
   * Retorna o payload com modulos_detectados, ferragens_obrigatorias e justificativa.
   */
  const runOpenAIVisionMatch = async (
    fileState: UploadedFileState,
    modulos: TemplateEngenharia[],
  ): Promise<{
    modulos_detectados?: Array<{
      codigo_modulo: string
      nome: string
      dimensao_estimada?: { largura: number; altura: number; profundidade: number }
      adaptacoes?: string
    }>
    ferragens_obrigatorias?: Array<{
      catalogo_id: string
      descricao: string
      quantidade: number
      justificativa: string
    }>
    justificativa?: string
    id_modulo_encontrado?: string | null
    idModulo?: string | null
  }> => {
    // Converte a primeira imagem para Base64.
    const imagemBase64 = await fileToBase64(fileState)

    const { data, error } = await supabase.functions.invoke('analisar-imagem', {
      body: { imagemBase64, modulos, catalogoMateriais },
    })

    if (error) {
      throw new Error(error.message || 'Erro ao chamar função de análise de imagem.')
    }

    if (data?.error) {
      throw new Error(data.error)
    }

    return data
  }

  /**
   * Fallback mock (sem API key ou em caso de erro da IA): simula a análise da
   * IA em 3 segundos e seleciona o primeiro módulo disponível.
   */
  const runMockMatch = (
    modulos: TemplateEngenharia[],
    description: string,
    variant?: 'default' | 'destructive',
  ) => {
    setIsAnalyzing(true)
    analyzeTimeoutRef.current = setTimeout(() => {
      if (modulos.length > 0) {
        setSelectedModuleId((prevSel) => prevSel || modulos[0].id)
      }
      setIsAnalyzing(false)
      analyzeTimeoutRef.current = null
      toast({
        title: '✓ Match Automático Concluído!',
        description,
        variant,
      })
    }, 3000)
  }

  const handleFilesSelect = (files: UploadedFileState[] | null) => {
    setUploadedFiles(files ?? [])
    // Limpa a justificativa anterior sempre que novos arquivos chegam.
    setMatchJustificativa(null)

    if (errors.uploadedFile) {
      setErrors((prev) => ({ ...prev, uploadedFile: undefined }))
    }

    // Limpa qualquer análise anterior pendente
    if (analyzeTimeoutRef.current) {
      clearTimeout(analyzeTimeoutRef.current)
      analyzeTimeoutRef.current = null
    }

    // Sem arquivos ⇒ reset do estado de análise
    if (!files || files.length === 0) {
      setIsAnalyzing(false)
      return
    }

    // Captura o estado atual dos módulos para usar de forma síncrona na IA.
    const modulosAtuais = modulosDisponiveis

    // 1. Verificação de biblioteca vazia antes da análise
    if (modulosAtuais.length === 0) {
      setIsAnalyzing(false)
      toast({
        variant: 'destructive',
        title: 'Biblioteca de Módulos Vazia',
        description:
          'Sua biblioteca de módulos está vazia. Cadastre pelo menos 1 módulo na página Biblioteca para gerar orçamentos.',
        action: (
          <ToastAction altText="Ir para Biblioteca" onClick={() => navigate('/biblioteca')}>
            Ir para Biblioteca
          </ToastAction>
        ),
      })
      return
    }

    // 🔄 FLUXO DE MATCH AUTOMÁTICO (IA):
    // Chama a Edge Function 'analisar-imagem' do Supabase
    setIsAnalyzing(true)

    const primeiraImagem = files[0]

    runOpenAIVisionMatch(primeiraImagem, modulosAtuais)
      .then((data) => {
        const modulosDetectados = data.modulos_detectados
        const ferragensObrigatorias = data.ferragens_obrigatorias ?? []
        const justificativaGeral =
          data.justificativa || 'Match identificado pela análise visual da IA.'

        if (Array.isArray(modulosDetectados) && modulosDetectados.length > 0) {
          // 1. Seleciona o primeiro módulo detectado
          const primeiroModulo = modulosDetectados[0]
          const codigoModulo = primeiroModulo.codigo_modulo

          let moduloEncontrado = modulosAtuais.find((m) => m.id === codigoModulo)
          if (!moduloEncontrado) {
            moduloEncontrado = modulosAtuais.find(
              (m) =>
                m.nome_template.toLowerCase() === codigoModulo.toLowerCase() ||
                m.nome_template.toLowerCase() === primeiroModulo.nome.toLowerCase(),
            )
          }

          const idFinal = moduloEncontrado?.id ?? modulosAtuais[0]?.id ?? ''
          setSelectedModuleId(idFinal)

          // 2. Se houver dimensao_estimada, preenche o estado dimensoes
          if (primeiroModulo.dimensao_estimada) {
            const { largura, altura, profundidade } = primeiroModulo.dimensao_estimada
            setDimensoes({
              largura: largura > 0 ? largura : 1800,
              altura: altura > 0 ? altura : 2200,
              profundidade: profundidade > 0 ? profundidade : 600,
            })
          }

          // 3. Adiciona cada ferragem obrigatória como item manual
          if (ferragensObrigatorias.length > 0) {
            const effectiveMarkup = markupEngenharia > 0 ? markupEngenharia : 2.5
            const novasFerragens: BudgetItem[] = ferragensObrigatorias.map((f, idx) => {
              // Buscar preco_custo do catalogoMateriais pelo catalogo_id ou usar 0
              const matNoCatalogo = catalogoMateriais.find(
                (c) =>
                  c.id === f.catalogo_id ||
                  c.nome_material.toLowerCase() === f.descricao.toLowerCase(),
              )
              const unitCost = matNoCatalogo ? Number(matNoCatalogo.preco_custo) || 0 : 0
              const qtd = f.quantidade > 0 ? f.quantidade : 1
              const totalCost = unitCost * qtd
              const salePrice = Math.round(totalCost * effectiveMarkup * 100) / 100

              return {
                id: `ferragem-ia-${f.catalogo_id || 'item'}-${Date.now()}-${idx}`,
                description: f.descricao,
                material: matNoCatalogo?.categoria || 'Ferragem',
                metragem: qtd,
                unidade:
                  matNoCatalogo?.unidade === 'm²' ||
                  matNoCatalogo?.unidade === 'm' ||
                  matNoCatalogo?.unidade === 'jogo'
                    ? matNoCatalogo.unidade
                    : undefined,
                unitCost,
                totalCost,
                markup: effectiveMarkup,
                salePrice,
              }
            })

            setManualItems((prev) => [...prev, ...novasFerragens])

            toast({
              title: 'Ferragens Obrigatórias Adicionadas',
              description: `✓ IA adicionou ${novasFerragens.length} ferragens obrigatórias ao orçamento (ex: corrediças, puxadores)`,
            })
          }

          // Se houver mais de 1 módulo detectado, mostra toast avisando
          if (modulosDetectados.length > 1) {
            toast({
              title: `IA detectou ${modulosDetectados.length} módulos no ambiente`,
              description: `O primeiro (${primeiroModulo.nome}) foi selecionado. Adicione os demais manualmente.`,
            })
          }

          setMatchJustificativa(justificativaGeral)
          setIsAnalyzing(false)

          toast({
            title: '✓ Match IA Concluído!',
            description: justificativaGeral,
          })
        } else {
          // Fallback para resposta antiga ou id_modulo_encontrado
          const idModuloAntigo = data.id_modulo_encontrado || data.idModulo
          let moduloEncontrado: TemplateEngenharia | undefined

          if (idModuloAntigo) {
            moduloEncontrado = modulosAtuais.find((m) => m.id === idModuloAntigo)
          }

          if (!moduloEncontrado && idModuloAntigo) {
            moduloEncontrado = modulosAtuais.find(
              (m) => m.nome_template.toLowerCase() === idModuloAntigo.toLowerCase(),
            )
          }

          const idFinal = moduloEncontrado?.id ?? modulosAtuais[0]?.id ?? ''

          setSelectedModuleId(idFinal)
          setMatchJustificativa(justificativaGeral)
          setIsAnalyzing(false)

          toast({
            title: '✓ Match IA Concluído!',
            description: justificativaGeral,
          })
        }
      })
      .catch((err) => {
        console.error('Falha na análise visual da IA (Edge Function):', err)
        // Fallback para o mock em caso de erro na chamada da IA.
        runMockMatch(
          modulosAtuais,
          '⚠️ A IA falhou, mas o match manual está disponível.',
          'destructive',
        )
      })
  }

  // Limpa o timeout pendente ao desmontar
  useEffect(() => {
    return () => {
      if (analyzeTimeoutRef.current) clearTimeout(analyzeTimeoutRef.current)
    }
  }, [])

  // Action: "⚙️ Gerar Orçamento do Módulo"
  const handleGenerateBudget = () => {
    const newErrors: {
      clientName?: string
      room?: string
      selectedModule?: string
      uploadedFile?: string
    } = {}

    if (!clientName.trim()) {
      newErrors.clientName = 'Informe o nome do cliente'
    }

    const effectiveRoom = ambienteSelecionado || room
    if (!effectiveRoom) {
      newErrors.room = 'Selecione o ambiente do projeto'
    } else if (!room) {
      setRoom(effectiveRoom)
    }

    if (!selectedModuleId) {
      newErrors.selectedModule = 'Selecione um módulo da biblioteca'
    }

    if (uploadedFiles.length === 0) {
      newErrors.uploadedFile = 'Envie ao menos uma foto ou projeto do cliente para comparação'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast({
        title: 'Campos Obrigatórios Pendentes',
        description:
          'Preencha o nome do cliente, anexe o arquivo e selecione o módulo correspondente.',
        variant: 'destructive',
      })
      return
    }

    // Success validation -> trigger generation animation
    setIsGenerating(true)

    setTimeout(() => {
      setIsGenerating(false)
      setShowResults(true)

      toast({
        title: 'Orçamento Gerado com Sucesso!',
        description: 'Peças calculadas com base nas dimensões paramétricas do módulo.',
      })

      // Smooth scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
    }, 600)
  }

  // Action: "+ Adicionar Item Manualmente"
  const handleAddNewManualItem = () => {
    if (!showResults) {
      setShowResults(true)
    }

    const effectiveMarkup = markupEngenharia || 2.5
    const unitCost = 80.0
    const totalCost = 160.0
    const salePrice = Math.round(totalCost * effectiveMarkup * 100) / 100

    const newItem: BudgetItem = {
      id: `manual-${Date.now()}`,
      description: 'Nova Peça em MDF 18mm',
      unitCost,
      totalCost,
      markup: effectiveMarkup,
      salePrice,
      isEditing: true,
    }

    setManualItems((prev) => [...prev, newItem])

    // Scroll to results if needed
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, 100)
  }

  // Action: "+ Adicionar Outro Módulo"
  const handleAddAnotherModule = () => {
    setSelectedModuleId('')
    setUploadedFiles([])
    setIsAnalyzing(false)
    setManualItems([])
    setMatchJustificativa(null)
    if (analyzeTimeoutRef.current) {
      clearTimeout(analyzeTimeoutRef.current)
      analyzeTimeoutRef.current = null
    }
    setErrors({})
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    toast({
      title: 'Pronto para novo módulo',
      description: 'Faça o upload das fotos e a IA identificará o módulo automaticamente.',
    })
  }

  // Action: "Finalizar Orçamento"
  const handleFinalizeClick = () => {
    if (!clientName.trim()) {
      setErrors((prev) => ({ ...prev, clientName: 'Informe o nome do cliente antes de finalizar' }))
      topRef.current?.scrollIntoView({ behavior: 'smooth' })
      toast({
        title: 'Nome do cliente ausente',
        description: 'Por favor, informe o nome do cliente no cabeçalho.',
        variant: 'destructive',
      })
      return
    }

    setIsQuoteSaved(false)
    setSavedOrcamentoRecord(null)
    setIsFinalizeModalOpen(true)
  }

  const handleConfirmFinalize = async () => {
    setIsSavingQuote(true)
    try {
      const totalSale = pricingItems.reduce((acc, it) => acc + (Number(it.salePrice) || 0), 0)
      const totalCost = pricingItems.reduce((acc, it) => acc + (Number(it.totalCost) || 0), 0)

      // Busca parâmetros reais da DRE de configuracoes_engenharia, custos fixos, variáveis e comissões
      let impostosPercent = 10.0
      let comissaoPercent = 5.0
      let custoFixoPercent = 8.0
      let markupConfig = 2.5

      try {
        const { config, custosFixos, custosVariaveis, comissoesPersonalizadas } =
          await fetchConfigEngenharia()

        if (config) {
          impostosPercent = Number(config.impostos_percent) || 10.0
          // Soma da comissão base + comissões personalizadas
          const comissaoBase = Number(config.comissoes_percent) || 0
          const comissoesExtras = (comissoesPersonalizadas ?? []).reduce(
            (s, c) => s + (Number(c.percentual) || 0),
            0,
          )
          comissaoPercent = comissaoBase + comissoesExtras || 5.0
          markupConfig = Number(config.markup_padrao) || 2.5

          // Cálculo do índice de rateio real da Engenharia Financeira
          const totalCustosFixos = (custosFixos ?? []).reduce(
            (s, c) => s + (Number(c.valor) || 0),
            0,
          )
          const totalCustosVariaveis = (custosVariaveis ?? []).reduce(
            (s, c) => s + (Number(c.valor) || 0),
            0,
          )
          const totalCustosEmpresa = totalCustosFixos + totalCustosVariaveis
          const meta = Number(config.meta_faturamento) || 0

          if (meta > 0) {
            custoFixoPercent = Math.round((totalCustosEmpresa / meta) * 100 * 100) / 100
          }
        } else if (configEngenhariaCompleta) {
          impostosPercent = configEngenhariaCompleta.impostos_percent
          comissaoPercent = configEngenhariaCompleta.comissoes_percent
          custoFixoPercent = configEngenhariaCompleta.indice_rateio
          markupConfig = configEngenhariaCompleta.markup_padrao
        } else {
          console.warn(
            'Configuração de engenharia não encontrada no Supabase. Usando defaults com aviso.',
          )
        }
      } catch (e) {
        console.warn('Erro ao buscar configuração da engenharia no finalize. Usando fallback:', e)
      }

      const impostosValor = Math.round(((totalSale * impostosPercent) / 100) * 100) / 100
      const comissaoValor = Math.round(((totalSale * comissaoPercent) / 100) * 100) / 100
      const custoFixoValor = Math.round(((totalSale * custoFixoPercent) / 100) * 100) / 100
      const lucroValor =
        Math.round((totalSale - totalCost - impostosValor - comissaoValor - custoFixoValor) * 100) /
        100
      const lucroPercent = totalSale > 0 ? (lucroValor / totalSale) * 100 : 0
      const markupEfetivo = totalCost > 0 ? totalSale / totalCost : markupConfig

      const dreJson: OrcamentoDRE = {
        custo_mp: totalCost,
        impostos: impostosValor,
        impostos_percent: impostosPercent,
        comissao: comissaoValor,
        comissao_percent: comissaoPercent,
        custo_fixo_rateado: custoFixoValor,
        custo_fixo_percent: custoFixoPercent,
        lucro_liquido: lucroValor,
        lucro_liquido_percent: Math.round(lucroPercent * 100) / 100,
        markup_efetivo: Math.round(markupEfetivo * 100) / 100,
        preco_final: totalSale,
      }

      const bomJson: OrcamentoBOMItem[] = pricingItems.map((item) => ({
        id: item.id,
        description: item.description,
        material: item.material,
        espessura: item.espessura,
        metragem: item.metragem,
        unidade: item.unidade,
        unitCost: item.unitCost,
        totalCost: item.totalCost,
        markup: item.markup,
        salePrice: item.salePrice,
      }))

      let savedRecord: Orcamento | null = null

      if (editingId) {
        // Atualização de orçamento existente
        savedRecord = await updateOrcamento(editingId, {
          cliente_nome: clientName,
          ambiente: ambienteSelecionado || room || null,
          modulo: currentModuleName || null,
          valor_total: totalSale,
          status: 'Aprovado',
          forma_pagamento: formaPagamento || null,
          observacoes: observacoes || null,
          bom_json: bomJson,
          dre_json: dreJson,
        })
      } else {
        // Criação de novo orçamento
        savedRecord = await createOrcamento({
          cliente_nome: clientName,
          ambiente: ambienteSelecionado || room || null,
          modulo: currentModuleName || null,
          valor_total: totalSale,
          status: 'Aprovado',
          forma_pagamento: formaPagamento || null,
          observacoes: observacoes || null,
          bom_json: bomJson,
          dre_json: dreJson,
        })
      }

      if (savedRecord) {
        setSavedOrcamentoRecord(savedRecord)
        setIsQuoteSaved(true)
        toast({
          title: editingId
            ? '✓ Orçamento Atualizado com Sucesso!'
            : '✓ Orçamento Salvo com Sucesso!',
          description: `Orçamento de ${clientName} ${editingId ? 'atualizado' : 'registrado'}. Escolha os relatórios em PDF para download.`,
        })
      } else {
        toast({
          title: 'Aviso',
          description: 'Orçamento processado. Redirecionando para a lista.',
        })
        navigate('/orcamentos')
      }
    } catch (err) {
      console.error('Erro ao finalizar orçamento:', err)
      toast({
        title: 'Erro ao salvar orçamento',
        description: 'Ocorreu um erro ao gravar os dados. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSavingQuote(false)
    }
  }

  // Handlers para gerar os PDFs no Modal após a finalização
  const handleDownloadProposta = async () => {
    try {
      const totalSale = pricingItems.reduce((acc, it) => acc + (Number(it.salePrice) || 0), 0)
      await gerarPropostaComercial({
        orcamentoId: savedOrcamentoRecord?.id || editingId || undefined,
        codigo: (savedOrcamentoRecord?.id || editingId || '').slice(-6).toUpperCase() || undefined,
        data: savedOrcamentoRecord?.data || new Date().toISOString(),
        cliente: {
          nome: clientName,
        },
        empresa: perfilEmpresa,
        ambientes: [
          {
            nome: ambienteSelecionado || room || 'Ambiente Principal',
            descricao: `Módulo: ${currentModuleName} (${dimensoes.largura}L × ${dimensoes.altura}A × ${dimensoes.profundidade}P mm)`,
            quantidade: 1,
            valorUnitario: totalSale,
            valorTotal: totalSale,
          },
        ],
        valorTotal: totalSale,
        formaPagamento: formaPagamento,
        observacoes: observacoes,
      })
      toast({
        title: '✓ PDF da Proposta Gerado!',
        description: 'O download do documento comercial foi iniciado.',
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
        title: 'Erro na geração da Proposta',
        description: errorMsg,
        variant: 'destructive',
      })
    }
  }

  const handleDownloadAnaliseCusto = async () => {
    try {
      const totalSale = pricingItems.reduce((acc, it) => acc + (Number(it.salePrice) || 0), 0)
      const totalCost = pricingItems.reduce((acc, it) => acc + (Number(it.totalCost) || 0), 0)

      const impPercent = configEngenhariaCompleta?.impostos_percent ?? 10.0
      const comPercent = configEngenhariaCompleta?.comissoes_percent ?? 5.0
      const fixoPercent = configEngenhariaCompleta?.indice_rateio ?? 8.0
      const markupConfig = configEngenhariaCompleta?.markup_padrao ?? markupEngenharia ?? 2.5

      const impVal = Math.round(((totalSale * impPercent) / 100) * 100) / 100
      const comVal = Math.round(((totalSale * comPercent) / 100) * 100) / 100
      const fixoVal = Math.round(((totalSale * fixoPercent) / 100) * 100) / 100
      const lucroVal = Math.round((totalSale - totalCost - impVal - comVal - fixoVal) * 100) / 100
      const lucroPct = totalSale > 0 ? (lucroVal / totalSale) * 100 : 0
      const markupEf = totalCost > 0 ? totalSale / totalCost : markupConfig

      const dre = savedOrcamentoRecord?.dre_json || {
        custo_mp: totalCost,
        impostos: impVal,
        impostos_percent: impPercent,
        comissao: comVal,
        comissao_percent: comPercent,
        custo_fixo_rateado: fixoVal,
        custo_fixo_percent: fixoPercent,
        lucro_liquido: lucroVal,
        lucro_liquido_percent: Math.round(lucroPct * 100) / 100,
        markup_efetivo: Math.round(markupEf * 100) / 100,
        preco_final: totalSale,
      }

      await gerarAnaliseCusto({
        orcamentoId: savedOrcamentoRecord?.id || editingId || undefined,
        codigo: (savedOrcamentoRecord?.id || editingId || '').slice(-6).toUpperCase() || undefined,
        data: savedOrcamentoRecord?.data || new Date().toISOString(),
        cliente: {
          nome: clientName,
        },
        moduloNome: currentModuleName,
        ambienteNome: ambienteSelecionado || room || 'Ambiente',
        dimensoes: dimensoes,
        empresa: perfilEmpresa,
        dre: dre,
        bom: pricingItems as OrcamentoBOMItem[],
        valorTotalVenda: totalSale,
        valorTotalCusto: totalCost,
      })
      toast({
        title: '✓ PDF de Análise de Custo Gerado!',
        description: 'O relatório de engenharia foi baixado com sucesso.',
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
        title: 'Erro na geração da Análise de Custo',
        description: errorMsg,
        variant: 'destructive',
      })
    }
  }

  const currentModuleName = selectedModuleObj?.nome_template || 'Módulo Padrão'

  // Formatador monetário pt-BR com 2 casas decimais.
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val)

  return (
    <div ref={topRef} className="space-y-8 pb-20">
      {/* 1. Header Hero Title */}
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-300 text-slate-800 text-xs font-semibold mb-1">
          <Sparkles className="w-3.5 h-3.5 text-slate-700" />
          <span>Comparador Visual Paramétrico</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {editingId ? 'Editar Orçamento de Marcenaria' : 'Novo Orçamento de Marcenaria'}
        </h2>
        <p className="text-sm sm:text-base text-slate-500 max-w-3xl leading-relaxed">
          {editingId
            ? `Editando dados do orçamento #${editingId.slice(-6).toUpperCase()} — ajuste peças, dimensões e condições comerciais.`
            : 'Compare o projeto do cliente com o módulo da biblioteca e gere a precificação automática com lista de peças e markup comercial.'}
        </p>
      </div>
      {/* 2. CABEÇALHO DE IDENTIFICAÇÃO */}
      <section aria-labelledby="identificacao-heading">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-xs">
                1
              </div>
              <h3
                id="identificacao-heading"
                className="text-sm sm:text-base font-bold text-slate-900"
              >
                Identificação do Orçamento
              </h3>
              <span className="text-xs text-slate-400 font-normal hidden sm:inline">
                • Dados básicos do cliente e ambiente
              </span>
            </div>
            {(ambienteSelecionado || room) && (
              <div className="flex items-center gap-1.5 animate-fade-in">
                <span className="text-xs text-slate-400 font-medium">Ambiente:</span>
                <Badge
                  variant="outline"
                  className="bg-slate-100 text-slate-900 border-slate-300 font-semibold text-xs px-2.5 py-0.5 gap-1.5 shadow-2xs"
                >
                  <Home className="w-3.5 h-3.5 text-slate-700" />
                  {ambienteSelecionado || room}
                </Badge>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Input: Nome do Cliente */}
            <div className="space-y-1.5">
              <label
                htmlFor="clientName"
                className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
              >
                <User className="w-3.5 h-3.5 text-slate-700" />
                Nome do Cliente <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Input
                  id="clientName"
                  placeholder="Ex.: Maria Silva"
                  value={clientName}
                  onChange={(e) => handleClientNameChange(e.target.value)}
                  className={cn(
                    'h-11 rounded-xl text-sm transition-all',
                    errors.clientName
                      ? 'border-rose-500 ring-2 ring-rose-200 bg-rose-50/20'
                      : 'border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20',
                  )}
                />
              </div>
              {errors.clientName && (
                <p className="text-[11px] font-medium text-rose-600 flex items-center gap-1 pt-0.5 animate-fade-in">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.clientName}
                </p>
              )}
            </div>

            {/* Select / Combobox: Ambiente */}
            <div className="space-y-1.5">
              <label
                htmlFor="ambiente-combobox-header"
                className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
              >
                <Home className="w-3.5 h-3.5 text-slate-700" />
                Ambiente <span className="text-rose-500">*</span>
              </label>
              <AmbienteSelector
                id="ambiente-combobox-header"
                value={ambienteSelecionado || room}
                onChange={handleAmbienteSelecionadoChange}
                error={errors.room}
              />
              {errors.room && (
                <p className="text-[11px] font-medium text-rose-600 flex items-center gap-1 pt-0.5 animate-fade-in">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.room}
                </p>
              )}
            </div>

            {/* Select: Módulo — 100% dinâmico do Supabase */}
            <div className="space-y-1.5">
              <label
                htmlFor="moduleSelect"
                className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
              >
                <Box className="w-3.5 h-3.5 text-slate-700" />
                Módulo Identificado (Ajuste Manual) <span className="text-rose-500">*</span>
              </label>
              <Select value={selectedModuleId} onValueChange={handleModuleChange}>
                <SelectTrigger
                  id="moduleSelect"
                  className={cn(
                    'h-11 rounded-xl text-sm transition-all',
                    errors.selectedModule
                      ? 'border-rose-500 ring-2 ring-rose-200 bg-rose-50/20'
                      : 'border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20',
                  )}
                >
                  <SelectValue
                    placeholder={loadingModulos ? 'Carregando módulos...' : 'Selecione o módulo'}
                  />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {modulosDisponiveis.length === 0 && !loadingModulos && (
                    <div className="px-3 py-2 text-xs text-slate-500">
                      Nenhum módulo disponível na biblioteca.
                    </div>
                  )}
                  {modulosDisponiveis.map((modulo) => (
                    <SelectItem key={modulo.id} value={modulo.id}>
                      {modulo.nome_template}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.selectedModule && (
                <p className="text-[11px] font-medium text-rose-600 flex items-center gap-1 pt-0.5 animate-fade-in">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.selectedModule}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
      {/* 3. ÁREA CENTRAL: O MATCH LADO A LADO (Grid de 2 colunas) */}
      <section aria-labelledby="match-heading" className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-xs">
              2
            </div>
            <h3 id="match-heading" className="text-base sm:text-lg font-bold text-slate-900">
              Comparação Lado a Lado
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            Validação visual entre o desejo do cliente e os padrões construtivos
          </span>
        </div>

        {/* 2-Column Responsive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative items-stretch">
          {/* Left Column: Upload do Cliente */}
          <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <User className="w-4 h-4 text-slate-700" />
                  Upload do Cliente (Croqui / Foto)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Projeto de referência enviado para cotar
                </p>
              </div>
            </div>

            <div className="flex-1 min-h-[300px]">
              <CustomerDropzone
                uploadedFiles={uploadedFiles}
                onFilesSelect={handleFilesSelect}
                error={errors.uploadedFile}
                onClearError={() => setErrors((prev) => ({ ...prev, uploadedFile: undefined }))}
              />
            </div>
          </div>

          {/* Mobile Connection Indicator */}
          <div className="lg:hidden flex items-center justify-center my-[-10px] z-10">
            <div className="w-10 h-10 rounded-full bg-slate-700 text-white flex items-center justify-center shadow-lg ring-4 ring-white">
              <ArrowDown className="w-5 h-5 animate-bounce" />
            </div>
          </div>

          {/* Right Column: Match da Biblioteca */}
          <div className="flex flex-col h-full">
            <LibraryMatchCard
              selectedModule={selectedModuleObj}
              isAnalyzing={isAnalyzing}
              dimensoes={dimensoes}
              onOpenLibraryModal={() => navigate('/biblioteca')}
              modulosDisponiveis={modulosDisponiveis}
              selectedModuleId={selectedModuleId}
              justificativa={matchJustificativa}
              onModuleChange={(id) => {
                // Troca manual de gabarito: atualiza o card e reseta o estado de análise.
                handleModuleChange(id)
                setIsAnalyzing(false)
                if (analyzeTimeoutRef.current) {
                  clearTimeout(analyzeTimeoutRef.current)
                  analyzeTimeoutRef.current = null
                }
                toast({
                  title: 'Módulo trocado manualmente',
                  description: 'Gabarito atualizado para o módulo escolhido.',
                })
              }}
            />
          </div>
        </div>
      </section>
      {/* 3a. PAINEL DE DIMENSÕES REAIS DO MÓDULO */}
      <section aria-labelledby="dimensoes-heading" className="space-y-3">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-800 flex items-center justify-center">
                <Ruler className="w-4 h-4" />
              </div>
              <h3 id="dimensoes-heading" className="text-sm sm:text-base font-bold text-slate-900">
                Dimensões Reais do Módulo
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              Ajuste fino das medidas para o plano de corte
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            {/* Largura */}
            <div className="space-y-1.5">
              <Label
                htmlFor="dim-largura"
                className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
              >
                <ArrowRight className="w-3.5 h-3.5 text-slate-700" />
                Largura (L)
              </Label>
              <div className="relative">
                <Input
                  id="dim-largura"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={dimensoes.largura}
                  onChange={(e) =>
                    setDimensoes((prev) => ({
                      ...prev,
                      largura: Number(e.target.value) || 0,
                    }))
                  }
                  className="h-11 rounded-xl text-sm font-mono font-semibold border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20 pr-12"
                />{' '}
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  mm
                </span>
              </div>
            </div>

            {/* Altura */}
            <div className="space-y-1.5">
              <Label
                htmlFor="dim-altura"
                className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-700" />
                Altura (A)
              </Label>
              <div className="relative">
                <Input
                  id="dim-altura"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={dimensoes.altura}
                  onChange={(e) =>
                    setDimensoes((prev) => ({
                      ...prev,
                      altura: Number(e.target.value) || 0,
                    }))
                  }
                  className="h-11 rounded-xl text-sm font-mono font-semibold border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20 pr-12"
                />{' '}
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  mm
                </span>
              </div>
            </div>

            {/* Profundidade */}
            <div className="space-y-1.5">
              <Label
                htmlFor="dim-profundidade"
                className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
              >
                <ArrowDown className="w-3.5 h-3.5 text-slate-700" />
                Profundidade (P)
              </Label>
              <div className="relative">
                <Input
                  id="dim-profundidade"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={dimensoes.profundidade}
                  onChange={(e) =>
                    setDimensoes((prev) => ({
                      ...prev,
                      profundidade: Number(e.target.value) || 0,
                    }))
                  }
                  className="h-11 rounded-xl text-sm font-mono font-semibold border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20 pr-12"
                />{' '}
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  mm
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* 3b. CARD DE ESPECIFICAÇÃO DE MATERIAIS */}
      <section aria-labelledby="materiais-heading" className="space-y-3">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-800 flex items-center justify-center">
                <Layers3 className="w-4 h-4" />
              </div>
              <h3 id="materiais-heading" className="text-sm sm:text-base font-bold text-slate-900">
                Especificação de Materiais
              </h3>
            </div>
            <span className="text-xs text-slate-500">Acabamento e espessuras do MDF</span>
          </div>

          <div className="space-y-5 pt-4">
            {/* Padrão do Projeto — Radio Cards visuais */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Padrão do Projeto
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPadraoProjeto('comercial')}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-xl border text-left transition-all',
                    padraoProjeto === 'comercial'
                      ? 'border-slate-600 bg-slate-100/70 ring-2 ring-slate-600/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white',
                  )}
                >
                  <Star
                    className={cn(
                      'w-5 h-5 mt-0.5 shrink-0',
                      padraoProjeto === 'comercial'
                        ? 'text-slate-700 fill-slate-600'
                        : 'text-slate-300',
                    )}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900">Padrão (Comercial)</div>
                    <div className="text-[11px] text-slate-500 leading-snug">
                      Materiais e acabamentos de mercado, custo otimizado.
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPadraoProjeto('premium')}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-xl border text-left transition-all',
                    padraoProjeto === 'premium'
                      ? 'border-slate-600 bg-slate-100/70 ring-2 ring-slate-600/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white',
                  )}
                >
                  <div className="flex mt-0.5 shrink-0">
                    <Star
                      className={cn(
                        'w-5 h-5',
                        padraoProjeto === 'premium'
                          ? 'text-slate-700 fill-slate-600'
                          : 'text-slate-300',
                      )}
                    />
                    <Star
                      className={cn(
                        'w-5 h-5 -ml-1',
                        padraoProjeto === 'premium'
                          ? 'text-slate-700 fill-slate-600'
                          : 'text-slate-300',
                      )}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900">Premium (Alto Padrão)</div>
                    <div className="text-[11px] text-slate-500 leading-snug">
                      Acabamentos nobres, ferragens e detalhamento superior.
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* MDF Externo */}
            <div className="space-y-2 p-3 rounded-xl bg-slate-50/60 border border-slate-100">
              <div className="flex items-center gap-1.5">
                <Box className="w-4 h-4 text-slate-700" />
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  MDF Externo
                </Label>
                <span className="text-[11px] text-slate-400 font-normal">
                  Frentes / caixaria vista
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Material / Cor</span>
                  <Select
                    value={mdfExterno.cor}
                    onValueChange={(v) => {
                      const mat = opcoesMdfEstrutural.find((item) => item.nome_material === v)
                      const espessura: 15 | 18 = mat?.categoria === 'MDF 15mm' ? 15 : 18
                      setMdfExterno({ cor: v, espessura })
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-lg text-sm bg-white border-slate-300">
                      <SelectValue placeholder="Selecione o MDF externo" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {opcoesMdfEstrutural.length === 0 ? (
                        <SelectItem value="Branco TX">Branco TX</SelectItem>
                      ) : (
                        opcoesMdfEstrutural.map((mat) => (
                          <SelectItem key={mat.id} value={mat.nome_material}>
                            {mat.nome_material}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Espessura</span>
                  <ToggleGroup
                    type="single"
                    value={String(mdfExterno.espessura)}
                    onValueChange={(v) =>
                      v && setMdfExterno((prev) => ({ ...prev, espessura: Number(v) as 15 | 18 }))
                    }
                    className="justify-start bg-white border border-slate-300 rounded-lg p-1 h-10 w-full"
                  >
                    <ToggleGroupItem
                      value="15"
                      className="flex-1 h-8 text-xs font-semibold data-[state=on]:bg-slate-700 data-[state=on]:text-white rounded-md"
                    >
                      15 mm
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="18"
                      className="flex-1 h-8 text-xs font-semibold data-[state=on]:bg-slate-700 data-[state=on]:text-white rounded-md"
                    >
                      18 mm
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
            </div>

            {/* MDF Interno */}
            <div className="space-y-2 p-3 rounded-xl bg-slate-50/60 border border-slate-100">
              <div className="flex items-center gap-1.5">
                <Layers3 className="w-4 h-4 text-slate-700" />
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  MDF Interno
                </Label>
                <span className="text-[11px] text-slate-400 font-normal">
                  Prateleiras / divisórias / gavetas
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Material / Cor</span>
                  <Select
                    value={mdfInterno.cor}
                    onValueChange={(v) => {
                      const mat = opcoesMdfEstrutural.find((item) => item.nome_material === v)
                      const espessura: 15 | 18 = mat?.categoria === 'MDF 18mm' ? 18 : 15
                      setMdfInterno({ cor: v, espessura })
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-lg text-sm bg-white border-slate-300">
                      <SelectValue placeholder="Selecione o MDF interno" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {opcoesMdfEstrutural.length === 0 ? (
                        <SelectItem value="Branco TX">Branco TX</SelectItem>
                      ) : (
                        opcoesMdfEstrutural.map((mat) => (
                          <SelectItem key={mat.id} value={mat.nome_material}>
                            {mat.nome_material}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Espessura</span>
                  <ToggleGroup
                    type="single"
                    value={String(mdfInterno.espessura)}
                    onValueChange={(v) =>
                      v && setMdfInterno((prev) => ({ ...prev, espessura: Number(v) as 15 | 18 }))
                    }
                    className="justify-start bg-white border border-slate-300 rounded-lg p-1 h-10 w-full"
                  >
                    <ToggleGroupItem
                      value="15"
                      className="flex-1 h-8 text-xs font-semibold data-[state=on]:bg-slate-700 data-[state=on]:text-white rounded-md"
                    >
                      15 mm
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="18"
                      className="flex-1 h-8 text-xs font-semibold data-[state=on]:bg-slate-700 data-[state=on]:text-white rounded-md"
                    >
                      18 mm
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
            </div>

            {/* MDF Fundo */}
            <div className="space-y-2 p-3 rounded-xl bg-slate-50/60 border border-slate-100">
              <div className="flex items-center gap-1.5">
                <Package className="w-4 h-4 text-slate-700" />
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  MDF Fundo
                </Label>
                <span className="text-[11px] text-slate-400 font-normal">
                  Espessura / cor do fundo
                </span>
              </div>
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-500">Opção</span>
                <Select value={mdfFundo} onValueChange={setMdfFundo}>
                  <SelectTrigger className="h-10 rounded-lg text-sm bg-white border-slate-300">
                    <SelectValue placeholder="Selecione o MDF de fundo" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {opcoesMdfFundo.length === 0 ? (
                      <SelectItem value="MDF 6mm Branco TX">MDF 6mm Branco TX</SelectItem>
                    ) : (
                      opcoesMdfFundo.map((mat) => (
                        <SelectItem key={mat.id} value={mat.nome_material}>
                          {mat.nome_material}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* 4. BOTÃO DE AÇÃO PRINCIPAL */}
      <div className="flex flex-col items-center justify-center pt-2 pb-4">
        <Button
          type="button"
          size="lg"
          onClick={handleGenerateBudget}
          disabled={isGenerating}
          className="w-full max-w-md h-14 bg-slate-700 hover:bg-slate-800 active:scale-[0.98] text-white font-bold text-base rounded-2xl shadow-lg shadow-slate-700/25 transition-all flex items-center justify-center gap-2.5 group"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Processando Parâmetros e Peças...</span>
            </>
          ) : (
            <>
              <span className="text-xl group-hover:rotate-45 transition-transform duration-300">
                ⚙️
              </span>
              <span>Gerar Orçamento do Módulo</span>
            </>
          )}
        </Button>
        <p className="text-xs text-slate-400 mt-2 text-center">
          Calcula automaticamente caixaria, frentes, puxadores e margem comercial
        </p>
      </div>
      {/* 5. RESULTADOS: TABELA DE PRECIFICAÇÃO DINÂMICA */}
      {showResults && (
        <section
          ref={resultsRef}
          aria-labelledby="resultados-heading"
          className="space-y-4 pt-4 animate-slide-up"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-slate-700 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                3
              </div>
              <h3 id="resultados-heading" className="text-lg sm:text-xl font-bold text-slate-900">
                Peças e Precificação do Módulo
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              Módulo: <strong className="text-slate-800">{currentModuleName}</strong> ({room})
            </span>
          </div>

          {dimensoesValidas ? (
            <PricingTable items={pricingItems} />
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <HelpCircle className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                Selecione um módulo e preencha as dimensões para gerar a precificação.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                A tabela de peças é calculada em tempo real a partir das medidas e materiais
                informados acima.
              </p>
            </div>
          )}

          {/* 🌟 BOTÕES DE ADIÇÃO MANUAL DE ITENS */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCatalogModalOpen(true)}
              className="flex-1 h-11 border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-800 font-semibold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2"
            >
              <Package className="w-4 h-4 text-slate-700" />+ Adicionar do Catálogo
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCustomItemModalOpen(true)}
              className="flex-1 h-11 border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-800 font-semibold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4 text-slate-700" />+ Item Avulso (Fora do Catálogo)
            </Button>
          </div>

          {/* Rodapé de Totais Consolidados — exibido quando há BOM válida */}
          {dimensoesValidas && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
                      Custo Consolidado
                    </p>
                    <p className="text-[11px] text-amber-700/70">Soma de todos os custos totais</p>
                  </div>
                </div>
                <p className="text-xl font-extrabold text-amber-800 font-mono">
                  {formatCurrency(totalCusto)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-300 bg-gradient-to-br from-slate-100 to-white p-5 shadow-sm flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-700 text-white flex items-center justify-center shadow-md shadow-slate-700/20">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-900 uppercase tracking-wider">
                      Valor Consolidado
                    </p>
                    <p className="text-[11px] text-slate-800/70">
                      Soma de todos os valores de venda
                    </p>
                  </div>
                </div>
                <p className="text-xl font-extrabold text-slate-800 font-mono">
                  {formatCurrency(totalVenda)}
                </p>
              </div>
            </div>
          )}

          {/* Card: Termos Comerciais */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2 pb-2">
              <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-800 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-bold text-slate-900">Termos Comerciais</h4>
                <p className="text-xs text-slate-500">
                  Condições de pagamento e observações contratuais para a proposta
                </p>
              </div>
            </div>

            {/* Campo 1: Forma de Pagamento */}
            <div className="space-y-2">
              <Label
                htmlFor="forma-pagamento"
                className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
              >
                <CreditCard className="w-3.5 h-3.5 text-slate-700" />
                Forma de Pagamento
              </Label>
              <Input
                id="forma-pagamento"
                placeholder="Ex.: 30% de entrada + 4x no cartão"
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
                className="h-11 rounded-xl text-sm border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20"
              />
            </div>

            <Separator className="bg-slate-100" />

            {/* Campo 2: Observações / Termos */}
            <div className="space-y-2">
              <Label
                htmlFor="observacoes-termos"
                className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
              >
                <FileText className="w-3.5 h-3.5 text-slate-700" />
                Observações / Termos
              </Label>
              <Textarea
                id="observacoes-termos"
                placeholder="Ex.: Prazo de entrega: 30 dias. Frete incluso para Grande São Paulo. Garantia de 5 anos."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
                className="rounded-xl text-sm border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/20 resize-y min-h-[90px]"
              />
            </div>
          </div>
        </section>
      )}
      {/* 6. RODAPÉ DE AÇÕES FIXO (Sticky Bottom Bar) */}
      <aside
        aria-label="Ações do Orçamento"
        className="sticky bottom-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-xl"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Secondary Action Buttons (Left) */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={handleAddNewManualItem}
              className="w-full sm:w-auto text-xs font-semibold border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl h-10 shadow-2xs"
            >
              <Plus className="w-4 h-4 mr-1.5 text-slate-500" />+ Adicionar Item Manualmente
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleAddAnotherModule}
              className="w-full sm:w-auto text-xs font-semibold border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl h-10 shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-slate-500" />+ Adicionar Outro Módulo
            </Button>
          </div>

          {/* Primary Action Button (Right) */}
          <div className="w-full sm:w-auto">
            <Button
              type="button"
              onClick={handleFinalizeClick}
              className="w-full sm:w-auto h-11 px-6 bg-slate-700 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-md shadow-slate-700/25 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Finalizar Orçamento
            </Button>
          </div>
        </div>
      </aside>
      {/* Modais de Adição de Itens */}
      <AddFromCatalogModal
        isOpen={isCatalogModalOpen}
        onClose={() => setIsCatalogModalOpen(false)}
        catalogoMateriais={catalogoMateriais}
        markupEngenharia={markupEngenharia}
        onAddItem={(item) => {
          setManualItems((prev) => [...prev, item])
          toast({
            title: 'Item adicionado',
            description: `${item.description} foi incluído no orçamento.`,
          })
        }}
      />

      <AddCustomItemModal
        isOpen={isCustomItemModalOpen}
        onClose={() => setIsCustomItemModalOpen(false)}
        markupEngenharia={markupEngenharia}
        onAddItem={(item) => {
          setManualItems((prev) => [...prev, item])
          toast({
            title: 'Item avulso adicionado',
            description: `${item.description} foi incluído no orçamento.`,
          })
        }}
      />

      {/* Finalize Confirmation Modal */}
      <FinalizeQuoteModal
        isOpen={isFinalizeModalOpen}
        onClose={() => {
          setIsFinalizeModalOpen(false)
          if (isQuoteSaved) {
            navigate('/orcamentos')
          }
        }}
        onConfirm={handleConfirmFinalize}
        onDownloadProposta={handleDownloadProposta}
        onDownloadAnaliseCusto={handleDownloadAnaliseCusto}
        clientName={clientName}
        room={ambienteSelecionado || room}
        moduleName={currentModuleName}
        items={pricingItems}
        isSaved={isQuoteSaved}
        isSaving={isSavingQuote}
      />
    </div>
  )
}
