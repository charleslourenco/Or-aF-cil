import React from 'react'
import { cn } from '@/lib/utils'

export type ModuloBlueprintType = 'wardrobe' | 'counter' | 'aerial' | 'empty'

export interface ModuloDimensoes {
  largura: number
  altura: number
  profundidade: number
}

interface ModuloBlueprint2DProps {
  type: ModuloBlueprintType
  dimensoes?: ModuloDimensoes
  corMdf?: string
  className?: string
}

const DEFAULT_DIMENSOES: ModuloDimensoes = {
  largura: 1800,
  altura: 2200,
  profundidade: 600,
}

// Paleta blueprint / CAD.
const C = {
  bg: '#0F172A',
  gridMinor: '#1E293B',
  gridMajor: '#334155',
  outline: '#38BDF8',
  outlineDim: '#64748B',
  accent: '#22D3EE',
  rodape: '#475569',
  tampo: '#475569',
  pes: '#475569',
  cota: '#94A3B8',
  text: '#CBD5E1',
  textDim: '#64748B',
  tag: '#0EA5E9',
}

/**
 * Renderiza o <pattern> de grid reticulado (papel milimetrado) usado como
 * fundo de todos os blueprints. Linhas finas a cada 20px, grossas a cada 100px.
 */
const GridPattern: React.FC<{ id: string }> = ({ id }) => (
  <pattern id={id} width="100" height="100" patternUnits="userSpaceOnUse">
    {/* células menores 20px */}
    {Array.from({ length: 5 }).map((_, i) => (
      <React.Fragment key={`v${i}`}>
        <line x1={i * 20} y1={0} x2={i * 20} y2={100} stroke={C.gridMinor} strokeWidth={0.5} />
        <line x1={0} y1={i * 20} x2={100} y2={i * 20} stroke={C.gridMinor} strokeWidth={0.5} />
      </React.Fragment>
    ))}
    {/* linha grossa a cada 100px */}
    <line x1={0} y1={0} x2={0} y2={100} stroke={C.gridMajor} strokeWidth={1} />
    <line x1={0} y1={0} x2={100} y2={0} stroke={C.gridMajor} strokeWidth={1} />
  </pattern>
)

/**
 * Calcula as dimensões (em unidades SVG) do retângulo da caixaria mantendo a
 * proporção largura/altura real das dimensões informadas. Cabe dentro de uma
 * área máxima de desenho preservando o aspect ratio.
 */
function calcRect(dim: ModuloDimensoes, maxW: number, maxH: number): { w: number; h: number } {
  const ratio = dim.altura > 0 ? dim.largura / dim.altura : 1
  let w = maxW
  let h = w / ratio
  if (h > maxH) {
    h = maxH
    w = h * ratio
  }
  return { w: Math.round(w), h: Math.round(h) }
}

/** Formata número de milímetros para exibição em cota. */
const fmtMm = (n: number) => `${Math.round(n)} mm`

/** Extremidade em "V" de uma linha de cota. */
const CotaTick: React.FC<{ x: number; y: number; dx: number; dy: number }> = ({ x, y, dx, dy }) => (
  <path
    d={`M ${x - dx} ${y - dy} L ${x + dx} ${y + dy}`}
    stroke={C.cota}
    strokeWidth={1}
    strokeLinecap="round"
  />
)

/** Linha de cota completa horizontal (extremidades em V + texto central). */
const CotaHorizontal: React.FC<{
  x1: number
  x2: number
  y: number
  label: string
}> = ({ x1, x2, y, label }) => (
  <g>
    <line x1={x1} y1={y} x2={x2} y2={y} stroke={C.cota} strokeWidth={1} />
    <CotaTick x={x1} y={y} dx={0} dy={4} />
    <CotaTick x={x2} y={y} dx={0} dy={4} />
    <text
      x={(x1 + x2) / 2}
      y={y - 5}
      fill={C.cota}
      fontSize={10}
      fontFamily="ui-monospace, monospace"
      textAnchor="middle"
    >
      {label}
    </text>
  </g>
)

/** Linha de cota completa vertical (extremidades em V + texto central rotacionado). */
const CotaVertical: React.FC<{
  x: number
  y1: number
  y2: number
  label: string
}> = ({ x, y1, y2, label }) => (
  <g>
    <line x1={x} y1={y1} x2={x} y2={y2} stroke={C.cota} strokeWidth={1} />
    <CotaTick x={x} y={y1} dx={4} dy={0} />
    <CotaTick x={x} y={y2} dx={4} dy={0} />
    <text
      x={x - 6}
      y={(y1 + y2) / 2}
      fill={C.cota}
      fontSize={10}
      fontFamily="ui-monospace, monospace"
      textAnchor="middle"
      transform={`rotate(-90 ${x - 6} ${(y1 + y2) / 2})`}
    >
      {label}
    </text>
  </g>
)

/** Tag de material fixada no canto inferior direito. */
const MaterialTag: React.FC<{ x: number; y: number; corMdf?: string }> = ({ x, y, corMdf }) => (
  <g>
    <rect
      x={x - 92}
      y={y - 18}
      width={92}
      height={16}
      rx={3}
      fill={C.bg}
      stroke={C.tag}
      strokeWidth={0.75}
    />
    <text
      x={x - 46}
      y={y - 6}
      fill={C.accent}
      fontSize={9}
      fontFamily="ui-monospace, monospace"
      fontWeight={600}
      textAnchor="middle"
    >
      {corMdf ? corMdf.slice(0, 14) : 'MDF 18mm'}
    </text>
  </g>
)

export const ModuloBlueprint2D: React.FC<ModuloBlueprint2DProps> = ({
  type,
  dimensoes = DEFAULT_DIMENSOES,
  corMdf,
  className,
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

  // Área útil de desenho (deixa margem para cotas superior e lateral).
  const drawMaxW = 300
  const drawMaxH = 200
  const { w: rectW, h: rectH } = calcRect(dimensoes, drawMaxW, drawMaxH)
  // Centraliza a caixaria em X; em Y deixa um pouco de respiro no topo.
  const rectX = (400 - rectW) / 2
  const rectY = 60

  return (
    <div
      className={cn(
        'relative w-full h-56 bg-slate-900 rounded-xl border border-slate-700 flex items-center justify-center p-2 overflow-hidden shadow-inner',
        className,
      )}
    >
      <svg
        viewBox="0 0 400 320"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        fill="none"
      >
        {/* Fundo + grid */}
        <defs>
          <GridPattern id={`grid-${type}`} />
        </defs>
        <rect x={0} y={0} width={400} height={320} fill={C.bg} />
        <rect x={0} y={0} width={400} height={320} fill={`url(#grid-${type})`} />

        {type === 'wardrobe' && (
          <WardrobeBlueprint
            rectX={rectX}
            rectY={rectY}
            rectW={rectW}
            rectH={rectH}
            dimensoes={dimensoes}
            corMdf={corMdf}
          />
        )}
        {type === 'counter' && (
          <CounterBlueprint
            rectX={rectX}
            rectY={rectY}
            rectW={rectW}
            rectH={rectH}
            dimensoes={dimensoes}
            corMdf={corMdf}
          />
        )}
        {type === 'aerial' && (
          <AerialBlueprint
            rectX={rectX}
            rectY={rectY}
            rectW={rectW}
            rectH={rectH}
            dimensoes={dimensoes}
            corMdf={corMdf}
          />
        )}
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-blueprints por tipo. Todos recebem a geometria calculada (caixaria já
// proporcional às dimensões reais) e apenas desenham os detalhes internos.
// ---------------------------------------------------------------------------

interface BlueprintProps {
  rectX: number
  rectY: number
  rectW: number
  rectH: number
  dimensoes: ModuloDimensoes
  corMdf?: string
}

const WardrobeBlueprint: React.FC<BlueprintProps> = ({
  rectX,
  rectY,
  rectW,
  rectH,
  dimensoes,
  corMdf,
}) => {
  const cx = rectX + rectW / 2
  const maleiroY = rectY + rectH * 0.22
  const rodapeH = 8
  const rodapeY = rectY + rectH - rodapeH

  return (
    <g>
      {/* Caixaria externa */}
      <rect x={rectX} y={rectY} width={rectW} height={rectH} stroke={C.outline} strokeWidth={2} />

      {/* Divisão central das portas (tracejada) */}
      <line
        x1={cx}
        y1={rectY}
        x2={cx}
        y2={rodapeY}
        stroke={C.outlineDim}
        strokeWidth={1}
        strokeDasharray="5 3"
      />

      {/* Maleiro (divisão horizontal tracejada ~25% topo) */}
      <line
        x1={rectX}
        y1={maleiroY}
        x2={rectX + rectW}
        y2={maleiroY}
        stroke={C.outlineDim}
        strokeWidth={1}
        strokeDasharray="5 3"
      />
      <text
        x={cx}
        y={rectY + 13}
        fill={C.textDim}
        fontSize={8}
        fontFamily="ui-monospace, monospace"
        textAnchor="middle"
        letterSpacing="1"
      >
        MALEIRO
      </text>

      {/* Puxadores perfil gola (laterais internas de cada porta) */}
      <rect
        x={cx - 10}
        y={maleiroY + (rodapeY - maleiroY) / 2 - 22}
        width={4}
        height={44}
        rx={1.5}
        fill={C.accent}
      />
      <rect
        x={cx + 6}
        y={maleiroY + (rodapeY - maleiroY) / 2 - 22}
        width={4}
        height={44}
        rx={1.5}
        fill={C.accent}
      />

      {/* Seta de abertura de porta (arco tracejado + seta) */}
      <path
        d={`M ${rectX + 8} ${rodapeY - 4} A ${rectW / 2 - 8} ${
          rectW / 2 - 8
        } 0 0 1 ${cx - 10} ${maleiroY + (rodapeY - maleiroY) / 2}`}
        stroke={C.outlineDim}
        strokeWidth={0.75}
        strokeDasharray="3 3"
      />
      <path
        d={`M ${cx - 10} ${maleiroY + (rodapeY - maleiroY) / 2} l 6 -2 l -2 5 z`}
        fill={C.outlineDim}
      />

      {/* Rodapé */}
      <rect x={rectX} y={rodapeY} width={rectW} height={rodapeH} fill={C.rodape} />

      {/* Cotas */}
      <CotaHorizontal
        x1={rectX}
        x2={rectX + rectW}
        y={rectY - 14}
        label={`L ${fmtMm(dimensoes.largura)}`}
      />
      <CotaVertical
        x={rectX - 14}
        y1={rectY}
        y2={rectY + rectH}
        label={`A ${fmtMm(dimensoes.altura)}`}
      />

      <MaterialTag x={rectX + rectW + 6} y={rodapeY + 6} corMdf={corMdf} />
    </g>
  )
}

const CounterBlueprint: React.FC<BlueprintProps> = ({
  rectX,
  rectY,
  rectW,
  rectH,
  dimensoes,
  corMdf,
}) => {
  const cx = rectX + rectW / 2
  const tampoH = 12
  const tampoY = rectY - tampoH
  const tampoX = rectX - 15
  const tampoW = rectW + 30
  const bodyY = rectY
  const bodyH = rectH - 18 // espaço para os pés
  const pesY = rectY + bodyH

  // Metades esquerda (gavetas) / direita (portas)
  const leftW = rectW / 2
  const rightW = rectW / 2
  const gavH = bodyH / 2

  return (
    <g>
      {/* Tampo superior (com balanço) */}
      <rect
        x={tampoX}
        y={tampoY}
        width={tampoW}
        height={tampoH}
        rx={1.5}
        fill={C.tampo}
        stroke={C.outlineDim}
        strokeWidth={1}
      />

      {/* Caixaria principal */}
      <rect x={rectX} y={bodyY} width={rectW} height={bodyH} stroke={C.outline} strokeWidth={2} />

      {/* Divisão vertical central */}
      <line
        x1={cx}
        y1={bodyY}
        x2={cx}
        y2={bodyY + bodyH}
        stroke={C.outlineDim}
        strokeWidth={1}
        strokeDasharray="4 3"
      />

      {/* Gavetas à esquerda (2 empilhadas) */}
      {[0, 1].map((i) => {
        const gy = bodyY + i * gavH + 4
        const gh = gavH - 8
        return (
          <g key={i}>
            <rect
              x={rectX + 4}
              y={gy}
              width={leftW - 8}
              height={gh}
              stroke={C.outlineDim}
              strokeWidth={1}
            />
            <rect
              x={rectX + leftW / 2 - 16}
              y={gy + gh / 2 - 2}
              width={32}
              height={4}
              rx={1.5}
              fill={C.accent}
            />
          </g>
        )
      })}

      {/* Portas à direita (2 lado a lado) */}
      {[0, 1].map((i) => {
        const px = cx + 4 + (i * (rightW - 8)) / 2
        const pw = (rightW - 8) / 2 - 2
        const ph = bodyH - 8
        return (
          <g key={i}>
            <rect
              x={px}
              y={bodyY + 4}
              width={pw}
              height={ph}
              stroke={C.outlineDim}
              strokeWidth={1}
            />
            <rect
              x={px + pw / 2 - 2}
              y={bodyY + ph / 2 - 10}
              width={4}
              height={20}
              rx={1.5}
              fill={C.accent}
            />
          </g>
        )
      })}

      {/* Pés reguláveis (3 pequenos retângulos) */}
      {[0, 1, 2].map((i) => {
        const fx = i === 0 ? rectX + 8 : i === 1 ? cx - 7 : rectX + rectW - 15
        return <rect key={i} x={fx} y={pesY} width={7} height={14} rx={1} fill={C.pes} />
      })}

      {/* Cotas */}
      <CotaHorizontal
        x1={tampoX}
        x2={tampoX + tampoW}
        y={tampoY - 8}
        label={`L ${fmtMm(dimensoes.largura)}`}
      />
      <CotaVertical
        x={rectX - 14}
        y1={tampoY}
        y2={pesY + 14}
        label={`A ${fmtMm(dimensoes.altura)}`}
      />

      <MaterialTag x={rectX + rectW + 6} y={pesY + 6} corMdf={corMdf} />
    </g>
  )
}

const AerialBlueprint: React.FC<BlueprintProps> = ({
  rectX,
  rectY,
  rectW,
  rectH,
  dimensoes,
  corMdf,
}) => {
  const cx = rectX + rectW / 2
  const cy = rectY + rectH / 2

  return (
    <g>
      {/* Linha de fixação na parede (tracejada, topo) */}
      <line
        x1={rectX - 20}
        y1={rectY - 10}
        x2={rectX + rectW + 20}
        y2={rectY - 10}
        stroke={C.outlineDim}
        strokeWidth={1.25}
        strokeDasharray="6 3"
      />
      {/* Hachura de parede */}
      {Array.from({ length: Math.floor((rectW + 40) / 14) }).map((_, i) => (
        <line
          key={i}
          x1={rectX - 20 + i * 14}
          y1={rectY - 10}
          x2={rectX - 20 + i * 14 - 6}
          y2={rectY - 18}
          stroke={C.outlineDim}
          strokeWidth={0.75}
        />
      ))}
      <text
        x={cx}
        y={rectY - 16}
        fill={C.textDim}
        fontSize={8}
        fontFamily="ui-monospace, monospace"
        textAnchor="middle"
        letterSpacing="1"
      >
        FIXAÇÃO OCULTA
      </text>

      {/* Caixaria */}
      <rect x={rectX} y={rectY} width={rectW} height={rectH} stroke={C.outline} strokeWidth={2} />

      {/* Porta basculante central */}
      <rect
        x={rectX + 6}
        y={rectY + 6}
        width={rectW - 12}
        height={rectH - 12}
        stroke={C.accent}
        strokeWidth={1.25}
        strokeDasharray="3 2"
      />

      {/* Puxador horizontal inferior */}
      <rect x={cx - 40} y={rectY + rectH - 14} width={80} height={4} rx={2} fill={C.accent} />

      {/* Símbolo de pistão a gás (linhas em V) */}
      <path
        d={`M ${cx} ${rectY + rectH - 18} L ${cx - 10} ${
          cy
        } M ${cx} ${rectY + rectH - 18} L ${cx + 10} ${cy}`}
        stroke={C.outline}
        strokeWidth={1}
        strokeLinecap="round"
      />
      <text
        x={cx}
        y={cy + 4}
        fill={C.textDim}
        fontSize={7}
        fontFamily="ui-monospace, monospace"
        textAnchor="middle"
      >
        PISTÃO
      </text>

      {/* Cotas */}
      <CotaHorizontal
        x1={rectX}
        x2={rectX + rectW}
        y={rectY + rectH + 18}
        label={`L ${fmtMm(dimensoes.largura)}`}
      />
      <CotaVertical
        x={rectX - 14}
        y1={rectY}
        y2={rectY + rectH}
        label={`A ${fmtMm(dimensoes.altura)}`}
      />

      <MaterialTag x={rectX + rectW + 6} y={rectY + rectH + 6} corMdf={corMdf} />
    </g>
  )
}

export default ModuloBlueprint2D
