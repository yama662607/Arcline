import { useEffect, useMemo, useState } from 'react';

import type { UiMode } from './lib/ui-mode';
import { requestUiMode } from './lib/ui-mode';
import { requestSpacesSnapshot } from './lib/spaces';
import { SpaceList } from './ui/components/SpaceList';
import { useSpacesStore } from './store/spacesSlice';

export default function App() {
  const [uiMode, setUiMode] = useState<UiMode>('side-panel');
  const setSpaces = useSpacesStore((state) => state.setSpaces);

  const shortcuts = useMemo(
    () => [
      { key: '⇧ Cmd K', description: 'Open command palette' },
      { key: 'Ctrl E', description: 'Toggle side panel' },
      { key: 'Ctrl D', description: 'Quick pin active tab' }
    ],
    []
  );

  useEffect(() => {
    requestUiMode().then(setUiMode).catch(() => setUiMode('side-panel'));
  }, []);

  useEffect(() => {
    requestSpacesSnapshot()
      .then((spaces) => setSpaces(spaces))
      .catch((error) => {
        console.warn('Failed to load spaces snapshot', error);
      });
  }, [setSpaces]);

  return (
    <div className="min-h-screen bg-surface text-slate-100">
      <div className="mx-auto max-w-3xl space-y-8 px-8 py-16">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Arcline</p>
          <h1 className="text-4xl font-semibold text-white">Atlas-ready Arc experience</h1>
          <p className="text-slate-300">
            This sandbox renders the upcoming React + TypeScript UI shell. The legacy Arcify codebase
            is stored under <code className="rounded bg-surface-light px-2 py-1 font-mono text-xs">legacy/arcify</code>
            for reference.
          </p>
        </header>

        <section className="grid gap-3 rounded-2xl border border-white/5 bg-surface-light/80 p-6 backdrop-blur">
          <h2 className="text-lg font-medium text-white">Keybindings (default)</h2>
          <ul className="grid gap-2 text-sm text-slate-200">
            {shortcuts.map((item) => (
              <li key={item.key} className="flex items-center justify-between rounded-lg bg-black/30 px-3 py-2">
                <span>{item.description}</span>
                <kbd className="rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-xs uppercase text-slate-100">
                  {item.key}
                </kbd>
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-4 rounded-2xl border border-white/5 bg-black/30 p-6">
          <h2 className="text-lg font-medium text-white">Spaces Preview</h2>
          <SpaceList />
          <p className="text-xs text-slate-500">
            実際のタブ情報は Service Worker 経由で Chrome API から読み込みます。現段階ではモック表示です。
          </p>
        </section>

        <section className="grid gap-3 rounded-2xl border border-white/5 bg-black/20 p-6">
          <h2 className="text-lg font-medium text-white">UI モード</h2>
          <p className="text-sm text-slate-300">
            現在のブラウザでは
            <span className="mx-1 rounded bg-surface-light px-2 py-1 font-mono text-xs uppercase text-slate-100">
              {uiMode}
            </span>
            モードで Arcline を表示します。
          </p>
          {uiMode === 'popup' ? (
            <p className="text-xs text-slate-400">
              ツールバーアイコンをクリックするか <kbd className="rounded bg-black/30 px-1">Ctrl/Cmd+E</kbd> を押すとポップアップが表示されます。
            </p>
          ) : (
            <p className="text-xs text-slate-400">
              サイドパネルが利用可能です。ショートカットで素早く表示できます。
            </p>
          )}
        </section>

        <footer className="text-xs text-slate-500">
          Built with React, Tailwind, Zustand, and friends. Replace this placeholder with the actual side panel UI
          as migration progresses.
        </footer>
      </div>
    </div>
  );
}
