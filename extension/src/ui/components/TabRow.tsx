import type {
  DragEvent as ReactDragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from 'react';
import type React from 'react';
import { forwardRef, useCallback, useRef, useState } from 'react';

import type { TabEntry } from '@/shared/types';
import { TabPeekPreview } from './TabPeekPreview';

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

  const [showPeek, setShowPeek] = useState(false);
  const [peekPosition, setPeekPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      if (rowRef.current) {
        const rect = rowRef.current.getBoundingClientRect();
        // Position to the right of the tab row
        setPeekPosition({ top: rect.top, left: rect.right + 12 });
        setShowPeek(true);
      }
    }, 600); // 600ms delay for peek
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setShowPeek(false);
  }, []);

  // Merge refs
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      // Handle the forwarded ref
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
      // Handle our local ref
      rowRef.current = node;
    },
    [ref]
  );

  const containerClasses = [
    variant === 'floating'
      ? `group relative flex items-center gap-2 px-3 ${compact ? 'py-1.5' : 'py-2'} rounded-xl transition-colors duration-200`
      : `group relative flex items-center gap-2 px-4 ${compact ? 'py-1.5' : 'py-2'} hover:bg-surface-light border-b border-surface-light/50`,
    // Active state
    tab.active
      ? variant === 'floating'
        ? 'bg-white/15 shadow-sm'
        : 'bg-surface-light'
      : variant === 'floating'
        ? 'hover:bg-white/5'
        : '',
    isDragged ? 'opacity-50' : '',
    className,
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
      ref={setRefs}
      className={containerClasses}
      onContextMenu={props.onContextMenu || handleContextMenuLegacy}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="group"
      {...props}
    >
      <TabPeekPreview tab={tab} isVisible={showPeek} position={peekPosition} />
      <div
        className="flex flex-1 min-w-0 items-center gap-3 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/20 rounded-lg py-0.5"
        onClick={() => onTabSelect?.(tab)}
        onKeyDown={handleKeyDown}
        {...dragHandleProps}
        tabIndex={0}
        role="button"
      >
        <div className="flex-shrink-0 flex items-center justify-center">
          {showFavicons && tab.favIconUrl ? (
            <img
              src={tab.favIconUrl}
              alt=""
              className="w-4 h-4 rounded-sm object-contain opacity-90 group-hover:opacity-100"
              onError={(event) => {
                const target = event.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-4 h-4 rounded-sm bg-white/10 flex items-center justify-center">
              <span className="text-[10px] text-white/50">🌐</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 overflow-hidden flex flex-col justify-center">
          <div
            className={`text-[13px] leading-tight truncate ${variant === 'floating' ? 'text-slate-100 font-medium' : 'text-slate-200'}`}
            title={tab.title}
          >
            {tab.title}
          </div>
          {/* Only show URL/hostname if not compact, or maybe show it very subtly */}
          {!compact && (
            <div
              className={`text-[10px] leading-tight truncate mt-0.5 ${variant === 'floating' ? 'text-slate-400 group-hover:text-slate-300' : 'text-slate-500'}`}
              title={tab.url ? safeHostname(tab.url) : ''}
            >
              {tab.url ? safeHostname(tab.url) : ''}
            </div>
          )}
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
