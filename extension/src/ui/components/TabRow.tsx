import type {
  DragEvent as ReactDragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from 'react';
import { useCallback } from 'react';

import type { TabEntry } from '@/shared/types';

export interface TabRowProps {
  tab: TabEntry;
  compact: boolean;
  variant: 'standalone' | 'floating';
  isDragged: boolean;
  showFavicons: boolean;
  onSelect: (tab: TabEntry) => void;
  onContextMenu?: (tab: TabEntry, event: ReactMouseEvent<HTMLDivElement>) => void;
  onPinToggle: (event: ReactMouseEvent<HTMLButtonElement>, tab: TabEntry) => void;
  onArchive: (event: ReactMouseEvent<HTMLButtonElement>, tab: TabEntry) => void;
  onClose: (event: ReactMouseEvent<HTMLButtonElement>, tab: TabEntry) => void;
  onDragStart?: (event: ReactDragEvent<HTMLDivElement>, tab: TabEntry) => void;
  onDragOver?: (event: ReactDragEvent<HTMLDivElement>) => void;
  onDrop?: (event: ReactDragEvent<HTMLDivElement>, tab: TabEntry) => void;
  onDragEnd?: () => void;
}

export function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

export function useTabRowHandlers(
  tab: TabEntry,
  onSelect: (tab: TabEntry) => void,
  onContextMenu?: (tab: TabEntry, event: ReactMouseEvent<HTMLDivElement>) => void,
  onDragStart?: (event: ReactDragEvent<HTMLDivElement>, tab: TabEntry) => void,
  onDragOver?: (event: ReactDragEvent<HTMLDivElement>) => void,
  onDrop?: (event: ReactDragEvent<HTMLDivElement>, targetTab: TabEntry) => void,
  onDragEnd?: () => void
) {
  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        onSelect(tab);
      }
    },
    [onSelect, tab]
  );

  const handleContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      onContextMenu?.(tab, event);
    },
    [onContextMenu, tab]
  );

  const handleDragStart = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      onDragStart?.(event, tab);
    },
    [onDragStart, tab]
  );

  const handleDragOver = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      onDragOver?.(event);
    },
    [onDragOver]
  );

  const handleDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      onDrop?.(event, tab);
    },
    [onDrop, tab]
  );

  const handleDragEnd = useCallback(() => {
    onDragEnd?.();
  }, [onDragEnd]);

  return {
    handleKeyDown,
    handleContextMenu,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
  };
}

export function TabRow({
  tab,
  compact,
  variant,
  isDragged,
  showFavicons,
  onSelect,
  onContextMenu,
  onPinToggle,
  onArchive,
  onClose,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: TabRowProps) {
  const {
    handleKeyDown,
    handleContextMenu,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
  } = useTabRowHandlers(tab, onSelect, onContextMenu, onDragStart, onDragOver, onDrop, onDragEnd);

  const containerClasses = [
    variant === 'floating'
      ? `group relative flex items-center gap-0 px-4 ${compact ? 'py-1.5' : 'py-2'} rounded hover:bg-surface-light`
      : `group relative flex items-center gap-0 px-4 ${compact ? 'py-1.5' : 'py-2'} hover:bg-surface-light border-b border-surface-light/50`,
    tab.active ? 'bg-surface-light' : '',
    isDragged ? 'opacity-50' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const actionButtonTextClass = variant === 'floating' ? 'text-xs' : 'text-sm';
  const actionContainerBgClass = 'bg-surface-light';

  const dragHandleProps =
    variant === 'floating'
      ? {
          draggable: true,
          onDragStart: handleDragStart,
          onDragOver: handleDragOver,
          onDrop: handleDrop,
          onDragEnd: handleDragEnd,
        }
      : {};

  return (
    <div className={containerClasses}>
      <div
        className="flex flex-1 min-w-0 items-center gap-3 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface pr-2"
        onClick={() => onSelect(tab)}
        onKeyDown={handleKeyDown}
        onContextMenu={handleContextMenu}
        {...dragHandleProps}
        tabIndex={0}
        role="button"
      >
        <div className="flex-shrink-0">
          {showFavicons && tab.favIconUrl ? (
            <img
              src={tab.favIconUrl}
              alt=""
              className="w-4 h-4 rounded"
              onError={(event) => {
                const target = event.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-4 h-4 bg-surface-light rounded flex items-center justify-center">
              <span className="text-xs text-slate-400">🌐</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="text-sm text-slate-200 truncate" title={tab.title}>
            {tab.title}
          </div>
          <div
            className="text-xs text-slate-500 truncate"
            title={tab.url ? safeHostname(tab.url) : ''}
          >
            {tab.url ? safeHostname(tab.url) : ''}
          </div>
        </div>
      </div>

      <div
        className={`flex items-center gap-1 rounded overflow-hidden justify-end ml-0 flex-shrink-0 max-w-0 opacity-0 pointer-events-none px-0 py-0 whitespace-nowrap group-hover:max-w-[120px] group-hover:opacity-100 group-hover:pointer-events-auto group-hover:px-1 group-hover:py-0.5 group-hover:ml-2 ${actionContainerBgClass}`}
      >
        <button
          type="button"
          onClick={(event) => onPinToggle(event, tab)}
          className={`p-1 rounded ${actionButtonTextClass} ${
            tab.pinned
              ? 'text-yellow-400 hover:text-yellow-300'
              : 'text-slate-500 hover:text-slate-300'
          }`}
          title={tab.pinned ? 'Unpin' : 'Pin'}
        >
          📌
        </button>

        <button
          type="button"
          onClick={(event) => onArchive(event, tab)}
          className={`p-1 rounded ${actionButtonTextClass} text-slate-500 hover:text-blue-400`}
          title="Archive"
        >
          📦
        </button>

        <button
          type="button"
          onClick={(event) => onClose(event, tab)}
          className={`p-1 rounded ${actionButtonTextClass} text-slate-500 hover:text-red-400`}
          title="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
