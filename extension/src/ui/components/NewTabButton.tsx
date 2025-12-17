/**
 * NewTabButton Component
 * Arc-style new tab button at the bottom
 */

import { Plus } from 'lucide-react';
import { useCallback } from 'react';

import { useOpenUrlInTab } from '@/hooks/use-spaces-query';

interface NewTabButtonProps {
  variant?: 'standalone' | 'floating';
}

export function NewTabButton({ variant = 'standalone' }: NewTabButtonProps) {
  const { mutate: openUrlInTab } = useOpenUrlInTab();

  const handleClick = useCallback(() => {
    // Open a new tab with the new tab page
    openUrlInTab('chrome://newtab');
  }, [openUrlInTab]);

  const isFloating = variant === 'floating';

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex w-full items-center justify-center gap-2 rounded-xl transition-all duration-200 backdrop-blur-sm border border-white/10 ${
        isFloating
          ? 'py-2 text-sm bg-black/20 hover:bg-black/30 text-white/70 hover:text-white'
          : 'py-2.5 text-base bg-black/20 hover:bg-black/30 text-white/80 hover:text-white'
      }`}
    >
      <Plus className={isFloating ? 'h-4 w-4' : 'h-5 w-5'} />
      <span className="font-medium">New Tab</span>
    </button>
  );
}
