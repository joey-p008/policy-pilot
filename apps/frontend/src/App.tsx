import type { BaseAccessRequest } from '@policy-pilot/shared-types';
import type { JSX } from 'react';

const scaffoldRequestShape: Array<keyof BaseAccessRequest> = [
  'requestId',
  'employeeId',
  'targetEntitlement',
];

export function App(): JSX.Element {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-400">Policy-Pilot</p>
        <h1 className="text-3xl font-semibold tracking-tight">HITL Dashboard Scaffold</h1>
        <p className="text-slate-300">
          React + Vite + Tailwind is wired. Shared access-request fields ready for React Query
          hooks: {scaffoldRequestShape.join(', ')}.
        </p>
      </div>
    </main>
  );
}
