import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Hammer } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

export default function AuthGuard() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shadow-xl shadow-emerald-500/30">
            <Hammer className="w-7 h-7 animate-bounce" />
          </div>
          <div className="flex flex-col items-center">
            <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-1.5">
              OrçaFácil
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            </h1>
            <p className="text-xs text-slate-400 font-medium tracking-wider uppercase mt-0.5">
              Carregando sistema...
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
