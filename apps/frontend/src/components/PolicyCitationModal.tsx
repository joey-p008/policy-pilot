import type { PolicyCitation } from '@policy-pilot/shared-types';
import { useEffect, type JSX } from 'react';

export function PolicyCitationModal({
  citation,
  onClose,
}: {
  citation: PolicyCitation;
  onClose: () => void;
}): JSX.Element {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/80"
        aria-label="Close policy citation dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="policy-citation-title"
        className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 id="policy-citation-title" className="text-lg font-semibold text-slate-100">
              Policy citation
            </h2>
            <p className="text-sm text-slate-400">
              {citation.documentId} · p.{citation.pageNumber} · {citation.sectionTitle}
            </p>
          </div>
          <button
            type="button"
            className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {citation.content !== undefined && citation.content.length > 0 ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
            {citation.content}
          </p>
        ) : (
          <p className="text-sm text-slate-400">Policy text unavailable</p>
        )}
      </div>
    </div>
  );
}
