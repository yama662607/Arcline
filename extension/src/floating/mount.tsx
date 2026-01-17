import { QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import React, {
  forwardRef,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getSpaceTheme } from '@/lib/space-theme';
import { queryClient } from '@/lib/query-client';
import { useSpacesStore } from '@/store';
import stylesText from '@/styles.css?inline';

const FloatingApp = React.lazy(() => import('./FloatingApp'));
const CommandPalette = React.lazy(() =>
  import('./CommandPalette').then((module) => ({ default: module.CommandPalette }))
);

export interface FloatingUiInstance {
  openFromHover(): void;
  openInstantly(data?: { spaces?: unknown[]; activeSpaceId?: number }): void;
  openCommandPalette(): void;
  showPageTransition(): void;
  destroy(): void;
}

interface MountOptions {
  host: HTMLElement;
  shadowRoot: ShadowRoot;
  perfId?: string;
  t0?: number;
  onBootstrapReady?: () => void;
  onClosed?: () => void;
  onOpenStateChange?: (isOpen: boolean) => void;
}

interface FloatingUiHandle {
  openFromHover(): void;
  openInstantly(data?: { spaces?: unknown[]; activeSpaceId?: number }): void;
  openCommandPalette(): void;
  showPageTransition(): void;
  destroy(): void;
}

function injectStyles(shadowRoot: ShadowRoot) {
  const existing = shadowRoot.querySelector('style[data-arcline-floating-style="true"]');
  if (existing) return;

  const style = document.createElement('style');
  style.setAttribute('data-arcline-floating-style', 'true');
  style.textContent = stylesText;
  if (import.meta.env.DEV) {
    console.log('[Arcline-Debug] Styles Content Preview:', stylesText.slice(0, 200));
  }
  shadowRoot.append(style);
}

const FloatingUiRoot = forwardRef<
  FloatingUiHandle,
  { onBootstrapReady?: () => void; onClosed?: () => void }
>(({ onBootstrapReady, onClosed }, ref) => {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [skipAnimation, setSkipAnimation] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const spaces = useSpacesStore((state) => state.spaces);
  const activeSpaceId = useSpacesStore((state) => state.activeSpaceId);
  const activeSpace = useMemo(
    () => spaces.find((space) => space.id === activeSpaceId) ?? null,
    [spaces, activeSpaceId]
  );

  const frameRgb = useMemo(() => {
    const baseHex = getSpaceTheme(activeSpace?.themeColor).accent;

    const toRgb = (hex: string) => {
      const normalized = hex.replace('#', '');
      if (normalized.length !== 6) return null;
      const r = Number.parseInt(normalized.slice(0, 2), 16);
      const g = Number.parseInt(normalized.slice(2, 4), 16);
      const b = Number.parseInt(normalized.slice(4, 6), 16);
      if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
      return { r, g, b };
    };

    const mixWithWhite = (value: number, amount: number) =>
      Math.round(value + (255 - value) * amount);

    const rgb = toRgb(baseHex) ?? { r: 148, g: 163, b: 184 };
    const whiteMix = 0.55;
    return {
      r: mixWithWhite(rgb.r, whiteMix),
      g: mixWithWhite(rgb.g, whiteMix),
      b: mixWithWhite(rgb.b, whiteMix),
    };
  }, [activeSpace?.themeColor]);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    if (pinned) return;
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      // Re-enable hostElement pointer events when UI closes
      onClosed?.();
    }, 220);
  }, [clearCloseTimer, onClosed, pinned]);

  const cancelClose = useCallback(() => {
    clearCloseTimer();
  }, [clearCloseTimer]);

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent) => {
      if (e.clientX <= 0) {
        return;
      }
      scheduleClose();
    },
    [scheduleClose]
  );

  useImperativeHandle(
    ref,
    () => ({
      openFromHover() {
        cancelClose();
        setSkipAnimation(false);
        setOpen(true);
      },
      openInstantly(_data?: { spaces?: unknown[]; activeSpaceId?: number }) {
        // Note: data parameter is for future use (spaces/activeSpaceId updates)
        // Currently the store is synced via useSpacesSync
        cancelClose();
        setSkipAnimation(true);
        setOpen(true);
        // Reset animation flag after a short delay
        requestAnimationFrame(() => setSkipAnimation(false));
      },
      openCommandPalette() {
        setShowPalette(true);
      },
      showPageTransition() {
        // Page transition effect placeholder - can be expanded for visual feedback
        console.log('[Arcline] showPageTransition called');
      },
      destroy() {
        cancelClose();
        setPinned(false);
        setOpen(false);
        setShowPalette(false);
        onClosed?.();
      },
    }),
    [cancelClose, onClosed]
  );

  useEffect(() => {
    onBootstrapReady?.();
  }, [onBootstrapReady]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  useEffect(() => {
    // We do NOT set host styles here anymore to avoid conflicting with zoom correction.
    // The host element is styled by floating-ui.ts content script.
  }, []);

  return (
    <div className="pointer-events-none fixed inset-y-0 left-0 flex w-full max-w-[300px] font-sans text-base leading-normal text-left">
      <div
        aria-hidden="true"
        className="pointer-events-auto absolute inset-y-0 left-0 w-[2px] z-10"
        style={{ background: 'transparent' }}
        onPointerEnter={() => {
          cancelClose();
          setOpen(true);
        }}
        onPointerLeave={handlePointerLeave}
      />
      <div className="pointer-events-none flex h-full w-full max-w-[332px] items-stretch">
        <button
          data-testid="arcline-floating-hotzone"
          type="button"
          className="relative flex w-[8px] flex-col items-center justify-center appearance-none border-none bg-transparent opacity-0 outline-none transition-all focus:outline-none active:scale-95"
          onPointerEnter={() => {
            cancelClose();
            setOpen(true);
          }}
          onPointerLeave={handlePointerLeave}
          onClick={() => {
            setPinned((prev) => {
              const next = !prev;
              if (next) {
                cancelClose();
                setOpen(true);
              } else {
                scheduleClose();
              }
              return next;
            });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpen(true);
            }
            if (e.key === 'Escape' && (open || pinned)) {
              e.preventDefault();
              setPinned(false);
              setOpen(false);
            }
          }}
          aria-label={pinned ? 'Unpin floating sidebar (currently pinned)' : 'Pin floating sidebar'}
          aria-pressed={pinned}
          aria-expanded={open || pinned}
          tabIndex={0}
          title={pinned ? 'Click to unpin sidebar' : 'Hover or click to open sidebar'}
        />
        <AnimatePresence>
          {(open || pinned) && (
            <motion.aside
              key="arcline-floating-panel"
              data-testid="arcline-floating-panel"
              className="pointer-events-auto flex h-full flex-1"
              style={{ marginLeft: '-5px', marginTop: '3px', marginBottom: '3px' }}
              initial={skipAnimation ? false : { x: '-100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-102%', opacity: 0 }}
              transition={
                skipAnimation
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 420, damping: 38, mass: 0.5 }
              }
              onPointerEnter={cancelClose}
              onPointerLeave={handlePointerLeave}
            >
              <div
                className="relative flex w-[288px] flex-col overflow-hidden rounded-2xl border border-white/10 ring-1 ring-white/15 bg-slate-950/95 shadow-xl shadow-black/50 backdrop-blur"
                style={{ borderRadius: '16px', height: 'calc(100% - 6px)' }}
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-10 rounded-2xl"
                  style={{
                    border: `1px solid rgba(${frameRgb.r}, ${frameRgb.g}, ${frameRgb.b}, 0.32)`,
                    boxShadow: `0 0 0 2px rgba(${frameRgb.r}, ${frameRgb.g}, ${frameRgb.b}, 0.28), 0 0 0 1px rgba(2, 6, 23, 0.55), inset 0 0 0 1px rgba(${frameRgb.r}, ${frameRgb.g}, ${frameRgb.b}, 0.55)`,
                  }}
                />
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center text-sm text-slate-300">
                      Loading…
                    </div>
                  }
                >
                  <div className="relative z-0 flex h-full min-h-0 flex-col">
                    <FloatingApp
                      pinned={pinned}
                      onTogglePinned={() => {
                        setPinned((prev) => {
                          const next = !prev;
                          if (next) {
                            cancelClose();
                            setOpen(true);
                          } else {
                            scheduleClose();
                          }
                          return next;
                        });
                      }}
                      onRequestClose={() => {
                        setPinned(false);
                        setOpen(false);
                      }}
                    />
                  </div>
                </Suspense>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
      <Suspense fallback={null}>
        <QueryClientProvider client={queryClient}>
          <CommandPalette isOpen={showPalette} onClose={() => setShowPalette(false)} />
        </QueryClientProvider>
      </Suspense>
    </div>
  );
});
FloatingUiRoot.displayName = 'FloatingUiRoot';

export async function mountFloatingUi({
  host,
  shadowRoot,
  onBootstrapReady,
  onClosed,
}: MountOptions): Promise<FloatingUiInstance> {
  void host;
  injectStyles(shadowRoot);

  const container = document.createElement('div');
  shadowRoot.append(container);
  const rootRef = React.createRef<FloatingUiHandle>();
  const root: Root = createRoot(container);
  root.render(
    <FloatingUiRoot ref={rootRef} onBootstrapReady={onBootstrapReady} onClosed={onClosed} />
  );

  return {
    openFromHover() {
      rootRef.current?.openFromHover();
    },
    openInstantly(data?: { spaces?: unknown[]; activeSpaceId?: number }) {
      rootRef.current?.openInstantly(data);
    },
    openCommandPalette() {
      rootRef.current?.openCommandPalette();
    },
    showPageTransition() {
      rootRef.current?.showPageTransition();
    },
    destroy() {
      rootRef.current?.destroy();
      root.unmount();
      container.remove();
    },
  };
}
