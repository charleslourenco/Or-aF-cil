import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'

interface ModuloInfo {
  id: string
  nome_template: string
  categoria?: string | null
  dimensoes?: string | null
  assinatura_visual?: string[] | null
  descricao?: string | null
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

interface ModuloDetectado {
  codigo_modulo: string
  nome: string
  e_customizado?: boolean
  dimensao_estimada?: Dimensoes3D
  dimensoes_originais?: Dimensoes3D
  fator_escala?: number
  adaptacoes?: string
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

    const { imagemBase64, modulos, catalogoMateriais } = (await req.json()) as {
      imagemBase64?: string
      modulos?: ModuloInfo[]
      catalogoMateriais?: CatalogoMaterialInfo[]
    }

    if (!imagemBase64) {
      return new Response(JSON.stringify({ error: 'Parâmetro imagemBase64 é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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
              return `ID: ${m.id} | Nome: ${m.nome_template}${cat}${dim}${tags ? ` | Tags: ${tags}` : ''}`
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

    const systemPrompt = `Você é um engenheiro de marcenaria especializado em móveis sob medida. Analise a foto do AMBIENTE INTEIRO e identifique TODOS os módulos de marcenaria visíveis na imagem.

**Lista de módulos da biblioteca:**
${listaModulosText}

**Catálogo de materiais e ferragens disponíveis:**
${listaCatalogoText}

**REGRAS RÍGIDAS DE ENGENHARIA:**
1. CORRESPONDÊNCIA DE MÓDULOS:
   - Se o móvel identificado na imagem tiver correspondência técnica e visual com algum módulo da biblioteca acima, use EXATAMENTE o "ID" daquele módulo em "codigo_modulo" e o nome do módulo em "nome".
   - Se o móvel identificado NÃO possuir correspondente idêntico ou muito próximo na biblioteca, retorne OBRIGATORIAMENTE:
     "codigo_modulo": "MODULO-CUSTOM",
     "nome": "Módulo Personalizado (Análise IA)",
     "e_customizado": true
   - NUNCA invente IDs aleatórios e NUNCA force o primeiro módulo da lista se não houver correspondência exata/adequada.

2. FERRAGENS E INSUMOS OBRIGATÓRIOS:
   - Se o módulo tiver PORTAS DE CORRER: inclua OBRIGATORIAMENTE Kit Sistema de Correr + Trilho Superior + Trilho Inferior.
   - Se o módulo tiver GAVETAS: inclua OBRIGATORIAMENTE Corrediças (Telescópicas ou Invisíveis) + Puxadores (multiplicados pela quantidade de gavetas).
   - Se o módulo for AÉREO / SUSPENSO: inclua OBRIGATORIAMENTE Suportes de Fixação / Buchas.
   - TRATAMENTO DE CATÁLOGO:
     * Se o item/ferragem EXISTIR no Catálogo fornecido, retorne "catalogo_id" com o ID real do catálogo e a "descricao" correspondente.
     * Se o item/ferragem NÃO EXISTIR no Catálogo fornecido, retorne "catalogo_id": null, "item_nao_cadastrado": true, "preco_custo_estimado": 50.00, e a "descricao" clara do item ausente.

3. DIMENSÕES ESTIMADAS:
   - Estime as dimensões (largura, altura, profundidade em mm) de cada módulo com base na proporção visual e objetos de referência no ambiente.

Retorne EXATAMENTE o JSON no formato abaixo, sem markdown, sem blocos de código:
{
  "modulos_detectados": [
    {
      "codigo_modulo": "ID_REAL_OU_MODULO-CUSTOM",
      "nome": "Nome do módulo",
      "e_customizado": false,
      "dimensao_estimada": { "largura": 1800, "altura": 2200, "profundidade": 600 },
      "adaptacoes": "Descrição de adaptações necessárias"
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
  "justificativa": "Resumo geral da análise do ambiente"
}`

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
            content: [
              {
                type: 'text',
                text: 'Analise este ambiente/projeto de marcenaria sob medida e identifique todos os módulos visíveis, dimensões estimadas e ferragens obrigatórias com base nas regras de engenharia.',
              },
              {
                type: 'image_url',
                image_url: { url: imagemBase64 },
              },
            ],
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

      return {
        codigo_modulo: codigo,
        nome,
        e_customizado: eCustomizado,
        dimensao_estimada: dimensaoEstimada,
        dimensoes_originais: dimensoesOriginais,
        fator_escala: fatorEscala,
        adaptacoes: m.adaptacoes ? String(m.adaptacoes) : undefined,
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
      // Fallback sem módulos identificados: cria módulo personalizado, NUNCA força o primeiro da biblioteca
      modulosDetectados = [
        {
          codigo_modulo: 'MODULO-CUSTOM',
          nome: 'Módulo Personalizado (Análise IA)',
          e_customizado: true,
          dimensao_estimada: { largura: 1800, altura: 2200, profundidade: 600 },
          fator_escala: 1.0,
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
