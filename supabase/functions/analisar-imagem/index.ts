import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'

interface ModuloInfo {
  id: string
  nome_template: string
  assinatura_visual?: string[]
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

    const { imagemBase64, modulos } = (await req.json()) as {
      imagemBase64?: string
      modulos?: ModuloInfo[]
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

    // Conjunto de IDs válidos para validação
    const idsValidos = new Set(modulos.map((m) => m.id))

    // Constrói a lista de módulos como texto formatado para o prompt
    const listaModulosText = modulos
      .map((m) => {
        const tags = m.assinatura_visual?.join(', ') ?? ''
        return `ID: ${m.id} | Nome: ${m.nome_template}${tags ? ` | Tags: ${tags}` : ''}`
      })
      .join('\n')

    const systemPrompt = `Você é um especialista em móveis sob medida e marcenaria.
Analise a imagem anexada enviada pelo usuário e encontre o 'match' na biblioteca de módulos do sistema.

A lista de módulos disponíveis é EXCLUSIVAMENTE a seguinte:
${listaModulosText}

REGRAS OBRIGATÓRIAS:
1. Você deve usar EXCLUSIVAMENTE os IDs e nomes da lista de módulos fornecida acima.
2. Você deve escolher OBRIGATORIAMENTE um dos módulos da lista fornecida. Não invente IDs.
3. Se nenhum módulo combinar com a imagem, retorne o primeiro da lista como fallback e explique na justificativa que é uma estimativa.
4. O campo 'id_modulo_encontrado' deve ser um id real da lista, exatamente como escrito acima.

Retorne EXATAMENTE um objeto JSON válido no formato:
{ "id_modulo_encontrado": "ID_REAL_DA_LISTA", "justificativa": "Breve explicação do porquê este módulo corresponde à imagem (ou que é uma estimativa se não houver match direto)" }

Não inclua markdown, blocos de código (\`\`\`json) ou qualquer texto fora do JSON.`

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
                text: 'Analise esta imagem de um projeto de marcenaria e identifique qual módulo da biblioteca corresponde a ela.',
              },
              {
                type: 'image_url',
                image_url: { url: imagemBase64 },
              },
            ],
          },
        ],
        max_tokens: 300,
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
    let id_modulo_encontrado: string = parsed?.id_modulo_encontrado ?? ''

    // Garante que o ID retornado existe de fato na lista de módulos recebida
    if (!id_modulo_encontrado || !idsValidos.has(id_modulo_encontrado)) {
      // Tenta recuperar se a IA retornou pelo nome do template
      const correspondentePorNome = modulos.find(
        (m) =>
          m.nome_template.toLowerCase() === id_modulo_encontrado.toLowerCase() ||
          m.id.toLowerCase() === id_modulo_encontrado.toLowerCase(),
      )
      id_modulo_encontrado = correspondentePorNome ? correspondentePorNome.id : modulos[0].id
    }

    const justificativa: string =
      parsed?.justificativa ?? 'Match identificado pela análise visual da IA.'

    return new Response(JSON.stringify({ id_modulo_encontrado, justificativa }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Erro interno ao processar imagem.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
