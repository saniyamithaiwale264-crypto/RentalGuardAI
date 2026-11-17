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
      ? '#EF4444'
      : band.tone === 'medium'
      ? '#F97316'
      : '#22C55E';

  const textColor =
    band.tone === 'high'
      ? 'text-red-400'
      : band.tone === 'medium'
      ? 'text-orange-400'
      : 'text-emerald-400';

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
            stroke="rgba(255,255,255,0.08)"
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
            className={`font-mono font-bold text-white tabular-nums ${
              size === 'sm' ? 'text-lg' : 'text-2xl'
            }`}
          >
            {clamped}
          </span>
          <span className="font-mono text-[10px] text-zinc-500 tabular-nums">/100</span>
        </div>
      </div>

      <div className="min-w-0">
        <div className={`text-sm font-semibold ${textColor}`}>{band.label}</div>
        <p className="mt-0.5 text-xs text-zinc-400 leading-relaxed">
          Weighted from High, Medium, and Low risk clause findings.
        </p>
      </div>
    </div>
  );
}
