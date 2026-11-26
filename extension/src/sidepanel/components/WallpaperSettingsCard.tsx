import { Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Space } from '../../core/types';
import {
  GLOBAL_WALLPAPER_KEY,
  loadWallpaper,
  removeWallpaper,
  saveWallpaper,
  spaceWallpaperKey,
} from '../../core/wallpapers';
import { useT } from '../i18n';

interface WallpaperSettingsCardProps {
  spaces: readonly Space[];
}

export function WallpaperSettingsCard({ spaces }: WallpaperSettingsCardProps) {
  const t = useT();
  const [target, setTarget] = useState<string>(GLOBAL_WALLPAPER_KEY);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const storageKey =
    target === GLOBAL_WALLPAPER_KEY ? GLOBAL_WALLPAPER_KEY : spaceWallpaperKey(target);

  useEffect(() => {
    let active = true;
    setError(null);
    void loadWallpaper(storageKey).then((record) => {
      if (!active) return;
      if (record?.dataUrl) {
        setPreviewUrl(record.dataUrl);
        setFileName(record.name);
      } else {
        setPreviewUrl(null);
        setFileName(null);
      }
    });
    return () => {
      active = false;
    };
  }, [storageKey]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await saveWallpaper(storageKey, file, file.name);
      setPreviewUrl(dataUrl);
      setFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.wallpaper.error'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleClear = async () => {
    setBusy(true);
    setError(null);
    try {
      await removeWallpaper(storageKey);
      setPreviewUrl(null);
      setFileName(null);
    } catch {
      setError(t('settings.wallpaper.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="arcline-settings-card flex flex-col gap-2.5"
      data-testid="wallpaper-settings-card"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 font-medium">
            <ImageIcon size={13} style={{ color: 'var(--accent)' }} aria-hidden="true" />
            <span>{t('settings.wallpaper.title')}</span>
          </div>
          <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {t('settings.wallpaper.description')}
          </div>
        </div>
        <select
          aria-label={t('settings.wallpaper.scopeAria')}
          data-testid="wallpaper-scope-selector"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="h-7 shrink-0 rounded-lg border px-2 text-[11.5px]"
          style={{
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-primary)',
          }}
        >
          <option value={GLOBAL_WALLPAPER_KEY}>{t('settings.wallpaper.scopeAll')}</option>
          {spaces.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="relative flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border"
          style={{
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--bg-canvas)',
          }}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={fileName ?? 'Wallpaper preview'}
              data-testid="wallpaper-preview-img"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="px-2 text-center text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
              {t('settings.wallpaper.defaultTheme')}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {fileName && (
            <div className="truncate text-[11px] font-medium" title={fileName}>
              {fileName}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <label
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors hover:bg-[var(--bg-hover)]"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <Upload size={12} aria-hidden="true" />
              <span>{t('settings.wallpaper.pick')}</span>
              <input
                ref={inputRef}
                type="file"
                accept="image/*,.gif"
                disabled={busy}
                data-testid="wallpaper-file-input"
                onChange={(e) => void handleFileChange(e)}
                className="sr-only"
              />
            </label>
            {previewUrl && (
              <button
                type="button"
                disabled={busy}
                data-testid="wallpaper-clear-btn"
                onClick={() => void handleClear()}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11.5px] transition-colors hover:bg-[var(--bg-hover)]"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
              >
                <Trash2 size={12} aria-hidden="true" />
                <span>{t('settings.wallpaper.reset')}</span>
              </button>
            )}
          </div>
          {error && <div className="text-[11px] text-red-500">{error}</div>}
        </div>
      </div>
    </div>
  );
}
