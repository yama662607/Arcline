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
      className={`flex w-full items-center justify-center gap-2 rounded-lg transition-all duration-200 ${
        isFloating
          ? 'py-2 text-sm bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white'
          : 'py-2.5 text-base bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white'
      }`}
    >
      <Plus className={isFloating ? 'h-4 w-4' : 'h-5 w-5'} />
      <span>New Tab</span>
    </button>
  );
}
