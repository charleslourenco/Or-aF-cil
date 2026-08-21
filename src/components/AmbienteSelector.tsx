import React, { useState, useMemo } from 'react'
import { Check, ChevronsUpDown, Plus, Home, Building2, Store, Sparkles, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'

export interface CategoriaAmbiente {
  categoria: string
  icone?: React.ReactNode
  ambientes: string[]
}

export const AMBIENTES_PREDEFINIDOS: CategoriaAmbiente[] = [
  {
    categoria: 'Residencial — Área Íntima & Suítes',
    ambientes: [
      'Suíte Master',
      'Suíte Principal',
      'Suíte Casal',
      'Suíte 01',
      'Suíte 02',
      'Suíte 03',
      'Suíte 04',
      'Suíte 05',
      'Quarto 01',
      'Quarto 02',
      'Quarto 03',
      'Quarto 04',
      'Quarto 05',
      'Quarto de Solteiro 01',
      'Quarto de Solteiro 02',
      'Quarto de Hóspedes 01',
      'Quarto de Hóspedes 02',
      'Quarto Infantil',
      'Quarto do Bebê 01',
      'Quarto do Bebê 02',
      'Closet Suíte Master',
      'Closet 01',
      'Closet 02',
      'Closet 03',
      'Banheiro Suíte Master',
      'Banheiro Suíte 01',
      'Banheiro Suíte 02',
      'Banheiro Suíte 03',
      'Banheiro Suíte 04',
      'Banheiro Social 01',
      'Banheiro Social 02',
      'Banheiro Demi-Suíte 01',
      'Banheiro Demi-Suíte 02',
      'Banheiro Infantil',
      'Home Office Residencial',
      'Espaço de Estudos',
    ],
  },
  {
    categoria: 'Residencial — Área Social & Convivência',
    ambientes: [
      'Hall de Entrada',
      'Hall Social',
      'Sala de Estar',
      'Living Principal',
      'Sala de TV',
      'Home Theater',
      'Sala de Cinema',
      'Sala de Jantar',
      'Sala de Almoço',
      'Copa',
      'Cozinha Principal',
      'Cozinha Gourmet',
      'Cozinha de Apoio',
      'Cozinha Suja (Dirty Kitchen)',
      'Cantinho do Café',
      'Bar Residencial',
      'Cristaleira',
      'Adega',
      'Lavabo Social 01',
      'Lavabo Social 02',
      'Varanda Gourmet',
      'Sacada Integrada',
    ],
  },
  {
    categoria: 'Residencial — Serviços, Lazer & Apoio',
    ambientes: [
      'Lavanderia',
      'Área de Serviço Principal',
      'Lavanderia de Apoio',
      'Secaria',
      'Despensa de Alimentos',
      'Rouparia 01',
      'Rouparia 02',
      'Quarto de Serviço',
      'Suíte do Funcionário',
      'Banheiro de Serviço',
      'Depósito Residencial',
      'DML',
      'Garagem',
      'Oficina de Ferramentas',
      'Espaço Gourmet Externo',
      'Quiosque',
      'Banheiro da Piscina',
      'Vestiário',
      'Brinquedoteca',
      'Salão de Jogos',
      'Academia Residencial',
      'Espaço Wellness',
    ],
  },
  {
    categoria: 'Corporativo — Escritórios & Empresas',
    ambientes: [
      'Recepção',
      'Hall Corporativo',
      'Sala da Presidência',
      'Sala da Diretoria',
      'Sala de Reunião Principal (Grande)',
      'Sala de Reunião 01',
      'Sala de Reunião 02',
      'Sala de Reunião 03 (Huddle Rooms)',
      'Estações de Trabalho',
      'Open Space (Staff)',
      'Consultório',
      'Sala de Atendimento 01',
      'Sala de Atendimento 02',
      'Sala de Atendimento 03',
      'Auditório',
      'Sala de Treinamento',
      'Copa Corporativa',
      'Refeitório',
      'Espaço de Descompressão',
      'Lounge',
      'Central de Impressão',
      'Almoxarifado',
      'Sala de Servidores',
      'CPD',
      'Sanitário Masculino',
      'Sanitário Feminino',
      'Sanitário PWD',
    ],
  },
  {
    categoria: 'Comercial — Lojas, Gastronomia & Serviços',
    ambientes: [
      'Salão de Vendas',
      'Showroom Principal',
      'Balcão de Caixa',
      'Check-out',
      'Atendimento',
      'Provador 01',
      'Provador 02',
      'Provador 03',
      'Provador PWD',
      'Estoque Comercial',
      'Depósito de Mercadorias',
      'Salão do Restaurante',
      'Salão de Clientes',
      'Bar',
      'Balcão de Drinks',
      'Cozinha Industrial',
      'Área de Pré-Preparo',
      'Recepção de Hotel',
      'Pousada',
      'Quarto/Apt Hotel 01 (Standard)',
      'Apt 02 (Luxo)',
      'Apt 03 (Presidencial)',
      'Recepção de Clínica',
      'Sala de Espera',
      'Sala de Procedimentos 01',
      'Sala de Procedimentos 02',
    ],
  },
]

interface AmbienteSelectorProps {
  value: string
  onChange: (value: string) => void
  error?: string
  className?: string
  id?: string
}

export function AmbienteSelector({
  value,
  onChange,
  error,
  className,
  id = 'ambiente-combobox',
}: AmbienteSelectorProps) {
  const [open, setOpen] = useState(false)
  const [customAmbientes, setCustomAmbientes] = useState<string[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [newAmbienteName, setNewAmbienteName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const allCategories = useMemo(() => {
    if (customAmbientes.length === 0) return AMBIENTES_PREDEFINIDOS
    return [
      ...AMBIENTES_PREDEFINIDOS,
      {
        categoria: 'Personalizados / Novos',
        ambientes: customAmbientes,
      },
    ]
  }, [customAmbientes])

  const handleCreateNew = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = newAmbienteName.trim()
    if (!trimmed) return

    // Adiciona à lista de customizados se ainda não existir
    if (!customAmbientes.includes(trimmed)) {
      setCustomAmbientes((prev) => [...prev, trimmed])
    }
    onChange(trimmed)
    setNewAmbienteName('')
    setIsCreating(false)
    setOpen(false)
  }

  return (
    <div className={cn('relative w-full', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-full h-11 justify-between rounded-xl text-sm font-normal transition-all bg-white text-left px-3.5',
              !value && 'text-slate-400',
              value && 'text-slate-900 font-medium',
              error
                ? 'border-rose-500 ring-2 ring-rose-200 bg-rose-50/20'
                : 'border-slate-300 hover:border-emerald-500 hover:bg-slate-50/50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20',
            )}
          >
            <div className="flex items-center gap-2 truncate">
              <Home
                className={cn('w-4 h-4 shrink-0', value ? 'text-emerald-600' : 'text-slate-400')}
              />
              <span className="truncate">{value || 'Selecione o ambiente...'}</span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] min-w-[320px] max-w-[480px] p-0 rounded-xl shadow-xl border-slate-200 bg-white"
          align="start"
          sideOffset={6}
        >
          <Command
            className="rounded-xl"
            filter={(itemValue, search) => {
              if (itemValue.toLowerCase().includes(search.toLowerCase())) return 1
              return 0
            }}
          >
            <CommandInput
              placeholder="Buscar ambiente..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              className="h-11"
            />
            <CommandList className="max-h-[320px] overflow-y-auto p-1.5">
              <CommandEmpty className="py-6 text-center text-xs text-slate-500">
                Nenhum ambiente encontrado para &ldquo;{searchQuery}&rdquo;.
              </CommandEmpty>

              {allCategories.map((group) => (
                <CommandGroup
                  key={group.categoria}
                  heading={
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/80 px-1 py-1 block">
                      {group.categoria}
                    </span>
                  }
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-slate-500"
                >
                  {group.ambientes.map((amb) => {
                    const isSelected = value === amb
                    return (
                      <CommandItem
                        key={amb}
                        value={`${group.categoria} ${amb}`}
                        onSelect={() => {
                          onChange(amb)
                          setOpen(false)
                        }}
                        className={cn(
                          'flex items-center justify-between px-2.5 py-2 rounded-lg text-xs sm:text-sm cursor-pointer transition-colors',
                          isSelected
                            ? 'bg-emerald-50 text-emerald-900 font-semibold data-[selected=true]:bg-emerald-100'
                            : 'text-slate-700 data-[selected=true]:bg-slate-100 hover:bg-slate-50',
                        )}
                      >
                        <span className="truncate">{amb}</span>
                        {isSelected && <Check className="h-4 w-4 text-emerald-600 shrink-0 ml-2" />}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              ))}

              <CommandSeparator className="my-1 border-slate-100" />

              {/* Opção "+ Criar Novo Ambiente" */}
              <div className="p-1 pt-1.5">
                {!isCreating ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(true)
                      setNewAmbienteName(searchQuery || '')
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors text-left"
                  >
                    <Plus className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>+ Criar Novo Ambiente</span>
                  </button>
                ) : (
                  <form
                    onSubmit={handleCreateNew}
                    className="p-2 bg-slate-50 border border-slate-200 rounded-lg space-y-2 animate-fade-in"
                  >
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Novo Ambiente Personalizado
                    </div>
                    <Input
                      autoFocus
                      placeholder="Ex.: Adega Subterrânea, Sala de Jogos..."
                      value={newAmbienteName}
                      onChange={(e) => setNewAmbienteName(e.target.value)}
                      className="h-9 text-xs bg-white border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsCreating(false)
                          setNewAmbienteName('')
                        }}
                        className="h-7 text-xs px-2.5 text-slate-500 hover:text-slate-700"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={!newAmbienteName.trim()}
                        className="h-7 text-xs px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                      >
                        Adicionar
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
