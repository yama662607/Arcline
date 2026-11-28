import {
  Archive,
  ArrowRight,
  Bookmark,
  CircleHelp,
  Clock,
  Globe,
  ImagePlus,
  Search,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../content/overlay';
import { isNeutralHue } from '../core/colors';
import {
  buildCommandBarResults,
  buildSearchUrl,
  buildSiteSearchUrl,
  type CommandBarBadge,
  type CommandBarHistoryEntry,
  type CommandBarItem,
  type CommandBarTab,
  getSiteSearchById,
  matchSiteSearchPrefix,
  SEARCH_ENGINE_URLS,
  type SiteSearchId,
} from '../core/command-bar';
import { verifyFramedAccess } from '../core/frame-auth';
import { DEFAULT_SETTINGS } from '../core/settings';
import { formatShortcutCombo } from '../core/shortcut-keys';
import { isSafeNavigableUrl } from '../core/snapshot';
import { buildSpaceBackgroundCss, primaryHueFromTheme } from '../core/space-theme';
import type { ArchivedTab, CustomSiteSearch, Settings, SidebarState, Space } from '../core/types';
import { resolveEffectiveWallpaper, WALLPAPER_VERSION_KEY } from '../core/wallpapers';
import {
  getCurrentWindowId,
  loadArchivedTabs,
  loadSettings,
  loadSidebarState,
  saveSettings,
  sendCommand,
  subscribeToWindowUpdates,
} from '../sidepanel/api';
import { Favicon } from '../sidepanel/components/Favicon';
import { WallpaperSettingsCard } from '../sidepanel/components/WallpaperSettingsCard';
import { I18nProvider, useT } from '../sidepanel/i18n';
import '../sidepanel/styles.css';

// Prevent Chromium's iframe color-scheme mismatch rule from painting an opaque canvas over
// light-mode host webpages when OS Dark Mode is active. Both the parent <iframe class="arcline-cmd-frame">
// and this modal document declare color-scheme: light while the floating card itself stays dark.
if (
  typeof document !== 'undefined' &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('mode') === 'modal'
) {
  document.querySelector('meta[name="color-scheme"]')?.remove();
  document.documentElement.style.colorScheme = 'light';
  document.documentElement.style.background = 'transparent';
  document.body?.style.setProperty('background', 'transparent');
}

const BADGE_KEY: Record<CommandBarBadge, `commandBar.badge.${CommandBarBadge}`> = {
  switchTab: 'commandBar.badge.switchTab',
  favorite: 'commandBar.badge.favorite',
  pinned: 'commandBar.badge.pinned',
  history: 'commandBar.badge.history',
  archived: 'commandBar.badge.archived',
  action: 'commandBar.badge.action',
  siteSearch: 'commandBar.badge.siteSearch',
  search: 'commandBar.badge.search',
  navigate: 'commandBar.badge.navigate',
};

function renderItemGlyph(item: CommandBarItem, customSiteSearches: readonly CustomSiteSearch[]) {
  if (item.kind === 'siteSearch') {
    const site = getSiteSearchById(item.siteSearchId, customSiteSearches);
    return (
      <span
        aria-hidden="true"
        className="grid size-5 shrink-0 place-items-center rounded-[6px] text-[10px] font-bold text-white"
        style={{ backgroundColor: site.accent }}
      >
        {site.prefix.toUpperCase()}
      </span>
    );
  }
  if (item.kind === 'quickAction') {
    return (
      <span
        aria-hidden="true"
        className="grid size-5 shrink-0 place-items-center rounded-[6px]"
        style={{ backgroundColor: 'var(--hover)', color: 'var(--accent)' }}
      >
        <Sparkles size={12} />
      </span>
    );
  }
  if (item.kind === 'webSearch') {
    return (
      <span
        aria-hidden="true"
        className="grid size-5 shrink-0 place-items-center rounded-[6px]"
        style={{ backgroundColor: 'var(--hover)', color: 'var(--ink-muted)' }}
      >
        <Search size={12} />
      </span>
    );
  }
  if (item.kind === 'navigate') {
    return (
      <span
        aria-hidden="true"
        className="grid size-5 shrink-0 place-items-center rounded-[6px]"
        style={{ backgroundColor: 'var(--hover)', color: 'var(--accent)' }}
      >
        <Globe size={12} />
      </span>
    );
  }
  if (item.url) {
    return <Favicon url={item.url} favIconUrl={item.favIconUrl} title={item.title} size={18} />;
  }
  if (item.kind === 'favorite') return <Star size={14} />;
  if (item.kind === 'pin') return <Bookmark size={14} />;
  if (item.kind === 'archived') return <Archive size={14} />;
  return <Clock size={14} />;
}

function EmptySpaceCanvas() {
  const t = useT();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const requestedSpaceId = params.get('spaceId');
  const isPopup = params.get('popup') === '1';
  const isModal = params.get('mode') === 'modal';
  const isCommandBarExplicit = params.get('commandBar') === '1';
  const returnTabId = useMemo(() => {
    const raw = params.get('returnTabId');
    if (!raw) return undefined;
    const parsed = Number.parseInt(raw, 10);
    return Number.isInteger(parsed) ? parsed : undefined;
  }, [params]);
  const initialBarVisible = isModal || isPopup || isCommandBarExplicit || !requestedSpaceId;

  const [barVisible, setBarVisible] = useState(initialBarVisible);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [windowId, setWindowId] = useState<number | null>(null);
  const [state, setState] = useState<SidebarState | null>(null);
  const [openTabs, setOpenTabs] = useState<CommandBarTab[]>([]);
  const [archived, setArchived] = useState<ArchivedTab[]>([]);
  const [history, setHistory] = useState<CommandBarHistoryEntry[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [query, setQuery] = useState('');
  const [activeSiteSearchId, setActiveSiteSearchId] = useState<SiteSearchId | undefined>(undefined);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);
  const [wallpaperVersion, setWallpaperVersion] = useState(0);
  const [wallpaperMenuOpen, setWallpaperMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const customizeRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pointerHoverEnabledRef = useRef(false);
  const lastPointerPosRef = useRef<{ x: number; y: number } | null>(null);

  const resetPointerHover = useCallback(() => {
    pointerHoverEnabledRef.current = false;
    lastPointerPosRef.current = null;
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const refreshTabsAndArchive = useCallback(async () => {
    try {
      const [tabs, archivedList] = await Promise.all([
        chrome.tabs?.query ? chrome.tabs.query({}) : Promise.resolve([]),
        loadArchivedTabs().catch(() => [] as ArchivedTab[]),
      ]);
      const mapped: CommandBarTab[] = [];
      for (const tab of tabs) {
        if (tab.id === undefined || tab.windowId === undefined) continue;
        const url = tab.url ?? tab.pendingUrl ?? '';
        if (!url) continue;
        mapped.push({
          id: tab.id,
          windowId: tab.windowId,
          title: tab.title ?? url,
          url,
          favIconUrl: tab.favIconUrl,
          active: tab.active,
        });
      }
      setOpenTabs(mapped);
      setArchived(archivedList);
    } catch {
      // Ignore if tabs permission isn't ready in isolated unit environments
    }
  }, []);

  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | undefined;

    (async () => {
      const [winId, loadedSettings, rawTabs, archivedList, initialHistory] = await Promise.all([
        getCurrentWindowId(),
        loadSettings(),
        chrome.tabs?.query ? chrome.tabs.query({}).catch(() => []) : Promise.resolve([]),
        loadArchivedTabs().catch(() => [] as ArchivedTab[]),
        typeof chrome !== 'undefined' && chrome.history?.search
          ? chrome.history
              .search({
                text: '',
                maxResults: 16,
                startTime: Date.now() - 90 * 24 * 60 * 60 * 1000,
              })
              .catch(() => [] as chrome.history.HistoryItem[])
          : Promise.resolve([] as chrome.history.HistoryItem[]),
      ]);
      if (!active) return;
      const loaded = await loadSidebarState(winId);
      if (!active) return;

      const mappedTabs: CommandBarTab[] = [];
      for (const tab of rawTabs) {
        if (tab.id === undefined || tab.windowId === undefined) continue;
        const url = tab.url ?? tab.pendingUrl ?? '';
        if (!url) continue;
        mappedTabs.push({
          id: tab.id,
          windowId: tab.windowId,
          title: tab.title ?? url,
          url,
          favIconUrl: tab.favIconUrl,
          active: tab.active,
        });
      }
      const mappedHistory: CommandBarHistoryEntry[] = [];
      for (const e of initialHistory) {
        if (!e.url) continue;
        mappedHistory.push({
          url: e.url,
          title: e.title,
          lastVisitTime: e.lastVisitTime,
          visitCount: e.visitCount,
        });
      }

      // Commit all initial data in a single React batch so the first painted frame already
      // contains open tabs, favorites, pins, and history (never flashing quick actions at #0).
      setWindowId(winId);
      setSettings(loadedSettings);
      setState(loaded);
      setOpenTabs(mappedTabs);
      setArchived(archivedList);
      setHistory(mappedHistory);
      setInitialLoaded(true);

      cleanup = subscribeToWindowUpdates(winId, {
        onReload: () => {
          void loadSidebarState(winId)
            .then((next) => {
              if (active) setState(next);
            })
            .catch(() => undefined);
          void refreshTabsAndArchive();
        },
        onTabPatch: () => undefined,
        onSettingsChange: () => {
          void loadSettings()
            .then((next) => {
              if (active) setSettings(next);
            })
            .catch(() => undefined);
        },
        onArchiveChange: () => {
          void refreshTabsAndArchive();
        },
      });
    })();

    return () => {
      active = false;
      cleanup?.();
    };
  }, [refreshTabsAndArchive]);

  // Guarantee native chrome://newtab / brave://newtab never lingers with Brave's bottom
  // "Arcline | Customize Brave" bar by redirecting to our extension URL when opened directly.
  useEffect(() => {
    if (isModal || isPopup || requestedSpaceId || isCommandBarExplicit) return;
    if (typeof chrome === 'undefined' || !chrome.tabs?.getCurrent) return;
    void chrome.tabs
      .getCurrent()
      .then((tab) => {
        if (tab?.id !== undefined && /^(?:chrome|brave):\/\/newtab\/?$/i.test(tab.url ?? '')) {
          return chrome.tabs.update(tab.id, {
            url: chrome.runtime.getURL('empty-space.html?commandBar=1'),
          });
        }
        return undefined;
      })
      .catch(() => undefined);
  }, [isModal, isPopup, requestedSpaceId, isCommandBarExplicit]);

  const closeModal = useCallback(() => {
    if (isModal) {
      window.parent.postMessage({ type: 'arcline:command-bar-close' }, '*');
    } else if (isPopup) {
      window.close();
    } else if (requestedSpaceId && !isCommandBarExplicit) {
      setBarVisible(false);
    } else {
      // Opened as a New Tab Command Bar (Cmd+T in "newtab" mode): pressing Esc activates the
      // exact original tab (returnTabId) — or falls back to the most recent normal webpage —
      // and closes this empty tab, unless it's the only tab in the window.
      if (typeof chrome !== 'undefined' && chrome.tabs?.getCurrent && chrome.tabs?.query) {
        void Promise.all([chrome.tabs.getCurrent(), chrome.tabs.query({ currentWindow: true })])
          .then(async ([cur, all]) => {
            if (cur?.id !== undefined && all.length > 1) {
              const validTarget =
                (returnTabId !== undefined && returnTabId !== cur.id
                  ? all.find((tab) => tab.id === returnTabId)
                  : undefined) ??
                all
                  .filter(
                    (tab) =>
                      tab.id !== undefined &&
                      tab.id !== cur.id &&
                      !(tab.url ?? '').includes('empty-space.html?commandBar=1') &&
                      !/^(?:chrome|brave):\/\//i.test(tab.url ?? ''),
                  )
                  .sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0];
              if (validTarget?.id !== undefined) {
                await chrome.tabs.update(validTarget.id, { active: true }).catch(() => undefined);
              }
              await chrome.tabs.remove(cur.id);
              return;
            }
            setBarVisible(false);
          })
          .catch(() => setBarVisible(false));
      } else {
        setBarVisible(false);
      }
    }
  }, [isModal, isPopup, requestedSpaceId, isCommandBarExplicit, returnTabId]);

  // Keep modal iframe background transparent so the active webpage shows directly behind the card
  useEffect(() => {
    if (!isModal) return;
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
  }, [isModal]);

  // Signal parent overlay to reveal the modal iframe only once initial state + tabs are painted
  useEffect(() => {
    if (!isModal || !initialLoaded) return;
    const rafId = requestAnimationFrame(() => {
      window.parent.postMessage({ type: 'arcline:command-bar-ready' }, '*');
      inputRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(rafId);
  }, [isModal, initialLoaded]);

  // Dismiss Command Bar or wallpaper customize popover when clicking outside
  useEffect(() => {
    if (!barVisible && !wallpaperMenuOpen) return;
    const onOutsidePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (customizeRef.current?.contains(target)) return;
      if (wallpaperMenuOpen) {
        setWallpaperMenuOpen(false);
        return;
      }
      if (barVisible && cardRef.current && !cardRef.current.contains(target)) {
        if (isModal || isPopup) {
          closeModal();
        } else {
          setBarVisible(false);
        }
      }
    };
    window.addEventListener('pointerdown', onOutsidePointerDown);
    return () => window.removeEventListener('pointerdown', onOutsidePointerDown);
  }, [barVisible, wallpaperMenuOpen, isModal, isPopup, closeModal]);

  // Dismiss popover or Command Bar on Escape even when focus moved to a result button,
  // clear button, or after clicking outside on an explicit Command Bar New Tab.
  useEffect(() => {
    if (!barVisible && !isCommandBarExplicit && !wallpaperMenuOpen) return;
    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (wallpaperMenuOpen) {
        e.preventDefault();
        setWallpaperMenuOpen(false);
        return;
      }
      if (e.target instanceof HTMLInputElement) return;
      e.preventDefault();
      closeModal();
    };
    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, [barVisible, isCommandBarExplicit, wallpaperMenuOpen, closeModal]);

  // Allow background/overlay to reveal or toggle the Command Bar on an empty Space canvas
  useEffect(() => {
    if (isModal) return;
    const onCommandBarEvent = (e: Event) => {
      const action = (e as CustomEvent<'open' | 'toggle' | 'close'>).detail ?? 'open';
      if (action === 'close') {
        setBarVisible(false);
        return;
      }
      setBarVisible((prev) => {
        const next = action === 'toggle' ? !prev : true;
        if (next) {
          setSelectedIdx(0);
          resetPointerHover();
          requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
        }
        return next;
      });
    };
    window.addEventListener('arcline:empty-space-command-bar', onCommandBarEvent);
    return () => window.removeEventListener('arcline:empty-space-command-bar', onCommandBarEvent);
  }, [isModal, resetPointerHover]);

  // Ensure the Command Bar search box receives keyboard focus on open, tab switch, and Cmd+T
  useEffect(() => {
    if (!barVisible || !initialLoaded) return;
    const focusInput = () => {
      inputRef.current?.focus({ preventScroll: true });
    };
    focusInput();
    const rafId = requestAnimationFrame(() => {
      focusInput();
      // On chrome://newtab / brave://newtab override, Chromium locks initial focus in the Omnibox
      // AND renders a browser-native "Arcline | Customize" bar along the bottom edge. Replacing
      // the tab with our extension URL moves focus directly into the Command Bar and removes that bar.
      if (
        !isModal &&
        !location.search &&
        typeof chrome !== 'undefined' &&
        chrome.tabs?.getCurrent &&
        chrome.tabs?.update
      ) {
        void chrome.tabs
          .getCurrent()
          .then(async (tab) => {
            if (tab?.id === undefined) return;
            const currentUrl = tab.url ?? tab.pendingUrl ?? '';
            if (!/^(?:chrome|brave):\/\/newtab\/?/i.test(currentUrl)) return;
            await chrome.tabs.update(tab.id, {
              url: chrome.runtime.getURL('empty-space.html?commandBar=1'),
            });
          })
          .catch(() => undefined);
      }
    });
    const onVisibility = () => {
      if (!document.hidden) focusInput();
    };
    window.addEventListener('focus', focusInput);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('focus', focusInput);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [barVisible, isModal, initialLoaded]);

  // Auto-detect prefix + space (e.g. "gh " or "yt ") and promote to a colored chip immediately
  useEffect(() => {
    if (activeSiteSearchId) return;
    const match = matchSiteSearchPrefix(
      query,
      settings.customSiteSearches,
      settings.disabledSiteSearchIds,
    );
    if (match) {
      setActiveSiteSearchId(match.siteSearch.id);
      setQuery(match.term);
      setSelectedIdx(0);
    }
  }, [query, activeSiteSearchId, settings.customSiteSearches, settings.disabledSiteSearchIds]);

  // Debounced native browser History query merged live into Command Bar results
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.history?.search) return;
    let active = true;
    const timer = window.setTimeout(() => {
      const searchText = activeSiteSearchId ? query.trim() : query.trim();
      void chrome.history
        .search({
          text: searchText,
          maxResults: searchText ? 36 : 16,
          startTime: Date.now() - 90 * 24 * 60 * 60 * 1000,
        })
        .then((entries) => {
          if (!active) return;
          setHistory(
            entries
              .filter((e): e is chrome.history.HistoryItem & { url: string } => Boolean(e.url))
              .map((e) => ({
                url: e.url,
                title: e.title,
                lastVisitTime: e.lastVisitTime,
                visitCount: e.visitCount,
              })),
          );
        })
        .catch(() => undefined);
    }, 45);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, activeSiteSearchId]);

  const space: Space | undefined = useMemo(() => {
    if (!state) return undefined;
    if (requestedSpaceId) {
      const match = state.spaces.find((s) => s.id === requestedSpaceId);
      if (match) return match;
    }
    return state.spaces.find((s) => s.id === state.activeSpaceId) ?? state.spaces[0];
  }, [state, requestedSpaceId]);

  // Listen for live wallpaper changes from Settings so open empty-space tabs update immediately
  useEffect(() => {
    if (isModal || typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && WALLPAPER_VERSION_KEY in changes) {
        setWallpaperVersion((v) => v + 1);
      }
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, [isModal]);

  // Load per-Space or global wallpaper (image / animated GIF) from unpartitioned SW IndexedDB
  useEffect(() => {
    if (isModal) return;
    let active = true;
    void resolveEffectiveWallpaper(space?.id).then((record) => {
      if (!active) return;
      setWallpaperUrl(record?.dataUrl ?? null);
    });
    return () => {
      active = false;
    };
  }, [isModal, space?.id, wallpaperVersion]);

  const activeTheme = space?.theme;
  const resolvedScheme: 'light' | 'dark' =
    activeTheme?.appearance === 'light'
      ? 'light'
      : activeTheme?.appearance === 'dark'
        ? 'dark'
        : settings.theme === 'light'
          ? 'light'
          : settings.theme === 'dark'
            ? 'dark'
            : systemDark
              ? 'dark'
              : 'light';

  useEffect(() => {
    const hue = activeTheme ? primaryHueFromTheme(activeTheme) : (space?.hue ?? -1);
    if (isNeutralHue(hue)) {
      document.documentElement.setAttribute('data-neutral', 'true');
    } else {
      document.documentElement.removeAttribute('data-neutral');
      document.documentElement.style.setProperty('--space-hue', String(hue));
    }
    document.documentElement.setAttribute('data-theme', resolvedScheme);
    if (space?.name) {
      document.title = `${space.name} — Arcline`;
    }
  }, [activeTheme, space?.hue, space?.name, resolvedScheme]);

  const actionLabels = useMemo(
    () => ({
      newSpace: t('commandBar.action.newSpace'),
      toggleTheme: t('commandBar.action.toggleTheme'),
      openSettings: t('commandBar.action.openSettings'),
      clearTodayTabs: t('commandBar.action.clearTodayTabs'),
      openOnboarding: t('commandBar.action.openOnboarding'),
      openShortcuts: t('commandBar.action.openShortcuts'),
    }),
    [t],
  );

  const activeTabId = useMemo(
    () =>
      windowId !== null
        ? openTabs.find((tab) => tab.windowId === windowId && tab.active)?.id
        : undefined,
    [openTabs, windowId],
  );

  const commandResult = useMemo(
    () =>
      buildCommandBarResults({
        query,
        openTabs,
        favorites: state?.favorites ?? [],
        spaces: state?.spaces ?? [],
        history,
        archived,
        searchEngine: settings.searchEngine,
        activeSpaceId: space?.id,
        activeSiteSearchId,
        activeTabId,
        actionLabels,
        customSiteSearches: settings.customSiteSearches,
        disabledSiteSearchIds: settings.disabledSiteSearchIds,
        favoriteShortcuts: settings.favoriteShortcuts,
      }),
    [
      query,
      openTabs,
      state?.favorites,
      state?.spaces,
      history,
      archived,
      settings.searchEngine,
      settings.customSiteSearches,
      settings.disabledSiteSearchIds,
      settings.favoriteShortcuts,
      space?.id,
      activeSiteSearchId,
      activeTabId,
      actionLabels,
    ],
  );

  useEffect(() => {
    if (selectedIdx >= commandResult.items.length) {
      setSelectedIdx(Math.max(0, commandResult.items.length - 1));
    }
  }, [commandResult.items.length, selectedIdx]);

  useEffect(() => {
    rowRefs.current[selectedIdx]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  const navigateUrl = useCallback(
    async (url: string) => {
      if (!isSafeNavigableUrl(url)) return;
      if (isModal) {
        if (windowId !== null && space) {
          await sendCommand({ type: 'openTab', windowId, spaceId: space.id, url });
        } else {
          await chrome.tabs.create({
            ...(windowId !== null ? { windowId } : {}),
            url,
            active: true,
          });
        }
        closeModal();
        return;
      }
      if (isPopup) {
        const wins = await chrome.windows.getAll({ windowTypes: ['normal'] }).catch(() => []);
        const targetWin = wins[0];
        if (targetWin?.id !== undefined) {
          await chrome.tabs.create({ windowId: targetWin.id, url, active: true });
          await chrome.windows.update(targetWin.id, { focused: true }).catch(() => undefined);
        } else {
          await chrome.tabs.create({ url, active: true });
        }
        window.close();
        return;
      }
      window.location.href = url;
    },
    [isModal, isPopup, windowId, space, closeModal],
  );

  const executeItem = useCallback(
    async (item: CommandBarItem) => {
      const { action } = item;
      if (action.type === 'switchTab') {
        await chrome.tabs.update(action.tabId, { active: true }).catch(() => undefined);
        if (action.windowId !== undefined) {
          await chrome.windows.update(action.windowId, { focused: true }).catch(() => undefined);
        }
        closeModal();
        return;
      }
      if (action.type === 'openFavorite') {
        if (windowId !== null) {
          await sendCommand({ type: 'openFavorite', windowId, favoriteId: action.favoriteId });
        } else if (item.url) {
          await navigateUrl(item.url);
        }
        closeModal();
        return;
      }
      if (action.type === 'openPin') {
        if (windowId !== null) {
          await sendCommand({ type: 'openPin', windowId, pinId: action.pinId });
        } else if (item.url) {
          await navigateUrl(item.url);
        }
        closeModal();
        return;
      }
      if (action.type === 'restoreArchived') {
        if (windowId !== null) {
          await sendCommand({
            type: 'restoreArchived',
            windowId,
            spaceId: action.spaceId || space?.id || '',
            archiveId: action.archiveId,
          });
        }
        closeModal();
        return;
      }
      if (action.type === 'openUrl') {
        await navigateUrl(action.url);
        return;
      }
      // quickAction
      if (action.id === 'newSpace' && windowId !== null) {
        await sendCommand({ type: 'createSpace', windowId, name: 'Space' });
        closeModal();
        return;
      }
      if (action.id === 'toggleTheme') {
        const nextTheme = resolvedScheme === 'dark' ? 'light' : 'dark';
        const next = { ...settings, theme: nextTheme as Settings['theme'] };
        setSettings(next);
        await saveSettings(next);
        closeModal();
        return;
      }
      if (action.id === 'clearTodayTabs' && windowId !== null && space) {
        await sendCommand({ type: 'clearSpaceTabs', windowId, spaceId: space.id });
        await refreshTabsAndArchive();
        closeModal();
        return;
      }
      if (action.id === 'openSettings' && windowId !== null) {
        await chrome.sidePanel?.open?.({ windowId }).catch(() => undefined);
        closeModal();
        return;
      }
      if (action.id === 'openOnboarding') {
        await chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html'), active: true });
        closeModal();
        return;
      }
      if (action.id === 'openShortcuts') {
        await chrome.tabs.create({ url: 'chrome://extensions/shortcuts', active: true });
        closeModal();
      }
    },
    [closeModal, windowId, space, resolvedScheme, settings, navigateUrl, refreshTabsAndArchive],
  );

  const displayItemTitle = (item: CommandBarItem): string => {
    if (item.kind === 'webSearch') {
      return t('commandBar.searchWith', {
        engine: SEARCH_ENGINE_URLS[item.engine].label,
        term: item.term,
      });
    }
    if (item.kind === 'siteSearch') {
      const site = getSiteSearchById(item.siteSearchId, settings.customSiteSearches);
      return t('commandBar.searchSite', { site: site.label, term: item.term });
    }
    if (item.kind === 'navigate') {
      return t('commandBar.openUrl', { url: item.subtitle || item.title });
    }
    return item.title;
  };

  const activeChip = commandResult.activeSiteSearch;
  const suggestion = !activeChip ? commandResult.siteSearchSuggestion : undefined;

  const customBackground = activeTheme
    ? buildSpaceBackgroundCss(activeTheme, resolvedScheme, false)
    : undefined;
  const grainOpacity = activeTheme ? Math.min(0.32, (activeTheme.grain / 100) * 0.28) : 0.08;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const isCtrlOnly = e.ctrlKey && !e.metaKey && !e.altKey;
    if (e.key === 'ArrowDown' || (isCtrlOnly && (e.key === 'n' || e.key === 'N'))) {
      e.preventDefault();
      resetPointerHover();
      if (commandResult.items.length > 0) {
        setSelectedIdx((i) => (i + 1) % commandResult.items.length);
      }
      return;
    }
    if (e.key === 'ArrowUp' || (isCtrlOnly && (e.key === 'p' || e.key === 'P'))) {
      e.preventDefault();
      resetPointerHover();
      if (commandResult.items.length > 0) {
        setSelectedIdx((i) => (i - 1 + commandResult.items.length) % commandResult.items.length);
      }
      return;
    }
    if (e.key === 'Tab' && suggestion) {
      e.preventDefault();
      resetPointerHover();
      setActiveSiteSearchId(suggestion.id);
      setQuery('');
      setSelectedIdx(0);
      return;
    }
    if (e.key === 'Backspace' && !query && activeChip) {
      e.preventDefault();
      setActiveSiteSearchId(undefined);
      return;
    }
    if (e.key === 'Escape') {
      if (helpOpen) {
        e.preventDefault();
        setHelpOpen(false);
      } else if (query || activeChip) {
        e.preventDefault();
        setQuery('');
        setActiveSiteSearchId(undefined);
        setSelectedIdx(0);
      } else {
        e.preventDefault();
        closeModal();
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = query.trim();
      if ((e.metaKey || e.ctrlKey) && trimmed) {
        const directUrl = activeChip
          ? buildSiteSearchUrl(activeChip, trimmed)
          : buildSearchUrl(settings.searchEngine, trimmed);
        void navigateUrl(directUrl);
        return;
      }
      const chosen = commandResult.items[selectedIdx] ?? commandResult.items[0];
      if (chosen) void executeItem(chosen);
    }
  };

  const spaceHue = activeTheme ? primaryHueFromTheme(activeTheme) : (space?.hue ?? -1);
  const hasAccentHue = !isNeutralHue(spaceHue);
  const primaryHex = activeTheme?.nodes?.[0]?.hex;
  // Authentic Arc Command Bar surface: always the same soft matte dark charcoal everywhere,
  // with ONLY the active row highlight (and selected arrow icon) adopting the Space theme color.
  const cardBg = 'rgba(36, 36, 39, 0.96)';
  const selectedRowBg = hasAccentHue
    ? primaryHex
      ? `color-mix(in oklch, ${primaryHex} 62%, #141418)`
      : `hsl(${spaceHue} 58% 38%)`
    : 'rgba(255, 255, 255, 0.14)';
  const selectedArrowColor = hasAccentHue
    ? primaryHex
      ? `color-mix(in oklch, ${primaryHex} 58%, #101014)`
      : `hsl(${spaceHue} 58% 32%)`
    : '#1c1c1f';
  const cardInk = 'rgba(255, 255, 255, 0.86)';
  const cardMuted = 'rgba(255, 255, 255, 0.44)';
  const cardRule = 'rgba(255, 255, 255, 0.08)';

  const shortHost = (url?: string): string | null => {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  };

  return (
    <div
      data-arcline-empty-space="true"
      data-arcline-command-bar={barVisible ? 'true' : 'false'}
      data-arcline-command-mode={isModal ? 'modal' : 'page'}
      data-space-name={space?.name ?? ''}
      className={`${isModal ? '' : 'arcline-shell '}relative flex min-h-screen w-full flex-col items-center justify-start overflow-x-hidden overflow-y-auto px-5 ${isPopup ? 'pt-6 pb-6' : 'pt-[24vh] pb-10'}`}
      style={
        isModal
          ? { background: 'transparent' }
          : wallpaperUrl
            ? { background: '#0e0e11' }
            : customBackground
              ? { backgroundImage: customBackground }
              : undefined
      }
    >
      {!isModal && wallpaperUrl && (
        <>
          <img
            src={wallpaperUrl}
            alt=""
            aria-hidden="true"
            data-testid="empty-space-wallpaper"
            className="pointer-events-none fixed inset-0 h-full w-full object-cover"
          />
          {barVisible && (
            <div
              aria-hidden="true"
              className="pointer-events-none fixed inset-0"
              style={{ background: 'rgba(10, 10, 14, 0.28)' }}
            />
          )}
        </>
      )}
      {!isModal && !wallpaperUrl && grainOpacity > 0.01 && (
        <div aria-hidden="true" className="arcline-grain-layer" style={{ opacity: grainOpacity }} />
      )}

      {barVisible && initialLoaded && (
        <div className="relative z-10 flex w-full max-w-[700px] flex-col">
          {/* Centered Arc-style Floating Command Bar (uniform matte dark charcoal + Space highlight) */}
          <section
            ref={cardRef}
            aria-label={t('commandBar.inputLabel')}
            className="flex flex-col overflow-hidden rounded-[14px]"
            style={{
              colorScheme: 'dark',
              backgroundColor: cardBg,
              WebkitBackdropFilter: 'blur(28px) saturate(1.15)',
              backdropFilter: 'blur(28px) saturate(1.15)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 24px 72px rgb(0 0 0 / 0.5), 0 4px 16px rgb(0 0 0 / 0.22)',
              color: cardInk,
            }}
          >
            {/* Search Input Row */}
            <div
              className="flex h-[58px] items-center gap-3 px-5"
              style={{ borderBottom: `1px solid ${cardRule}` }}
            >
              <Search size={18} className="shrink-0" style={{ color: cardMuted }} />

              {activeChip && (
                <span
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold text-white"
                  style={{ backgroundColor: activeChip.accent }}
                >
                  <span>{activeChip.label}</span>
                  <button
                    type="button"
                    aria-label={t('commandBar.removeChip', { site: activeChip.label })}
                    onClick={() => {
                      setActiveSiteSearchId(undefined);
                      inputRef.current?.focus();
                    }}
                    className="grid size-3.5 cursor-pointer place-items-center rounded-full hover:bg-black/20"
                  >
                    <X size={10} />
                  </button>
                </span>
              )}

              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  resetPointerHover();
                  setQuery(e.target.value);
                  setSelectedIdx(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  activeChip
                    ? t('commandBar.sitePlaceholder', { site: activeChip.label })
                    : t('commandBar.placeholder')
                }
                aria-label={t('commandBar.inputLabel')}
                className="h-full min-w-0 flex-1 border-0 bg-transparent text-[16.5px] outline-none placeholder:text-white/40"
                style={{ color: '#f5f5f7' }}
              />

              {suggestion && (
                <button
                  type="button"
                  data-testid="command-bar-tab-hint"
                  onClick={() => {
                    setActiveSiteSearchId(suggestion.id);
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[12px] font-medium transition-colors hover:bg-white/10"
                  style={{ color: cardMuted }}
                >
                  <span>{t('commandBar.tabHintLabel', { site: suggestion.label })}</span>
                  <kbd
                    className="rounded-[5px] border px-1.5 py-0.5 font-sans text-[11px] font-medium"
                    style={{
                      borderColor: 'rgba(255, 255, 255, 0.16)',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      color: 'rgba(255, 255, 255, 0.78)',
                    }}
                  >
                    Tab
                  </kbd>
                </button>
              )}

              {(query || activeChip) && !suggestion && (
                <button
                  type="button"
                  aria-label={t('commandBar.clear')}
                  onClick={() => {
                    setQuery('');
                    setActiveSiteSearchId(undefined);
                    setSelectedIdx(0);
                    inputRef.current?.focus();
                  }}
                  className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-md hover:bg-white/10"
                  style={{ color: cardMuted }}
                >
                  <X size={14} />
                </button>
              )}

              <button
                type="button"
                data-testid="command-bar-help-btn"
                aria-label={t('commandBar.helpTitle')}
                aria-expanded={helpOpen}
                title={t('commandBar.helpTitle')}
                onClick={() => setHelpOpen((prev) => !prev)}
                className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-full transition-colors hover:bg-white/10"
                style={{
                  color: helpOpen ? 'rgba(255, 255, 255, 0.92)' : cardMuted,
                  backgroundColor: helpOpen ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                }}
              >
                <CircleHelp size={15} />
              </button>
            </div>

            {helpOpen && (
              <div
                data-testid="command-bar-help-panel"
                className="flex flex-col gap-1.5 px-4 py-2.5 text-[11.5px]"
                style={{
                  borderBottom: `1px solid ${cardRule}`,
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  color: 'rgba(255, 255, 255, 0.78)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span>{t('commandBar.helpNavigate')}</span>
                  <span className="font-mono text-[11px]" style={{ color: cardMuted }}>
                    ↑ ↓ / ^P ^N
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>{t('commandBar.helpSiteSearch')}</span>
                  <kbd
                    className="rounded border px-1.5 py-0.5 font-sans text-[10.5px]"
                    style={{
                      borderColor: 'rgba(255, 255, 255, 0.16)',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    Tab
                  </kbd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>
                    {t('commandBar.helpWebSearch')} (
                    {SEARCH_ENGINE_URLS[settings.searchEngine].label})
                  </span>
                  <span className="font-mono text-[11px]" style={{ color: cardMuted }}>
                    {/Macintosh|Mac OS X|MacIntel/i.test(navigator.userAgent) ? '⌘↵' : 'Ctrl+↵'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>{t('commandBar.helpClose')}</span>
                  <span className="font-mono text-[11px]" style={{ color: cardMuted }}>
                    Esc
                  </span>
                </div>
              </div>
            )}

            {/* Fused Live Results */}
            <div
              className="arcline-scroll flex max-h-[280px] flex-col gap-1 px-2.5 py-2"
              onPointerMove={(e) => {
                const prev = lastPointerPosRef.current;
                if (!prev) {
                  lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
                  return;
                }
                if (Math.abs(e.clientX - prev.x) >= 2 || Math.abs(e.clientY - prev.y) >= 2) {
                  lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
                  pointerHoverEnabledRef.current = true;
                }
              }}
            >
              {commandResult.items.length === 0 ? (
                <div className="py-8 text-center text-[13px]" style={{ color: cardMuted }}>
                  {t('commandBar.noResults')}
                </div>
              ) : (
                commandResult.items.map((item, idx) => {
                  const selected = idx === selectedIdx;
                  const badgeText = t(BADGE_KEY[item.badge]);
                  const host = shortHost(item.url);
                  const showInlineHost =
                    host !== null &&
                    item.kind !== 'tab' &&
                    item.kind !== 'webSearch' &&
                    item.kind !== 'siteSearch' &&
                    item.kind !== 'navigate' &&
                    !item.title.toLowerCase().includes(host.toLowerCase());
                  const showRightAction =
                    item.kind === 'tab' || item.kind === 'pin' || item.kind === 'archived';
                  const rightLabel =
                    item.kind === 'tab'
                      ? selected
                        ? badgeText
                        : item.spaceName || badgeText
                      : showRightAction
                        ? item.spaceName || badgeText
                        : null;
                  return (
                    <button
                      key={item.id}
                      ref={(el) => {
                        rowRefs.current[idx] = el;
                      }}
                      type="button"
                      data-command-item-kind={item.kind}
                      data-selected={selected ? 'true' : 'false'}
                      onPointerMove={() => {
                        if (pointerHoverEnabledRef.current && selectedIdx !== idx) {
                          setSelectedIdx(idx);
                        }
                      }}
                      onClick={() => void executeItem(item)}
                      className="flex min-h-[48px] w-full cursor-pointer items-center gap-3.5 rounded-[10px] px-3.5 py-2.5 text-left transition-colors"
                      style={{
                        backgroundColor: selected ? selectedRowBg : 'transparent',
                        color: selected ? '#ffffff' : cardInk,
                      }}
                    >
                      {renderItemGlyph(item, settings.customSiteSearches)}
                      <div className="flex min-w-0 flex-1 items-baseline gap-1.5 overflow-hidden">
                        <span className="truncate text-[14px] font-medium">
                          {displayItemTitle(item)}
                        </span>
                        {showInlineHost && (
                          <span
                            className="shrink-0 truncate text-[13px]"
                            style={{
                              color: selected ? 'rgba(255, 255, 255, 0.72)' : cardMuted,
                            }}
                          >
                            — {host}
                          </span>
                        )}
                      </div>
                      {item.kind === 'favorite' && item.alias && (
                        <span
                          className="shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px]"
                          style={{
                            backgroundColor: selected
                              ? 'rgba(255, 255, 255, 0.2)'
                              : 'rgba(255, 255, 255, 0.08)',
                            color: selected ? '#ffffff' : 'rgba(255, 255, 255, 0.78)',
                          }}
                        >
                          @{item.alias}
                        </span>
                      )}
                      {item.kind === 'favorite' && item.shortcut && (
                        <kbd
                          className="shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[11px]"
                          style={{
                            borderColor: selected ? 'rgba(255, 255, 255, 0.35)' : cardRule,
                            color: selected ? '#ffffff' : cardMuted,
                          }}
                        >
                          {formatShortcutCombo(
                            item.shortcut,
                            /Macintosh|Mac OS X|MacIntel/i.test(navigator.userAgent),
                          )}
                        </kbd>
                      )}
                      {rightLabel && (
                        <span
                          className="shrink-0 text-[12.5px] font-medium"
                          style={{
                            color: selected ? 'rgba(255, 255, 255, 0.94)' : cardMuted,
                          }}
                        >
                          {rightLabel}
                        </span>
                      )}
                      {showRightAction &&
                        (selected ? (
                          <span
                            aria-hidden="true"
                            className="grid size-5 shrink-0 place-items-center rounded-[6px] bg-white"
                            style={{ color: selectedArrowColor }}
                          >
                            <ArrowRight size={12} strokeWidth={2.5} />
                          </span>
                        ) : (
                          <span
                            aria-hidden="true"
                            className="grid size-5 shrink-0 place-items-center"
                            style={{ color: cardMuted }}
                          >
                            <ArrowRight size={12} strokeWidth={2} />
                          </span>
                        ))}
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}

      {!isModal && !isPopup && (
        <div ref={customizeRef} className="fixed right-5 bottom-5 z-20 flex flex-col items-end">
          {wallpaperMenuOpen && (
            <div
              role="dialog"
              aria-label={t('commandBar.customizeWallpaper')}
              data-testid="wallpaper-customize-popover"
              className="mb-2.5 w-[348px] max-w-[calc(100vw-2.5rem)] rounded-2xl border p-3 shadow-2xl"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
                WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
                backdropFilter: 'blur(24px) saturate(1.2)',
              }}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-[12px] font-semibold">
                  {t('commandBar.customizeWallpaper')}
                </span>
                <button
                  type="button"
                  aria-label={t('commandBar.clear')}
                  onClick={() => setWallpaperMenuOpen(false)}
                  className="grid size-6 cursor-pointer place-items-center rounded-md transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X size={13} />
                </button>
              </div>
              <WallpaperSettingsCard spaces={state?.spaces ?? []} />
            </div>
          )}

          <button
            type="button"
            data-testid="wallpaper-customize-btn"
            aria-label={t('commandBar.customizeWallpaper')}
            aria-expanded={wallpaperMenuOpen}
            title={t('commandBar.customizeWallpaperTitle')}
            onClick={() => setWallpaperMenuOpen((open) => !open)}
            className="group flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium shadow-lg transition-all hover:scale-[1.03] active:scale-[0.97]"
            style={{
              backgroundColor: wallpaperMenuOpen
                ? 'rgba(28, 28, 32, 0.92)'
                : 'rgba(24, 24, 28, 0.62)',
              borderColor: 'rgba(255, 255, 255, 0.16)',
              color: 'rgba(255, 255, 255, 0.88)',
              WebkitBackdropFilter: 'blur(16px) saturate(1.2)',
              backdropFilter: 'blur(16px) saturate(1.2)',
            }}
          >
            <ImagePlus size={15} strokeWidth={2} aria-hidden="true" />
            <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover:max-w-[140px] group-hover:opacity-100">
              {t('commandBar.customizeWallpaper')}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

// Apply transparent modal canvas synchronously before React/token verification to avoid any flash
if (new URLSearchParams(window.location.search).get('mode') === 'modal') {
  document.documentElement.style.background = 'transparent';
  document.body.style.background = 'transparent';
}

const rootEl = document.getElementById('root');
if (rootEl) {
  const mount = () => {
    createRoot(rootEl).render(
      <StrictMode>
        <I18nProvider>
          <EmptySpaceCanvas />
        </I18nProvider>
      </StrictMode>,
    );
  };
  if (window.top === window) {
    mount();
  } else {
    void verifyFramedAccess('modal').then((allowed) => {
      if (allowed) mount();
    });
  }
}
