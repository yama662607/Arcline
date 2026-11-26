import {
  Archive,
  Check,
  Copy,
  Download,
  ExternalLink,
  FolderOpen,
  Keyboard,
  MessageSquarePlus,
  Monitor,
  MousePointer2,
  Moon,
  RotateCcw,
  SlidersHorizontal,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArcImportError, filterImportedSidebar, parseArcSidebar } from '../../core/arc-import';
import { LANGUAGE_OPTIONS, type MessageKey, type Translator } from '../../core/i18n';
import type {
  ArchivedTab,
  AutoArchiveHours,
  CommandBarOpenMode,
  ImportedSidebar,
  LanguagePreference,
  SearchEngine,
  Settings,
  SidebarState,
  ThemeMode,
} from '../../core/types';
import { ARC_SIDEBAR_PATHS, type ArcPathOs, defaultArcPathOs } from '../../onboarding/platform';
import { useT } from '../i18n';
import { ArcImportPreview } from './ArcImportPreview';
import { Favicon } from './Favicon';
import { ShortcutSettingsPanel } from './ShortcutSettingsPanel';
import { WallpaperSettingsCard } from './WallpaperSettingsCard';

export type SettingsTabId = 'general' | 'interaction' | 'archive' | 'import' | 'shortcuts';

interface SettingsModalProps {
  open: boolean;
  initialTab?: SettingsTabId;
  settings: Settings;
  archivedTabs: ArchivedTab[];
  sidebarState: SidebarState;
  onClose: (meta?: { backdropOutsideSidebar?: boolean }) => void;
  onUpdateSettings: (next: Settings) => void;
  onRestoreArchived: (archiveId: string) => void;
  onRemoveArchived: (archiveId: string) => void;
  onClearArchive: () => void;
  onConfirmImport: (data: ImportedSidebar) => Promise<void>;
  sidebarWidthPx?: number;
}

const SEARCH_ENGINE_OPTIONS: ReadonlyArray<{ value: SearchEngine; label: string }> = [
  { value: 'google', label: 'Google' },
  { value: 'duckduckgo', label: 'DuckDuckGo' },
  { value: 'brave', label: 'Brave Search' },
];

function formatRelativeTime(ts: number, t: Translator): string {
  const diffMin = Math.max(1, Math.floor((Date.now() - ts) / 60000));
  if (diffMin < 60) return t('settings.time.minutesAgo', { count: diffMin });
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return t('settings.time.hoursAgo', { count: diffHr });
  return t('settings.time.daysAgo', { count: Math.floor(diffHr / 24) });
}

function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className="arcline-switch shrink-0 cursor-pointer"
      data-checked={checked ? 'true' : 'false'}
    >
      <span className="arcline-switch-thumb" aria-hidden="true" />
    </button>
  );
}

const SHORTCUT_ITEMS: ReadonlyArray<{
  id: string;
  keys: ReadonlyArray<string | MessageKey>;
  label: MessageKey;
  note?: MessageKey;
}> = [
  {
    id: 'toggle',
    keys: ['⌃', 'B'],
    label: 'settings.shortcuts.toggleSidebar',
    note: 'settings.shortcuts.toggleSidebarNote',
  },
  {
    id: 'space',
    keys: ['⌃', '← / →'],
    label: 'settings.shortcuts.switchSpace',
    note: 'settings.shortcuts.switchSpaceNote',
  },
  { id: 'swipe', keys: ['settings.shortcuts.swipeKey'], label: 'settings.shortcuts.swipe' },
  {
    id: 'pin',
    keys: ['⌃', 'D'],
    label: 'settings.shortcuts.pin',
    note: 'settings.shortcuts.pinNote',
  },
  {
    id: 'search',
    keys: ['⌘', 'K'],
    label: 'settings.shortcuts.search',
    note: 'settings.shortcuts.searchNote',
  },
  { id: 'escape', keys: ['Esc'], label: 'settings.shortcuts.escape' },
];

export function SettingsModal({
  open,
  initialTab = 'general',
  settings,
  archivedTabs,
  sidebarState,
  onClose,
  onUpdateSettings,
  onRestoreArchived,
  onRemoveArchived,
  onClearArchive,
  onConfirmImport,
  sidebarWidthPx = 290,
}: SettingsModalProps) {
  const t = useT();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const backdropCloseRef = useRef(false);
  const [tab, setTab] = useState<SettingsTabId>(initialTab);
  const [archiveQuery, setArchiveQuery] = useState('');
  const [pathOs, setPathOs] = useState<ArcPathOs>(() => defaultArcPathOs());
  const [rawJson, setRawJson] = useState<unknown | null>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [skipEmpty, setSkipEmpty] = useState(true);
  const [skipSearches, setSkipSearches] = useState(true);
  const [dedupe, setDedupe] = useState(true);
  const [selectedSpaces, setSelectedSpaces] = useState<ReadonlySet<number>>(() => new Set());
  const [includeFavorites, setIncludeFavorites] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const activeArcPath = ARC_SIDEBAR_PATHS[pathOs];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      backdropCloseRef.current = false;
      setError(null);
      setTab(initialTab);
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, initialTab]);

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
    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose, sidebarWidthPx]);

  const { parsed, parseError } = useMemo<{
    parsed: ImportedSidebar | null;
    parseError: string | null;
  }>(() => {
    if (!rawJson) return { parsed: null, parseError: error };
    try {
      return {
        parsed: parseArcSidebar(rawJson, {
          skipEmptyFolders: skipEmpty,
          skipGoogleSearches: skipSearches,
          dedupeWithinSpace: dedupe,
          skipBrokenLocalFiles: true,
        }),
        parseError: error,
      };
    } catch (err) {
      return {
        parsed: null,
        parseError: err instanceof ArcImportError ? err.message : t('settings.import.errorParse'),
      };
    }
  }, [rawJson, skipEmpty, skipSearches, dedupe, error, t]);

  useEffect(() => {
    if (!parsed) {
      setSelectedSpaces(new Set());
      return;
    }
    setSelectedSpaces(new Set(parsed.spaces.map((_, idx) => idx)));
    setIncludeFavorites(true);
  }, [parsed?.spaces.length, rawJson]);

  const filteredImport = useMemo(
    () => (parsed ? filterImportedSidebar(parsed, selectedSpaces, includeFavorites) : null),
    [parsed, selectedSpaces, includeFavorites],
  );
  const nothingSelected =
    filteredImport !== null &&
    filteredImport.spaces.length === 0 &&
    filteredImport.favorites.length === 0;

  const filteredArchive = archiveQuery.trim()
    ? archivedTabs.filter(
        (a) =>
          a.title.toLowerCase().includes(archiveQuery.toLowerCase()) ||
          a.url.toLowerCase().includes(archiveQuery.toLowerCase()) ||
          a.spaceName.toLowerCase().includes(archiveQuery.toLowerCase()),
      )
    : archivedTabs;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setImportFileName(file.name);
    try {
      const text = await file.text();
      setRawJson(JSON.parse(text));
    } catch {
      setRawJson(null);
      setImportFileName(null);
      setError(t('settings.import.errorFile'));
    }
  };

  const handleImport = async () => {
    if (!filteredImport || nothingSelected) return;
    setImporting(true);
    try {
      await onConfirmImport(filteredImport);
      setRawJson(null);
      setImportFileName(null);
      dialogRef.current?.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.import.errorFailed'));
    } finally {
      setImporting(false);
    }
  };

  const toggleImportSpace = (idx: number) => {
    setSelectedSpaces((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleExportBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      favorites: sidebarState.favorites.map(({ title, url }) => ({ title, url })),
      spaces: sidebarState.spaces.map(({ name, hue, icon, theme, pinned }) => ({
        name,
        hue,
        icon,
        theme,
        pinned,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arcline-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(activeArcPath);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  const copyAndPickFile = async () => {
    await copyPath();
    importInputRef.current?.click();
  };

  const selectLanguage = (next: LanguagePreference) => {
    if (next === settings.language) return;
    onUpdateSettings({ ...settings, language: next });
  };

  const openStartGuide = () => {
    const url = chrome.runtime.getURL('onboarding.html');
    try {
      void chrome.tabs.create({ url });
    } catch {
      window.open(url, '_blank', 'noopener');
    }
    dialogRef.current?.close();
  };

  const navItems: ReadonlyArray<{
    id: SettingsTabId;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    {
      id: 'general',
      label: t('settings.nav.general'),
      shortLabel: t('settings.nav.generalShort'),
      icon: <SlidersHorizontal size={14} />,
    },
    {
      id: 'interaction',
      label: t('settings.nav.interaction'),
      shortLabel: t('settings.nav.interactionShort'),
      icon: <MousePointer2 size={14} />,
    },
    {
      id: 'archive',
      label: t('settings.nav.archive', { count: archivedTabs.length }),
      shortLabel: t('settings.nav.archive', { count: archivedTabs.length }),
      icon: <Archive size={14} />,
      badge: archivedTabs.length > 0 ? archivedTabs.length : undefined,
    },
    {
      id: 'import',
      label: t('settings.nav.import'),
      shortLabel: t('settings.nav.import'),
      icon: <Upload size={14} />,
    },
    {
      id: 'shortcuts',
      label: t('settings.nav.shortcuts'),
      shortLabel: t('settings.nav.shortcutsShort'),
      icon: <Keyboard size={14} />,
    },
  ];

  const activeNav = navItems.find((n) => n.id === tab) ?? navItems[0];

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      data-arcline-settings-dialog="true"
      {...({ closedby: 'any' } as Record<string, string>)}
      className="arcline-dialog arcline-settings-dialog"
    >
      <div className="arcline-settings-layout">
        {/* Desktop / Window-Centered Left Navigation Rail */}
        <aside
          className="arcline-settings-rail flex flex-col border-r p-3"
          style={{
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'color-mix(in oklch, var(--bg-canvas) 65%, transparent)',
          }}
        >
          <div className="mb-3 flex items-center gap-2 px-2 pt-1">
            <img
              src="icons/icon-32.png"
              alt=""
              width={20}
              height={20}
              className="rounded-md shadow-xs"
            />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold leading-tight">Arcline</div>
              <div className="text-[10.5px] leading-tight" style={{ color: 'var(--text-muted)' }}>
                v1.0.0
              </div>
            </div>
          </div>

          <nav aria-label={t('settings.navLabel')} className="flex flex-col gap-0.5">
            {navItems.map((item) => {
              const selected = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={selected ? 'page' : undefined}
                  onClick={() => setTab(item.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors cursor-pointer"
                  style={{
                    backgroundColor: selected ? 'var(--bg-active)' : 'transparent',
                    color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
                    boxShadow: selected ? 'var(--pill-shadow)' : 'none',
                  }}
                >
                  <span className="shrink-0 opacity-85">{item.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-auto flex flex-col gap-1.5 pt-2">
            <div
              className="flex flex-col gap-1 border-t pt-2.5"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSdXf5b7sSiMUez01iu137XaH0u2D9kvgQLBIUUF4D4MRR7yIg/viewform"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium no-underline transition-colors hover:bg-[var(--bg-hover)]"
                style={{ color: 'var(--text-primary)' }}
              >
                <MessageSquarePlus size={13} className="shrink-0 opacity-85" />
                <span className="min-w-0 flex-1 truncate">{t('settings.feedback.form')}</span>
                <ExternalLink size={11} className="shrink-0 opacity-60" />
              </a>
              <a
                href="https://github.com/yama662607/Arcline/issues/new/choose"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium no-underline transition-colors hover:bg-[var(--bg-hover)]"
                style={{ color: 'var(--text-muted)' }}
              >
                <ExternalLink size={12} className="shrink-0 opacity-75" />
                <span className="min-w-0 flex-1 truncate">{t('settings.feedback.github')}</span>
              </a>
            </div>
            <div
              className="rounded-lg px-2.5 py-1.5 text-[10.5px]"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('settings.privacyNote')}
            </div>
          </div>
        </aside>

        {/* Right Detail Pane */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Header */}
          <div
            className="flex shrink-0 items-center justify-between border-b px-4 py-3"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div className="min-w-0">
              <h1 id={titleId} className="m-0 text-[14.5px] font-semibold">
                {t('settings.title')}
              </h1>
              <p
                className="arcline-settings-subtitle m-0 mt-0.5 text-[11px]"
                style={{ color: 'var(--text-muted)' }}
              >
                {activeNav?.label}
              </p>
            </div>
            <button
              type="button"
              aria-label={t('settings.close')}
              onClick={() => dialogRef.current?.close()}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-hover)] cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Compact Top Tabs (shown only in narrow Side Panel viewports < 540px) */}
          <div
            className="arcline-settings-compact-tabs arcline-hscroll flex shrink-0 gap-1 border-b px-3 py-2"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className="shrink-0 rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors cursor-pointer"
                style={{
                  backgroundColor: tab === item.id ? 'var(--bg-active)' : 'transparent',
                  color: tab === item.id ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                {item.shortLabel}
              </button>
            ))}
          </div>

          {/* Scrollable Body */}
          <div className="arcline-scroll flex min-h-0 flex-1 flex-col gap-3.5 p-4 text-[12.5px]">
            {tab === 'general' && (
              <>
                <div className="arcline-settings-card flex flex-col gap-2">
                  <div>
                    <div className="font-medium">{t('settings.language.label')}</div>
                    <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {t('settings.language.description')}
                    </div>
                  </div>
                  <fieldset
                    aria-label={t('settings.language.ariaLabel')}
                    data-testid="language-selector"
                    className="m-0 grid grid-cols-3 gap-1.5 border-0 p-0"
                  >
                    {LANGUAGE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        data-testid={`language-option-${option.value}`}
                        aria-pressed={settings.language === option.value}
                        onClick={() => selectLanguage(option.value)}
                        className="flex items-center justify-center rounded-lg border py-2 text-[12px] font-medium transition-all cursor-pointer"
                        style={{
                          borderColor:
                            settings.language === option.value
                              ? 'var(--accent)'
                              : 'var(--border-subtle)',
                          backgroundColor:
                            settings.language === option.value
                              ? 'var(--bg-active)'
                              : 'var(--bg-canvas)',
                        }}
                      >
                        {option.value === 'auto' ? t('settings.language.auto') : option.label}
                      </button>
                    ))}
                  </fieldset>
                </div>

                <div className="arcline-settings-card flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{t('settings.startGuide.label')}</div>
                    <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {t('settings.startGuide.description')}
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="open-start-guide"
                    onClick={openStartGuide}
                    className="shrink-0 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-[var(--bg-hover)] cursor-pointer"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    {t('settings.startGuide.open')}
                  </button>
                </div>

                <div className="arcline-settings-card flex items-center justify-between gap-3">
                  <div>
                    <label htmlFor="arcline-search-engine" className="font-medium">
                      {t('settings.searchEngine.label')}
                    </label>
                    <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {t('settings.searchEngine.description')}
                    </div>
                  </div>
                  <select
                    id="arcline-search-engine"
                    data-testid="search-engine-selector"
                    value={settings.searchEngine}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        searchEngine: e.target.value as SearchEngine,
                      })
                    }
                    className="h-8 shrink-0 rounded-lg border px-2 text-[12px]"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {SEARCH_ENGINE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="arcline-settings-card flex flex-col gap-2">
                  <span className="text-[12px] font-semibold">{t('settings.theme.label')}</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        ['system', t('settings.theme.system'), <Monitor key="m" size={13} />],
                        ['light', t('settings.theme.light'), <Sun key="s" size={13} />],
                        ['dark', t('settings.theme.dark'), <Moon key="d" size={13} />],
                      ] as Array<[ThemeMode, string, React.ReactNode]>
                    ).map(([mode, label, icon]) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={settings.theme === mode}
                        onClick={() => onUpdateSettings({ ...settings, theme: mode })}
                        className="flex items-center justify-center gap-1.5 rounded-lg border py-2 text-[12px] font-medium transition-all cursor-pointer"
                        style={{
                          borderColor:
                            settings.theme === mode ? 'var(--accent)' : 'var(--border-subtle)',
                          backgroundColor:
                            settings.theme === mode ? 'var(--bg-active)' : 'var(--bg-canvas)',
                        }}
                      >
                        {icon}
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="arcline-settings-card flex flex-col gap-2">
                  <div>
                    <div className="font-medium">{t('settings.commandBarMode.title')}</div>
                    <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {t('settings.commandBarMode.description')}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5" data-testid="command-bar-mode-selector">
                    {(
                      [
                        ['popup', t('settings.commandBarMode.popup')],
                        ['newtab', t('settings.commandBarMode.newtab')],
                      ] as Array<[CommandBarOpenMode, string]>
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        data-testid={`command-bar-mode-${mode}`}
                        aria-pressed={settings.commandBarOpenMode === mode}
                        onClick={() => onUpdateSettings({ ...settings, commandBarOpenMode: mode })}
                        className="flex cursor-pointer items-center justify-center rounded-lg border py-2 text-[12px] font-medium transition-all"
                        style={{
                          borderColor:
                            settings.commandBarOpenMode === mode
                              ? 'var(--accent)'
                              : 'var(--border-subtle)',
                          backgroundColor:
                            settings.commandBarOpenMode === mode
                              ? 'var(--bg-active)'
                              : 'var(--bg-canvas)',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <WallpaperSettingsCard spaces={sidebarState.spaces} />

                <div className="arcline-settings-card flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{t('settings.topBar.title')}</div>
                    <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {t('settings.topBar.description')}
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={settings.showTopBar}
                    ariaLabel={t('settings.topBar.title')}
                    onChange={(next) => onUpdateSettings({ ...settings, showTopBar: next })}
                  />
                </div>

                <div className="arcline-settings-card flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{t('settings.collapsedFolders.title')}</div>
                    <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {t('settings.collapsedFolders.description')}
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={settings.showOpenInCollapsedFolders}
                    ariaLabel={t('settings.collapsedFolders.title')}
                    onChange={(next) =>
                      onUpdateSettings({ ...settings, showOpenInCollapsedFolders: next })
                    }
                  />
                </div>

                <div className="arcline-settings-card flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{t('settings.emptySpacePage.title')}</div>
                    <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {t('settings.emptySpacePage.description')}
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={settings.openEmptySpacePage}
                    ariaLabel={t('settings.emptySpacePage.title')}
                    onChange={(next) => onUpdateSettings({ ...settings, openEmptySpacePage: next })}
                  />
                </div>

                <div className="arcline-settings-card flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="arcline-archive-hours" className="font-medium">
                      {t('settings.autoArchive.title')}
                    </label>
                    <select
                      id="arcline-archive-hours"
                      value={settings.autoArchiveHours}
                      onChange={(e) =>
                        onUpdateSettings({
                          ...settings,
                          autoArchiveHours: Number(e.target.value) as AutoArchiveHours,
                        })
                      }
                      className="h-8 rounded-lg border px-2 text-[12px]"
                      style={{
                        borderColor: 'var(--border-subtle)',
                        backgroundColor: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <option value={0}>{t('settings.autoArchive.off')}</option>
                      <option value={12}>{t('settings.autoArchive.hours12')}</option>
                      <option value={24}>{t('settings.autoArchive.hours24')}</option>
                      <option value={168}>{t('settings.autoArchive.days7')}</option>
                    </select>
                  </div>
                  <p className="m-0 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {t('settings.autoArchive.description')}
                  </p>
                </div>

                <div className="arcline-settings-card flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{t('settings.swipe.title')}</div>
                    <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {t('settings.swipe.descriptionGeneral')}
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={settings.swipeToSwitchSpace}
                    ariaLabel={t('settings.swipe.title')}
                    onChange={(next) => onUpdateSettings({ ...settings, swipeToSwitchSpace: next })}
                  />
                </div>
              </>
            )}

            {tab === 'interaction' && (
              <>
                <div className="arcline-settings-card flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{t('settings.edgeHover.title')}</div>
                      <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {t('settings.edgeHover.description')}
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={settings.edgeHoverEnabled}
                      ariaLabel={t('settings.edgeHover.title')}
                      onChange={(next) => onUpdateSettings({ ...settings, edgeHoverEnabled: next })}
                    />
                  </div>

                  {settings.edgeHoverEnabled && (
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {t('settings.edgeHover.triggerWidth')}
                        </span>
                        <select
                          aria-label={t('settings.edgeHover.triggerWidthAria')}
                          value={settings.edgeTriggerWidthPx}
                          onChange={(e) =>
                            onUpdateSettings({
                              ...settings,
                              edgeTriggerWidthPx: Number(e.target.value),
                            })
                          }
                          className="h-8 rounded-lg border px-2 text-[11.5px]"
                          style={{
                            borderColor: 'var(--border-subtle)',
                            backgroundColor: 'var(--bg-surface)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <option value={3}>3px</option>
                          <option value={6}>
                            {t('settings.recommendedValue', { value: '6px' })}
                          </option>
                          <option value={10}>10px</option>
                          <option value={16}>16px</option>
                        </select>
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {t('settings.edgeHover.openDelay')}
                        </span>
                        <select
                          aria-label={t('settings.edgeHover.openDelayAria')}
                          value={settings.edgeOpenDelayMs}
                          onChange={(e) =>
                            onUpdateSettings({
                              ...settings,
                              edgeOpenDelayMs: Number(e.target.value),
                            })
                          }
                          className="h-8 rounded-lg border px-2 text-[11.5px]"
                          style={{
                            borderColor: 'var(--border-subtle)',
                            backgroundColor: 'var(--bg-surface)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <option value={0}>0ms</option>
                          <option value={90}>
                            {t('settings.recommendedValue', { value: '90ms' })}
                          </option>
                          <option value={160}>160ms</option>
                          <option value={260}>260ms</option>
                        </select>
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {t('settings.edgeHover.closeDelay')}
                        </span>
                        <select
                          aria-label={t('settings.edgeHover.closeDelayAria')}
                          value={settings.edgeCloseDelayMs}
                          onChange={(e) =>
                            onUpdateSettings({
                              ...settings,
                              edgeCloseDelayMs: Number(e.target.value),
                            })
                          }
                          className="h-8 rounded-lg border px-2 text-[11.5px]"
                          style={{
                            borderColor: 'var(--border-subtle)',
                            backgroundColor: 'var(--bg-surface)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <option value={150}>150ms</option>
                          <option value={260}>
                            {t('settings.recommendedValue', { value: '260ms' })}
                          </option>
                          <option value={450}>450ms</option>
                          <option value={700}>700ms</option>
                        </select>
                      </label>
                    </div>
                  )}
                </div>

                <div className="arcline-settings-card flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{t('settings.swipe.title')}</div>
                    <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {t('settings.swipe.descriptionInteraction')}
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={settings.swipeToSwitchSpace}
                    ariaLabel={t('settings.swipe.interactionAria')}
                    onChange={(next) => onUpdateSettings({ ...settings, swipeToSwitchSpace: next })}
                  />
                </div>

                <div className="arcline-settings-card flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{t('settings.emptySpacePage.title')}</div>
                    <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {t('settings.emptySpacePage.interactionDescription')}
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={settings.openEmptySpacePage}
                    ariaLabel={t('settings.emptySpacePage.interactionAria')}
                    onChange={(next) => onUpdateSettings({ ...settings, openEmptySpacePage: next })}
                  />
                </div>

                <div className="arcline-settings-card flex flex-col gap-1.5 text-[11.5px]">
                  <div className="font-semibold">{t('settings.brave.title')}</div>
                  <ol
                    className="m-0 flex list-decimal flex-col gap-1 pl-4"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <li>
                      <code>brave://settings/appearance</code> {t('settings.brave.step1')}
                    </li>
                    <li>
                      {t('settings.brave.step2Pre')}{' '}
                      <strong>{t('settings.brave.step2Strong')}</strong>{' '}
                      {t('settings.brave.step2Post')}
                    </li>
                    <li>
                      {t('settings.brave.step3Pre')}
                      <code>brave://</code>
                      {t('settings.brave.step3Mid')}
                      <code>Ctrl+B</code> {t('settings.brave.step3Post')}
                    </li>
                  </ol>
                </div>
              </>
            )}

            {tab === 'archive' && (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="search"
                    value={archiveQuery}
                    onChange={(e) => setArchiveQuery(e.target.value)}
                    placeholder={t('settings.archive.searchPlaceholder')}
                    className="h-8 flex-1 rounded-lg border px-2.5 text-[12px] outline-none focus:border-[var(--accent)]"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      backgroundColor: 'var(--bg-canvas)',
                    }}
                  />
                  {archivedTabs.length > 0 && (
                    <button
                      type="button"
                      onClick={onClearArchive}
                      className="flex h-8 items-center gap-1 rounded-lg border px-2.5 text-[11.5px] transition-colors hover:bg-[var(--bg-hover)] cursor-pointer"
                      style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
                    >
                      <Trash2 size={12} />
                      <span>{t('settings.archive.clearAll')}</span>
                    </button>
                  )}
                </div>

                {filteredArchive.length === 0 ? (
                  <div
                    className="flex flex-col items-center gap-2 py-10 text-center"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Archive size={22} />
                    <p className="m-0">{t('settings.archive.empty')}</p>
                  </div>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                    {filteredArchive.map((entry) => (
                      <li
                        key={entry.id}
                        className="group flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors hover:bg-[var(--bg-hover)]"
                        style={{
                          borderColor: 'var(--border-subtle)',
                          backgroundColor: 'var(--bg-canvas)',
                        }}
                      >
                        <Favicon url={entry.url} title={entry.title} size={16} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12.5px] font-medium">{entry.title}</div>
                          <div
                            className="truncate text-[11px]"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {entry.spaceName} ・ {formatRelativeTime(entry.archivedAt, t)}
                          </div>
                        </div>
                        <button
                          type="button"
                          title={t('settings.archive.restore')}
                          aria-label={t('settings.archive.restoreLabel', { title: entry.title })}
                          onClick={() => onRestoreArchived(entry.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[var(--bg-hover)] cursor-pointer"
                          style={{ color: 'var(--accent)' }}
                        >
                          <RotateCcw size={13} />
                        </button>
                        <button
                          type="button"
                          title={t('settings.archive.remove')}
                          aria-label={t('settings.archive.removeLabel', { title: entry.title })}
                          onClick={() => onRemoveArchived(entry.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[var(--bg-hover)] cursor-pointer"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <X size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {tab === 'import' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                    {t('settings.import.introPre')} <code>StorableSidebar.json</code>{' '}
                    {t('settings.import.introPost')}
                  </p>
                  <div
                    className="inline-flex rounded-lg border p-0.5 text-[11px]"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      backgroundColor: 'var(--bg-canvas)',
                    }}
                  >
                    {(['mac', 'windows'] as const).map((os) => (
                      <button
                        key={os}
                        type="button"
                        onClick={() => setPathOs(os)}
                        className="cursor-pointer rounded-md border-0 px-2 py-0.5 font-medium transition-colors"
                        style={{
                          backgroundColor: pathOs === os ? 'var(--bg-surface)' : 'transparent',
                          color: pathOs === os ? 'var(--text-primary)' : 'var(--text-muted)',
                        }}
                      >
                        {os === 'mac' ? 'macOS' : 'Windows'}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[11.5px]"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    backgroundColor: 'var(--bg-canvas)',
                  }}
                >
                  <code className="truncate">{activeArcPath}</code>
                  <button
                    type="button"
                    onClick={copyPath}
                    className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-[var(--bg-hover)]"
                    style={{ color: 'var(--accent)' }}
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    <span>
                      {copied ? t('settings.import.copied') : t('settings.import.copyPath')}
                    </span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void copyAndPickFile()}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    <FolderOpen size={13} />
                    <span>{t('onboarding.import.copyAndPick')}</span>
                  </button>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {pathOs === 'mac'
                      ? t('onboarding.import.where.finder')
                      : t('onboarding.import.where.explorer')}
                  </span>
                </div>

                <label
                  className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-4 transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <Upload size={18} style={{ color: 'var(--accent)' }} />
                  <span className="font-medium">
                    {importFileName ?? t('settings.import.pickFile')}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {t('settings.import.pickFileHint')}
                  </span>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>

                {parseError && (
                  <p className="m-0 rounded-lg bg-red-500/15 px-3 py-2 text-[12px] text-red-500">
                    {parseError}
                  </p>
                )}

                {parsed && (
                  <div
                    className="rounded-xl border p-3 text-[12px]"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      backgroundColor: 'var(--bg-surface)',
                    }}
                  >
                    <div className="mb-2 font-semibold">{t('settings.import.previewTitle')}</div>
                    <ArcImportPreview
                      parsed={parsed}
                      selectedSpaceIndices={selectedSpaces}
                      onToggleSpace={toggleImportSpace}
                      onSelectAllSpaces={() =>
                        setSelectedSpaces(new Set(parsed.spaces.map((_, i) => i)))
                      }
                      onClearSpaces={() => setSelectedSpaces(new Set())}
                      includeFavorites={includeFavorites}
                      onToggleFavorites={setIncludeFavorites}
                      compact
                      cleanup={{
                        skipEmpty,
                        skipSearches,
                        dedupe,
                        onSkipEmpty: setSkipEmpty,
                        onSkipSearches: setSkipSearches,
                        onDedupe: setDedupe,
                      }}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] transition-colors hover:bg-[var(--bg-hover)]"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <Download size={13} />
                    <span>{t('settings.import.exportBackup')}</span>
                  </button>
                  <button
                    type="button"
                    disabled={!filteredImport || nothingSelected || importing}
                    onClick={handleImport}
                    className="cursor-pointer rounded-lg px-4 py-1.5 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-45"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    {importing ? t('settings.import.running') : t('settings.import.run')}
                  </button>
                </div>
              </>
            )}

            {tab === 'shortcuts' && (
              <div className="flex flex-col gap-3">
                <ShortcutSettingsPanel
                  settings={settings}
                  favorites={sidebarState.favorites}
                  onUpdateSettings={onUpdateSettings}
                />
                <div className="arcline-settings-card flex flex-col divide-y divide-[var(--border-subtle)] p-0">
                  {SHORTCUT_ITEMS.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-medium">{t(item.label)}</div>
                        {item.note && (
                          <div className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                            {t(item.note)}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {item.keys.map((k) => (
                          <kbd
                            key={k}
                            className="rounded-md border px-1.5 py-0.5 font-mono text-[11px]"
                            style={{
                              borderColor: 'var(--border-subtle)',
                              backgroundColor: 'var(--bg-surface)',
                            }}
                          >
                            {k.startsWith('settings.') ? t(k as MessageKey) : k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
