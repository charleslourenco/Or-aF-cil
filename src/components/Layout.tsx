import React, { useState } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Layers,
  Settings,
  PlusCircle,
  Menu,
  X,
  ChevronLeft,
  Hammer,
  LogOut,
  FolderGit2,
  Bell,
  BookOpen,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  badge?: string
  isPrimaryAction?: boolean
}

const navItems: NavItem[] = [
  { name: 'Painel de Orçamentos', href: '/', icon: LayoutDashboard },
  { name: 'Novo Orçamento', href: '/novo-orcamento', icon: PlusCircle },
  { name: 'Biblioteca de Módulos', href: '/biblioteca', icon: Layers },
  { name: 'Catálogo de Materiais', href: '/catalogo', icon: BookOpen },
  { name: 'Engenharia Financeira', href: '/engenharia-financeira', icon: Wallet },
  { name: 'Configurações', href: '/configuracoes', icon: Settings },
  { name: 'Usuários', href: '/usuarios', icon: Users },
]

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeProject, setActiveProject] = useState('Obra Ed. Jardins - Apto 402')
  const location = useLocation()

  const isCurrent = (href: string) => {
    if (href === '/' && location.pathname === '/') return true
    if (href !== '/' && location.pathname.startsWith(href)) return true
    return false
  }

  // Get current page title for Topbar
  const getPageMeta = () => {
    if (location.pathname === '/') {
      return {
        title: 'Novo Orçamento',
        breadcrumb: 'Orçamentos / Novo Orçamento',
        showBack: true,
        backHref: '/orcamentos',
      }
    }
    if (location.pathname === '/orcamentos') {
      return {
        title: 'Orçamentos Cadastrados',
        breadcrumb: 'Visão Geral / Orçamentos',
        showBack: false,
        backHref: '/',
      }
    }
    if (location.pathname === '/biblioteca') {
      return {
        title: 'Biblioteca de Módulos',
        breadcrumb: 'Sistema / Biblioteca de Módulos',
        showBack: true,
        backHref: '/',
      }
    }
    return {
      title: 'Marcenaria Pro',
      breadcrumb: 'Sistema',
      showBack: true,
      backHref: '/',
    }
  }

  const pageMeta = getPageMeta()

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col font-sans antialiased selection:bg-emerald-100 selection:text-emerald-900">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Container */}
      <div className="flex flex-1 w-full min-h-screen">
        {/* Sidebar Desktop & Mobile Drawer */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200/80 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto shadow-sm',
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          {/* Sidebar Header / Logo */}
          <div className="h-16 px-6 border-b border-slate-100 flex items-center justify-between">
            <Link
              to="/"
              className="flex items-center gap-3 group"
              onClick={() => setMobileMenuOpen(false)}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <Hammer className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base tracking-tight text-slate-900 group-hover:text-emerald-700 transition-colors flex items-center gap-1.5">
                  Marcenaria Pro
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </span>
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Módulos Sob Medida
                </span>
              </div>
            </Link>

            {/* Mobile close button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 lg:hidden"
              aria-label="Fechar menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Action Banner */}
          <div className="p-4 pb-2">
            <Link
              to="/novo-orcamento"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-emerald-600/20 transition-all hover:shadow-lg hover:shadow-emerald-600/30 active:scale-[0.98]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Novo Orçamento</span>
            </Link>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
            <div className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Menu Principal
            </div>

            {navItems.map((item) => {
              const active = isCurrent(item.href)
              const Icon = item.icon

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group',
                    active
                      ? 'bg-emerald-50/80 text-emerald-800 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={cn(
                        'w-4 h-4 transition-colors',
                        active ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600',
                      )}
                    />
                    <span>{item.name}</span>
                  </div>

                  {item.badge && (
                    <Badge
                      variant="secondary"
                      className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-semibold"
                    >
                      {item.badge}
                    </Badge>
                  )}

                  {active && !item.badge && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* User Footer inside Sidebar */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="w-9 h-9 border border-slate-200">
                  <AvatarImage
                    src="https://img.usecurling.com/ppl/medium?gender=male&seed=42"
                    alt="Marceneiro Responsável"
                  />
                  <AvatarFallback className="bg-emerald-600 text-white font-bold text-xs">
                    MP
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    Marcenaria Silva & Cia
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">Projetista Master</p>
                </div>
              </div>

              <button
                type="button"
                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition-colors"
                title="Sair do sistema"
                onClick={() => alert('Sessão ativa como Projetista Master.')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Content Column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar */}
          <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Mobile hamburger */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden text-slate-600 hover:text-slate-900"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Abrir menu"
              >
                <Menu className="w-5 h-5" />
              </Button>

              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <span>{pageMeta.breadcrumb}</span>
                </div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none mt-0.5">
                  {pageMeta.title}
                </h1>
              </div>
            </div>

            {/* Right Topbar actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Active Project Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden sm:flex items-center gap-2 text-xs font-medium border-slate-200 text-slate-700 bg-white hover:bg-slate-50 max-w-[220px] truncate rounded-lg shadow-xs"
                  >
                    <FolderGit2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span className="truncate">{activeProject}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="text-xs text-slate-500">
                    Selecione o Projeto Ativo
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setActiveProject('Obra Ed. Jardins - Apto 402')}
                    className="cursor-pointer text-xs"
                  >
                    Obra Ed. Jardins - Apto 402
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setActiveProject('Residência Alphaville - Casa 12')}
                    className="cursor-pointer text-xs"
                  >
                    Residência Alphaville - Casa 12
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setActiveProject('Escritório Comercial Faria Lima')}
                    className="cursor-pointer text-xs"
                  >
                    Escritório Comercial Faria Lima
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Notification icon */}
              <Button
                variant="ghost"
                size="icon"
                className="relative text-slate-500 hover:text-slate-800"
                aria-label="Notificações"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
              </Button>

              {/* Back to quotes button (if applicable) */}
              {pageMeta.showBack && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="hidden md:flex items-center gap-1.5 text-xs font-semibold border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg shadow-xs"
                >
                  <Link to={pageMeta.backHref}>
                    <ChevronLeft className="w-4 h-4" />
                    Voltar aos Orçamentos
                  </Link>
                </Button>
              )}
            </div>
          </header>

          {/* Page Content Body */}
          <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>

          {/* Global Footer */}
          <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto w-full">
            <span>
              © {new Date().getFullYear()} Marcenaria Pro — Sistema Especialista em Mobiliário Sob
              Medida.
            </span>
            <div className="flex items-center gap-4 text-[11px] text-slate-400">
              <span>Versão 2.4.0</span>
              <span>•</span>
              <span className="text-emerald-600 font-medium">Sistema 100% Operacional</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
