export default function SettingsPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col items-center text-center gap-3 max-w-md">
        <span className="text-4xl">⚙️</span>
        <h2 className="text-xl font-bold text-slate-900">Configurações</h2>
        <p className="text-sm text-slate-500">Parâmetros do sistema, preferências e integrações.</p>
        <span className="bg-amber-100 text-amber-700 rounded-full px-3 py-1 text-xs font-semibold">
          Em construção
        </span>
      </div>
    </div>
  )
}
