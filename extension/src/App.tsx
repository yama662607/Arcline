import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { CommandPalette } from '@/floating/CommandPalette';
import { queryClient } from '@/lib/query-client';
import { getSpaceTheme } from '@/lib/space-theme';
import type { UiMode } from '@/lib/ui-mode';
import { requestUiMode } from '@/lib/ui-mode';
import { useSpacesSync } from '@/lib/useSpacesSync';
import { useSpacesStore } from '@/store';
import { SpacesWorkspace } from '@/ui/components/SpacesWorkspace';
import { ThemeProvider } from '@/ui/theme/ThemeContext';

function AppContent() {
  const [uiMode, setUiMode] = useState<UiMode>('floating');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const spaces = useSpacesStore((state) => state.spaces);
  const activeSpaceId = useSpacesStore((state) => state.activeSpaceId);
  const activeSpace = useMemo(
    () => spaces.find((space) => space.id === activeSpaceId) ?? null,
    [spaces, activeSpaceId]
  );

  const frameRgb = useMemo(() => {
    const baseHex = getSpaceTheme(activeSpace?.themeColor).accent;

    const toRgb = (hex: string) => {
      const normalized = hex.replace('#', '');
      if (normalized.length !== 6) return null;
      const r = Number.parseInt(normalized.slice(0, 2), 16);
      const g = Number.parseInt(normalized.slice(2, 4), 16);
      const b = Number.parseInt(normalized.slice(4, 6), 16);
      if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
      return { r, g, b };
    };

    const mixWithWhite = (value: number, amount: number) =>
      Math.round(value + (255 - value) * amount);

    const rgb = toRgb(baseHex) ?? { r: 148, g: 163, b: 184 };
    const whiteMix = 0.55;
    return {
      r: mixWithWhite(rgb.r, whiteMix),
      g: mixWithWhite(rgb.g, whiteMix),
      b: mixWithWhite(rgb.b, whiteMix),
    };
  }, [activeSpace?.themeColor]);

  useEffect(() => {
    requestUiMode()
      .then(setUiMode)
      .catch(() => setUiMode('floating'));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };

    const handleOpenPalette = () => setIsSearchOpen(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-command-palette', handleOpenPalette);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-command-palette', handleOpenPalette);
    };
  }, []);

  useSpacesSync();

  return (
    <>
      <div className="relative min-h-screen bg-background text-foreground">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            border: `1px solid rgba(${frameRgb.r}, ${frameRgb.g}, ${frameRgb.b}, 0.32)`,
            boxShadow: `0 0 0 2px rgba(${frameRgb.r}, ${frameRgb.g}, ${frameRgb.b}, 0.28), 0 0 0 1px rgba(2, 6, 23, 0.55), inset 0 0 0 1px rgba(${frameRgb.r}, ${frameRgb.g}, ${frameRgb.b}, 0.55)`,
          }}
        />
        {uiMode === 'floating' || uiMode === 'popup' ? (
          <div className="pl-[20px] pr-4 pt-4 pb-4">
            <SpacesWorkspace variant="floating" />
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
            <div className="mx-auto max-w-3xl space-y-8">
              <SpacesWorkspace variant="sidepanel" />
            </div>
          </div>
        )}
      </div>
      <CommandPalette isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}

// Removed unused stubs (FloatingModeStub, SidePanelView)

import { Onboarding } from '@/ui/components/Onboarding';
import { useOnboardingStatus } from '@/ui/hooks/use-onboarding-status';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppWrapper />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function AppWrapper() {
  const { hasSeenOnboarding, setHasSeenOnboarding, isLoading } = useOnboardingStatus();

  if (isLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!hasSeenOnboarding) {
    return <Onboarding onFinish={() => setHasSeenOnboarding(true)} />;
  }

  return <AppContent />;
}
