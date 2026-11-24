import { ChevronRight } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useT } from '../i18n';

export interface ContextMenuActionItem {
  kind: 'action';
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface ContextMenuSubmenuItem {
  kind: 'submenu';
  id: string;
  label: string;
  icon?: ReactNode;
  items: ContextMenuActionItem[];
}

export type ContextMenuItem =
  | { kind: 'separator' }
  | { kind: 'label'; id: string; text: string }
  | ContextMenuActionItem
  | ContextMenuSubmenuItem;

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

interface ContextMenuProps {
  menu: ContextMenuState | null;
  onClose: () => void;
}

export function ContextMenu({ menu, onClose }: ContextMenuProps) {
  const t = useT();
  const id = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [openSubId, setOpenSubId] = useState<string | null>(null);
  const [subFlipLeft, setSubFlipLeft] = useState(false);

  useEffect(() => {
    const popover = popoverRef.current;
    const anchor = anchorRef.current;
    if (!popover || !anchor) return;

    setOpenSubId(null);

    if (!menu) {
      if (popover.matches(':popover-open')) {
        popover.hidePopover();
      }
      return;
    }

    const supportsAnchor =
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      CSS.supports('anchor-name: --a');

    const show = () => {
      if (!popover.isConnected) return;
      if (supportsAnchor) {
        anchor.style.left = `${menu.x}px`;
        anchor.style.top = `${menu.y}px`;
      } else {
        const clampedX = Math.min(menu.x, Math.max(8, window.innerWidth - 230));
        const clampedY = Math.min(menu.y, Math.max(8, window.innerHeight - 280));
        popover.style.left = `${clampedX}px`;
        popover.style.top = `${clampedY}px`;
      }

      if (!popover.matches(':popover-open')) {
        try {
          (
            popover as HTMLElement & { showPopover: (opts?: { source?: HTMLElement }) => void }
          ).showPopover({ source: anchor });
        } catch {
          popover.showPopover();
        }
      }

      const rect = popover.getBoundingClientRect();
      setSubFlipLeft(rect.right + 190 > window.innerWidth);

      const firstButton = popover.querySelector<HTMLButtonElement>('button:not(:disabled)');
      firstButton?.focus();
    };

    const raf = requestAnimationFrame(show);

    // Dismiss on subsequent pointerdown outside the menu or Escape.
    // Using popover="manual" + outside pointerdown avoids macOS right-click mouseup
    // prematurely light-dismissing a menu that opened during mousedown.
    const onPointerDown = (e: PointerEvent) => {
      if (e.target instanceof Node && popover.contains(e.target)) return;
      if (popover.matches(':popover-open')) {
        popover.hidePopover();
      }
      onCloseRef.current();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (popover.matches(':popover-open')) {
          popover.hidePopover();
        }
        onCloseRef.current();
      }
    };
    const onWindowBlur = () => {
      if (popover.matches(':popover-open')) {
        popover.hidePopover();
      }
      onCloseRef.current();
    };

    // Delay attaching outside pointerdown to the next tick so the opening right-click never self-dismisses
    const armTimer = setTimeout(() => {
      window.addEventListener('pointerdown', onPointerDown, true);
    }, 0);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('blur', onWindowBlur);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(armTimer);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [menu]);

  const closeMenu = () => {
    const popover = popoverRef.current;
    if (popover?.matches(':popover-open')) {
      popover.hidePopover();
    }
    setOpenSubId(null);
    onCloseRef.current();
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const items = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        ':scope > button:not(:disabled), :scope > div > button:not(:disabled)',
      ),
    );
    if (!items.length) return;
    const currentIdx = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(currentIdx + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(currentIdx - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  return (
    <>
      <span ref={anchorRef} className="menu-anchor" aria-hidden="true" />
      <div
        ref={popoverRef}
        id={id}
        {...({ popover: 'manual' } as Record<string, string>)}
        className="arcline-menu"
      >
        <div
          role="menu"
          {...({ focusgroup: 'menu nomemory' } as Record<string, string>)}
          aria-label={t('sidebar.contextMenu.label')}
          onKeyDown={handleMenuKeyDown}
          className="flex flex-col gap-0.5"
        >
          {menu?.items.map((item, idx) => {
            if (item.kind === 'separator') {
              const prev = menu.items[idx - 1];
              const sepKey = `sep-after-${prev && 'id' in prev ? prev.id : idx}`;
              return (
                <hr
                  key={sepKey}
                  className="my-1 border-0 border-t"
                  style={{ borderColor: 'var(--border-subtle)' }}
                />
              );
            }
            if (item.kind === 'label') {
              return (
                <div
                  key={item.id}
                  className="px-2.5 pt-1 pb-0.5 text-[10.5px] font-semibold tracking-wide uppercase"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {item.text}
                </div>
              );
            }
            if (item.kind === 'submenu') {
              const isOpen = openSubId === item.id;
              return (
                <div
                  key={item.id}
                  role="none"
                  className="relative"
                  onMouseEnter={() => setOpenSubId(item.id)}
                  onMouseLeave={() => setOpenSubId((cur) => (cur === item.id ? null : cur))}
                >
                  <button
                    role="menuitem"
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    onClick={() => setOpenSubId((cur) => (cur === item.id ? null : item.id))}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        setOpenSubId(item.id);
                      } else if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        setOpenSubId(null);
                      }
                    }}
                    className="arcline-menu-item flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] cursor-pointer"
                    style={{
                      backgroundColor: isOpen ? 'var(--bg-hover)' : undefined,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {item.icon && (
                      <span className="grid size-4 shrink-0 place-items-center opacity-75">
                        {item.icon}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <ChevronRight size={13} className="shrink-0 opacity-60" />
                  </button>

                  {isOpen && (
                    <div
                      role="menu"
                      aria-label={item.label}
                      className="arcline-submenu absolute top-[-5px] z-30 flex min-w-[172px] max-w-[220px] flex-col gap-0.5 rounded-xl border p-1.5"
                      style={{
                        left: subFlipLeft ? undefined : 'calc(100% + 4px)',
                        right: subFlipLeft ? 'calc(100% + 4px)' : undefined,
                        borderColor: 'var(--rule)',
                        backgroundColor: 'var(--menu)',
                        boxShadow: '0 14px 36px rgb(0 0 0 / 0.34), 0 2px 8px rgb(0 0 0 / 0.16)',
                      }}
                    >
                      {item.items.map((sub) => (
                        <button
                          key={sub.id}
                          role="menuitem"
                          type="button"
                          disabled={sub.disabled}
                          onClick={() => {
                            closeMenu();
                            sub.onSelect();
                          }}
                          className="arcline-menu-item flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] disabled:opacity-45 cursor-pointer"
                          style={{
                            color: sub.danger ? 'oklch(62% 0.21 25)' : 'var(--text-primary)',
                          }}
                        >
                          {sub.icon && (
                            <span className="grid size-4 shrink-0 place-items-center opacity-80">
                              {sub.icon}
                            </span>
                          )}
                          <span className="min-w-0 flex-1 truncate">{sub.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <button
                key={item.id}
                role="menuitem"
                type="button"
                disabled={item.disabled}
                onMouseEnter={() => setOpenSubId(null)}
                onClick={() => {
                  closeMenu();
                  item.onSelect();
                }}
                className="arcline-menu-item flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] disabled:opacity-45 cursor-pointer"
                style={{
                  color: item.danger ? 'oklch(62% 0.21 25)' : 'var(--text-primary)',
                }}
              >
                {item.icon && (
                  <span className="grid size-4 shrink-0 place-items-center opacity-75">
                    {item.icon}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.shortcut && (
                  <kbd className="ml-2 shrink-0 font-mono text-[10.5px] opacity-55">
                    {item.shortcut}
                  </kbd>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
