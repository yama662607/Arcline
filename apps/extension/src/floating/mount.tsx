import { AnimatePresence, motion } from 'framer-motion';
import React, {
  forwardRef,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';

import stylesText from '@/styles.css?inline';

const FloatingApp = React.lazy(() => import('./FloatingApp'));

export interface FloatingUiInstance {
  openFromHover(): void;
  destroy(): void;
}

interface MountOptions {
  host: HTMLElement;
  shadowRoot: ShadowRoot;
  onBootstrapReady?: () => void;
}

interface FloatingUiHandle {
  openFromHover(): void;
  destroy(): void;
}

function injectStyles(shadowRoot: ShadowRoot) {
  const existing = shadowRoot.querySelector('style[data-arcline-floating-style="true"]');
  if (existing) return;

  const style = document.createElement('style');
  style.setAttribute('data-arcline-floating-style', 'true');
  style.textContent = stylesText;
  shadowRoot.append(style);
}

const FloatingUiRoot = forwardRef<
  FloatingUiHandle,
  { host: HTMLElement; onBootstrapReady?: () => void }
>(({ host, onBootstrapReady }, ref) => {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const closeTimer = useRef<number | null>(null);

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
    }, 220);
  }, [clearCloseTimer, pinned]);

  const cancelClose = useCallback(() => {
    clearCloseTimer();
  }, [clearCloseTimer]);

  useImperativeHandle(
    ref,
    () => ({
      openFromHover() {
        cancelClose();
        setOpen(true);
      },
      destroy() {
        cancelClose();
        setPinned(false);
        setOpen(false);
      },
    }),
    [cancelClose]
  );

  useEffect(() => {
    onBootstrapReady?.();
  }, [onBootstrapReady]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  useEffect(() => {
    host.style.position = 'fixed';
    host.style.top = '0';
    host.style.left = '0';
    host.style.height = '100vh';
    host.style.width = open || pinned ? '356px' : '6px';
    host.style.zIndex = '2147483646';
    host.style.pointerEvents = 'auto';
  }, [host, open, pinned]);

  return (
    <div className="pointer-events-none fixed inset-y-0 left-0 flex w-full max-w-[356px]">
      <div className="pointer-events-auto flex h-full w-full max-w-[356px] items-stretch">
        <button
          data-testid="arcline-floating-hotzone"
          type="button"
          className="relative flex w-[6px] flex-col items-center justify-center"
          onPointerEnter={() => {
            cancelClose();
            setOpen(true);
          }}
          onPointerLeave={scheduleClose}
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
          aria-label="Toggle floating sidebar pin"
          aria-pressed={pinned}
          title="Arcline floating hotzone"
        >
          <span
            className="absolute inset-y-0 left-0 w-full rounded-r transition-opacity duration-150"
            style={{
              opacity: open || pinned ? 0.65 : 0,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.45), rgba(255,255,255,0.1))',
            }}
          />
        </button>
        <AnimatePresence>
          {(open || pinned) && (
            <motion.aside
              key="arcline-floating-panel"
              data-testid="arcline-floating-panel"
              className="ml-2 flex h-full flex-1"
              initial={{ x: '-100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-102%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.5 }}
              onPointerEnter={cancelClose}
              onPointerLeave={scheduleClose}
            >
              <div className="flex h-full w-[320px] flex-col overflow-hidden rounded-r-2xl border border-white/10 bg-slate-950/95 shadow-xl shadow-black/50 backdrop-blur">
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center text-sm text-slate-300">
                      Loading…
                    </div>
                  }
                >
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
                </Suspense>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});
FloatingUiRoot.displayName = 'FloatingUiRoot';

export async function mountFloatingUi({
  host,
  shadowRoot,
  onBootstrapReady,
}: MountOptions): Promise<FloatingUiInstance> {
  injectStyles(shadowRoot);

  const container = document.createElement('div');
  shadowRoot.append(container);
  const rootRef = React.createRef<FloatingUiHandle>();
  const root: Root = createRoot(container);
  root.render(<FloatingUiRoot ref={rootRef} host={host} onBootstrapReady={onBootstrapReady} />);

  return {
    openFromHover() {
      rootRef.current?.openFromHover();
    },
    destroy() {
      rootRef.current?.destroy();
      root.unmount();
      container.remove();
    },
  };
}
