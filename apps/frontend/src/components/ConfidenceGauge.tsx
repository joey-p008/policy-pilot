import type { JSX } from 'react';

function formatConfidence(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export function ConfidenceGauge({ score }: { score: number }): JSX.Element {
  const clamped = Math.min(1, Math.max(0, score));
  const percentLabel = formatConfidence(clamped);

  return (
    <div className="space-y-1.5" aria-label={`Confidence ${percentLabel}`}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-slate-400">Confidence</span>
        <span className="font-medium text-slate-100">{percentLabel}</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-800"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
        aria-label="Confidence score"
      >
        <div
          className="h-full rounded-full bg-teal-500 transition-[width]"
          style={{ width: `${clamped * 100}%` }}
        />
      </div>
    </div>
  );
}
