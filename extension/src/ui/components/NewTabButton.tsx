/**
 * NewTabButton Component
 * Arc-style new tab button at the bottom - triggers Command Palette
 */

import { Plus } from 'lucide-react';
import { useCallback } from 'react';

interface NewTabButtonProps {
  variant?: 'standalone' | 'floating';
}

export function NewTabButton({ variant = 'standalone' }: NewTabButtonProps) {
  const handleClick = useCallback(() => {
    if (variant === 'floating') {
      // In floating mode, dispatch event to open Command Palette
      window.dispatchEvent(new CustomEvent('arcline-open-command-palette'));
    } else {
      // In standalone mode (side panel), send message to background to open Command Palette
      chrome.runtime.sendMessage({ command: 'toggleSpotlight' });
    }
  }, [variant]);

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
