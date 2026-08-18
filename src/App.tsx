/* Main App Component - Handles routing (using react-router-dom), query client and other providers - use this file to add all routes */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/components/ThemeProvider'
import Index from './pages/Index'
import QuotesListPage from './pages/QuotesListPage'
import LibraryPage from './pages/LibraryPage'
import DashboardPage from './pages/DashboardPage'
import CatalogPage from './pages/CatalogPage'
import EngineeringPage from './pages/EngineeringPage'
import SettingsPage from './pages/SettingsPage'
import UsersPage from './pages/UsersPage'
import NotFound from './pages/NotFound'
import Layout from './components/Layout'

// AVOID REMOVING ANY CONTEXT PROVIDERS FROM THIS FILE (e.g. TooltipProvider, Toaster, Sonner)

const App = () => (
  <ThemeProvider defaultTheme="dark" storageKey="orca-facil-theme">
    <BrowserRouter>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/novo-orcamento" element={<Index />} />
            <Route path="/orcamentos" element={<QuotesListPage />} />
            <Route path="/biblioteca" element={<LibraryPage />} />
            <Route path="/catalogo" element={<CatalogPage />} />
            <Route path="/engenharia-financeira" element={<EngineeringPage />} />
            <Route path="/configuracoes" element={<SettingsPage />} />
            <Route path="/usuarios" element={<UsersPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </BrowserRouter>
  </ThemeProvider>
)

export default App
