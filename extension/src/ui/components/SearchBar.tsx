/**
 * SearchBar Component
 * Arc-style always-visible search/URL bar with integrated MoreMenu
 */

import { Globe, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useActiveTab, useOpenUrlInTab } from '@/hooks/use-spaces-query';
import { MoreMenu } from '@/ui/components/MoreMenu';

interface SearchBarProps {
  onOpenCommandPalette?: () => void;
  onOpenSettings?: () => void;
  onOpenArchive?: () => void;
  onOpenBookmarkImport?: () => void;
  variant?: 'standalone' | 'floating';
}

function formatDisplayUrl(url?: string) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    // Remove protocol and trailing slash for cleaner display
    return parsed.hostname + parsed.pathname.replace(/\/$/, '') + parsed.search;
  } catch {
    return url;
  }
}

export function SearchBar({
  onOpenCommandPalette,
  onOpenSettings,
  onOpenArchive,
  onOpenBookmarkImport,
  variant = 'standalone',
}: SearchBarProps) {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const { mutate: openUrlInTab } = useOpenUrlInTab();
  const { data: activeTab } = useActiveTab();

  const isFloating = variant === 'floating';

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed) return;

      // Check if it's a URL
      const isUrl =
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.includes('.') ||
        trimmed.startsWith('localhost');

      if (isUrl) {
        const url = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
        openUrlInTab(url);
      } else {
        // Search with default search engine
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
        openUrlInTab(searchUrl);
      }

      setInputValue('');
    },
    [inputValue, openUrlInTab]
  );

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    // Load current URL into input when focused
    if (activeTab?.url && !inputValue) {
      setInputValue(activeTab.url);
    }
  }, [activeTab?.url, inputValue]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    // Clear input when blurred
    setInputValue('');
  }, []);

  // Clear input value when focus state changes
  useEffect(() => {
    if (!isFocused) {
      setInputValue('');
    }
  }, [isFocused]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setInputValue('');
        (e.target as HTMLInputElement).blur();
      }
      // Cmd/Ctrl+K to open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenCommandPalette?.();
      }
    },
    [onOpenCommandPalette]
  );

  const hasMoreMenuHandlers = onOpenSettings || onOpenArchive || onOpenBookmarkImport;

  return (
    <div className="flex items-center gap-2 w-full">
      <form onSubmit={handleSubmit} className="flex-1">
        <div
          className={`relative flex items-center rounded-xl transition-all duration-200 backdrop-blur-md border ${
            isFocused
              ? 'bg-white/15 ring-1 ring-white/20 border-white/20'
              : 'bg-white/10 hover:bg-white/15 border-transparent'
          } ${isFloating ? 'px-3 py-1.5 h-[36px]' : 'px-4 py-2.5'}`}
        >
          <Search className={`flex-shrink-0 text-white/50 ${isFloating ? 'h-4 w-4' : 'h-5 w-5'}`} />

          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={
              activeTab?.url && !isFocused
                ? formatDisplayUrl(activeTab.url)
                : 'Search or Enter URL...'
            }
            className={`flex-1 bg-transparent border-none outline-none text-white placeholder-white/40 ${
              isFloating ? 'ml-2 text-[13px] font-medium tracking-wide' : 'ml-3 text-base'
            }`}
          />

          {inputValue && (
            <Globe
              className={`flex-shrink-0 text-white/60 ${isFloating ? 'h-4 w-4' : 'h-5 w-5'}`}
            />
          )}

          {!inputValue && (
            <kbd
              className={`hidden sm:inline-flex items-center gap-1 rounded bg-white/10 text-white/50 border border-white/10 ${
                isFloating ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'
              }`}
            >
              <span className="text-[10px]">⌘</span>K
            </kbd>
          )}
        </div>
      </form>

      {/* More Menu - integrated into SearchBar */}
      {hasMoreMenuHandlers && (
        <MoreMenu
          onOpenSettings={onOpenSettings ?? (() => {})}
          onOpenArchive={onOpenArchive ?? (() => {})}
          onOpenBookmarkImport={onOpenBookmarkImport ?? (() => {})}
          variant={variant}
        />
      )}
    </div>
  );
}
