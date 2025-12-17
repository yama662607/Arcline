import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { queryClient } from '@/lib/query-client';
import type { UiMode } from '@/lib/ui-mode';
import { requestUiMode } from '@/lib/ui-mode';
import { useSpacesSync } from '@/lib/useSpacesSync';
import { SpacesWorkspace } from '@/ui/components/SpacesWorkspace';
import { ThemeProvider } from '@/ui/theme/ThemeContext';



import { CommandPalette } from '@/floating/CommandPalette';

function AppContent() {
  const [uiMode, setUiMode] = useState<UiMode>('floating');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

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
      <div className="min-h-screen bg-background text-foreground">
        {uiMode === 'floating' || uiMode === 'popup' ? (
          <div className="p-4">
            <SpacesWorkspace variant="floating" uiMode={uiMode} />
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
            <div className="mx-auto max-w-3xl space-y-8">
              <SpacesWorkspace variant="sidepanel" uiMode="side-panel" />
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
