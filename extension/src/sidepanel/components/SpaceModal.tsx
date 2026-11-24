import { Ban, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { SPACE_PRESETS } from '../../core/colors';
import { ARC_SPACE_ICONS, CURATED_SPACE_EMOJIS } from '../../core/space-icons';
import { useT } from '../i18n';
import { SpaceGlyph } from './SpaceGlyph';

export interface SpaceModalTarget {
  mode: 'create' | 'edit';
  spaceId?: string;
  initialName?: string;
  initialHue?: number;
  initialIcon?: string;
  initialFocus?: 'name' | 'icon';
}

interface SpaceModalProps {
  target: SpaceModalTarget | null;
  onClose: (meta?: { backdropOutsideSidebar?: boolean }) => void;
  onSubmit: (values: { name: string; hue: number; icon: string }) => void;
  sidebarWidthPx?: number;
}

export function SpaceModal({ target, onClose, onSubmit, sidebarWidthPx = 290 }: SpaceModalProps) {
  const t = useT();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const backdropCloseRef = useRef(false);
  const [name, setName] = useState('');
  const [hue, setHue] = useState(235);
  const [icon, setIcon] = useState('');
  const [iconTab, setIconTab] = useState<'arc' | 'emoji'>('arc');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (target) {
      backdropCloseRef.current = false;
      const initIcon = target.initialIcon ?? '';
      setName(target.initialName ?? '');
      setHue(target.initialHue ?? 235);
      setIcon(initIcon);
      setIconTab(initIcon && !/^[a-zA-Z0-9_-]{3,}$/.test(initIcon) ? 'emoji' : 'arc');
      if (!dialog.open) dialog.showModal();
      if (target.initialFocus !== 'icon') {
        requestAnimationFrame(() => nameInputRef.current?.focus());
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [target]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      const backdropOutsideSidebar = backdropCloseRef.current;
      backdropCloseRef.current = false;
      onClose({ backdropOutsideSidebar });
    };
    const handlePointerDown = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      const outsideDialog =
        e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      backdropCloseRef.current = outsideDialog && e.clientX > sidebarWidthPx + 14;
    };

    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('pointerdown', handlePointerDown);

    // Fallback for click-outside dismiss if `closedby` is unsupported
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      let pressedOutside = false;
      const isOutside = (e: PointerEvent) => {
        const r = dialog.getBoundingClientRect();
        return (
          e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
        );
      };
      const onDown = (e: PointerEvent) => {
        pressedOutside = isOutside(e);
      };
      const onUp = (e: PointerEvent) => {
        if (pressedOutside && isOutside(e)) dialog.close();
      };
      dialog.addEventListener('pointerdown', onDown);
      dialog.addEventListener('pointerup', onUp);
      return () => {
        dialog.removeEventListener('close', handleClose);
        dialog.removeEventListener('pointerdown', handlePointerDown);
        dialog.removeEventListener('pointerdown', onDown);
        dialog.removeEventListener('pointerup', onUp);
      };
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose, sidebarWidthPx]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({ name: trimmed, hue, icon: icon.trim() });
    dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      data-arcline-space-dialog="true"
      {...({ closedby: 'any' } as Record<string, string>)}
      className="arcline-dialog arcline-space-dialog"
    >
      {target && (
        <form onSubmit={handleSave} className="flex flex-col gap-3.5 p-4">
          <div className="flex items-center justify-between gap-2">
            <h1 id={titleId} className="m-0 text-[15px] font-semibold">
              {target?.mode === 'edit' ? t('spaces.titleEdit') : t('spaces.titleCreate')}
            </h1>
            <button
              type="button"
              aria-label={t('spaces.close')}
              onClick={() => dialogRef.current?.close()}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-hover)] cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Live Space Header Preview */}
          <div
            className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5"
            style={{
              borderColor: 'var(--border-subtle)',
              background:
                hue < 0
                  ? 'var(--bg-canvas)'
                  : `linear-gradient(135deg, oklch(0.32 0.05 ${hue} / 0.35), var(--bg-canvas))`,
            }}
          >
            <span
              className="grid size-8 shrink-0 place-items-center rounded-lg"
              style={{
                backgroundColor: 'var(--bg-active)',
                boxShadow: 'var(--pill-shadow)',
              }}
            >
              <SpaceGlyph icon={icon || undefined} size={16} />
            </span>
            <label className="flex flex-1 flex-col gap-0.5">
              <span className="sr-only">{t('spaces.nameLabel')}</span>
              <input
                ref={nameInputRef}
                type="text"
                required
                aria-label={t('spaces.nameLabel')}
                placeholder={t('spaces.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 w-full rounded-lg border-0 bg-transparent px-1 text-[14px] font-semibold outline-none placeholder:font-normal placeholder:text-[var(--text-muted)]"
              />
            </label>
          </div>

          {/* Arc Space Icon Picker (Arc Vector Icons + Emojis) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11.5px] font-medium" style={{ color: 'var(--text-muted)' }}>
                {t('spaces.iconHeading')}
              </span>
              <div
                className="flex items-center gap-0.5 rounded-lg p-0.5"
                style={{ backgroundColor: 'var(--bg-canvas)' }}
              >
                <button
                  type="button"
                  onClick={() => setIconTab('arc')}
                  className="rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer"
                  style={{
                    backgroundColor: iconTab === 'arc' ? 'var(--bg-active)' : 'transparent',
                    color: iconTab === 'arc' ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  {t('spaces.iconTabArc')}
                </button>
                <button
                  type="button"
                  onClick={() => setIconTab('emoji')}
                  className="rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer"
                  style={{
                    backgroundColor: iconTab === 'emoji' ? 'var(--bg-active)' : 'transparent',
                    color: iconTab === 'emoji' ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  {t('spaces.iconTabEmoji')}
                </button>
              </div>
            </div>

            {iconTab === 'arc' ? (
              <div
                className="grid grid-cols-8 gap-1 rounded-xl border p-2"
                style={{
                  borderColor: 'var(--border-subtle)',
                  backgroundColor: 'var(--bg-canvas)',
                }}
              >
                <button
                  type="button"
                  title={t('spaces.iconNoneTitle')}
                  aria-label={t('spaces.iconNone')}
                  aria-pressed={icon === ''}
                  onClick={() => setIcon('')}
                  className="grid h-8 w-full place-items-center rounded-lg transition-all hover:bg-[var(--bg-hover)] cursor-pointer"
                  style={{
                    backgroundColor: icon === '' ? 'var(--bg-active)' : 'transparent',
                    outline: icon === '' ? '1.5px solid var(--accent)' : 'none',
                    color: 'var(--text-muted)',
                  }}
                >
                  <Ban size={13} />
                </button>
                {ARC_SPACE_ICONS.map((opt) => {
                  const selected = icon === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      title={opt.label}
                      aria-label={t('spaces.iconLabel', { name: opt.label })}
                      aria-pressed={selected}
                      onClick={() => setIcon(opt.id)}
                      className="grid h-8 w-full place-items-center rounded-lg transition-all hover:bg-[var(--bg-hover)] cursor-pointer"
                      style={{
                        backgroundColor: selected ? 'var(--bg-active)' : 'transparent',
                        outline: selected ? '1.5px solid var(--accent)' : 'none',
                        color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
                      }}
                    >
                      <SpaceGlyph icon={opt.id} size={15} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div
                className="flex flex-col gap-2 rounded-xl border p-2"
                style={{
                  borderColor: 'var(--border-subtle)',
                  backgroundColor: 'var(--bg-canvas)',
                }}
              >
                <div className="grid grid-cols-8 gap-1">
                  {CURATED_SPACE_EMOJIS.map((emoji) => {
                    const selected = icon === emoji;
                    return (
                      <button
                        key={emoji}
                        type="button"
                        aria-label={t('spaces.emojiLabel', { emoji })}
                        aria-pressed={selected}
                        onClick={() => setIcon(emoji)}
                        className="grid h-8 w-full place-items-center rounded-lg text-[15px] transition-all hover:scale-110 hover:bg-[var(--bg-hover)] cursor-pointer"
                        style={{
                          backgroundColor: selected ? 'var(--bg-active)' : 'transparent',
                          outline: selected ? '1.5px solid var(--accent)' : 'none',
                        }}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={2}
                    aria-label={t('spaces.customEmojiLabel')}
                    placeholder={t('spaces.customEmojiPlaceholder')}
                    value={/^[a-zA-Z0-9_-]{3,}$/.test(icon) ? '' : icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="h-7 flex-1 rounded-md border px-2 text-[12px]"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      backgroundColor: 'var(--bg-surface)',
                    }}
                  />
                  {icon && (
                    <button
                      type="button"
                      onClick={() => setIcon('')}
                      className="rounded-md px-2 py-1 text-[11px] hover:bg-[var(--bg-hover)] cursor-pointer"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {t('spaces.clear')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend
              className="mb-1 text-[11.5px] font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('spaces.baseColor')}
            </legend>
            <div className="flex flex-wrap gap-2">
              {SPACE_PRESETS.map((preset) => {
                const selected =
                  preset.hue < 0 ? hue < 0 : hue >= 0 && Math.abs(hue - preset.hue) < 12;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    title={preset.name}
                    aria-label={preset.name}
                    aria-pressed={selected}
                    onClick={() => setHue(preset.hue)}
                    className="h-6 w-6 rounded-full transition-transform hover:scale-110 cursor-pointer"
                    style={{
                      backgroundColor:
                        preset.hue < 0 ? 'oklch(34% 0 0)' : `oklch(62% 0.17 ${preset.hue})`,
                      outline: selected ? '2px solid var(--text-primary)' : 'none',
                      outlineOffset: '2px',
                    }}
                  />
                );
              })}
            </div>
          </fieldset>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-lg border px-3 py-1.5 text-[12.5px] transition-colors hover:bg-[var(--bg-hover)] cursor-pointer"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              {t('spaces.cancel')}
            </button>
            <button
              type="submit"
              className="rounded-lg px-4 py-1.5 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
              style={{
                backgroundColor: hue < 0 ? 'var(--accent)' : `oklch(55% 0.18 ${hue})`,
              }}
            >
              {target?.mode === 'edit' ? t('spaces.save') : t('spaces.create')}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
