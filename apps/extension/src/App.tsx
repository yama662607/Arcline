import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { queryClient } from '@/lib/query-client';
import type { UiMode } from '@/lib/ui-mode';
import { requestUiMode } from '@/lib/ui-mode';
import { useSpacesSync } from '@/lib/useSpacesSync';
import { SpacesWorkspace } from '@/ui/components/SpacesWorkspace';

type PreviewMode = 'sidepanel' | 'floating';

function FloatingModeStub() {
  return (
    <div className="min-h-screen bg-surface text-slate-100">
      <div className="mx-auto max-w-xl space-y-4 px-6 py-10">
        <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 shadow-2xl">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Floating Mode</p>
          <h1 className="mt-3 text-2xl font-semibold text-white">Floating モードで動作中です</h1>
          <p className="mt-3 text-sm text-slate-300">
            このブラウザではサイドパネルではなく、ページ左端のホットゾーン / 拡張アイコンクリックで
            Floating UI を表示します。サイドパネル UI は無効化されています。
          </p>
        </div>
      </div>
    </div>
  );
}

function SidePanelView({ initialUiMode }: { initialUiMode: UiMode }) {
  const [uiMode, setUiMode] = useState<UiMode>(initialUiMode);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('sidepanel');

  useEffect(() => {
    requestUiMode()
      .then(setUiMode)
      .catch(() => setUiMode('floating'));
  }, []);

  useSpacesSync();

  const header = useMemo(
    () => (
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Arcline Preview</p>
          <h1 className="text-3xl font-semibold text-white">Choose a layout to preview</h1>
        </div>
        <div className="inline-flex rounded-lg border border-surface-light p-1">
          {(['sidepanel', 'floating'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setPreviewMode(mode)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                previewMode === mode
                  ? 'bg-surface-light text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode === 'sidepanel' ? 'Side Panel' : 'Floating'}
            </button>
          ))}
        </div>
      </header>
    ),
    [previewMode]
  );

  return (
    <div className="min-h-screen bg-surface text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        {header}
        {previewMode === 'sidepanel' ? (
          <div className="mx-auto max-w-3xl space-y-8">
            <SpacesWorkspace variant="sidepanel" uiMode={uiMode} />
          </div>
        ) : (
          <div className="mx-auto max-w-xl space-y-4">
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 shadow-2xl">
              <SpacesWorkspace variant="floating" uiMode="floating" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AppContent() {
  const [uiMode, setUiMode] = useState<UiMode>('floating');

  useEffect(() => {
    requestUiMode()
      .then(setUiMode)
      .catch(() => setUiMode('floating'));
  }, []);

  if (uiMode === 'floating') {
    return <FloatingModeStub />;
  }

  return <SidePanelView initialUiMode={uiMode} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
