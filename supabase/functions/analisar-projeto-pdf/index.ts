import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, x-supabase-client-platform, apikey, content-type',
}

/**
 * Edge Function: analisar-projeto-pdf
 *
 * Lê uma prancha/detalhamento de mobiliário (PDF do arquiteto renderizado em imagens +
 * texto extraído) com gpt-4o e devolve, em JSON estruturado:
 *  - ambientes e módulos (dimensões em mm, MDF externo/interno, perfil construtivo, composição)
 *  - itens extras por módulo (tomadas, passa-fios, vidro, pernas de metal, puxadores especiais...)
 *    casados com o catálogo de materiais quando existir item equivalente; caso contrário
 *    marcados como item_nao_cadastrado com custo estimado.
 */

interface CatalogoMaterialInfo {
  id: string
  nome_material?: string
  descricao?: string
  categoria: string
  unidade: string
  preco_custo: number
}

interface TemplateInfo {
  id: string
  nome_template: string
  categoria?: string | null
  perfil_construtivo?: string | null
  dimensoes?: string | null
}

type PerfilConstrutivo =
  | 'Fechado Envelopado'
  | 'Balcão (tampo por conta do cliente)'
  | 'Aberto / Painel'
  | 'Caixa Simples'

const PERFIS_VALIDOS: PerfilConstrutivo[] = [
  'Fechado Envelopado',
  'Balcão (tampo por conta do cliente)',
  'Aberto / Painel',
  'Caixa Simples',
]

const CATEGORIAS_VALIDAS = [
  'MDF 15mm',
  'MDF 18mm',
  'MDF 6mm',
  'Fita de Borda',
  'Ferragem',
  'Iluminação',
  'Componentes Elétricos',
  'Parafusos e Sistemas de Fixação',
  'Acessórios',
  'Serralheria Terceirizada',
  'Estofaria Terceirizada',
  'Instalação',
  'Outro',
]

export interface ItemExtraProjeto {
  descricao: string
  quantidade: number
  unidade: string
  categoria_sugerida: string
  catalogo_id: string | null
  catalogo_nome?: string | null
  item_nao_cadastrado: boolean
  preco_custo_estimado: number
  origem_texto?: string
  justificativa?: string
}

export interface ModuloProjeto {
  codigo: string
  nome: string
  descricao: string
  quantidade: number
  perfil_construtivo: PerfilConstrutivo
  template_id: string | null
  dimensoes_mm: { largura: number; altura: number; profundidade: number }
  mdf_externo: { cor: string; espessura: 15 | 18 }
  mdf_interno: { cor: string; espessura: 15 | 18 }
  mdf_fundo: string
  composicao: {
    portas: { qtd: number; tipo: 'abrir' | 'correr' | 'batente' | 'nenhum' }
    gavetas: { qtd: number }
    prateleiras: { qtd: number }
    divisorias: { qtd: number }
    cabideiro: boolean
    iluminacao_led: boolean
    puxadores: { qtd: number; tipo: string }
    rodape_mm: number | null
    tampo: string | null
  }
  itens_extras: ItemExtraProjeto[]
  confianca: 'alta' | 'media' | 'baixa'
  observacoes: string[]
}

export interface AmbienteProjeto {
  nome: string
  modulos: ModuloProjeto[]
}

export interface ProjetoExtraido {
  projeto: {
    titulo: string
    cliente: string | null
    responsavel_tecnico: string | null
    observacoes: string[]
  }
  ambientes: AmbienteProjeto[]
  itens_extras_gerais: ItemExtraProjeto[]
  resumo: string
}

// ---------- helpers ----------

const normalizar = (s: string): string =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'em', 'para', 'com', 'e', 'o', 'a', 'un', 'mm', 'cm'])

const tokens = (s: string): string[] =>
  normalizar(s)
    .split(' ')
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))

/** Pontuação simples de similaridade por sobreposição de tokens (0..1). */
function similaridade(a: string, b: string): number {
  const ta = tokens(a)
  const tb = new Set(tokens(b))
  if (ta.length === 0 || tb.size === 0) return 0
  let hits = 0
  for (const t of ta) {
    if (tb.has(t)) {
      hits += 1
      continue
    }
    // prefixo (tomada / tomadas, passa-fio / passa fios)
    for (const u of tb) {
      if (u.length >= 4 && t.length >= 4 && (u.startsWith(t) || t.startsWith(u))) {
        hits += 0.8
        break
      }
    }
  }
  return hits / Math.max(ta.length, 1)
}

function melhorMatchCatalogo(
  descricao: string,
  catalogo: CatalogoMaterialInfo[],
): { item: CatalogoMaterialInfo; score: number } | null {
  let melhor: { item: CatalogoMaterialInfo; score: number } | null = null
  for (const c of catalogo) {
    const nome = c.nome_material || c.descricao || ''
    const score = similaridade(descricao, nome)
    if (score > 0 && (!melhor || score > melhor.score)) melhor = { item: c, score }
  }
  return melhor && melhor.score >= 0.6 ? melhor : null
}

const num = (v: unknown, fallback: number): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const espessura = (v: unknown, fallback: 15 | 18): 15 | 18 => {
  const n = Math.round(num(v, fallback))
  return n === 18 ? 18 : n === 15 ? 15 : fallback
}

function normalizarPerfil(v: unknown): PerfilConstrutivo {
  const s = normalizar(String(v ?? ''))
  if (PERFIS_VALIDOS.some((p) => normalizar(p) === s)) return String(v) as PerfilConstrutivo
  if (s.includes('painel') || s.includes('aberto') || s.includes('prateleira flutuante')) return 'Aberto / Painel'
  if (s.includes('balcao') || s.includes('bancada') || s.includes('tampo')) return 'Balcão (tampo por conta do cliente)'
  if (s.includes('caixa') || s.includes('aereo') || s.includes('nicho')) return 'Caixa Simples'
  return 'Fechado Envelopado'
}

function normalizarCategoria(v: unknown): string {
  const s = normalizar(String(v ?? ''))
  const found = CATEGORIAS_VALIDAS.find((c) => normalizar(c) === s)
  if (found) return found
  if (s.includes('eletric') || s.includes('tomada') || s.includes('passa')) return 'Componentes Elétricos'
  if (s.includes('led') || s.includes('ilumin')) return 'Iluminação'
  if (s.includes('metal') || s.includes('serralh') || s.includes('aco') || s.includes('ferro')) return 'Serralheria Terceirizada'
  if (s.includes('vidro') || s.includes('pedra') || s.includes('granito') || s.includes('acess')) return 'Acessórios'
  if (s.includes('ferragem') || s.includes('puxador') || s.includes('dobradica') || s.includes('corredica')) return 'Ferragem'
  return 'Outro'
}

function normalizarItemExtra(raw: any, catalogo: CatalogoMaterialInfo[], idsValidos: Set<string>): ItemExtraProjeto | null {
  const descricao = String(raw?.descricao || raw?.nome || '').trim()
  if (!descricao) return null

  let catalogoId: string | null = raw?.catalogo_id ? String(raw.catalogo_id) : null
  let catalogoItem: CatalogoMaterialInfo | undefined
  if (catalogoId && idsValidos.has(catalogoId)) {
    catalogoItem = catalogo.find((c) => c.id === catalogoId)
  } else {
    catalogoId = null
  }
  // Fallback: tenta casar pelo nome quando a IA não informou um id válido
  if (!catalogoItem) {
    const match = melhorMatchCatalogo(descricao, catalogo)
    if (match) {
      catalogoItem = match.item
      catalogoId = match.item.id
    }
  }

  const unidadeRaw = String(raw?.unidade || catalogoItem?.unidade || 'un').trim()
  const unidade = ['m²', 'm2', 'm', 'un', 'par', 'jogo'].includes(unidadeRaw.toLowerCase())
    ? unidadeRaw === 'm2'
      ? 'm²'
      : unidadeRaw.toLowerCase()
    : 'un'

  return {
    descricao,
    quantidade: num(raw?.quantidade, 1),
    unidade,
    categoria_sugerida: catalogoItem?.categoria || normalizarCategoria(raw?.categoria_sugerida ?? raw?.categoria),
    catalogo_id: catalogoId,
    catalogo_nome: catalogoItem ? catalogoItem.nome_material || catalogoItem.descricao || null : null,
    item_nao_cadastrado: !catalogoItem,
    preco_custo_estimado: catalogoItem
      ? Number(catalogoItem.preco_custo || 0)
      : num(raw?.preco_custo_estimado, 50),
    origem_texto: raw?.origem_texto ? String(raw.origem_texto) : undefined,
    justificativa: raw?.justificativa ? String(raw.justificativa) : undefined,
  }
}

function normalizarModulo(
  raw: any,
  idx: number,
  catalogo: CatalogoMaterialInfo[],
  idsCatalogo: Set<string>,
  templates: TemplateInfo[],
): ModuloProjeto {
  const nome = String(raw?.nome || raw?.descricao || `Módulo ${idx + 1}`).trim()
  const codigo = String(raw?.codigo || `M${String(idx + 1).padStart(2, '0')}`).trim()

  let templateId: string | null = raw?.template_id ? String(raw.template_id) : null
  if (templateId && !templates.some((t) => t.id === templateId)) templateId = null

  const comp = raw?.composicao || {}
  const tipoPortaRaw = normalizar(String(comp?.portas?.tipo || ''))
  const qtdPortas = Math.round(num(comp?.portas?.qtd, 0))
  const tipoPorta: ModuloProjeto['composicao']['portas']['tipo'] =
    qtdPortas === 0
      ? 'nenhum'
      : tipoPortaRaw.includes('correr')
        ? 'correr'
        : tipoPortaRaw.includes('batente')
          ? 'batente'
          : 'abrir'

  const extras: ItemExtraProjeto[] = Array.isArray(raw?.itens_extras)
    ? raw.itens_extras
        .map((e: any) => normalizarItemExtra(e, catalogo, idsCatalogo))
        .filter((e: ItemExtraProjeto | null): e is ItemExtraProjeto => Boolean(e))
    : []

  const mdfExtCor = String(raw?.mdf_externo?.cor || raw?.mdf_externo || 'Branco TX').trim()
  const mdfIntCor = String(raw?.mdf_interno?.cor || raw?.mdf_interno || 'Branco TX').trim()

  return {
    codigo,
    nome,
    descricao: String(raw?.descricao || '').trim(),
    quantidade: Math.max(1, Math.round(num(raw?.quantidade, 1))),
    perfil_construtivo: normalizarPerfil(raw?.perfil_construtivo),
    template_id: templateId,
    dimensoes_mm: {
      largura: Math.round(num(raw?.dimensoes_mm?.largura, 1000)),
      altura: Math.round(num(raw?.dimensoes_mm?.altura, 700)),
      profundidade: Math.round(num(raw?.dimensoes_mm?.profundidade, 500)),
    },
    mdf_externo: { cor: mdfExtCor, espessura: espessura(raw?.mdf_externo?.espessura, 18) },
    mdf_interno: { cor: mdfIntCor, espessura: espessura(raw?.mdf_interno?.espessura, 15) },
    mdf_fundo: String(raw?.mdf_fundo || 'MDF 6mm Branco TX').trim(),
    composicao: {
      portas: { qtd: qtdPortas, tipo: tipoPorta },
      gavetas: { qtd: Math.round(num(comp?.gavetas?.qtd, 0)) },
      prateleiras: { qtd: Math.round(num(comp?.prateleiras?.qtd, 0)) },
      divisorias: { qtd: Math.round(num(comp?.divisorias?.qtd, 0)) },
      cabideiro: Boolean(comp?.cabideiro),
      iluminacao_led: Boolean(comp?.iluminacao_led ?? comp?.iluminacaoLed),
      puxadores: {
        qtd: Math.round(num(comp?.puxadores?.qtd, 0)),
        tipo: String(comp?.puxadores?.tipo || '').trim(),
      },
      rodape_mm: comp?.rodape_mm ? Math.round(num(comp.rodape_mm, 0)) : null,
      tampo: comp?.tampo ? String(comp.tampo) : null,
    },
    itens_extras: extras,
    confianca: raw?.confianca === 'alta' ? 'alta' : raw?.confianca === 'baixa' ? 'baixa' : 'media',
    observacoes: Array.isArray(raw?.observacoes) ? raw.observacoes.map((o: any) => String(o)) : [],
  }
}

// ---------- handler ----------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) return json({ error: 'OPENAI_API_KEY não está configurada no servidor.' }, 500)

    const { paginasBase64, textoExtraido, catalogoMateriais, templates, nomeArquivo } =
      (await req.json()) as {
        paginasBase64?: string[]
        textoExtraido?: string
        catalogoMateriais?: CatalogoMaterialInfo[]
        templates?: TemplateInfo[]
        nomeArquivo?: string
      }

    const paginas = (Array.isArray(paginasBase64) ? paginasBase64 : []).filter(
      (p) => typeof p === 'string' && p.trim().length > 0,
    )
    const texto = typeof textoExtraido === 'string' ? textoExtraido.trim() : ''

    if (paginas.length === 0 && texto.length === 0) {
      return json({ error: 'Envie paginasBase64 (imagens das páginas) e/ou textoExtraido.' }, 400)
    }

    const catalogo = Array.isArray(catalogoMateriais) ? catalogoMateriais : []
    const listaTemplates = Array.isArray(templates) ? templates : []
    const idsCatalogo = new Set(catalogo.map((c) => c.id))

    const listaCatalogoText =
      catalogo.length > 0
        ? catalogo
            .map((c) => {
              const desc = c.nome_material || c.descricao || 'Material'
              return `ID: ${c.id} | ${desc} | Categoria: ${c.categoria} | Unidade: ${c.unidade} | Custo: R$ ${Number(c.preco_custo || 0).toFixed(2)}`
            })
            .join('\n')
        : 'Nenhum material cadastrado no catálogo.'

    const listaTemplatesText =
      listaTemplates.length > 0
        ? listaTemplates
            .map(
              (t) =>
                `ID: ${t.id} | ${t.nome_template}${t.categoria ? ` | Categoria: ${t.categoria}` : ''}${t.perfil_construtivo ? ` | Perfil: ${t.perfil_construtivo}` : ''}${t.dimensoes ? ` | Dimensões: ${t.dimensoes}` : ''}`,
            )
            .join('\n')
        : 'Nenhum módulo pré-cadastrado na biblioteca.'

    const systemPrompt = `Você é um engenheiro de marcenaria especialista em ler PRANCHAS DE DETALHAMENTO DE MOBILIÁRIO feitas por arquitetos (plantas, vistas, cortes, tabelas de mobiliário e observações) e transformá-las em um orçamento de móveis sob medida.

Você receberá as páginas da prancha como imagens e, quando disponível, o texto extraído do PDF. Use os dois: o texto traz as medidas e descrições exatas; as imagens trazem a forma, a contagem de portas/prateleiras e os detalhes.

**Catálogo de materiais/ferragens da marcenaria (use o ID quando houver item equivalente):**
${listaCatalogoText}

**Biblioteca de módulos cadastrados (opcional; use template_id só se for claramente o mesmo tipo de móvel):**
${listaTemplatesText}

**REGRAS:**
1. Liste TODOS os módulos/móveis que a prancha detalha (M01, M02, M03... ou nomes). Um módulo por item da tabela de mobiliário. Se a prancha mostra uma composição (ex.: painel + armário baixo), cada peça é um módulo separado.
2. Agrupe os módulos por AMBIENTE (Sala, Cozinha, Quarto, Escritório...). Se a prancha não nomear o ambiente, use o título da prancha.
3. DIMENSÕES sempre em MILÍMETROS (largura × altura × profundidade). Converta cm e m. Painéis: profundidade = profundidade das prateleiras/nichos acoplados ao painel (ex.: 200); painel sem prateleiras = 150. Prateleiras flutuantes e nichos acoplados a um painel entram na composição/itens do painel, não como módulo separado, a menos que a tabela de mobiliário os liste separadamente.
4. MDF: informe cor/padrão e espessura (15 ou 18) do MDF externo (frentes/laterais aparentes) e do MDF interno. Se a prancha cita marca (Duratex, Arauco, Guararapes...), inclua no nome da cor. Fundo: "MDF 6mm <cor>".
5. PERFIL CONSTRUTIVO (exatamente um destes textos):
   - "Fechado Envelopado": armários, roupeiros, armários altos fechados.
   - "Balcão (tampo por conta do cliente)": balcões/bancadas/gabinetes que recebem tampo de pedra ou vidro fornecido à parte.
   - "Aberto / Painel": painéis de TV, painéis ripados, cabeceiras, estantes abertas, prateleiras.
   - "Caixa Simples": aéreos e caixas simples sem tamponamento.
   Armário baixo com tampo em MDF do próprio móvel = "Fechado Envelopado"; se o tampo é pedra/vidro fornecido à parte = "Balcão (tampo por conta do cliente)".
6. COMPOSIÇÃO: conte portas (e tipo: abrir/correr/batente/nenhum), gavetas, prateleiras internas, divisórias verticais (compartimentos − 1), cabideiro, LED, puxadores (quantidade e tipo: cava 45°, perfil, concha, sem puxador...), rodapé em mm, tampo (descreva se houver).
7. ITENS EXTRAS (MUITO IMPORTANTE): tudo que está escrito na prancha e NÃO é peça de MDF nem ferragem básica de montagem deve virar item extra com QUANTIDADE calculada a partir do texto:
   - tomadas, interruptores, réguas, passa-fios/passa-cabos, carregadores USB
   - vidro temperado/espelho (informe em m² calculando pela medida do tampo/porta), pedra/granito
   - pernas/pés/estruturas de metal, serralheria, suportes de prateleira flutuante
   - fita LED, perfis de alumínio, fontes
   - puxadores especiais (cava/perfil/concha), dobradiças com amortecimento, corrediças se citadas
   - estofados, tecidos, instalação especial
   Exemplo: "6 tomadas por compartimento" com 3 compartimentos = 18 tomadas. "1 passa-fio por compartimento" = 3 passa-fios. "6 passa-fios circulares" = 6.
   Para cada item extra: se existir item equivalente no catálogo, informe o "catalogo_id" (ID real) e "item_nao_cadastrado": false; se NÃO existir, "catalogo_id": null, "item_nao_cadastrado": true e "preco_custo_estimado" com um custo unitário realista em reais no mercado brasileiro. Sempre preencha "categoria_sugerida" com uma destas: ${CATEGORIAS_VALIDAS.join(', ')}.
   Vincule o item extra ao módulo a que pertence (dentro de "itens_extras" do módulo). Itens do projeto que não pertencem a um módulo específico vão em "itens_extras_gerais".
8. Em "observacoes" do projeto, transcreva as notas da prancha que afetam o orçamento (conferir medidas no local, acabamentos, exigências de instalação).
9. "confianca": "alta" quando a prancha traz medidas e descrição explícitas; "media" quando parte foi inferida das imagens; "baixa" quando houve dúvida.
10. Nunca invente módulos que não estão na prancha. Não inclua chapas de MDF, parafusos, cola ou fita de borda como itens extras (o sistema já calcula isso).

Responda SOMENTE com JSON válido, sem markdown, neste formato:
{
  "projeto": {
    "titulo": "DETALHAMENTO DE MOBILIÁRIO – SALA",
    "cliente": "nome do cliente ou null",
    "responsavel_tecnico": "nome do arquiteto ou null",
    "observacoes": ["Conferir medidas no local antes da execução"]
  },
  "ambientes": [
    {
      "nome": "Sala",
      "modulos": [
        {
          "codigo": "M02",
          "nome": "Painel de TV liso",
          "descricao": "Painel liso em MDF Carvalho Avelã com faixa vertical, 2 prateleiras flutuantes e 6 passa-fios",
          "quantidade": 1,
          "perfil_construtivo": "Aberto / Painel",
          "template_id": null,
          "dimensoes_mm": { "largura": 3720, "altura": 2400, "profundidade": 200 },
          "mdf_externo": { "cor": "Carvalho Avelã (Duratex)", "espessura": 18 },
          "mdf_interno": { "cor": "Branco TX", "espessura": 15 },
          "mdf_fundo": "MDF 6mm Branco TX",
          "composicao": {
            "portas": { "qtd": 0, "tipo": "nenhum" },
            "gavetas": { "qtd": 0 },
            "prateleiras": { "qtd": 2 },
            "divisorias": { "qtd": 0 },
            "cabideiro": false,
            "iluminacao_led": false,
            "puxadores": { "qtd": 0, "tipo": "" },
            "rodape_mm": null,
            "tampo": null
          },
          "itens_extras": [
            {
              "descricao": "Passa-fio circular embutido",
              "quantidade": 6,
              "unidade": "un",
              "categoria_sugerida": "Componentes Elétricos",
              "catalogo_id": null,
              "item_nao_cadastrado": true,
              "preco_custo_estimado": 12.0,
              "origem_texto": "6 passa-fios circulares embutidos",
              "justificativa": "Citado na descrição do painel"
            }
          ],
          "confianca": "alta",
          "observacoes": ["Prateleiras flutuantes 850×200×40 mm"]
        }
      ]
    }
  ],
  "itens_extras_gerais": [],
  "resumo": "Resumo curto do que a prancha contém"
}`

    const userContent: Array<
      { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail?: 'high' | 'low' | 'auto' } }
    > = [
      {
        type: 'text',
        text: `Leia esta prancha de detalhamento${nomeArquivo ? ` (${nomeArquivo})` : ''} e extraia ambientes, módulos, composição e itens extras conforme as regras.${
          texto
            ? `\n\n=== TEXTO EXTRAÍDO DO PDF (fonte principal para medidas e descrições) ===\n${texto.slice(0, 15000)}`
            : ''
        }`,
      },
      ...paginas.slice(0, 8).map((url) => ({
        type: 'image_url' as const,
        image_url: { url, detail: 'high' as const },
      })),
    ]

    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        max_tokens: 4000,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    })

    if (!openAiResponse.ok) {
      const errText = await openAiResponse.text().catch(() => '')
      return json({ error: `OpenAI respondeu ${openAiResponse.status}: ${errText}` }, 502)
    }

    const aiData = await openAiResponse.json()
    const rawContent: string = aiData?.choices?.[0]?.message?.content ?? ''
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return json({ error: 'Resposta da IA não continha um JSON válido.' }, 500)

    let parsed: any
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch (e) {
      return json({ error: `JSON da IA inválido: ${e instanceof Error ? e.message : String(e)}` }, 500)
    }

    const ambientesRaw: any[] = Array.isArray(parsed?.ambientes) ? parsed.ambientes : []
    let contador = 0
    const ambientes: AmbienteProjeto[] = ambientesRaw
      .map((a) => ({
        nome: String(a?.nome || parsed?.projeto?.titulo || 'Ambiente').trim(),
        modulos: (Array.isArray(a?.modulos) ? a.modulos : []).map((m: any) =>
          normalizarModulo(m, contador++, catalogo, idsCatalogo, listaTemplates),
        ),
      }))
      .filter((a) => a.modulos.length > 0)

    const extrasGerais: ItemExtraProjeto[] = (
      Array.isArray(parsed?.itens_extras_gerais) ? parsed.itens_extras_gerais : []
    )
      .map((e: any) => normalizarItemExtra(e, catalogo, idsCatalogo))
      .filter((e: ItemExtraProjeto | null): e is ItemExtraProjeto => Boolean(e))

    const resultado: ProjetoExtraido = {
      projeto: {
        titulo: String(parsed?.projeto?.titulo || nomeArquivo || 'Projeto importado').trim(),
        cliente: parsed?.projeto?.cliente ? String(parsed.projeto.cliente) : null,
        responsavel_tecnico: parsed?.projeto?.responsavel_tecnico
          ? String(parsed.projeto.responsavel_tecnico)
          : null,
        observacoes: Array.isArray(parsed?.projeto?.observacoes)
          ? parsed.projeto.observacoes.map((o: any) => String(o))
          : [],
      },
      ambientes,
      itens_extras_gerais: extrasGerais,
      resumo: String(parsed?.resumo || '').trim(),
    }

    const totalModulos = ambientes.reduce((acc, a) => acc + a.modulos.length, 0)
    if (totalModulos === 0 && extrasGerais.length === 0) {
      return json(
        { ...resultado, error: 'A IA não identificou módulos nem itens nesta prancha.' },
        200,
      )
    }

    return json(resultado)
  } catch (err) {
    console.error('[analisar-projeto-pdf] erro:', err)
    return json({ error: err instanceof Error ? err.message : 'Erro interno ao analisar o PDF.' }, 500)
  }
})
