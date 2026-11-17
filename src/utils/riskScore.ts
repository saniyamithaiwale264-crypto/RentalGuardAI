import type { RiskCounts } from '../types/rental.ts';

export function computeRiskScore(counts: Pick<RiskCounts, 'high' | 'medium' | 'low'>): number {
  const high = Math.max(0, Number(counts?.high) || 0);
  const medium = Math.max(0, Number(counts?.medium) || 0);
  const low = Math.max(0, Number(counts?.low) || 0);
  const raw = high * 15 + medium * 7 + low * 2;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

export function getRiskScoreBand(score: number): {
  label: 'High Risk Exposure' | 'Moderate Risk Exposure' | 'Low Risk Exposure';
  tone: 'high' | 'medium' | 'low';
} {
  if (score >= 60) {
    return { label: 'High Risk Exposure', tone: 'high' };
  }
  if (score >= 30) {
    return { label: 'Moderate Risk Exposure', tone: 'medium' };
  }
  return { label: 'Low Risk Exposure', tone: 'low' };
}
