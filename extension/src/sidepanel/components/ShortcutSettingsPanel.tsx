import { ExternalLink, Keyboard, Plus, Search, Star, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SITE_SEARCHES } from '../../core/command-bar';
import type { MessageKey } from '../../core/i18n';
import { sanitizeCustomSiteSearch } from '../../core/settings';
import {
  formatShortcutCombo,
  normalizeShortcutCombo,
  parseShortcutFromEvent,
} from '../../core/shortcut-keys';
import type {
  CustomCommandAction,
  CustomSiteSearch,
  Favorite,
  FavoriteShortcut,
  Settings,
} from '../../core/types';
import {
  BRAVE_EXT_SHORTCUTS_URL,
  BRAVE_SHORTCUTS_URL,
  detectBrave,
  openBrowserPage,
  SHORTCUTS_URL,
} from '../../onboarding/platform';
import { useT } from '../i18n';
import { Favicon } from './Favicon';

const CUSTOM_ACTION_ROWS: ReadonlyArray<{
  action: CustomCommandAction;
  commandName: string;
  labelKey: MessageKey;
}> = [
  {
    action: 'openCommandBar',
    commandName: 'open-command-bar',
    labelKey: 'settings.shortcuts.openCommandBar',
  },
  {
    action: 'toggleSidebar',
    commandName: 'toggle-sidebar',
    labelKey: 'settings.shortcuts.toggleSidebar',
  },
  {
    action: 'nextSpace',
    commandName: 'next-space',
    labelKey: 'settings.shortcuts.nextSpace',
  },
  {
    action: 'previousSpace',
    commandName: 'previous-space',
    labelKey: 'settings.shortcuts.previousSpace',
  },
  {
    action: 'togglePin',
    commandName: 'toggle-pin',
    labelKey: 'settings.shortcuts.pin',
  },
];

interface ShortcutSettingsPanelProps {
  settings: Settings;
  favorites: readonly Favorite[];
  onUpdateSettings: (next: Settings) => void;
}

const IS_MAC =
  typeof navigator !== 'undefined' && /Macintosh|Mac OS X|MacIntel/i.test(navigator.userAgent);

export function ShortcutSettingsPanel({
  settings,
  favorites,
  onUpdateSettings,
}: ShortcutSettingsPanelProps) {
  const t = useT();
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingAction, setRecordingAction] = useState<CustomCommandAction | null>(null);
  const [browserCommands, setBrowserCommands] = useState<Record<string, string>>({});
  const [isBrave, setIsBrave] = useState(false);
  const [prefix, setPrefix] = useState('');
  const [label, setLabel] = useState('');
  const [urlTemplate, setUrlTemplate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void detectBrave().then((b) => {
      if (active) setIsBrave(b);
    });
    if (typeof chrome !== 'undefined' && chrome.commands?.getAll) {
      void chrome.commands
        .getAll()
        .then((list) => {
          if (!active) return;
          const map: Record<string, string> = {};
          for (const cmd of list) {
            if (cmd.name) map[cmd.name] = cmd.shortcut ?? '';
          }
          setBrowserCommands(map);
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, []);

  const updateCustomShortcut = (action: CustomCommandAction, combo: string) => {
    const normalized = normalizeShortcutCombo(combo);
    const next = { ...settings.customShortcuts };
    if (!normalized) {
      delete next[action];
    } else {
      next[action] = normalized;
    }
    onUpdateSettings({ ...settings, customShortcuts: next });
  };

  const handleRecordActionKeyDown = (
    action: CustomCommandAction,
    e: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setRecordingAction(null);
      return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      e.stopPropagation();
      updateCustomShortcut(action, '');
      setRecordingAction(null);
      return;
    }
    const combo = parseShortcutFromEvent(e);
    if (!combo) return;
    e.preventDefault();
    e.stopPropagation();
    updateCustomShortcut(action, combo);
    setRecordingAction(null);
  };

  const updateFavoriteMeta = (url: string, patch: Partial<FavoriteShortcut>) => {
    const current = settings.favoriteShortcuts[url] ?? {};
    const rawAlias = (patch.alias !== undefined ? patch.alias : (current.alias ?? ''))
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 24);
    const rawShortcut =
      patch.shortcut !== undefined
        ? normalizeShortcutCombo(patch.shortcut)
        : normalizeShortcutCombo(current.shortcut);

    const nextMap = { ...settings.favoriteShortcuts };
    if (!rawAlias && !rawShortcut) {
      delete nextMap[url];
    } else {
      nextMap[url] = {
        ...(rawAlias ? { alias: rawAlias } : {}),
        ...(rawShortcut ? { shortcut: rawShortcut } : {}),
      };
    }
    onUpdateSettings({ ...settings, favoriteShortcuts: nextMap });
  };

  const handleRecordKeyDown = (url: string, e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setRecordingUrl(null);
      return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      e.stopPropagation();
      updateFavoriteMeta(url, { shortcut: '' });
      setRecordingUrl(null);
      return;
    }
    const combo = parseShortcutFromEvent(e);
    if (!combo) return;
    e.preventDefault();
    e.stopPropagation();
    updateFavoriteMeta(url, { shortcut: combo });
    setRecordingUrl(null);
  };

  const handleAddSiteSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = sanitizeCustomSiteSearch({
      id: `custom:${prefix.trim().toLowerCase()}`,
      prefix,
      label,
      urlTemplate,
    });
    if (!cleaned) {
      setFormError(t('settings.siteSearch.invalid'));
      return;
    }
    setFormError(null);
    const rest = settings.customSiteSearches.filter(
      (item) => item.prefix.toLowerCase() !== cleaned.prefix.toLowerCase(),
    );
    onUpdateSettings({
      ...settings,
      customSiteSearches: [...rest, cleaned],
    });
    setPrefix('');
    setLabel('');
    setUrlTemplate('');
  };

  const handleRemoveSiteSearch = (target: CustomSiteSearch) => {
    onUpdateSettings({
      ...settings,
      customSiteSearches: settings.customSiteSearches.filter((s) => s.id !== target.id),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Editable In-App Arcline Shortcuts + Live Browser Shortcuts */}
      <section
        className="arcline-settings-card flex flex-col gap-2.5"
        data-testid="custom-shortcuts-section"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Keyboard size={13} style={{ color: 'var(--accent)' }} aria-hidden="true" />
            <div className="text-[12.5px] font-semibold">{t('settings.shortcuts.customTitle')}</div>
          </div>
          <div className="flex items-center gap-1.5">
            {isBrave && (
              <button
                type="button"
                onClick={() => void openBrowserPage(BRAVE_SHORTCUTS_URL)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[10.5px] font-medium transition-colors hover:bg-[var(--bg-hover)]"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <ExternalLink size={11} aria-hidden="true" />
                <span>{t('settings.shortcuts.openBraveShortcuts')}</span>
              </button>
            )}
            <button
              type="button"
              data-testid="open-browser-shortcuts-btn"
              onClick={() =>
                void openBrowserPage(isBrave ? BRAVE_EXT_SHORTCUTS_URL : SHORTCUTS_URL)
              }
              className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[10.5px] font-medium transition-colors hover:bg-[var(--bg-hover)]"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <ExternalLink size={11} aria-hidden="true" />
              <span>{t('settings.shortcuts.openBrowserShortcuts')}</span>
            </button>
          </div>
        </div>
        <p className="m-0 text-[11px] leading-[1.5]" style={{ color: 'var(--text-muted)' }}>
          {t('settings.shortcuts.customHint')}
        </p>

        <div className="flex flex-col gap-1.5">
          {CUSTOM_ACTION_ROWS.map((row) => {
            const customCombo = settings.customShortcuts?.[row.action];
            const browserKey = browserCommands[row.commandName];
            const isRecording = recordingAction === row.action;
            return (
              <div
                key={row.action}
                className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                style={{
                  borderColor: 'var(--border-subtle)',
                  backgroundColor: 'var(--bg-canvas)',
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium">{t(row.labelKey)}</div>
                  {browserKey && (
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      Browser: <kbd className="font-mono">{browserKey}</kbd>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    data-testid={`custom-shortcut-${row.action}`}
                    onClick={() => setRecordingAction(isRecording ? null : row.action)}
                    onBlur={() => {
                      if (isRecording) setRecordingAction(null);
                    }}
                    onKeyDown={(e) => {
                      if (isRecording) handleRecordActionKeyDown(row.action, e);
                    }}
                    className="h-7 min-w-[88px] cursor-pointer rounded-md border px-2 font-mono text-[11px] transition-colors outline-none"
                    style={{
                      borderColor: isRecording ? 'var(--accent)' : 'var(--border-subtle)',
                      backgroundColor: isRecording
                        ? 'color-mix(in oklch, var(--accent) 14%, var(--bg-surface))'
                        : 'var(--bg-surface)',
                      color:
                        isRecording || customCombo ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                  >
                    {isRecording
                      ? t('settings.favShortcuts.recording')
                      : customCombo
                        ? formatShortcutCombo(customCombo, IS_MAC)
                        : t('settings.favShortcuts.keyPlaceholder')}
                  </button>
                  {customCombo && !isRecording && (
                    <button
                      type="button"
                      onClick={() => updateCustomShortcut(row.action, '')}
                      aria-label={`Clear ${row.action}`}
                      className="flex size-6 cursor-pointer items-center justify-center rounded-md hover:bg-[var(--bg-hover)]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Favorite Aliases & Browser-wide Shortcuts */}
      <section className="arcline-settings-card flex flex-col gap-2.5">
        <div className="flex items-center gap-1.5">
          <Star size={13} style={{ color: 'var(--accent)' }} aria-hidden="true" />
          <div className="text-[12.5px] font-semibold">{t('settings.favShortcuts.title')}</div>
        </div>
        <p className="m-0 text-[11px] leading-[1.5]" style={{ color: 'var(--text-muted)' }}>
          {t('settings.favShortcuts.hint')}
        </p>

        {favorites.length === 0 ? (
          <p className="m-0 py-1 text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
            {t('settings.favShortcuts.empty')}
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {favorites.map((fav) => {
              const meta = settings.favoriteShortcuts[fav.url] ?? {};
              const isRecording = recordingUrl === fav.url;
              return (
                <div
                  key={fav.id}
                  className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    backgroundColor: 'var(--bg-canvas)',
                  }}
                >
                  <Favicon url={fav.url} title={fav.title} size={15} />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                    {fav.title}
                  </span>
                  <input
                    type="text"
                    value={meta.alias ?? ''}
                    onChange={(e) => updateFavoriteMeta(fav.url, { alias: e.target.value })}
                    placeholder={t('settings.favShortcuts.aliasPlaceholder')}
                    aria-label={t('settings.favShortcuts.aliasAria', { title: fav.title })}
                    data-testid={`fav-alias-${fav.id}`}
                    className="h-7 w-[88px] rounded-md border px-2 font-mono text-[11px] outline-none focus:border-[var(--accent)]"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setRecordingUrl(isRecording ? null : fav.url)}
                      onBlur={() => {
                        if (isRecording) setRecordingUrl(null);
                      }}
                      onKeyDown={(e) => {
                        if (isRecording) handleRecordKeyDown(fav.url, e);
                      }}
                      aria-label={t('settings.favShortcuts.keyAria', { title: fav.title })}
                      data-testid={`fav-shortcut-${fav.id}`}
                      className="h-7 min-w-[78px] cursor-pointer rounded-md border px-2 font-mono text-[11px] transition-colors outline-none"
                      style={{
                        borderColor: isRecording ? 'var(--accent)' : 'var(--border-subtle)',
                        backgroundColor: isRecording
                          ? 'color-mix(in oklch, var(--accent) 14%, var(--bg-surface))'
                          : 'var(--bg-surface)',
                        color:
                          isRecording || meta.shortcut
                            ? 'var(--text-primary)'
                            : 'var(--text-muted)',
                      }}
                    >
                      {isRecording
                        ? t('settings.favShortcuts.recording')
                        : meta.shortcut
                          ? formatShortcutCombo(meta.shortcut, IS_MAC)
                          : t('settings.favShortcuts.keyPlaceholder')}
                    </button>
                    {meta.shortcut && !isRecording && (
                      <button
                        type="button"
                        onClick={() => updateFavoriteMeta(fav.url, { shortcut: '' })}
                        aria-label={t('settings.favShortcuts.clearKeyAria', { title: fav.title })}
                        className="flex size-6 cursor-pointer items-center justify-center rounded-md hover:bg-[var(--bg-hover)]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Custom Site-Search Shortcuts */}
      <section className="arcline-settings-card flex flex-col gap-2.5">
        <div className="flex items-center gap-1.5">
          <Search size={13} style={{ color: 'var(--accent)' }} aria-hidden="true" />
          <div className="text-[12.5px] font-semibold">{t('settings.siteSearch.title')}</div>
        </div>
        <p className="m-0 text-[11px] leading-[1.5]" style={{ color: 'var(--text-muted)' }}>
          {t('settings.siteSearch.hint')}
        </p>

        {settings.customSiteSearches.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {settings.customSiteSearches.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11.5px]"
                style={{
                  borderColor: 'var(--border-subtle)',
                  backgroundColor: 'var(--bg-canvas)',
                }}
              >
                <code
                  className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold"
                  style={{
                    backgroundColor: 'color-mix(in oklch, var(--accent) 16%, transparent)',
                    color: 'var(--accent)',
                  }}
                >
                  {item.prefix}
                </code>
                <span className="shrink-0 font-medium">{item.label}</span>
                <span
                  className="min-w-0 flex-1 truncate font-mono text-[10.5px]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {item.urlTemplate}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveSiteSearch(item)}
                  aria-label={t('settings.siteSearch.removeAria', { label: item.label })}
                  className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-[var(--bg-hover)]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleAddSiteSearch} className="flex flex-col gap-2">
          <div className="grid grid-cols-[84px_1fr] gap-2">
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder={t('settings.siteSearch.prefixPlaceholder')}
              aria-label={t('settings.siteSearch.prefixPlaceholder')}
              data-testid="custom-site-prefix"
              className="h-8 rounded-lg border px-2 font-mono text-[11.5px] outline-none focus:border-[var(--accent)]"
              style={{
                borderColor: 'var(--border-subtle)',
                backgroundColor: 'var(--bg-canvas)',
                color: 'var(--text-primary)',
              }}
            />
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('settings.siteSearch.labelPlaceholder')}
              aria-label={t('settings.siteSearch.labelPlaceholder')}
              data-testid="custom-site-label"
              className="h-8 rounded-lg border px-2.5 text-[11.5px] outline-none focus:border-[var(--accent)]"
              style={{
                borderColor: 'var(--border-subtle)',
                backgroundColor: 'var(--bg-canvas)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={urlTemplate}
              onChange={(e) => setUrlTemplate(e.target.value)}
              placeholder="https://example.com/search?q=%s"
              aria-label={t('settings.siteSearch.urlPlaceholder')}
              data-testid="custom-site-url"
              className="h-8 min-w-0 flex-1 rounded-lg border px-2.5 font-mono text-[11.5px] outline-none focus:border-[var(--accent)]"
              style={{
                borderColor: 'var(--border-subtle)',
                backgroundColor: 'var(--bg-canvas)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              type="submit"
              data-testid="custom-site-add"
              className="flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-lg px-3 text-[11.5px] font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Plus size={13} />
              <span>{t('settings.siteSearch.add')}</span>
            </button>
          </div>
          {formError && <p className="m-0 text-[11px] text-red-500">{formError}</p>}
        </form>

        {/* Built-in AI & Web Site Searches quick reference */}
        <div className="pt-1">
          <div className="mb-1.5 text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
            {t('settings.siteSearch.builtInTitle')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SITE_SEARCHES.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px]"
                style={{
                  borderColor: 'var(--border-subtle)',
                  backgroundColor: 'var(--bg-canvas)',
                }}
              >
                <code className="font-mono font-semibold" style={{ color: s.accent }}>
                  {s.prefix}
                </code>
                <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
