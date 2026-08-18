import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { imagemBase64, modulos } = await req.json()
    const apiKey = Deno.env.get('OPENAI_API_KEY')

    const listaModulos = modulos
      .map(
        (m: any) =>
          `ID: ${m.id} | Nome: ${m.nome_template} | Tags: ${JSON.stringify(m.assinatura_visual)}`,
      )
      .join('\n')

    const promptSistema = `Você é um especialista em móveis sob medida. Analise a foto anexada e encontre o 'match' exato na nossa biblioteca de módulos.
    Módulos disponíveis:
    ${listaModulos}
    
    Retorne EXATAMENTE um objeto JSON válido (sem marcação markdown) no formato:
    { "id_modulo_encontrado": "ID_AQUI", "justificativa": "Breve explicação do porquê" }`

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: promptSistema },
              { type: 'image_url', image_url: { url: `${imagemBase64}` } },
            ],
          },
        ],
        max_tokens: 300,
      }),
    })

    const data = await openAIResponse.json()
    const conteudoMascara = data.choices[0].message.content
    const jsonPuro = conteudoMascara
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim()
    const resultado = JSON.parse(jsonPuro)

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
