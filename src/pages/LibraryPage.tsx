import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Layers,
  Sparkles,
  PlusCircle,
  Search,
  Check,
  Ruler,
  Boxes,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ModuleBlueprint } from '@/components/ModuleBlueprint'
import { LIBRARY_MODULES, LibraryModule } from '@/data/mockData'

export default function LibraryPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos')

  const modulesList = Object.values(LIBRARY_MODULES)

  const categories = ['Todos', 'Quarto', 'Cozinha', 'Sala']

  const filteredModules = modulesList.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.material.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCat = selectedCategory === 'Todos' || m.category.includes(selectedCategory)
    return matchesSearch && matchesCat
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Biblioteca de Módulos Paramétricos
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Catálogo de módulos padrões com peças, ferragens e planos de corte pré-configurados.
          </p>
        </div>

        <Button
          asChild
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
        >
          <Link to="/">
            <PlusCircle className="w-4 h-4 mr-2" />
            Criar Orçamento com Módulo
          </Link>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar por nome, material..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        {/* Category chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredModules.map((mod) => (
          <div
            key={mod.id}
            className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col group"
          >
            {/* Blueprint preview */}
            <div className="p-4 bg-slate-50/50 border-b border-slate-100">
              <ModuleBlueprint type={mod.iconType} className="h-44" />
            </div>

            {/* Content */}
            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold uppercase tracking-wider"
                  >
                    {mod.category}
                  </Badge>
                  <span className="text-[11px] font-mono text-slate-400">
                    {mod.defaultParts.length} peças base
                  </span>
                </div>

                <h3 className="font-bold text-base text-slate-900 mt-2 group-hover:text-emerald-700 transition-colors">
                  {mod.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{mod.description}</p>
              </div>

              {/* Specs */}
              <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Ruler className="w-3.5 h-3.5 text-emerald-600" /> Dimensões:
                  </span>
                  <span className="font-mono font-bold text-slate-800">{mod.dimensions}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Boxes className="w-3.5 h-3.5 text-emerald-600" /> Material:
                  </span>
                  <span
                    className="font-medium text-slate-700 truncate max-w-[170px]"
                    title={mod.material}
                  >
                    {mod.material}
                  </span>
                </div>
              </div>

              {/* Action */}
              <Button
                asChild
                className="w-full bg-slate-900 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                <Link to={`/?modulo=${mod.id}`}>
                  Usar no Orçamento
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
