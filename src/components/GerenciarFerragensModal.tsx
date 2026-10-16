import React, { useState, useEffect, useMemo } from 'react'
import {
  Wrench,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Link as LinkIcon,
  Unlink,
  ExternalLink,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  fetchFerragensVinculos,
  upsertFerragemVinculo,
  type VinculoComDetalhes,
} from '@/services/ferragensVinculos'
import { fetchCatalogoMateriais, type CatalogoMaterial } from '@/services/catalogo'

interface GerenciarFerragensModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onVinculosUpdated?: () => void
  ferragemInicial?: string | null
}

export function GerenciarFerragensModal({
  open,
  onOpenChange,
  onVinculosUpdated,
  ferragemInicial,
}: GerenciarFerragensModalProps) {
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [salvandoItem, setSalvandoItem] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'vinculados' | 'pendentes'>('todos')

  // Lista de materiais do catálogo (para opções do select)
  const [materiaisCatalogo, setMateriaisCatalogo] = useState<CatalogoMaterial[]>([])

  // Lista de vínculos mapeados
  const [vinculosMap, setVinculosMap] = useState<Map<string, VinculoComDetalhes>>(new Map())

  // Lista de ferragens conhecidas (combinadas do banco + regras)
  const [nomesFerragens, setNomesFerragens] = useState<string[]>([])

  // Nova ferragem manual
  const [novaFerragemNome, setNovaFerragemNome] = useState('')
  const [novoMaterialId, setNovoMaterialId] = useState<string>('')

  // Carrega catálogo e vínculos
  const carregarDados = async () => {
    setLoading(true)
    try {
      const [catData, vinculosRes] = await Promise.all([
        fetchCatalogoMateriais(),
        fetchFerragensVinculos(),
      ])

      const catalogo = catData ?? []
      setMateriaisCatalogo(catalogo)

      const map = vinculosRes.mapVinculos
      setVinculosMap(map)

      // Lista de nomes de ferragens a partir dos vínculos cadastrados
      const nomes = new Set<string>()
      for (const v of vinculosRes.data) {
        if (v.nome_ferragem) nomes.add(v.nome_ferragem)
      }

      // Adiciona ferragens padrão comuns se não existirem
      const defaults = [
        'Dobradiça 35mm',
        'Dobradiça 35mm Amortecedor',
        'Dobradiça Inox',
        'Dobradiça Inox Amortecedor',
        'Puxador',
        'Corrediça Telescópica (par)',
        'Corrediça Telescópica 400mm',
        'Corrediça Telescópica 450mm',
        'Corrediça Oculta Amortecedor',
        'Pistão a Gás',
        'Pistão a Gás 80N',
        'Trilho p/ Porta Coplanar',
        'Kit p/ Portas Deslizantes',
        'Lateral Metálica de Gaveta',
        'Pé Quadrado Alumínio 120mm',
        'Pé Palito Madeira 200mm',
        'Porta Alumínio Preto + Vidro Fluted',
        'Perfil LED de Sobrepor',
        'Fechadura para Móvel',
        'Cesto Tulha Aramado Basculante',
      ]
      for (const d of defaults) {
        nomes.add(d)
      }

      if (ferragemInicial && ferragemInicial.trim()) {
        nomes.add(ferragemInicial.trim())
      }

      const listaOrdenada = Array.from(nomes).sort((a, b) => a.localeCompare(b, 'pt-BR'))
      setNomesFerragens(listaOrdenada)
    } catch (err) {
      console.error('Erro ao carregar dados de ferragens:', err)
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os materiais do catálogo.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      carregarDados()
      if (ferragemInicial) {
        setSearchTerm(ferragemInicial)
      }
    }
  }, [open, ferragemInicial])

  // Vincula uma ferragem a um item do catálogo
  const handleVincular = async (nomeFerragem: string, catalogoId: string | null) => {
    setSalvandoItem(nomeFerragem)
    try {
      const { success, error } = await upsertFerragemVinculo(nomeFerragem, catalogoId)
      if (!success || error) {
        toast({
          title: 'Erro ao vincular ferragem',
          description: error || 'Não foi possível salvar o vínculo.',
          variant: 'destructive',
        })
        return
      }

      // Atualiza o estado local imediatamente
      const catItem = catalogoId ? materiaisCatalogo.find((m) => m.id === catalogoId) : null
      const novoDetalhe: VinculoComDetalhes = {
        nome_ferragem: nomeFerragem,
        catalogo_material_id: catalogoId,
        nome_material: catItem?.nome_material ?? null,
        preco_custo: catItem?.preco_custo ?? null,
        estoque_qtd: catItem?.estoque_qtd ?? null,
        unidade: catItem?.unidade ?? null,
        categoria: catItem?.categoria ?? null,
      }

      setVinculosMap((prev) => {
        const next = new Map(prev)
        next.set(nomeFerragem, novoDetalhe)
        next.set(nomeFerragem.toLowerCase(), novoDetalhe)
        return next
      })

      toast({
        title: catalogoId ? 'Ferragem vinculada com sucesso!' : 'Vínculo removido',
        description: catalogoId
          ? `"${nomeFerragem}" agora utiliza o preço e estoque de "${catItem?.nome_material}".`
          : `O vínculo de "${nomeFerragem}" foi removido.`,
      })

      if (onVinculosUpdated) {
        onVinculosUpdated()
      }
    } finally {
      setSalvandoItem(null)
    }
  }

  // Criação manual de nova ferragem
  const handleCriarNovaFerragem = async () => {
    const nome = novaFerragemNome.trim()
    if (!nome) {
      toast({
        title: 'Nome obrigatório',
        description: 'Digite o nome da ferragem genérica.',
        variant: 'destructive',
      })
      return
    }

    await handleVincular(nome, novoMaterialId || null)
    setNomesFerragens((prev) => Array.from(new Set([nome, ...prev])))
    setNovaFerragemNome('')
    setNovoMaterialId('')
  }

  // Filtra itens exibidos
  const itensFiltrados = useMemo(() => {
    return nomesFerragens.filter((nome) => {
      const matchSearch =
        nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (vinculosMap.get(nome)?.nome_material || '')
          .toLowerCase()
          .includes(searchTerm.toLowerCase())

      if (!matchSearch) return false

      const estaVinculado = Boolean(vinculosMap.get(nome)?.catalogo_material_id)
      if (filtroStatus === 'vinculados') return estaVinculado
      if (filtroStatus === 'pendentes') return !estaVinculado
      return true
    })
  }, [nomesFerragens, searchTerm, filtroStatus, vinculosMap])

  // Contadores
  const totalGeral = nomesFerragens.length
  const totalVinculados = nomesFerragens.filter((n) =>
    Boolean(vinculosMap.get(n)?.catalogo_material_id),
  ).length
  const totalPendentes = totalGeral - totalVinculados

  // Opções agrupadas de catálogo (apenas ferragens/acessórios e outras categorias de catálogo)
  const opcoesCatalogo = useMemo(() => {
    return materiaisCatalogo.slice().sort((a, b) => {
      // Prioriza categorias de Ferragem/Acessórios
      const catA = a.categoria || ''
      const catB = b.categoria || ''
      return catA.localeCompare(catB) || a.nome_material.localeCompare(b.nome_material)
    })
  }, [materiaisCatalogo])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  Vínculo Global de Ferragens com o Catálogo
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Vincule cada nome genérico de ferragem a um item do Catálogo de Materiais uma
                  única vez. Todo módulo paramétrico puxará o preço e estoque automaticamente.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
          {/* Card de Adicionar Nova Ferragem Manualmente */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-slate-700" />
                Vincular novo nome de ferragem
              </span>
              <span className="text-[11px] text-slate-500">
                Ou selecione abaixo para ferragens já existentes
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-5">
                <Input
                  value={novaFerragemNome}
                  onChange={(e) => setNovaFerragemNome(e.target.value)}
                  placeholder="Nome genérico (ex: Pistão 100N)"
                  className="h-8 text-xs bg-white"
                />
              </div>
              <div className="sm:col-span-5">
                <Select value={novoMaterialId} onValueChange={setNovoMaterialId}>
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue placeholder="Escolha do Catálogo..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    <SelectItem value="none">-- Nenhum (deixar pendente) --</SelectItem>
                    {opcoesCatalogo.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="text-xs">
                        {m.nome_material} — R$ {Number(m.preco_custo || 0).toFixed(2)} (
                        {m.categoria})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Button
                  onClick={handleCriarNovaFerragem}
                  disabled={!novaFerragemNome.trim() || salvandoItem !== null}
                  className="w-full h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Salvar
                </Button>
              </div>
            </div>
          </div>

          {/* Barra de Filtro e Busca */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar ferragem ou material..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs bg-white"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setFiltroStatus('todos')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  filtroStatus === 'todos'
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos ({totalGeral})
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus('vinculados')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  filtroStatus === 'vinculados'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                Vinculados ({totalVinculados})
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus('pendentes')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  filtroStatus === 'pendentes'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                Pendentes ({totalPendentes})
              </button>
            </div>
          </div>

          {/* Tabela de Vínculos */}
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
              <p className="text-xs text-slate-500">Carregando catálogo e vínculos...</p>
            </div>
          ) : itensFiltrados.length === 0 ? (
            <div className="py-8 text-center bg-white border border-dashed border-slate-200 rounded-xl">
              <p className="text-xs text-slate-500">
                Nenhuma ferragem encontrada para o filtro atual.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <div className="max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/90 text-slate-700 font-semibold sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-5/12">Nome Genérico (Módulo)</th>
                      <th className="py-2.5 px-3 w-5/12">Item Vinculado no Catálogo</th>
                      <th className="py-2.5 px-3 w-2/12 text-right">Preço / Estoque</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {itensFiltrados.map((nome) => {
                      const v = vinculosMap.get(nome)
                      const isVinculado = Boolean(v?.catalogo_material_id)
                      const isSaving = salvandoItem === nome

                      return (
                        <tr
                          key={nome}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isVinculado ? 'bg-white' : 'bg-amber-50/30'
                          }`}
                        >
                          {/* Nome da Ferragem */}
                          <td className="py-2.5 px-3 align-middle">
                            <div className="flex items-center gap-2">
                              {isVinculado ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              ) : (
                                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              )}
                              <span className="font-semibold text-slate-900">{nome}</span>
                            </div>
                          </td>

                          {/* Seletor do Item do Catálogo */}
                          <td className="py-2 px-3 align-middle">
                            <div className="flex items-center gap-1.5">
                              <Select
                                value={v?.catalogo_material_id || 'none'}
                                onValueChange={(val) => {
                                  const idFinal = val === 'none' ? null : val
                                  handleVincular(nome, idFinal)
                                }}
                                disabled={isSaving}
                              >
                                <SelectTrigger
                                  className={`h-7 text-xs bg-white border ${
                                    isVinculado
                                      ? 'border-slate-300 text-slate-900'
                                      : 'border-amber-300 bg-amber-50/40 text-amber-900'
                                  }`}
                                >
                                  <SelectValue placeholder="Vincular ao catálogo..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                  <SelectItem value="none" className="text-xs text-slate-400">
                                    -- Não vinculado --
                                  </SelectItem>
                                  {opcoesCatalogo.map((m) => (
                                    <SelectItem key={m.id} value={m.id} className="text-xs">
                                      {m.nome_material} — R$ {Number(m.preco_custo || 0).toFixed(2)}{' '}
                                      ({m.categoria})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {isSaving && (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500 shrink-0" />
                              )}

                              {isVinculado && (
                                <button
                                  type="button"
                                  onClick={() => handleVincular(nome, null)}
                                  title="Remover vínculo"
                                  disabled={isSaving}
                                  className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-100"
                                >
                                  <Unlink className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Preço e Estoque */}
                          <td className="py-2 px-3 text-right align-middle">
                            {isVinculado ? (
                              <div className="flex flex-col items-end">
                                <span className="font-mono font-bold text-emerald-700 text-xs">
                                  R$ {Number(v?.preco_custo || 0).toFixed(2)}
                                  <span className="text-[10px] text-slate-500 font-normal ml-0.5">
                                    /{v?.unidade || 'un'}
                                  </span>
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  Estoque:{' '}
                                  {v?.estoque_qtd !== null && v?.estoque_qtd !== undefined
                                    ? v.estoque_qtd
                                    : '—'}
                                </span>
                              </div>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
                              >
                                Não vinculado
                              </Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-100 pt-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs font-semibold"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
