import { getRiskScoreBand } from '../utils/riskScore.ts';

interface RiskScoreGaugeProps {
  score: number;
  size?: 'sm' | 'md';
}

export function RiskScoreGauge({ score, size = 'md' }: RiskScoreGaugeProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(score)));
  const band = getRiskScoreBand(clamped);

  const strokeColor =
    band.tone === 'high'
      ? '#DC2626'
      : band.tone === 'medium'
      ? '#D97706'
      : '#16A34A';

  const textColor =
    band.tone === 'high'
      ? 'text-red-700'
      : band.tone === 'medium'
      ? 'text-amber-700'
      : 'text-emerald-700';

  const radius = size === 'sm' ? 34 : 44;
  const strokeWidth = size === 'sm' ? 6 : 8;
  const boxSize = (radius + strokeWidth) * 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative flex items-center justify-center shrink-0"
        style={{ width: boxSize, height: boxSize }}
      >
        <svg
          width={boxSize}
          height={boxSize}
          viewBox={`0 0 ${boxSize} ${boxSize}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={boxSize / 2}
            cy={boxSize / 2}
            r={radius}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={boxSize / 2}
            cy={boxSize / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-mono font-bold text-slate-900 tabular-nums ${
              size === 'sm' ? 'text-lg' : 'text-2xl'
            }`}
          >
            {clamped}
          </span>
          <span className="font-mono text-[10px] text-slate-400 tabular-nums">/100</span>
        </div>
      </div>

      <div className="min-w-0">
        <div className={`text-sm font-semibold ${textColor}`}>{band.label}</div>
        <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
          Weighted from High, Medium, and Low risk clause findings.
        </p>
      </div>
    </div>
  );
}
