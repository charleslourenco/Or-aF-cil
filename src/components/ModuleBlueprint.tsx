import React from 'react'
import { cn } from '@/lib/utils'

interface ModuleBlueprintProps {
  type: 'wardrobe' | 'counter' | 'aerial' | 'empty'
  className?: string
  color?: string
}

export const ModuleBlueprint: React.FC<ModuleBlueprintProps> = ({
  type,
  className,
  color = '#059669',
}) => {
  if (type === 'empty') {
    return (
      <div
        className={cn(
          'relative w-full h-48 flex flex-col items-center justify-center bg-slate-50/80 rounded-xl border border-dashed border-slate-200',
          className,
        )}
      >
        <svg
          className="w-16 h-16 text-slate-300 stroke-[1.2]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
        <span className="mt-2 text-xs font-medium text-slate-400">Nenhum módulo selecionado</span>
      </div>
    )
  }

  if (type === 'wardrobe') {
    // Roupeiro 2 portas estilizado em SVG com detalhes de marcenaria
    return (
      <div
        className={cn(
          'relative w-full h-56 bg-gradient-to-b from-emerald-50/50 via-slate-50 to-white rounded-xl border border-emerald-100 flex items-center justify-center p-4 overflow-hidden shadow-inner',
          className,
        )}
      >
        {/* Background Grid Accent */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:16px_16px] opacity-40 pointer-events-none" />

        <svg
          viewBox="0 0 320 220"
          className="w-full h-full max-h-48 drop-shadow-md z-10"
          fill="none"
        >
          {/* Outer Cabinet Frame */}
          <rect
            x="70"
            y="20"
            width="180"
            height="180"
            rx="4"
            fill="#F1F5F9"
            stroke="#334155"
            strokeWidth="3"
          />

          {/* Top cornice / Maleiro divider */}
          <line
            x1="70"
            y1="65"
            x2="250"
            y2="65"
            stroke="#64748B"
            strokeWidth="2"
            strokeDasharray="4 2"
          />
          <text
            x="160"
            y="48"
            fill="#64748B"
            fontSize="10"
            fontWeight="600"
            textAnchor="middle"
            letterSpacing="1"
          >
            MALEIRO REFORÇADO
          </text>

          {/* Center Door Gap */}
          <line x1="160" y1="20" x2="160" y2="200" stroke="#0F172A" strokeWidth="3" />

          {/* Left Door Handle (Perfil Gola) */}
          <rect x="146" y="95" width="6" height="50" rx="3" fill="#059669" />
          <rect x="147" y="98" width="4" height="44" rx="2" fill="#34D399" />

          {/* Right Door Handle (Perfil Gola) */}
          <rect x="168" y="95" width="6" height="50" rx="3" fill="#059669" />
          <rect x="169" y="98" width="4" height="44" rx="2" fill="#34D399" />

          {/* Base / Rodapé */}
          <rect x="80" y="194" width="160" height="6" fill="#334155" />
          <line x1="100" y1="200" x2="100" y2="206" stroke="#334155" strokeWidth="3" />
          <line x1="220" y1="200" x2="220" y2="206" stroke="#334155" strokeWidth="3" />

          {/* Technical Measurement Badges */}
          <g className="text-[9px] font-mono font-medium">
            <rect
              x="18"
              y="95"
              width="44"
              height="18"
              rx="4"
              fill="#059669"
              fillOpacity="0.1"
              stroke="#059669"
              strokeWidth="1"
            />
            <text x="40" y="108" fill="#047857" fontSize="9" fontWeight="bold" textAnchor="middle">
              2000 mm
            </text>
            <line
              x1="64"
              y1="20"
              x2="64"
              y2="200"
              stroke="#059669"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <line x1="60" y1="20" x2="68" y2="20" stroke="#059669" strokeWidth="1.5" />
            <line x1="60" y1="200" x2="68" y2="200" stroke="#059669" strokeWidth="1.5" />

            <rect
              x="135"
              y="2"
              width="50"
              height="16"
              rx="4"
              fill="#059669"
              fillOpacity="0.1"
              stroke="#059669"
              strokeWidth="1"
            />
            <text x="160" y="13" fill="#047857" fontSize="9" fontWeight="bold" textAnchor="middle">
              1200 mm
            </text>
          </g>

          {/* Material Tag */}
          <rect x="230" y="170" width="75" height="18" rx="4" fill="#0F172A" />
          <text x="267" y="182" fill="#FFFFFF" fontSize="8.5" fontWeight="600" textAnchor="middle">
            MDF 18mm
          </text>
        </svg>
      </div>
    )
  }

  if (type === 'counter') {
    // Balcão de Cozinha
    return (
      <div
        className={cn(
          'relative w-full h-56 bg-gradient-to-b from-emerald-50/50 via-slate-50 to-white rounded-xl border border-emerald-100 flex items-center justify-center p-4 overflow-hidden shadow-inner',
          className,
        )}
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:16px_16px] opacity-40 pointer-events-none" />

        <svg
          viewBox="0 0 320 220"
          className="w-full h-full max-h-48 drop-shadow-md z-10"
          fill="none"
        >
          {/* Tampo Granito / Superior */}
          <rect
            x="50"
            y="45"
            width="220"
            height="14"
            rx="2"
            fill="#334155"
            stroke="#0F172A"
            strokeWidth="2"
          />

          {/* Caixaria */}
          <rect
            x="60"
            y="59"
            width="200"
            height="125"
            fill="#F8FAFC"
            stroke="#334155"
            strokeWidth="3"
          />

          {/* Divisão Gaveteiro / Portas */}
          <line x1="160" y1="59" x2="160" y2="184" stroke="#334155" strokeWidth="2" />

          {/* Gaveta Superior Esquerda */}
          <rect
            x="68"
            y="67"
            width="84"
            height="48"
            rx="2"
            fill="#FFFFFF"
            stroke="#64748B"
            strokeWidth="1.5"
          />
          <rect x="94" y="88" width="32" height="6" rx="2" fill="#059669" />

          {/* Gavetão Inferior Esquerda */}
          <rect
            x="68"
            y="122"
            width="84"
            height="54"
            rx="2"
            fill="#FFFFFF"
            stroke="#64748B"
            strokeWidth="1.5"
          />
          <rect x="94" y="146" width="32" height="6" rx="2" fill="#059669" />

          {/* Portas Direitas */}
          <rect
            x="168"
            y="67"
            width="84"
            height="109"
            rx="2"
            fill="#FFFFFF"
            stroke="#64748B"
            strokeWidth="1.5"
          />
          <line x1="210" y1="67" x2="210" y2="176" stroke="#CBD5E1" strokeWidth="1.5" />
          <rect x="202" y="112" width="4" height="24" rx="2" fill="#059669" />
          <rect x="214" y="112" width="4" height="24" rx="2" fill="#059669" />

          {/* Pés Reguláveis */}
          <rect x="75" y="184" width="14" height="18" rx="2" fill="#334155" />
          <rect x="153" y="184" width="14" height="18" rx="2" fill="#334155" />
          <rect x="231" y="184" width="14" height="18" rx="2" fill="#334155" />

          {/* Medidas */}
          <text x="160" y="36" fill="#047857" fontSize="9" fontWeight="bold" textAnchor="middle">
            1200 mm (L)
          </text>
          <text x="35" y="125" fill="#047857" fontSize="9" fontWeight="bold" textAnchor="middle">
            850 mm (A)
          </text>
        </svg>
      </div>
    )
  }

  // Aerial (Armário Aéreo)
  return (
    <div
      className={cn(
        'relative w-full h-56 bg-gradient-to-b from-emerald-50/50 via-slate-50 to-white rounded-xl border border-emerald-100 flex items-center justify-center p-4 overflow-hidden shadow-inner',
        className,
      )}
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:16px_16px] opacity-40 pointer-events-none" />

      <svg viewBox="0 0 320 220" className="w-full h-full max-h-48 drop-shadow-md z-10" fill="none">
        {/* Wall mounting line */}
        <line
          x1="40"
          y1="35"
          x2="280"
          y2="35"
          stroke="#CBD5E1"
          strokeWidth="2"
          strokeDasharray="6 4"
        />
        <text x="160" y="28" fill="#94A3B8" fontSize="8" fontWeight="600" textAnchor="middle">
          FIXAÇÃO OCULTA SUSPENSA
        </text>

        {/* Caixaria Aéreo */}
        <rect
          x="60"
          y="45"
          width="200"
          height="110"
          rx="3"
          fill="#F8FAFC"
          stroke="#334155"
          strokeWidth="3"
        />

        {/* Porta Basculante */}
        <rect
          x="68"
          y="53"
          width="184"
          height="94"
          rx="2"
          fill="#FFFFFF"
          stroke="#059669"
          strokeWidth="2"
        />

        {/* Puxador Horizontal inferior */}
        <rect x="110" y="132" width="100" height="6" rx="3" fill="#059669" />

        {/* Símbolo de Abertura Basculante (Pistão a Gás) */}
        <path
          d="M160 115 L160 80 M160 80 L152 88 M160 80 L168 88"
          stroke="#059669"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="160" y="74" fill="#047857" fontSize="9" fontWeight="bold" textAnchor="middle">
          PISTÃO A GÁS
        </text>

        {/* Medidas */}
        <text x="160" y="176" fill="#047857" fontSize="9" fontWeight="bold" textAnchor="middle">
          900 x 600 x 350 mm
        </text>
        <rect x="210" y="184" width="85" height="18" rx="4" fill="#0F172A" />
        <text x="252" y="196" fill="#FFFFFF" fontSize="8.5" fontWeight="600" textAnchor="middle">
          MDF 18mm Acetinado
        </text>
      </svg>
    </div>
  )
}
