import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'

interface ModuloInfo {
  id: string
  nome_template: string
  categoria?: string | null
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

interface ModuloDetectado {
  codigo_modulo: string
  nome: string
  dimensao_estimada?: {
    largura: number
    altura: number
    profundidade: number
  }
  adaptacoes?: string
}

interface FerragemObrigatoria {
  catalogo_id: string
  descricao: string
  quantidade: number
  justificativa: string
}

interface AnaliseResponse {
  modulos_detectados: ModuloDetectado[]
  ferragens_obrigatorias: FerragemObrigatoria[]
  justificativa: string
  // Compatibilidade com versões antigas
  id_modulo_encontrado?: string
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

    if (!modulos || !Array.isArray(modulos) || modulos.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhum módulo disponível na biblioteca para comparação.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const catalogo = Array.isArray(catalogoMateriais) ? catalogoMateriais : []

    // Conjunto de IDs válidos para validação
    const idsModulosValidos = new Set(modulos.map((m) => m.id))
    const idsCatalogoValidos = new Set(catalogo.map((c) => c.id))

    // Constrói a lista de módulos como texto formatado para o prompt
    const listaModulosText = modulos
      .map((m) => {
        const tags = m.assinatura_visual?.join(', ') ?? ''
        const cat = m.categoria ? ` | Categoria: ${m.categoria}` : ''
        return `ID: ${m.id} | Nome: ${m.nome_template}${cat}${tags ? ` | Tags: ${tags}` : ''}`
      })
      .join('\n')

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

**Lista de módulos da biblioteca (use EXATAMENTE estes IDs):**
${listaModulosText}

**Catálogo de materiais e ferragens disponíveis:**
${listaCatalogoText}

**REGRAS RÍGIDAS DE ENGENHARIA:**
1. Para CADA módulo visível na imagem, retorne o ID correspondente da biblioteca.
2. Se o módulo tiver PORTAS DE CORRER: inclua OBRIGATORIAMENTE nas ferragens_obrigatorias: Kit Sistema de Correr + Trilho Superior + Trilho Inferior do catálogo. Procure por 'correr', 'trilho' ou 'deslizante' na lista do catálogo.
3. Se o módulo tiver GAVETAS: inclua OBRIGATORIAMENTE Corrediças (Telescópicas ou Invisíveis) + Puxadores. Multiplique pela quantidade de gavetas visíveis. Procure no catálogo por 'corrediça', 'telescópica', 'puxador'.
4. Se o módulo for AÉREO (suspenso na parede, sem base no chão): inclua OBRIGATORIAMENTE Suportes de Fixação/Buchas. Procure por 'suporte', 'fixação', 'bucha' ou 'mão francesa'.
5. Para ferragens, use EXATAMENTE o \`catalogo_id\` e \`descricao\` do material no catálogo fornecido. NÃO invente IDs nem descrições.
6. Estime as dimensões (em mm) de cada módulo com base na proporção visual e objetos de referência no ambiente.

Retorne EXATAMENTE o JSON no formato especificado, sem markdown, sem blocos de código:
{
  "modulos_detectados": [
    {
      "codigo_modulo": "ID_REAL_DA_LISTA",
      "nome": "Nome do módulo",
      "dimensao_estimada": { "largura": 1800, "altura": 2200, "profundidade": 600 },
      "adaptacoes": "Descrição de adaptações necessárias"
    }
  ],
  "ferragens_obrigatorias": [
    {
      "catalogo_id": "ID_REAL_DO_CATALOGO",
      "descricao": "Kit Corrediça Telescópica 450mm",
      "quantidade": 4,
      "justificativa": "4 gavetas detectadas no módulo"
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
        max_tokens: 1200,
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

    // Normalização e sanitização dos módulos detectados
    let modulosDetectados: ModuloDetectado[] = []
    if (Array.isArray(parsed?.modulos_detectados) && parsed.modulos_detectados.length > 0) {
      modulosDetectados = parsed.modulos_detectados.map((m: any) => {
        let codigo = String(m.codigo_modulo || m.id || '')
        let nome = String(m.nome || '')

        // Validação se o ID existe
        if (!idsModulosValidos.has(codigo)) {
          const correspondente = modulos.find(
            (mod) =>
              mod.nome_template.toLowerCase() === codigo.toLowerCase() ||
              mod.nome_template.toLowerCase() === nome.toLowerCase() ||
              mod.id.toLowerCase() === codigo.toLowerCase(),
          )
          if (correspondente) {
            codigo = correspondente.id
            if (!nome) nome = correspondente.nome_template
          } else {
            codigo = modulos[0].id
            if (!nome) nome = modulos[0].nome_template
          }
        }

        const moduloEncontrado = modulos.find((mod) => mod.id === codigo)
        if (!nome && moduloEncontrado) {
          nome = moduloEncontrado.nome_template
        }

        const largura = Number(m.dimensao_estimada?.largura) || 1800
        const altura = Number(m.dimensao_estimada?.altura) || 2200
        const profundidade = Number(m.dimensao_estimada?.profundidade) || 600

        return {
          codigo_modulo: codigo,
          nome: nome || 'Módulo Identificado',
          dimensao_estimada: { largura, altura, profundidade },
          adaptacoes: m.adaptacoes ? String(m.adaptacoes) : undefined,
        }
      })
    } else if (parsed?.id_modulo_encontrado) {
      // Compatibilidade se a IA responder formato antigo
      let codigo = String(parsed.id_modulo_encontrado)
      if (!idsModulosValidos.has(codigo)) {
        const correspondente = modulos.find(
          (mod) =>
            mod.nome_template.toLowerCase() === codigo.toLowerCase() ||
            mod.id.toLowerCase() === codigo.toLowerCase(),
        )
        codigo = correspondente ? correspondente.id : modulos[0].id
      }
      const modObj = modulos.find((m) => m.id === codigo)
      modulosDetectados = [
        {
          codigo_modulo: codigo,
          nome: modObj?.nome_template || 'Módulo Identificado',
          dimensao_estimada: { largura: 1800, altura: 2200, profundidade: 600 },
        },
      ]
    } else {
      // Fallback para o primeiro módulo
      modulosDetectados = [
        {
          codigo_modulo: modulos[0].id,
          nome: modulos[0].nome_template,
          dimensao_estimada: { largura: 1800, altura: 2200, profundidade: 600 },
        },
      ]
    }

    // Normalização das ferragens obrigatórias
    let ferragensObrigatorias: FerragemObrigatoria[] = []
    if (Array.isArray(parsed?.ferragens_obrigatorias)) {
      ferragensObrigatorias = parsed.ferragens_obrigatorias
        .map((f: any) => {
          let catalogoId = String(f.catalogo_id || f.id || '')
          let desc = String(f.descricao || f.nome || '')

          // Tenta validar no catálogo se houver itens
          if (catalogo.length > 0) {
            if (!idsCatalogoValidos.has(catalogoId)) {
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
              }
            } else {
              const correspondente = catalogo.find((c) => c.id === catalogoId)
              if (correspondente && !desc) {
                desc = correspondente.descricao || correspondente.nome_material || 'Ferragem'
              }
            }
          }

          const quantidade = Math.max(1, Number(f.quantidade) || 1)
          const justificativa = String(f.justificativa || 'Requisito técnico identificado pela IA')

          return {
            catalogo_id: catalogoId,
            descricao: desc || 'Ferragem Obrigatória',
            quantidade,
            justificativa,
          }
        })
        .filter((f: FerragemObrigatoria) => f.catalogo_id || f.descricao)
    }

    const justificativa: string =
      parsed?.justificativa ?? 'Análise do ambiente realizada com sucesso.'

    const responsePayload: AnaliseResponse = {
      modulos_detectados: modulosDetectados,
      ferragens_obrigatorias: ferragensObrigatorias,
      justificativa,
      id_modulo_encontrado: modulosDetectados[0]?.codigo_modulo || modulos[0].id,
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
