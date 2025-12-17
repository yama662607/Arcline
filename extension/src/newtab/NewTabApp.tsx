import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { CommandPalette } from '@/floating/CommandPalette';
import { queryClient } from '@/lib/query-client';
import { SETTINGS_STORAGE_KEY } from '@/shared/settings';
import type { Settings } from '@/shared/types';

type SettingsRecord = Record<string, unknown>;

async function readSettings(): Promise<Settings> {
  const result = (await chrome.storage.local.get(SETTINGS_STORAGE_KEY)) as SettingsRecord;
  const raw = result[SETTINGS_STORAGE_KEY] as Settings | undefined;
  return (
    raw ??
    ({
      defaultSpaceName: 'Home',
      autoArchiveEnabled: false,
      autoArchiveIdleMinutes: 30,
      enableNewTabOverride: true,
      uiMode: 'floating',
      showFavicons: true,
      compactMode: false,
      enableAnimations: true,
      theme: 'auto',
      gesturesEnabled: true,
      gestureSensitivity: 100,
    } satisfies Settings)
  );
}

export function NewTabApp() {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);

  const title = useMemo(() => 'Arcline', []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const current = await readSettings();
      if (cancelled) return;
      setSettings(current);

      if (!current.enableNewTabOverride) {
        chrome.runtime.sendMessage({ action: 'navigateToDefaultNewTab' });
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  if (settings && !settings.enableNewTabOverride) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-sm text-slate-400">Redirecting…</div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16">
          <header className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-slate-400">
              Search tabs, bookmarks, history — or pin your current page.
            </p>
          </header>

          <main className="flex flex-col gap-3">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-4 py-3 text-sm font-medium text-slate-900 hover:bg-white"
              onClick={() => setIsPaletteOpen(true)}
            >
              Open Command Palette
            </button>

            <div className="text-xs text-slate-500">
              Tip: You can also use the keyboard shortcut (Ctrl/Command+Shift+K).
            </div>
          </main>
        </div>

        <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} />
      </div>
    </QueryClientProvider>
  );
}
