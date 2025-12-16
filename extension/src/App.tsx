import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { queryClient } from '@/lib/query-client';
import type { UiMode } from '@/lib/ui-mode';
import { requestUiMode } from '@/lib/ui-mode';
import { useSpacesSync } from '@/lib/useSpacesSync';
import { SpacesWorkspace } from '@/ui/components/SpacesWorkspace';
import { ThemeProvider } from '@/ui/theme/ThemeContext';

function FloatingModeStub() {
  return (
    <div className="min-h-screen bg-background text-foreground">
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

  useEffect(() => {
    requestUiMode()
      .then(setUiMode)
      .catch(() => setUiMode('floating'));
  }, []);

  useSpacesSync();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <div className="mx-auto max-w-3xl space-y-8">
          <SpacesWorkspace variant="sidepanel" uiMode={uiMode} />
        </div>
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
