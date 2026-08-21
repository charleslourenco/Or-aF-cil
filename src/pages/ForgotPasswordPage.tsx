import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Hammer, Mail, ArrowLeft, CheckCircle2, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email.trim()) {
      setErrorMessage('Por favor, informe seu e-mail cadastrado.')
      return
    }

    setLoading(true)
    try {
      const redirectUrl = `${window.location.origin}/login`
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
      })

      if (error) {
        setErrorMessage(error.message || 'Falha ao solicitar redefinição. Tente novamente.')
      } else {
        setSuccess(true)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar solicitação.'
      setErrorMessage(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white">
      {/* Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 p-8 sm:p-10 text-slate-900 dark:text-slate-100">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 mb-4">
              <Hammer className="w-7 h-7" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-2xl tracking-tight text-slate-900 dark:text-white">
                OrçaFácil
              </span>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-4">
              Recuperar Senha
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Informe seu e-mail para receber as instruções de recuperação
            </p>
          </div>

          {success ? (
            <div className="space-y-6 text-center animate-fadeIn">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                <p className="font-semibold text-sm">E-mail de redefinição enviado!</p>
                <p className="text-slate-600 dark:text-slate-300">
                  Se o e-mail existir, um link de redefinição foi enviado para{' '}
                  <strong>{email}</strong>. Verifique sua caixa de entrada e spam.
                </p>
              </div>

              <Button
                asChild
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl"
              >
                <Link to="/login">Voltar ao Login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="email"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  E-mail cadastrado
                </Label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl focus-visible:ring-emerald-500 text-sm"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-md shadow-emerald-600/20 transition-all hover:shadow-lg hover:shadow-emerald-600/30 active:scale-[0.99] mt-2 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enviando link...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Enviar link de redefinição</span>
                  </>
                )}
              </Button>

              {errorMessage && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-medium animate-fadeIn">
                  {errorMessage}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar para o login</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
