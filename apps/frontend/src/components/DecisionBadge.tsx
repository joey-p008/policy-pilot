import type { RecommendationDecision } from '@policy-pilot/shared-types';
import type { JSX } from 'react';

const BADGE_CLASS_BY_DECISION: Record<RecommendationDecision, string> = {
  APPROVE: 'bg-teal-900/70 text-teal-200 ring-teal-700/80',
  DENY: 'bg-rose-900/70 text-rose-200 ring-rose-700/80',
  ESCALATE: 'bg-amber-900/70 text-amber-200 ring-amber-700/80',
};

export function DecisionBadge({ decision }: { decision: RecommendationDecision }): JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide ring-1 ring-inset ${BADGE_CLASS_BY_DECISION[decision]}`}
    >
      {decision}
    </span>
  );
}
