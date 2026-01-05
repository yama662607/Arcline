import type {
  DragEvent as ReactDragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from 'react';
import { forwardRef, useCallback } from 'react';

import type { TabEntry } from '@/shared/types';

export interface TabRowProps extends React.HTMLAttributes<HTMLDivElement> {
  tab: TabEntry;
  compact?: boolean;
  variant?: 'standalone' | 'floating';
  isDragged?: boolean;
  showFavicons?: boolean;
  onTabSelect?: (tab: TabEntry) => void;
  // Legacy custom handler (deprecated in favor of Radix ContextMenu)
  onContextMenuCustom?: (tab: TabEntry, event: ReactMouseEvent<HTMLDivElement>) => void;
  onPinToggle?: (event: ReactMouseEvent<HTMLButtonElement>, tab: TabEntry) => void;
  onArchive?: (event: ReactMouseEvent<HTMLButtonElement>, tab: TabEntry) => void;
  onClose?: (event: ReactMouseEvent<HTMLButtonElement>, tab: TabEntry) => void;
  onLegacyDragStart?: (event: ReactDragEvent<HTMLDivElement>, tab: TabEntry) => void;
  onLegacyDragOver?: (event: ReactDragEvent<HTMLDivElement>) => void;
  onLegacyDrop?: (event: ReactDragEvent<HTMLDivElement>, tab: TabEntry) => void;
  onLegacyDragEnd?: () => void;
  disableNativeDrag?: boolean;
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
  onTabSelect: ((tab: TabEntry) => void) | undefined,
  onContextMenuCustom:
    | ((tab: TabEntry, event: ReactMouseEvent<HTMLDivElement>) => void)
    | undefined,
  onLegacyDragStart?: (event: ReactDragEvent<HTMLDivElement>, tab: TabEntry) => void,
  onLegacyDragOver?: (event: ReactDragEvent<HTMLDivElement>) => void,
  onLegacyDrop?: (event: ReactDragEvent<HTMLDivElement>, targetTab: TabEntry) => void,
  onLegacyDragEnd?: () => void
) {
  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        onTabSelect?.(tab);
      }
    },
    [onTabSelect, tab]
  );

  const handleDragStart = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      onLegacyDragStart?.(event, tab);
    },
    [onLegacyDragStart, tab]
  );

  const handleDragOver = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      onLegacyDragOver?.(event);
    },
    [onLegacyDragOver]
  );

  const handleDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      onLegacyDrop?.(event, tab);
    },
    [onLegacyDrop, tab]
  );

  const handleDragEnd = useCallback(() => {
    onLegacyDragEnd?.();
  }, [onLegacyDragEnd]);

  // Handle legacy context menu if provided and no external handler overrides it
  const handleContextMenuLegacy = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (onContextMenuCustom) {
        event.preventDefault();
        onContextMenuCustom(tab, event);
      }
    },
    [onContextMenuCustom, tab]
  );

  return {
    handleKeyDown,
    handleContextMenuLegacy,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
  };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: TabRow handles various tab states and interactions
export const TabRow = forwardRef<HTMLDivElement, TabRowProps>(function TabRow(
  {
    tab,
    compact,
    variant,
    isDragged,
    showFavicons,
    onTabSelect,
    onContextMenuCustom,
    onPinToggle,
    onArchive,
    onClose,
    onLegacyDragStart,
    onLegacyDragOver,
    onLegacyDrop,
    onLegacyDragEnd,
    disableNativeDrag,
    className,
    ...props
  },
  ref
) {
  const {
    handleKeyDown,
    handleContextMenuLegacy,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
  } = useTabRowHandlers(
    tab,
    onTabSelect,
    onContextMenuCustom,
    onLegacyDragStart,
    onLegacyDragOver,
    onLegacyDrop,
    onLegacyDragEnd
  );

  const containerClasses = [
    variant === 'floating'
      ? `group relative flex items-center gap-0 px-3 ${compact ? 'py-1.5' : 'py-2'} rounded-lg hover:bg-white/10 transition-colors`
      : `group relative flex items-center gap-0 px-4 ${compact ? 'py-1.5' : 'py-2'} hover:bg-surface-light border-b border-surface-light/50`,
    tab.active ? (variant === 'floating' ? 'bg-white/15' : 'bg-surface-light') : '',
    isDragged ? 'opacity-50' : '',
    className, // Merge external className if provided
  ]
    .filter(Boolean)
    .join(' ');

  const actionButtonTextClass = variant === 'floating' ? 'text-xs' : 'text-sm';
  const actionContainerBgClass = 'bg-surface-light';

  const dragHandleProps =
    variant === 'floating' && !disableNativeDrag
      ? {
          draggable: true,
          onDragStart: handleDragStart,
          onDragOver: handleDragOver,
          onDrop: handleDrop,
          onDragEnd: handleDragEnd,
        }
      : {};

  return (
    <div
      ref={ref}
      className={containerClasses}
      onContextMenu={props.onContextMenu || handleContextMenuLegacy} // Use prop (Radix) if available, else legacy
      role="group"
      {...props}
    >
      <div
        className="flex flex-1 min-w-0 items-center gap-3 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface pr-2"
        onClick={() => onTabSelect?.(tab)}
        onKeyDown={handleKeyDown}
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
          <div
            className={`text-sm truncate ${variant === 'floating' ? 'text-white font-medium drop-shadow-sm' : 'text-slate-200'}`}
            title={tab.title}
          >
            {tab.title}
          </div>
          <div
            className={`text-xs truncate ${variant === 'floating' ? 'text-white/50' : 'text-slate-500'}`}
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
          onClick={(event) => onPinToggle?.(event, tab)}
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
          onClick={(event) => onArchive?.(event, tab)}
          className={`p-1 rounded ${actionButtonTextClass} text-slate-500 hover:text-blue-400`}
          title="Archive"
        >
          📦
        </button>

        <button
          type="button"
          onClick={(event) => onClose?.(event, tab)}
          className={`p-1 rounded ${actionButtonTextClass} text-slate-500 hover:text-red-400`}
          title="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
});
