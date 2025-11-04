import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { queryClient } from './lib/query-client';
import type { UiMode } from './lib/ui-mode';
import { requestUiMode } from './lib/ui-mode';
import { useSpacesSync } from './lib/useSpacesSync';
import type { TabEntry } from './shared/types';
import { useSpacesStore } from './store';
import { ArchiveManager } from './ui/components/ArchiveManager';
import { EnhancedTabList } from './ui/components/EnhancedTabList';
import { SettingsPanel } from './ui/components/SettingsPanel';
import { SpaceManager } from './ui/components/SpaceManager';
import { TabContextMenu } from './ui/components/TabContextMenu';

export default function App() {
  const [uiMode, setUiMode] = useState<UiMode>('side-panel');
  const [activeTab, setActiveTab] = useState<'spaces' | 'archive' | 'settings'>('spaces');
  const spaces = useSpacesStore((state) => state.spaces);
  const activeSpaceId = useSpacesStore((state) => state.activeSpaceId);
  const activeSpace = useMemo(
    () => spaces.find((space) => space.id === activeSpaceId) ?? null,
    [spaces, activeSpaceId]
  );
  const [contextMenu, setContextMenu] = useState<{
    tab: TabEntry;
    x: number;
    y: number;
  } | null>(null);

  const shortcuts = useMemo(
    () => [
      { key: '⇧ Cmd K', description: 'Open command palette' },
      { key: 'Ctrl E', description: 'Toggle side panel' },
      { key: 'Ctrl D', description: 'Quick pin active tab' },
    ],
    []
  );

  useEffect(() => {
    requestUiMode()
      .then(setUiMode)
      .catch(() => setUiMode('side-panel'));
  }, []);

  useSpacesSync();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-surface text-slate-100">
        <div className="mx-auto max-w-3xl space-y-8 px-8 py-16">
          <header className="space-y-2">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Arcline</p>
            <h1 className="text-4xl font-semibold text-white">Atlas-ready Arc experience</h1>
            <p className="text-slate-300">
              This sandbox renders the upcoming React + TypeScript UI shell. The legacy Arcify
              codebase is stored under{' '}
              <code className="rounded bg-surface-light px-2 py-1 font-mono text-xs">
                legacy/arcify
              </code>
              for reference.
            </p>
          </header>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium text-white">Arcline</h2>
              <div className="text-sm text-slate-400">
                UI Mode: <span className="font-mono">{uiMode}</span>
              </div>
            </div>

            <div className="border border-surface-light rounded-lg">
              <div className="flex border-b border-surface-light">
                {(['spaces', 'archive', 'settings'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === tab
                        ? 'text-white bg-surface-light'
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {activeTab === 'spaces' && (
                  <div className="space-y-6">
                    <SpaceManager variant="standalone" />

                    {activeSpace && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium text-white">{activeSpace.name}</h3>
                        <EnhancedTabList
                          tabs={activeSpace.pinnedTabs}
                          title="Pinned Tabs"
                          emptyMessage="No pinned tabs"
                          variant="standalone"
                          onTabContextMenu={(tab, event) => {
                            const x = Math.min(event.clientX, window.innerWidth - 220);
                            const y = Math.min(event.clientY, window.innerHeight - 160);
                            setContextMenu({ tab, x, y });
                          }}
                        />
                        <EnhancedTabList
                          tabs={activeSpace.temporaryTabs}
                          title="Temporary Tabs"
                          emptyMessage="No temporary tabs"
                          variant="standalone"
                          onTabContextMenu={(tab, event) => {
                            const x = Math.min(event.clientX, window.innerWidth - 220);
                            const y = Math.min(event.clientY, window.innerHeight - 160);
                            setContextMenu({ tab, x, y });
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'archive' && <ArchiveManager variant="standalone" />}

                {activeTab === 'settings' && <SettingsPanel variant="standalone" />}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-medium text-white">Keyboard Shortcuts</h3>
            <div className="space-y-2">
              {shortcuts.map((shortcut, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-slate-300">{shortcut.description}</span>
                  <kbd className="rounded bg-surface-light px-2 py-1 font-mono text-xs text-slate-400">
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>
          </section>

          <footer className="text-center text-sm text-slate-400">
            <p>Arcline Extension • Development Build with React Query</p>
          </footer>
        </div>

        {contextMenu && (
          <TabContextMenu
            tab={contextMenu.tab}
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
    </QueryClientProvider>
  );
}
