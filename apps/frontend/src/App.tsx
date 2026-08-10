import type { JSX } from 'react';

import { Dashboard } from './components/Dashboard';

export function App(): JSX.Element {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <Dashboard />
    </main>
  );
}
