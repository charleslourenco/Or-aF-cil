/**
 * Edge Function: sincronizar-estoque-bender
 *
 * Lê o estoque do Sistema Bender (tabela estoque_itens, via REST com a chave de serviço
 * daquele projeto) e espelha os itens relevantes no catálogo do OrçaFácil (CatalogoMateriais),
 * com custo, saldo e fornecedor. Itens espelhados ficam com origem = 'bender' e
 * origem_id = id do estoque_itens, o que permite reexecutar a sincronização sem duplicar.
 *
 * Ficam de fora: chapas de MDF e fitas de borda (o OrçaFácil precifica por m² / m, com itens
 * genéricos próprios), consumíveis (limpeza, EPI, lixas, químicos...) e itens sem preço.
 *
 * Body (JSON, opcional): { "modo": "simular" | "aplicar" }  — padrão "aplicar".
 * Resposta: { ok, modo, lidos, considerados, inseridos, atualizados, vinculados, ignorados, porCategoria }
 *
 * Segredo necessário no projeto OrçaFácil: BENDER_SERVICE_ROLE_KEY (chave de serviço do projeto "Sistema Bender").
 * Opcional: BENDER_SUPABASE_URL (padrão: https://igsdtxyopeiecpxwovgh.supabase.co).
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BENDER_URL = (
  Deno.env.get('BENDER_SUPABASE_URL') || 'https://igsdtxyopeiecpxwovgh.supabase.co'
).replace(/\/$/, '')
const BENDER_KEY = Deno.env.get('BENDER_SERVICE_ROLE_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

interface ItemBender {
  id: string
  nome: string | null
  categoria: string | null
  grupo: string | null
  classe: string | null
  unidade: string | null
  quantidade: number | string | null
  valor_unitario: number | string | null
  fornecedor: string | null
  metadados_normalizados: { tipo_material?: string | null } | null
}

interface ItemCatalogo {
  id: string
  nome_material: string
  categoria: string
  origem: string | null
  origem_id: string | null
}

const CATEGORIAS_PERSONALIZADAS_NECESSARIAS = [
  'Puxadores',
  'Móveis soltos',
  'Espelho',
  'Portas de Vidro e Alumínio',
]

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Classifica um item do estoque Bender numa categoria do catálogo do OrçaFácil.
 * Devolve null quando o item não deve entrar no catálogo.
 */
export function classificarItemBender(it: ItemBender): string | null {
  const tc = [it.categoria, it.grupo, it.classe, it.metadados_normalizados?.tipo_material]
    .map((s) => (s || '').toString())
    .join(' | ')
    .toUpperCase()
  const tn = (it.nome || '').toUpperCase()
  const tudo = `${tc} ${tn}`

  if (/TUBO METALO|METALON|METALOM/.test(tn)) return 'Serralheria Terceirizada'
  if (/FILME|RODO|^VASSOURA|ASSISTENCIA|CAMARIM IZZY/.test(tn)) return null
  if (
    /CHAPA|MDF|MDP|COMPENSADO|PAINEL 15MM|GUARARAPES 15MM|PEARL RUBI/.test(tudo) &&
    !/FITA/.test(tudo)
  )
    return null
  if (
    /FITA DE BORDA|FITAS DE BORDA|BORDAS|FITA PVC|FITA BORDA|FITA_DE_BORDA|PERFIL FITA|POM DUBAI|PTA LUME/.test(
      tudo,
    )
  )
    return null
  if (
    /LIMPEZA|EPI|UNIFORME|ETIQUETA|EMBALAGEM|LIXA|BROCA|FRESA|SERRA|ESTOPA|QUIMICO|QUÍMICO|COLA|ADESIVO|SOLVENTE|INSUMO|DUPLA FACE|BALDE|ESTILETE|PARAFUSO|PARAFISO|COLCHÃO|COLCHAO|FRETE/.test(
      tudo,
    )
  )
    return null
  if (/PUXADOR|^PUX |PERFIL PUXADOR|CAVA/.test(tn)) return 'Puxadores'
  if (/LED|FONTE|INTERRUPTOR|LUM |DIFUSOR|W\/M|HIPER BRILHO|CALHA|PERFILED/.test(tn))
    return 'Iluminação'
  if (/FECHO|DESEMPENADEIRA|PORTA VASSOURA|PORTA XICARAS|TAMPA P\/ PORTAS|TUBO ZINC/.test(tn))
    return 'Ferragem'
  if (/TOMADA|PASSA FIO|PASSA-FIO|FIO |CABO|FILTRO|ELETR|ELÉTR/.test(tudo))
    return 'Componentes Elétricos'
  if (
    /DOBRAD|CORREDI|ARTICULAD|AMORTECEDOR|ALINHADOR|SUPORTE|CABIDEIRO|KIT|TRILHO|PERFIL|RODIZIO|RODÍZIO|^PÉ |PE PLAST|PÉ PLÁST|PÉ DE PL|PÉ CROM|NIVELADOR|BATENTE|FECHADURA|CALCO|CALÇO|PISTÃO|PISTAO|PENDURADOR|LIXEIRA|PINCAIS|CANALETA|FIXA|LIMIT/.test(
      tn,
    )
  )
    return 'Ferragem'
  if (/^MESA /.test(tn)) return 'Móveis soltos'
  if (/ESPELHO/.test(tudo)) return 'Espelho'
  if (/VIDRO|PORTA/.test(tudo)) return 'Portas de Vidro e Alumínio'
  if (/FERRAGE|ACABAMENTO/.test(tc)) return 'Ferragem'
  if (/CUBA|TABUA|TÁBUA|MANTA/.test(tn)) return 'Acessórios'
  if (
    /MOVEIS SOLTOS|MÓVEIS SOLTOS|CAMA|MESA|CADEIRA|BANQUETA|SOFA|SOFÁ|PUFE|OFFICE|BASE BOX/.test(
      tudo,
    )
  )
    return 'Móveis soltos'
  return null
}

function normalizarUnidade(u: string | null): 'm' | 'un' {
  const s = (u || '').trim().toUpperCase()
  return s === 'M' || s === 'METROS' || s === 'MT' ? 'm' : 'un'
}

function normalizarFornecedor(f: string | null): string | null {
  const s = (f || '').trim()
  if (!s || s.length > 60 || s.toLowerCase() === 'desconhecido') return null
  return s
}

async function lerEstoqueBender(): Promise<ItemBender[]> {
  const itens: ItemBender[] = []
  const pagina = 1000
  for (let offset = 0; offset < 20000; offset += pagina) {
    const url =
      `${BENDER_URL}/rest/v1/estoque_itens` +
      `?select=id,nome,categoria,grupo,classe,unidade,quantidade,valor_unitario,fornecedor,metadados_normalizados` +
      `&order=nome.asc&limit=${pagina}&offset=${offset}`
    const resp = await fetch(url, {
      headers: { apikey: BENDER_KEY, Authorization: `Bearer ${BENDER_KEY}` },
    })
    if (!resp.ok) {
      const txt = await resp.text()
      throw new Error(
        `Falha ao ler o estoque do Sistema Bender (${resp.status}): ${txt.slice(0, 300)}`,
      )
    }
    const lote = (await resp.json()) as ItemBender[]
    itens.push(...lote)
    if (lote.length < pagina) break
  }
  return itens
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    if (!BENDER_KEY) {
      return json(
        {
          ok: false,
          error: 'Segredo BENDER_SERVICE_ROLE_KEY não configurado no projeto OrçaFácil.',
        },
        500,
      )
    }
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return json(
        { ok: false, error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY indisponíveis.' },
        500,
      )
    }

    let modo: 'simular' | 'aplicar' = 'aplicar'
    try {
      const body = await req.json()
      if (body?.modo === 'simular') modo = 'simular'
    } catch (_) {
      // body vazio → aplicar
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    // 1. Estoque do Bender
    const estoque = await lerEstoqueBender()

    // 2. Classificação + filtro
    const candidatos: {
      origem_id: string
      nome: string
      categoria: string
      unidade: 'm' | 'un'
      preco: number
      qtd: number
      fornecedor: string | null
    }[] = []
    let ignorados = 0
    const porCategoria: Record<string, number> = {}
    for (const it of estoque) {
      const preco = round2(num(it.valor_unitario))
      const nome = (it.nome || '').replace(/\s+/g, ' ').trim()
      const categoria = classificarItemBender(it)
      if (!categoria || preco <= 0 || !nome) {
        ignorados++
        continue
      }
      porCategoria[categoria] = (porCategoria[categoria] || 0) + 1
      candidatos.push({
        origem_id: it.id,
        nome,
        categoria,
        unidade: normalizarUnidade(it.unidade),
        preco,
        qtd: round2(num(it.quantidade)),
        fornecedor: normalizarFornecedor(it.fornecedor),
      })
    }

    // 3. Catálogo atual do OrçaFácil
    const { data: catalogo, error: errCat } = await supabase
      .from('CatalogoMateriais')
      .select('id, nome_material, categoria, origem, origem_id')
    if (errCat) throw new Error(`Erro ao ler CatalogoMateriais: ${errCat.message}`)
    const porOrigemId = new Map<string, ItemCatalogo>()
    const porNome = new Map<string, ItemCatalogo>()
    for (const c of (catalogo || []) as ItemCatalogo[]) {
      if (c.origem_id) porOrigemId.set(c.origem_id, c)
      porNome.set(c.nome_material.trim().toLowerCase(), c)
    }

    const agora = new Date().toISOString()
    const inserir: Record<string, unknown>[] = []
    const atualizar: { id: string; dados: Record<string, unknown> }[] = []
    let vinculados = 0
    const nomesNoLote = new Set<string>()

    for (const c of candidatos) {
      const chaveNome = c.nome.toLowerCase()
      const existenteId = porOrigemId.get(c.origem_id)
      const existenteNome = porNome.get(chaveNome)
      if (existenteId) {
        // já espelhado: atualiza custo, saldo e fornecedor; mantém nome/categoria editados no OrçaFácil
        atualizar.push({
          id: existenteId.id,
          dados: {
            preco_custo: c.preco,
            estoque_qtd: c.qtd,
            fornecedor: c.fornecedor,
            sincronizado_em: agora,
            updated_at: agora,
          },
        })
      } else if (existenteNome) {
        // item cadastrado à mão com o mesmo nome: vincula ao Bender e assume o custo real
        vinculados++
        atualizar.push({
          id: existenteNome.id,
          dados: {
            origem: 'bender',
            origem_id: c.origem_id,
            preco_custo: c.preco,
            estoque_qtd: c.qtd,
            fornecedor: c.fornecedor,
            sincronizado_em: agora,
            updated_at: agora,
          },
        })
        porOrigemId.set(c.origem_id, existenteNome)
      } else {
        if (nomesNoLote.has(chaveNome)) {
          ignorados++
          continue
        }
        nomesNoLote.add(chaveNome)
        inserir.push({
          nome_material: c.nome,
          categoria: c.categoria,
          unidade: c.unidade,
          preco_custo: c.preco,
          nivel_padrao: 'padrao',
          ativo: true,
          origem: 'bender',
          origem_id: c.origem_id,
          estoque_qtd: c.qtd,
          fornecedor: c.fornecedor,
          sincronizado_em: agora,
        })
      }
    }

    const resumo = {
      ok: true,
      modo,
      lidos: estoque.length,
      considerados: candidatos.length,
      inseridos: inserir.length,
      atualizados: atualizar.length - vinculados,
      vinculados,
      ignorados,
      porCategoria,
    }
    if (modo === 'simular') return json(resumo)

    // 4. Garante as categorias personalizadas usadas
    const { data: cats } = await supabase.from('CategoriasPersonalizadas').select('nome')
    const existentes = new Set(
      ((cats || []) as { nome: string }[]).map((c) => c.nome.trim().toLowerCase()),
    )
    const novasCats = CATEGORIAS_PERSONALIZADAS_NECESSARIAS.filter(
      (n) => !existentes.has(n.toLowerCase()) && porCategoria[n],
    )
    if (novasCats.length > 0) {
      const { error } = await supabase
        .from('CategoriasPersonalizadas')
        .insert(novasCats.map((nome) => ({ nome })))
      if (error) console.warn('Não foi possível criar categorias personalizadas:', error.message)
    }

    // 5. Grava
    for (let i = 0; i < inserir.length; i += 200) {
      const { error } = await supabase.from('CatalogoMateriais').insert(inserir.slice(i, i + 200))
      if (error) throw new Error(`Erro ao inserir itens no catálogo: ${error.message}`)
    }
    for (let i = 0; i < atualizar.length; i += 25) {
      const lote = atualizar.slice(i, i + 25)
      const resultados = await Promise.all(
        lote.map((u) => supabase.from('CatalogoMateriais').update(u.dados).eq('id', u.id)),
      )
      const falha = resultados.find((r) => r.error)
      if (falha?.error)
        throw new Error(`Erro ao atualizar itens do catálogo: ${falha.error.message}`)
    }

    return json(resumo)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('sincronizar-estoque-bender:', msg)
    return json({ ok: false, error: msg }, 500)
  }
})
