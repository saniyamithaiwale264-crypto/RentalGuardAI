import { AlertOctagon, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { RiskLevel } from '../types/rental.ts';
import { useLanguage } from '../context/LanguageContext.tsx';

interface RiskBadgeProps {
  level: RiskLevel;
  compact?: boolean;
}

export function RiskBadge({ level, compact = false }: RiskBadgeProps) {
  const { t } = useLanguage();

  if (level === 'HIGH') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 font-medium text-red-400 whitespace-nowrap shrink-0 ${
          compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
        }`}
      >
        <AlertOctagon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{t('highRiskBadge')}</span>
      </span>
    );
  }

  if (level === 'MEDIUM') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border border-orange-500/30 bg-orange-500/10 font-medium text-orange-400 whitespace-nowrap shrink-0 ${
          compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
        }`}
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{t('mediumRiskBadge')}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 font-medium text-emerald-400 whitespace-nowrap shrink-0 ${
        compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{t('lowRiskBadge')}</span>
    </span>
  );
}
