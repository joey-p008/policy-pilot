import type { ProposedAccessDecisionTool } from '@policy-pilot/shared-types';
import type { JSX } from 'react';

export function ProposedToolBadge({ tool }: { tool: ProposedAccessDecisionTool }): JSX.Element {
  return (
    <span
      className="inline-flex items-center rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 ring-1 ring-inset ring-slate-600"
      title="This LLM tool call is a recommendation only. A human must approve before entitlements change."
    >
      Proposed tool: {tool.name} · awaiting human approval
    </span>
  );
}
