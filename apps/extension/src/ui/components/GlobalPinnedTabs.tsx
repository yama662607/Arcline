import { Pin, PinOff } from 'lucide-react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useMemo } from 'react';

import { useActivateTab, useToggleTabPinned } from '@/hooks/use-spaces-query';
import type { TabEntry } from '@/shared/types';

interface GlobalPinnedTabsProps {
  tabs: TabEntry[];
  compact: boolean;
  showFavicons: boolean;
  variant: 'standalone' | 'floating';
  onTabContextMenu?: (tab: TabEntry, event: ReactMouseEvent<HTMLButtonElement>) => void;
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function PinnedTabRow({
  tab,
  compact,
  variant,
  showFavicons,
  onSelect,
  onContextMenu,
  onPinToggle,
}: {
  tab: TabEntry;
  compact: boolean;
  variant: 'standalone' | 'floating';
  showFavicons: boolean;
  onSelect: (tab: TabEntry) => void;
  onContextMenu?: (tab: TabEntry, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onPinToggle: (event: ReactMouseEvent<HTMLButtonElement>, tab: TabEntry) => void;
}) {
  const hostname = useMemo(() => safeHostname(tab.url), [tab.url]);

  const handleContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      onContextMenu?.(tab, event);
    },
    [onContextMenu, tab]
  );

  const handlePinToggle = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      onPinToggle(event, tab);
    },
    [onPinToggle, tab]
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect(tab);
      }
    },
    [onSelect, tab]
  );

  return (
    <button
      type="button"
      className={`group relative flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/50 p-2 transition-all hover:bg-blue-100/50 hover:shadow-sm w-full text-left ${
        variant === 'floating' ? 'mb-1' : 'mb-2'
      }`}
      onClick={() => onSelect(tab)}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
    >
      {/* Pin icon indicator */}
      <div className="flex items-center justify-center">
        <Pin className="h-3 w-3 text-blue-600" />
      </div>

      {/* Favicon */}
      {showFavicons && tab.favIconUrl && (
        <img
          src={tab.favIconUrl}
          alt=""
          className="h-4 w-4 flex-shrink-0 rounded-sm"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
      )}

      {/* Tab content */}
      <div className="min-w-0 flex-1">
        <span className="truncate text-sm font-medium text-gray-900">
          {compact ? hostname : tab.title}
        </span>
        {!compact && <div className="truncate text-xs text-gray-500">{hostname}</div>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
          onClick={handlePinToggle}
          title="ピン留めを解除"
        >
          <PinOff className="h-3 w-3" />
        </button>
      </div>
    </button>
  );
}

export function GlobalPinnedTabs({
  tabs,
  compact,
  showFavicons,
  variant,
  onTabContextMenu,
}: GlobalPinnedTabsProps) {
  const { mutate: activateTab } = useActivateTab();
  const { mutate: toggleTabPinned } = useToggleTabPinned();

  const handleSelectTab = useCallback(
    (tab: TabEntry) => {
      activateTab(tab.id);
    },
    [activateTab]
  );

  const handlePinToggle = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, tab: TabEntry) => {
      event.stopPropagation();
      toggleTabPinned({ tabId: tab.id, pinned: !tab.pinned });
    },
    [toggleTabPinned]
  );

  if (tabs.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-gray-500">ピン留めされたタブはありません</div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-blue-700 border-b border-blue-200">
        <Pin className="h-3 w-3" />
        <span>グローバルピン留めタブ</span>
        <span className="ml-auto text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
          {tabs.length}
        </span>
      </div>

      {/* Pinned tabs list */}
      <div className="px-1 py-1">
        {tabs.map((tab) => (
          <PinnedTabRow
            key={tab.id}
            tab={tab}
            compact={compact}
            variant={variant}
            showFavicons={showFavicons}
            onSelect={handleSelectTab}
            onContextMenu={onTabContextMenu}
            onPinToggle={handlePinToggle}
          />
        ))}
      </div>
    </div>
  );
}
