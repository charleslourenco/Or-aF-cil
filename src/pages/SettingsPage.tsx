import { useEffect, useState } from 'react'
import {
  Sparkles,
  KeyRound,
  Save,
  CheckCircle2,
  Settings as SettingsIcon,
  Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'

const STORAGE_KEY = 'openai_api_key'

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('')
  const [hasSavedKey, setHasSavedKey] = useState(false)

  // Carrega a chave salva no localStorage ao montar o componente.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      setApiKey(saved)
      setHasSavedKey(true)
    } else {
      setHasSavedKey(false)
    }
  }, [])

  const handleSaveKey = () => {
    const valor = apiKey.trim()
    localStorage.setItem(STORAGE_KEY, valor)
    setHasSavedKey(valor.length > 0)
    toast({
      title: 'Chave salva com sucesso!',
      description: 'Sua chave da OpenAI foi armazenada localmente no navegador.',
    })
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Cabeçalho da página */}
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold mb-1">
          <SettingsIcon className="w-3.5 h-3.5 text-slate-500" />
          <span>Configurações do Sistema</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Configurações
        </h2>
        <p className="text-sm sm:text-base text-slate-500 max-w-3xl leading-relaxed">
          Parâmetros do sistema, preferências e integrações com serviços externos.
        </p>
      </div>

      {/* Card: Integração de Inteligência Artificial */}
      <section
        aria-labelledby="ai-heading"
        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 sm:p-6 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-emerald-500 flex items-center justify-center shadow-md shadow-violet-500/20 shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3
                id="ai-heading"
                className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2"
              >
                Integração de Inteligência Artificial
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 max-w-2xl leading-relaxed">
                Configure sua chave da OpenAI para ativar o reconhecimento visual inteligente na
                tela de orçamento. A chave é armazenada apenas no seu navegador.
              </p>
            </div>
          </div>

          {/* Indicador visual de status da chave */}
          {hasSavedKey ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />✓ Chave configurada
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-500 text-xs font-semibold shadow-xs">
              Não configurada
            </span>
          )}
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          <div className="space-y-2">
            <Label
              htmlFor="openai-api-key"
              className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
              OpenAI API Key (sk-...)
            </Label>
            <Input
              id="openai-api-key"
              type="password"
              autoComplete="off"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="h-11 rounded-xl text-sm font-mono border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              A chave nunca é enviada para servidores do OrçaFácil — fica apenas neste navegador.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
            <Button
              type="button"
              onClick={handleSaveKey}
              className="h-11 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-600/25 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Salvar Chave
            </Button>
            <p className="text-[11px] text-slate-400">
              Você pode obter sua chave em{' '}
              <span className="font-mono text-slate-500">platform.openai.com/api-keys</span>.
            </p>
          </div>
        </div>
      </section>

      {/* Card: Outras Configurações (futuro) */}
      <section
        aria-labelledby="other-heading"
        className="bg-white rounded-2xl border border-slate-200 shadow-sm"
      >
        <div className="flex items-center justify-between gap-3 p-5 sm:p-6 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <SettingsIcon className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <h3 id="other-heading" className="text-base sm:text-lg font-bold text-slate-900">
                Outras Configurações
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Parâmetros adicionais do sistema (markup padrão, integrações e notificações).
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 border border-amber-200 text-amber-700 text-xs font-semibold shadow-xs">
            Em construção
          </span>
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex flex-col items-center justify-center text-center py-8 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <SettingsIcon className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Mais configurações em breve</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Em breve você poderá configurar markup comercial padrão, integrações de pagamento e
              notificações por e-mail diretamente desta tela.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
