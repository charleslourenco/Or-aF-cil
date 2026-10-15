import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'

interface ModuloInfo {
  id: string
  nome_template: string
  categoria?: string | null
  dimensoes?: string | null
  assinatura_visual?: string[] | null
  descricao?: string | null
  perfil_construtivo?: string | null
}

interface CatalogoMaterialInfo {
  id: string
  descricao?: string
  nome_material?: string
  categoria: string
  preco_custo: number
  unidade: string
}

interface Dimensoes3D {
  largura: number
  altura: number
  profundidade: number
}

export type TipoPorta = 'abrir' | 'correr' | 'batente' | 'nenhum'

export interface DecomposicaoModulo {
  divisorias: {
    qtd: number
  }
  portas: {
    qtd: number
    tipo: TipoPorta
  }
  gavetas: {
    qtd: number
  }
  prateleiras: {
    qtd: number
  }
  cabideiro: boolean
  sapateira: boolean
  puxadores: number
}

export type PerfilConstrucaoSugerido =
  | 'Fechado Envelopado'
  | 'Balcão (tampo por conta do cliente)'
  | 'Aberto / Painel'
  | 'Caixa Simples'
  | 'Tampo sobre Estrutura'

interface ModuloDetectado {
  codigo_modulo: string
  nome: string
  e_customizado?: boolean
  confianca?: 'alta' | 'media' | 'baixa'
  perfil_construcao_sugerido?: PerfilConstrucaoSugerido
  dimensao_estimada?: Dimensoes3D
  dimensoes_originais?: Dimensoes3D
  fator_escala?: number
  adaptacoes?: string
  match_justificativa?: string
  tags_visuais_identificadas?: string[]
  forma_geometrica?: string
  divisorias?: {
    qtd: number
  }
  portas?: {
    qtd: number
    tipo: TipoPorta
  }
  gavetas?: {
    qtd: number
  }
  prateleiras?: {
    qtd: number
  }
  cabideiro?: boolean
  sapateira?: boolean
  puxadores?: number
}

interface FerragemObrigatoria {
  catalogo_id: string | null
  descricao: string
  quantidade: number
  justificativa: string
  item_nao_cadastrado?: boolean
  preco_custo_estimado?: number
}

interface AnaliseResponse {
  modulos_detectados: ModuloDetectado[]
  ferragens_obrigatorias: FerragemObrigatoria[]
  justificativa: string
  id_modulo_encontrado?: string | null
}

/**
 * Faz o parse de string de dimensões (ex: "2700x2710x650", "1800 x 2200 x 600", "1800×2200×600")
 */
function parseDimensoes(dimStr?: string | null): Dimensoes3D | null {
  if (!dimStr) return null
  const clean = dimStr.replace(/[^\d\sxX×]/g, ' ')
  const parts = clean
    .split(/[xX×\s]+/)
    .filter(Boolean)
    .map(Number)
  if (parts.length >= 3 && parts[0] > 0 && parts[1] > 0 && parts[2] > 0) {
    return {
      largura: parts[0],
      altura: parts[1],
      profundidade: parts[2],
    }
  }
  return null
}

Deno.serve(async (req: Request) => {
  // Trata requisição OPTIONS para CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY não está configurada no servidor.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { imagemBase64, imagensBase64, modulos, catalogoMateriais } = (await req.json()) as {
      imagemBase64?: string
      imagensBase64?: string[]
      modulos?: ModuloInfo[]
      catalogoMateriais?: CatalogoMaterialInfo[]
    }

    // Suporta tanto o array `imagensBase64` quanto o campo único `imagemBase64` (compatibilidade retroativa)
    const listaImagens: string[] = []
    if (Array.isArray(imagensBase64) && imagensBase64.length > 0) {
      for (const img of imagensBase64) {
        if (typeof img === 'string' && img.trim().length > 0) {
          listaImagens.push(img)
        }
      }
    }
    if (listaImagens.length === 0 && imagemBase64 && typeof imagemBase64 === 'string') {
      listaImagens.push(imagemBase64)
    }

    if (listaImagens.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Parâmetro imagemBase64 ou imagensBase64 é obrigatório.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const listaModulos = Array.isArray(modulos) ? modulos : []
    const catalogo = Array.isArray(catalogoMateriais) ? catalogoMateriais : []

    // Conjunto de IDs válidos para validação
    const idsModulosValidos = new Set(listaModulos.map((m) => m.id))
    const idsCatalogoValidos = new Set(catalogo.map((c) => c.id))

    // Constrói a lista de módulos como texto formatado para o prompt
    const listaModulosText =
      listaModulos.length > 0
        ? listaModulos
            .map((m) => {
              const tags = m.assinatura_visual?.join(', ') ?? ''
              const cat = m.categoria ? ` | Categoria: ${m.categoria}` : ''
              const dim = m.dimensoes ? ` | Dimensões padrão: ${m.dimensoes}` : ''
              const perf = m.perfil_construtivo ? ` | Perfil: ${m.perfil_construtivo}` : ''
              return `ID: ${m.id} | Nome: ${m.nome_template}${cat}${dim}${perf}${tags ? ` | Tags: ${tags}` : ''}`
            })
            .join('\n')
        : 'Nenhum módulo pré-cadastrado na biblioteca.'

    // Constrói a lista de catálogo de materiais/ferragens como texto formatado
    const listaCatalogoText =
      catalogo.length > 0
        ? catalogo
            .map((c) => {
              const desc = c.descricao || c.nome_material || 'Material'
              return `ID: ${c.id} | Descrição: ${desc} | Categoria: ${c.categoria} | Unidade: ${c.unidade} | Custo: R$ ${Number(c.preco_custo || 0).toFixed(2)}`
            })
            .join('\n')
        : 'Nenhum material cadastrado no catálogo.'

    const systemPrompt = `Você é um engenheiro de marcenaria especializado em móveis sob medida e visão computacional de mobiliário.
IMPORTANTE: A análise visual é realizada para UM MÓDULO POR VEZ (nunca um ambiente complexo inteiro). Compare a imagem do móvel/croqui fornecida com a biblioteca de módulos cadastrada.

**Lista de módulos da biblioteca:**
${listaModulosText}

**Catálogo de materiais e ferragens disponíveis:**
${listaCatalogoText}

**REGRAS RÍGIDAS DE ENGENHARIA E CORRESPONDÊNCIA GEOMÉTRICA (CRÍTICO):**

1. CORRESPONDÊNCIA GEOMÉTRICA FUNDAMENTAL (REGRA INEGOCIÁVEL):
   - O match com um módulo da biblioteca SÓ PODE ACONTECER se a FORMA GEOMÉTRICA FUNDAMENTAL da foto bater exatamente com a forma do módulo da biblioteca.
   - MÓVEIS RETOS / ORTOGONAIS NUNCA CASAM COM MÓVEIS CURVOS / ONDULADOS / ORGÂNICOS. Se a foto for de um móvel retilíneo (ex.: painel ripado reto, cabeceira reta, armário reto) e o módulo da biblioteca for curvo ou semi-curvo, O MATCH É PROIBIDO.
   - PAINÉIS VERTICAIS / CABECEIRAS RASAS NUNCA CASAM COM CAIXARIAS PROFUNDAS (armários, balcões, caixas de 500-600mm).
   - MÓVEIS SUSPENSOS/AÉREOS NÃO CASAM COM MÓVEIS DE CHÃO COM RODAPÉ/SAPATAS.
   - BALCÕES COM TAMPO NÃO CASAM COM TORRES OU ROUPEIROS ALTOS.
   - ILHA DE COZINHA / BANCADA CENTRAL / COOKTOP NUNCA CASA COM ROUPEIRO, ARMÁRIO ALTO OU MÓVEL DE CHÃO COM PORTAS ALTAS:
     * Toda ilha de cozinha, bancada central de cozinha ou balcão de cooktop deve ser classificada com perfil_construcao_sugerido 'Balcão (tampo por conta do cliente)' ou 'MODULO-CUSTOM' com esse perfil.
     * É TERMINANTEMENTE PROIBIDO associar uma ilha de cozinha a roupeiro, closet, armário de quarto ou armário alto.
   - Se a forma geométrica fundamental não for idêntica ou houver a MENOR dúvida sobre a compatibilidade formal, você DEVE OBRIGATORIAMENTE retornar "codigo_modulo": "MODULO-CUSTOM" e "confianca": "baixa".

2. CITAÇÃO OBRIGATÓRIA DE TAGS VISUAIS E JUSTIFICATIVA:
   - Para qualquer correspondência com a biblioteca (onde codigo_modulo != 'MODULO-CUSTOM'), você DEVE OBRIGATORIAMENTE preencher o campo "match_justificativa" citando explicitamente quais TAGS VISUAIS do módulo da biblioteca (campo Tags listado acima) justificam a correspondência e confirmam a compatibilidade geométrica.
   - Preencha também "tags_visuais_identificadas" como um array de strings com as tags que foram validadas na imagem.
   - Se o módulo da biblioteca não possuir tags que expliquem o móvel da foto, NÃO FAÇA O MATCH — retorne "MODULO-CUSTOM".

3. CASOS DE RETORNO MODULO-CUSTOM:
   - Se o móvel identificado NÃO possuir correspondente idêntico na biblioteca, OU
   - Se houver divergência geométrica (ex.: reto vs curvo, painel vs armário profundo), OU
   - Em caso de dúvida:
     Retorne OBRIGATORIAMENTE:
     "codigo_modulo": "MODULO-CUSTOM",
     "nome": "Módulo Personalizado (Análise IA)",
     "e_customizado": true,
     "confianca": "baixa",
     "match_justificativa": "Sem correspondente com geometria compatível na biblioteca; classificado como módulo sob medida personalizado."

4. NÍVEIS DE CONFIANÇA:
   - 'alta' = match direto na biblioteca com forma geométrica idêntica comprovada, tags visuais correspondentes e escala volumétrica compatível (0.7–1.4);
   - 'media' = match na biblioteca onde a forma geométrica é a mesma, mas com variações de divisões internas ou escala;
   - 'baixa' = MODULO-CUSTOM, imagem com baixa nitidez, dúvida nas divisões ou qualquer divergência formal.

5. PERFIL CONSTRUTIVO SUGERIDO:
   - "Fechado Envelopado": armários, roupeiros, guarda-roupas fechados com caixaria dupla/tamponamento.
   - "Balcão (tampo por conta do cliente)": ilha de cozinha, bancada central, balcão cooktop, balcões de pia, gabinetes inferiores de cozinha/banheiro onde o topo receberá tampo avulso (granito/madeira). NUNCA gere tampo automaticamente.
   - "Aberto / Painel": painéis de TV, painéis de cabeceira, racks abertos, estantes abertas, nichos sem tamponamento, sem base/teto internos nem rodateto.
   - "Caixa Simples": aéreos e caixas sem tamponamento externo.
   - "Tampo sobre Estrutura": mesas, escrivaninhas, aparadores e bancadas soltas: apenas um TAMPO de MDF apoiado em pés ou estrutura metálica. NÃO é caixaria nem balcão: não tem laterais, base, fundo nem travessas. Use este perfil sempre que o móvel for uma mesa.

6. DECOMPOSIÇÃO ESTRUTURADA DE COMPONENTES E INTERIOR VISÍVEL:
   - Analise minuciosamente a parte externa e o INTERIOR visível do móvel.
   - Preencha SEMPRE e OBRIGATORIAMENTE os seguintes campos para o módulo:
     * "divisorias": { "qtd": <número de divisórias verticais internas> }
     * "portas": { "qtd": <número total de portas>, "tipo": "abrir" | "correr" | "batente" | "nenhum" }
     * "gavetas": { "qtd": <número total de gavetas externas ou internas> }
     * "prateleiras": { "qtd": <número total de prateleiras internas ou divisões horizontais> }
     * "cabideiro": <true se houver varão/cabideiro para pendurar roupas, false se não houver>
     * "sapateira": <true se houver prateleiras aramadas/corrediças para sapatos, false se não houver>
     * "puxadores": <número estimado total de puxadores necessários para portas e gavetas>
   - Em "adaptacoes", descreva textualmente em português claro a composição do móvel.

7. FERRAGENS E INSUMOS OBRIGATÓRIOS:
   - Portas de correr: Kit Sistema de Correr + Trilho.
   - Gavetas: Corrediças + Puxadores.
   - Suspenso/Aéreo: Suportes de Fixação / Buchas.
   - Itens ausentes do catálogo: "catalogo_id": null, "item_nao_cadastrado": true, "preco_custo_estimado": 50.00.

Retorne EXATAMENTE o JSON no formato abaixo, sem markdown, sem blocos de código:
{
  "modulos_detectados": [
    {
      "codigo_modulo": "ID_REAL_OU_MODULO-CUSTOM",
      "nome": "Nome do módulo",
      "e_customizado": false,
      "confianca": "alta",
      "perfil_construcao_sugerido": "Fechado Envelopado",
      "dimensao_estimada": { "largura": 1800, "altura": 2200, "profundidade": 600 },
      "match_justificativa": "Forma ortogonal reta compatível; tags validadas: portas de abrir, gavetas inferiores, caixaria fechada",
      "tags_visuais_identificadas": ["portas de abrir", "gavetas", "reto"],
      "forma_geometrica": "ortogonal retilíneo",
      "divisorias": { "qtd": 1 },
      "portas": { "qtd": 2, "tipo": "abrir" },
      "gavetas": { "qtd": 4 },
      "prateleiras": { "qtd": 3 },
      "cabideiro": true,
      "sapateira": false,
      "puxadores": 6,
      "adaptacoes": "Guarda-roupa 2 portas de abrir, 1 divisória vertical (2 corpos), cabideiro interno e 4 gavetas"
    }
  ],
  "ferragens_obrigatorias": [
    {
      "catalogo_id": "ID_REAL_DO_CATALOGO_OU_NULL",
      "descricao": "Kit Corrediça Telescópica 450mm",
      "quantidade": 4,
      "justificativa": "4 gavetas detectadas no módulo",
      "item_nao_cadastrado": false,
      "preco_custo_estimado": 50.0
    }
  ],
  "justificativa": "Resumo da análise do móvel"
}`

    const userContent: Array<
      { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
    > = [
      {
        type: 'text',
        text:
          listaImagens.length > 1
            ? 'Analise este móvel/módulo sob medida individual (um módulo por vez). As imagens mostram o mesmo módulo sob ângulos/detalhes diferentes — use todas como referência. Compare com a biblioteca de módulos cadastrada, determine dimensões estimadas, perfil construtivo e decomposição interna.'
            : 'Analise este móvel/módulo sob medida individual (um módulo por vez). Compare com a biblioteca de módulos cadastrada, determine dimensões estimadas, perfil construtivo e decomposição interna.',
      },
      ...listaImagens.map((url) => ({
        type: 'image_url' as const,
        image_url: { url },
      })),
    ]

    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: userContent,
          },
        ],
        max_tokens: 1500,
        temperature: 0.1,
      }),
    })

    if (!openAiResponse.ok) {
      const errText = await openAiResponse.text().catch(() => '')
      return new Response(
        JSON.stringify({ error: `OpenAI respondeu ${openAiResponse.status}: ${errText}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const aiData = await openAiResponse.json()
    const rawContent: string = aiData?.choices?.[0]?.message?.content ?? ''

    // Extrai o JSON mesmo se vier com delimitadores de código markdown
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: 'Resposta da IA não continha um JSON válido.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Normalização e cálculo proporcional (fator de escala / deltas)
    let modulosDetectados: ModuloDetectado[] = []

    const processarModulo = (m: any): ModuloDetectado => {
      let codigo = String(m.codigo_modulo || m.id || '').trim()
      let nome = String(m.nome || '').trim()
      let eCustomizado = Boolean(m.e_customizado || codigo === 'MODULO-CUSTOM')

      let moduloCorrespondente: ModuloInfo | undefined

      if (codigo && codigo !== 'MODULO-CUSTOM') {
        if (idsModulosValidos.has(codigo)) {
          moduloCorrespondente = listaModulos.find((mod) => mod.id === codigo)
        } else {
          // Tenta encontrar por correspondência de nome ou id aproximado
          moduloCorrespondente = listaModulos.find(
            (mod) =>
              mod.nome_template.toLowerCase() === codigo.toLowerCase() ||
              mod.nome_template.toLowerCase() === nome.toLowerCase() ||
              mod.id.toLowerCase() === codigo.toLowerCase(),
          )
        }
      }

      if (moduloCorrespondente) {
        codigo = moduloCorrespondente.id
        if (!nome) nome = moduloCorrespondente.nome_template
        eCustomizado = false
      } else {
        // NÃO houve match exato/válido na biblioteca: NUNCA force o primeiro módulo como fallback
        codigo = 'MODULO-CUSTOM'
        nome = nome && nome !== 'Módulo Identificado' ? nome : 'Módulo Personalizado (Análise IA)'
        eCustomizado = true
      }

      const larguraEst = Number(m.dimensao_estimada?.largura) || 1800
      const alturaEst = Number(m.dimensao_estimada?.altura) || 2200
      const profEst = Number(m.dimensao_estimada?.profundidade) || 600

      const dimensaoEstimada: Dimensoes3D = {
        largura: larguraEst,
        altura: alturaEst,
        profundidade: profEst,
      }

      let dimensoesOriginais: Dimensoes3D | undefined
      let fatorEscala = 1.0

      if (moduloCorrespondente?.dimensoes) {
        const parsedOrig = parseDimensoes(moduloCorrespondente.dimensoes)
        if (parsedOrig) {
          dimensoesOriginais = parsedOrig
          const volPadrao = parsedOrig.largura * parsedOrig.altura * parsedOrig.profundidade
          const volEstimado = larguraEst * alturaEst * profEst
          if (volPadrao > 0) {
            fatorEscala = Math.round((volEstimado / volPadrao) * 1000) / 1000
          }
        }
      }

      // Processamento e normalização da decomposição estruturada
      const portasRaw = m.portas || {}
      let tipoPorta: TipoPorta = 'abrir'
      const tipoLower = String(portasRaw.tipo || '').toLowerCase()
      if (['correr', 'abrir', 'batente', 'nenhum'].includes(tipoLower)) {
        tipoPorta = tipoLower as TipoPorta
      } else if (tipoLower.includes('corr')) {
        tipoPorta = 'correr'
      } else if (tipoLower.includes('bat')) {
        tipoPorta = 'batente'
      } else if (tipoLower.includes('sem') || tipoLower === 'none') {
        tipoPorta = 'nenhum'
      }

      const qtdDivisorias = Math.max(0, Number(m.divisorias?.qtd ?? m.qtd_divisorias) || 0)
      const qtdPortas = Math.max(0, Number(portasRaw.qtd ?? m.qtd_portas) || 0)
      const qtdGavetas = Math.max(0, Number(m.gavetas?.qtd ?? m.qtd_gavetas) || 0)
      const qtdPrateleiras = Math.max(0, Number(m.prateleiras?.qtd ?? m.qtd_prateleiras) || 0)
      const cabideiro = Boolean(m.cabideiro)
      const sapateira = Boolean(m.sapateira)
      const puxadores = Math.max(0, Number(m.puxadores ?? qtdPortas + qtdGavetas) || 0)

      // Determinação da confiança da IA
      let confianca: 'alta' | 'media' | 'baixa' = 'baixa'
      const confiancaRaw = String(m.confianca || '')
        .toLowerCase()
        .trim()
      if (confiancaRaw === 'alta' || confiancaRaw === 'media' || confiancaRaw === 'baixa') {
        confianca = confiancaRaw as 'alta' | 'media' | 'baixa'
      } else {
        if (eCustomizado || codigo === 'MODULO-CUSTOM') {
          confianca = 'baixa'
        } else if (fatorEscala < 0.7 || fatorEscala > 1.4) {
          confianca = 'media'
        } else {
          confianca = 'alta'
        }
      }

      // Se virou MODULO-CUSTOM por falta de correspondente ou forma não-batendo, confiança é baixa
      if (eCustomizado || codigo === 'MODULO-CUSTOM') {
        confianca = 'baixa'
      }

      // Dedução e validação do perfil sugerido
      const textoDescricao =
        `${nome} ${String(m.descricao || '')} ${String(m.adaptacoes || '')}`.toLowerCase()
      const deduzirPerfilPorTexto = (txt: string): PerfilConstrucaoSugerido => {
        if (
          txt.includes('ilha') ||
          txt.includes('bancada') ||
          txt.includes('balcão') ||
          txt.includes('balcao') ||
          txt.includes('cooktop') ||
          txt.includes('pia') ||
          txt.includes('gabinete')
        ) {
          return 'Balcão (tampo por conta do cliente)'
        }
        if (
          txt.includes('painel') ||
          txt.includes('tv') ||
          txt.includes('rack') ||
          txt.includes('estante') ||
          txt.includes('nicho') ||
          txt.includes('cabeceira')
        ) {
          return 'Aberto / Painel'
        }
        if (txt.includes('aereo') || txt.includes('aéreo') || txt.includes('suspenso')) {
          return 'Caixa Simples'
        }
        if (txt.includes('mesa') || txt.includes('escrivaninha') || txt.includes('aparador')) {
          return 'Tampo sobre Estrutura'
        }
        return 'Fechado Envelopado'
      }

      let perfilSugerido: PerfilConstrucaoSugerido = 'Fechado Envelopado'
      const perfilRaw = String(m.perfil_construcao_sugerido || '').trim()

      // Regra de segurança: se o nome ou descrição indicar ilha/bancada/cooktop, nunca permitir roupeiro / fechado envelopado
      const ehIlhaOuBalcao =
        textoDescricao.includes('ilha') ||
        textoDescricao.includes('cooktop') ||
        textoDescricao.includes('bancada') ||
        textoDescricao.includes('balcão') ||
        textoDescricao.includes('balcao')

      const ehMesa = /\b(mesa|escrivaninha|aparador)\b/.test(textoDescricao) && !ehIlhaOuBalcao

      if (ehMesa) {
        perfilSugerido = 'Tampo sobre Estrutura'
      } else if (ehIlhaOuBalcao) {
        perfilSugerido = 'Balcão (tampo por conta do cliente)'
      } else if (
        perfilRaw === 'Fechado Envelopado' ||
        perfilRaw === 'Balcão (tampo por conta do cliente)' ||
        perfilRaw === 'Aberto / Painel' ||
        perfilRaw === 'Caixa Simples' ||
        perfilRaw === 'Tampo sobre Estrutura'
      ) {
        perfilSugerido = perfilRaw as PerfilConstrucaoSugerido
      } else {
        perfilSugerido = deduzirPerfilPorTexto(textoDescricao)
      }

      const matchJustificativa = m.match_justificativa ? String(m.match_justificativa) : undefined
      const tagsVisuaisIdentificadas = Array.isArray(m.tags_visuais_identificadas)
        ? m.tags_visuais_identificadas.map(String)
        : undefined
      const formaGeometrica = m.forma_geometrica ? String(m.forma_geometrica) : undefined

      return {
        codigo_modulo: codigo,
        nome,
        e_customizado: eCustomizado,
        confianca,
        perfil_construcao_sugerido: perfilSugerido,
        dimensao_estimada: dimensaoEstimada,
        dimensoes_originais: dimensoesOriginais,
        fator_escala: fatorEscala,
        adaptacoes: m.adaptacoes ? String(m.adaptacoes) : undefined,
        match_justificativa: matchJustificativa,
        tags_visuais_identificadas: tagsVisuaisIdentificadas,
        forma_geometrica: formaGeometrica,
        divisorias: {
          qtd: qtdDivisorias,
        },
        portas: {
          qtd: qtdPortas,
          tipo: qtdPortas === 0 ? 'nenhum' : tipoPorta,
        },
        gavetas: {
          qtd: qtdGavetas,
        },
        prateleiras: {
          qtd: qtdPrateleiras,
        },
        cabideiro,
        sapateira,
        puxadores,
      }
    }

    if (Array.isArray(parsed?.modulos_detectados) && parsed.modulos_detectados.length > 0) {
      modulosDetectados = parsed.modulos_detectados.map(processarModulo)
    } else if (parsed?.id_modulo_encontrado) {
      modulosDetectados = [
        processarModulo({
          codigo_modulo: parsed.id_modulo_encontrado,
          nome: parsed.nome_modulo || '',
          dimensao_estimada: { largura: 1800, altura: 2200, profundidade: 600 },
        }),
      ]
    } else {
      // Fallback sem módulos identificados: cria módulo personalizado, deduzindo o perfil do nome/descrição
      const nomeFallback = String(
        parsed?.nome_modulo || parsed?.nome || 'Módulo Personalizado (Análise IA)',
      ).trim()
      const descFallback = String(parsed?.justificativa || parsed?.descricao || '').toLowerCase()
      const textoFallback = `${nomeFallback} ${descFallback}`.toLowerCase()

      let perfilFallback: PerfilConstrucaoSugerido = 'Fechado Envelopado'
      if (/\b(mesa|escrivaninha|aparador)\b/.test(textoFallback)) {
        perfilFallback = 'Tampo sobre Estrutura'
      } else if (
        textoFallback.includes('ilha') ||
        textoFallback.includes('bancada') ||
        textoFallback.includes('balcão') ||
        textoFallback.includes('balcao') ||
        textoFallback.includes('cooktop') ||
        textoFallback.includes('pia') ||
        textoFallback.includes('gabinete')
      ) {
        perfilFallback = 'Balcão (tampo por conta do cliente)'
      } else if (
        textoFallback.includes('painel') ||
        textoFallback.includes('tv') ||
        textoFallback.includes('rack') ||
        textoFallback.includes('estante') ||
        textoFallback.includes('nicho') ||
        textoFallback.includes('cabeceira')
      ) {
        perfilFallback = 'Aberto / Painel'
      } else if (
        textoFallback.includes('aereo') ||
        textoFallback.includes('aéreo') ||
        textoFallback.includes('suspenso')
      ) {
        perfilFallback = 'Caixa Simples'
      }

      modulosDetectados = [
        {
          codigo_modulo: 'MODULO-CUSTOM',
          nome: nomeFallback,
          e_customizado: true,
          confianca: 'baixa',
          perfil_construcao_sugerido: perfilFallback,
          dimensao_estimada: {
            largura: perfilFallback === 'Balcão (tampo por conta do cliente)' ? 1200 : 1800,
            altura: perfilFallback === 'Balcão (tampo por conta do cliente)' ? 850 : 2200,
            profundidade: perfilFallback === 'Balcão (tampo por conta do cliente)' ? 600 : 600,
          },
          fator_escala: 1.0,
          divisorias: { qtd: 0 },
          portas: { qtd: 0, tipo: 'nenhum' },
          gavetas: { qtd: 0 },
          prateleiras: { qtd: 2 },
          cabideiro: false,
          sapateira: false,
          puxadores: 0,
        },
      ]
    }

    // Normalização das ferragens obrigatórias e tratamento de itens não cadastrados no catálogo
    let ferragensObrigatorias: FerragemObrigatoria[] = []
    if (Array.isArray(parsed?.ferragens_obrigatorias)) {
      ferragensObrigatorias = parsed.ferragens_obrigatorias
        .map((f: any) => {
          let catalogoId = f.catalogo_id ? String(f.catalogo_id).trim() : null
          if (
            catalogoId === 'null' ||
            catalogoId === 'NULL' ||
            catalogoId === 'ID_REAL_DO_CATALOGO_OU_NULL' ||
            catalogoId === ''
          ) {
            catalogoId = null
          }
          let desc = String(f.descricao || f.nome || '').trim()
          let itemNaoCadastrado = Boolean(f.item_nao_cadastrado) || catalogoId === null
          let precoCustoEstimado = Number(f.preco_custo_estimado) || 50.0

          // Tenta validar no catálogo se houver itens
          if (catalogo.length > 0) {
            if (catalogoId && idsCatalogoValidos.has(catalogoId)) {
              const correspondente = catalogo.find((c) => c.id === catalogoId)
              if (correspondente) {
                desc = correspondente.descricao || correspondente.nome_material || desc
                itemNaoCadastrado = false
                precoCustoEstimado = Number(correspondente.preco_custo) || 0
              }
            } else {
              // Tenta achar por descrição aproximada
              const correspondente = catalogo.find(
                (c) =>
                  (c.descricao && c.descricao.toLowerCase() === desc.toLowerCase()) ||
                  (c.nome_material && c.nome_material.toLowerCase() === desc.toLowerCase()) ||
                  c.id === catalogoId,
              )
              if (correspondente) {
                catalogoId = correspondente.id
                desc = correspondente.descricao || correspondente.nome_material || desc
                itemNaoCadastrado = false
                precoCustoEstimado = Number(correspondente.preco_custo) || 0
              } else {
                catalogoId = null
                itemNaoCadastrado = true
                if (!precoCustoEstimado || precoCustoEstimado <= 0) {
                  precoCustoEstimado = 50.0
                }
              }
            }
          } else {
            catalogoId = null
            itemNaoCadastrado = true
            precoCustoEstimado = 50.0
          }

          const quantidade = Math.max(1, Number(f.quantidade) || 1)
          const justificativa = String(f.justificativa || 'Requisito técnico identificado pela IA')

          return {
            catalogo_id: catalogoId,
            descricao: desc || 'Ferragem Obrigatória',
            quantidade,
            justificativa,
            item_nao_cadastrado: itemNaoCadastrado,
            preco_custo_estimado: precoCustoEstimado,
          }
        })
        .filter((f: FerragemObrigatoria) => f.descricao)
    }

    const justificativa: string =
      parsed?.justificativa ?? 'Análise do ambiente realizada com sucesso.'

    const primeiroId = modulosDetectados[0]?.codigo_modulo
    const idModuloEncontrado = primeiroId === 'MODULO-CUSTOM' ? null : primeiroId

    const responsePayload: AnaliseResponse = {
      modulos_detectados: modulosDetectados,
      ferragens_obrigatorias: ferragensObrigatorias,
      justificativa,
      id_modulo_encontrado: idModuloEncontrado,
    }

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Erro interno ao processar imagem.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
