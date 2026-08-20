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
    const body = await req.json()
    let imagemBase64 = body.imagemBase64 || body.pdfBase64 || body.image || body.base64
    if (!imagemBase64) {
      throw new Error('Nenhuma imagem ou PDF enviado no corpo da requisição.')
    }
    // Remove prefixo data URL se houver (ex: data:image/png;base64,...)
    if (imagemBase64.includes(',')) {
      imagemBase64 = imagemBase64.split(',')[1]
    }
    const apiKey = Deno.env.get('OPENAI_API_KEY')

    const promptSistema = `Você é um engenheiro especialista em marcenaria industrial. Analise a ficha técnica/PDF do módulo e extraia todas as informações no formato JSON estrito.
    
    Retorne EXATAMENTE um objeto JSON válido (sem markdown, sem \`\`\`json) no seguinte formato:
    {
      "codigo_modulo": "CÓDIGO (ex: BAL0305A)",
      "nome_template": "NOME DO MÓDULO (ex: Balcão 2 Portas)",
      "categoria": "Cozinha | Quarto | Sala | Banheiro",
      "largura_padrao": 600,
      "altura_padrao": 760,
      "profundidade_padrao": 550,
      "composicao_mdf": [
        { "item": 1, "codigo": "BAS0242A", "descricao": "Base Inferior", "qtd": 1 },
        { "item": 2, "codigo": "LAT0243A", "descricao": "Lateral Esquerda", "qtd": 1 }
      ],
      "ferragens": [
        { "ref": "DOBT", "descricao": "Kit Dobradiça Padrão Reta", "qtd": 4, "unidade": "UN" },
        { "ref": "PGOLA01", "descricao": "Puxador Gola p/ Porta", "qtd": 2, "unidade": "UN" }
      ],
      "regras_parametricas": {
        "tipo": "balcao_portas",
        "qtd_portas": 2,
        "qtd_gavetas": 0,
        "prateleiras_internas": 1
      }
    }`

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
              { type: 'image_url', image_url: { url: `data:image/png;base64,${imagemBase64}` } },
            ],
          },
        ],
        max_tokens: 1000,
      }),
    })

    const data = await openAIResponse.json()
    const conteudo = data.choices[0].message.content
    const jsonPuro = conteudo
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
