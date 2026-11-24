import {
  ArrowRightLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  FolderOpen,
  FolderPlus,
  Link2,
  Minus,
  Palette,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings as SettingsIcon,
  Smile,
  Sparkles,
  Star,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isNeutralHue } from '../core/colors';
import { EMPTY_STATE, patchLiveTab } from '../core/derive';
import { DEFAULT_SETTINGS } from '../core/settings';
import { matchFavoriteShortcut } from '../core/shortcut-keys';
import { SpaceSwipeMachine, type SpaceSwipeSnapshot } from '../core/space-swipe';
import { buildSpaceBackgroundCss, primaryHueFromTheme } from '../core/space-theme';
import type {
  ArchivedTab,
  Favorite,
  ImportedSidebar,
  LiveTab,
  PinnedFolder,
  PinnedNode,
  PinnedTab,
  Settings,
  SidebarState,
  Space,
  SpaceTheme,
} from '../core/types';
import {
  getCurrentWindowId,
  loadArchivedTabs,
  loadSettings,
  loadSidebarState,
  saveSettings,
  sendCommand,
  subscribeToWindowUpdates,
  toggleFolderOpen,
} from './api';
import { ContextMenu, type ContextMenuItem, type ContextMenuState } from './components/ContextMenu';
import { Favicon } from './components/Favicon';
import { type DragPayload, FavoritesGrid } from './components/FavoritesGrid';
import { PinnedTree } from './components/PinnedTree';
import { SettingsModal, type SettingsTabId } from './components/SettingsModal';
import { SpaceGlyph } from './components/SpaceGlyph';
import { SpaceModal, type SpaceModalTarget } from './components/SpaceModal';
import { SpaceSwitcher } from './components/SpaceSwitcher';
import { SpaceThemeModal } from './components/SpaceThemeModal';
import { TemporaryTabs } from './components/TemporaryTabs';
import { useT } from './i18n';

interface QuickSearchHit {
  key: string;
  kind: 'favorite' | 'pin' | 'tab' | 'archived';
  id: string | number;
  title: string;
  url: string;
  spaceName?: string;
  favIconUrl?: string;
}

const IDLE_SWIPE: SpaceSwipeSnapshot = {
  offset: 0,
  dragging: false,
  progress: 0,
  direction: 0,
};

function collectPins(nodes: PinnedNode[], spaceName: string): QuickSearchHit[] {
  const hits: QuickSearchHit[] = [];
  for (const n of nodes) {
    if (n.kind === 'pin') {
      hits.push({
        key: `pin-${n.id}`,
        kind: 'pin',
        id: n.id,
        title: n.title,
        url: n.url,
        spaceName,
      });
    } else {
      hits.push(...collectPins(n.children, spaceName));
    }
  }
  return hits;
}

function escapeMarkdownLinkTitle(title: string): string {
  return title.replaceAll('[', '\\[').replaceAll(']', '\\]');
}

function isInsideOverflowingHScroll(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const scroller = target.closest<HTMLElement>('.arcline-hscroll');
  if (!scroller) return false;
  return scroller.scrollWidth > scroller.clientWidth + 2;
}

function isRestrictedTabUrl(url?: string): boolean {
  if (!url) return false;
  if (/^https?:\/\//i.test(url)) {
    return /^https:\/\/chromewebstore\.google\.com\//i.test(url);
  }
  return !url.includes('/empty-space.html');
}

export function App() {
  const t = useT();
  const [windowId, setWindowId] = useState<number | null>(null);
  const [state, setState] = useState<SidebarState>(EMPTY_STATE);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [archivedTabs, setArchivedTabs] = useState<ArchivedTab[]>([]);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedHitIdx, setSelectedHitIdx] = useState(0);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingSpace, setRenamingSpace] = useState(false);
  const [spaceModal, setSpaceModal] = useState<SpaceModalTarget | null>(null);
  const [themeModalSpace, setThemeModalSpace] = useState<Space | null>(null);
  const [previewTheme, setPreviewTheme] = useState<SpaceTheme | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTabId>('general');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hostSidebarWidth, setHostSidebarWidth] = useState<number>(DEFAULT_SETTINGS.overlayWidthPx);
  const [hostStageExpanded, setHostStageExpanded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [swipe, setSwipe] = useState<SpaceSwipeSnapshot>(IDLE_SWIPE);
  const [spaceAnimDir, setSpaceAnimDir] = useState<'left' | 'right' | null>(null);
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true,
  );

  const shellRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const spaceAnimTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const swipeMachineRef = useRef<SpaceSwipeMachine | null>(null);

  const isOverlay = useMemo(
    () => new URLSearchParams(window.location.search).get('mode') === 'overlay',
    [],
  );
  const isStandaloneNativeSidePanel = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return !params.get('mode') && !params.get('windowId');
  }, []);

  const stageExpanded = Boolean(
    isOverlay && (settingsOpen || spaceModal || themeModalSpace || menu),
  );

  const overlayLocked = Boolean(
    menu ||
      spaceModal ||
      themeModalSpace ||
      settingsOpen ||
      renamingId ||
      renamingSpace ||
      isDragging ||
      searchOpen,
  );

  // Register live port when mounted inside the browser's native Side Panel so Ctrl+B can toggle it closed
  // and switching back to normal webpages can auto-close it. On restricted pages (brave://extensions, etc.),
  // the panel intentionally stays open when the cursor leaves because left-edge hover cannot reopen it there.
  useEffect(() => {
    if (!isStandaloneNativeSidePanel || !chrome.runtime?.connect) return;
    let port: chrome.runtime.Port | undefined;
    try {
      port = chrome.runtime.connect({ name: 'arcline:native-sidepanel' });
    } catch {
      return undefined;
    }
    return () => {
      port?.disconnect();
    };
  }, [isStandaloneNativeSidePanel]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      toastTimerRef.current = undefined;
      setToast(null);
    }, 1850);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (spaceAnimTimerRef.current) clearTimeout(spaceAnimTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Sync sidebar width CSS token with host overlay metrics
  useEffect(() => {
    document.documentElement.style.setProperty('--arcline-sidebar-w', `${hostSidebarWidth}px`);
  }, [hostSidebarWidth]);

  useEffect(() => {
    setHostSidebarWidth(settings.overlayWidthPx);
  }, [settings.overlayWidthPx]);

  // Keep left-edge hover overlay open while interacting with menus, modals, inline rename, or drag
  useEffect(() => {
    if (!isOverlay || window.parent === window) return;
    window.parent.postMessage({ type: 'arcline:overlay-lock', locked: overlayLocked }, '*');
  }, [isOverlay, overlayLocked]);

  // Expand overlay iframe transparently to full viewport when centered modals or overflowing menus open
  useEffect(() => {
    if (!isOverlay || window.parent === window) return;
    window.parent.postMessage({ type: 'arcline:overlay-stage', expanded: stageExpanded }, '*');
  }, [isOverlay, stageExpanded]);

  useEffect(() => {
    if (!isOverlay || window.parent === window) return;
    const notifyEnter = () => {
      window.parent.postMessage({ type: 'arcline:overlay-enter' }, '*');
    };
    const notifyLeave = (e: PointerEvent) => {
      if (e.relatedTarget !== null) return;
      window.parent.postMessage({ type: 'arcline:overlay-leave' }, '*');
    };
    const onHostMessage = (e: MessageEvent) => {
      if (!e.isTrusted || e.source !== window.parent) return;
      const msg = e.data as
        | { type?: string; sidebarWidth?: number; stageExpanded?: boolean }
        | undefined;
      if (msg?.type === 'arcline:host-metrics') {
        if (typeof msg.sidebarWidth === 'number' && Number.isFinite(msg.sidebarWidth)) {
          setHostSidebarWidth(Math.max(200, Math.min(600, Math.round(msg.sidebarWidth))));
        }
        if (typeof msg.stageExpanded === 'boolean') {
          setHostStageExpanded(msg.stageExpanded);
        }
      }
    };
    const onDragStart = () => setIsDragging(true);
    const onDragEnd = () => setIsDragging(false);

    window.parent.postMessage({ type: 'arcline:request-metrics' }, '*');
    document.documentElement.addEventListener('pointerenter', notifyEnter);
    document.documentElement.addEventListener('pointerdown', notifyEnter, true);
    document.documentElement.addEventListener('pointerleave', notifyLeave);
    window.addEventListener('message', onHostMessage);
    window.addEventListener('dragstart', onDragStart, true);
    window.addEventListener('dragend', onDragEnd, true);
    window.addEventListener('drop', onDragEnd, true);
    return () => {
      document.documentElement.removeEventListener('pointerenter', notifyEnter);
      document.documentElement.removeEventListener('pointerdown', notifyEnter, true);
      document.documentElement.removeEventListener('pointerleave', notifyLeave);
      window.removeEventListener('message', onHostMessage);
      window.removeEventListener('dragstart', onDragStart, true);
      window.removeEventListener('dragend', onDragEnd, true);
      window.removeEventListener('drop', onDragEnd, true);
    };
  }, [isOverlay]);

  const reload = useCallback(async (winId: number) => {
    try {
      const next = await loadSidebarState(winId);
      setState(next);
    } catch (error) {
      console.warn('[Arcline] loadSidebarState failed', error);
    }
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let active = true;

    (async () => {
      const [winId, loadedSettings, loadedArchive] = await Promise.all([
        getCurrentWindowId(),
        loadSettings(),
        loadArchivedTabs(),
      ]);
      if (!active) return;
      setWindowId(winId);
      setSettings(loadedSettings);
      setArchivedTabs(loadedArchive);
      await sendCommand({ type: 'reconcile', windowId: winId, recover: true }).catch(
        () => undefined,
      );
      await reload(winId);
      cleanup = subscribeToWindowUpdates(winId, {
        onReload: () => void reload(winId),
        onTabPatch: (tabId, patch) => setState((prev) => patchLiveTab(prev, tabId, patch)),
        onSettingsChange: () => void loadSettings().then(setSettings),
        onArchiveChange: () => void loadArchivedTabs().then(setArchivedTabs),
      });
    })();

    return () => {
      active = false;
      cleanup?.();
    };
  }, [reload]);

  const activeSpaceIndex = useMemo(() => {
    const idx = state.spaces.findIndex((s) => s.id === state.activeSpaceId);
    return Math.max(idx, 0);
  }, [state.spaces, state.activeSpaceId]);

  const activeSpace: Space | undefined = state.spaces[activeSpaceIndex] ?? state.spaces[0];

  const activeTheme = previewTheme ?? activeSpace?.theme;
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

  // Sync space hue (including neutral charcoal) & per-Space appearance override to :root
  useEffect(() => {
    const hue = activeTheme ? primaryHueFromTheme(activeTheme) : (activeSpace?.hue ?? -1);
    if (isNeutralHue(hue)) {
      document.documentElement.setAttribute('data-neutral', 'true');
    } else {
      document.documentElement.removeAttribute('data-neutral');
      document.documentElement.style.setProperty('--space-hue', String(hue));
    }
  }, [activeSpace?.hue, activeTheme]);

  useEffect(() => {
    if (activeTheme?.appearance === 'light' || activeTheme?.appearance === 'dark') {
      document.documentElement.setAttribute('data-theme', activeTheme.appearance);
    } else if (settings.theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', settings.theme);
    }
    if (isOverlay && window.parent !== window) {
      const hue = activeTheme ? primaryHueFromTheme(activeTheme) : (activeSpace?.hue ?? -1);
      const backdrop = activeTheme
        ? buildSpaceBackgroundCss(activeTheme, resolvedScheme, true)
        : isNeutralHue(hue)
          ? resolvedScheme === 'dark'
            ? 'rgba(30, 30, 31, 0.94)'
            : 'rgba(232, 232, 235, 0.94)'
          : resolvedScheme === 'dark'
            ? `linear-gradient(175deg, oklch(0.205 0.028 ${hue} / 0.94), oklch(0.185 0.024 ${hue + 38} / 0.94))`
            : `linear-gradient(175deg, oklch(0.84 0.036 ${hue} / 0.94), oklch(0.79 0.044 ${hue + 52} / 0.94))`;
      window.parent.postMessage(
        { type: 'arcline:overlay-scheme', scheme: resolvedScheme, backdrop },
        '*',
      );
    }
  }, [settings.theme, activeTheme, activeSpace?.hue, isOverlay, resolvedScheme]);

  const runCmd = useCallback(
    async <T = unknown>(cmd: Parameters<typeof sendCommand>[0]): Promise<T> => {
      const result = await sendCommand<T>(cmd);
      if (windowId !== null) await reload(windowId);
      return result;
    },
    [windowId, reload],
  );

  const triggerSpaceSlide = useCallback((dir: 'left' | 'right') => {
    setSpaceAnimDir(dir);
    if (spaceAnimTimerRef.current) clearTimeout(spaceAnimTimerRef.current);
    spaceAnimTimerRef.current = setTimeout(() => {
      spaceAnimTimerRef.current = undefined;
      setSpaceAnimDir(null);
    }, 240);
  }, []);

  const switchToSpace = useCallback(
    (targetSpaceId: string) => {
      if (windowId === null || !activeSpace || targetSpaceId === activeSpace.id) return;
      const targetIdx = state.spaces.findIndex((s) => s.id === targetSpaceId);
      const targetSpace = state.spaces[targetIdx];
      if (targetIdx >= 0 && targetIdx !== activeSpaceIndex) {
        triggerSpaceSlide(targetIdx > activeSpaceIndex ? 'right' : 'left');
      }
      setRenamingSpace(false);
      if (targetSpace) {
        const destTabId = targetSpace.lastActiveTabId ?? targetSpace.tabIds.at(-1);
        const targetTab = destTabId !== undefined ? state.tabs.get(destTabId) : undefined;
        const activeTabObj =
          state.activeTabId !== undefined ? state.tabs.get(state.activeTabId) : undefined;
        const effectiveUrl =
          targetTab?.url ?? (!settings.openEmptySpacePage ? activeTabObj?.url : undefined);

        // When swiping/switching from the floating overlay into a Space whose active tab is a
        // restricted page (e.g. brave://extensions), open the native Side Panel synchronously
        // within the wheel/click gesture so the sidebar remains seamlessly visible!
        if (isOverlay && isRestrictedTabUrl(effectiveUrl)) {
          chrome.sidePanel?.open?.({ windowId }).catch(() => undefined);
        }

        const hasRealTabs =
          (targetTab !== undefined && !targetTab.url.includes('/empty-space.html')) ||
          targetSpace.tabIds.some((tid) => {
            const tabEntry = state.tabs.get(tid);
            return tabEntry !== undefined && !tabEntry.url.includes('/empty-space.html');
          });
        if (!hasRealTabs) {
          showToast(
            settings.openEmptySpacePage
              ? t('sidebar.toast.switchedColorPage', { name: targetSpace.name })
              : t('sidebar.toast.switchedNoTabs', { name: targetSpace.name }),
          );
        }
      }
      void runCmd({
        type: 'switchSpace',
        windowId,
        spaceId: targetSpaceId,
        keepOverlayOpen: isOverlay || isStandaloneNativeSidePanel,
      });
    },
    [
      windowId,
      activeSpace,
      state.spaces,
      state.tabs,
      state.activeTabId,
      activeSpaceIndex,
      settings.openEmptySpacePage,
      isOverlay,
      isStandaloneNativeSidePanel,
      triggerSpaceSlide,
      showToast,
      runCmd,
      t,
    ],
  );

  // Two-finger horizontal trackpad Space swipe (non-passive wheel listener so browser Back/Forward never conflicts)
  const swipeContextRef = useRef({
    spaces: state.spaces,
    activeIndex: activeSpaceIndex,
    locked: overlayLocked,
    enabled: settings.swipeToSwitchSpace,
    switchToSpace,
  });
  swipeContextRef.current = {
    spaces: state.spaces,
    activeIndex: activeSpaceIndex,
    locked: overlayLocked,
    enabled: settings.swipeToSwitchSpace,
    switchToSpace,
  };

  useEffect(() => {
    const machine = new SpaceSwipeMachine({
      canGo: (dir) => {
        const { spaces, activeIndex } = swipeContextRef.current;
        const nextIdx = activeIndex + dir;
        return nextIdx >= 0 && nextIdx < spaces.length;
      },
      onCommit: (dir) => {
        const { spaces, activeIndex, switchToSpace: go } = swipeContextRef.current;
        const target = spaces[activeIndex + dir];
        if (target) go(target.id);
      },
      onChange: (snap) => setSwipe(snap),
    });
    swipeMachineRef.current = machine;
    return () => {
      machine.dispose();
      swipeMachineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      const ctx = swipeContextRef.current;
      const machine = swipeMachineRef.current;
      if (!machine || !ctx.enabled || ctx.locked || ctx.spaces.length < 2) return;
      if (isInsideOverflowingHScroll(event.target)) return;

      const panelWidth = shellRef.current?.clientWidth || hostSidebarWidth;
      machine.setWidth(panelWidth);
      const consumed = machine.handleWheel(event.deltaX, event.deltaY, event.ctrlKey);
      if (consumed) {
        event.preventDefault();
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [hostSidebarWidth]);

  useEffect(() => {
    swipeMachineRef.current?.setEnabled(settings.swipeToSwitchSpace && !overlayLocked);
  }, [settings.swipeToSwitchSpace, overlayLocked]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits: QuickSearchHit[] = [];
    for (const fav of state.favorites) {
      if (fav.title.toLowerCase().includes(q) || fav.url.toLowerCase().includes(q)) {
        hits.push({
          key: `fav-${fav.id}`,
          kind: 'favorite',
          id: fav.id,
          title: fav.title,
          url: fav.url,
          spaceName: 'Favorite',
        });
      }
    }
    for (const space of state.spaces) {
      for (const pin of collectPins(space.pinned, space.name)) {
        if (pin.title.toLowerCase().includes(q) || pin.url.toLowerCase().includes(q)) {
          hits.push(pin);
        }
      }
      for (const tid of space.tabIds) {
        const tab = state.tabs.get(tid);
        if (tab && (tab.title.toLowerCase().includes(q) || tab.url.toLowerCase().includes(q))) {
          hits.push({
            key: `tab-${tab.id}`,
            kind: 'tab',
            id: tab.id,
            title: tab.title,
            url: tab.url,
            spaceName: `${space.name} (Open)`,
            favIconUrl: tab.favIconUrl,
          });
        }
      }
    }
    for (const entry of archivedTabs) {
      if (entry.title.toLowerCase().includes(q) || entry.url.toLowerCase().includes(q)) {
        hits.push({
          key: `arc-${entry.id}`,
          kind: 'archived',
          id: entry.id,
          title: entry.title,
          url: entry.url,
          spaceName: 'Archive',
        });
      }
    }
    return hits.slice(0, 30);
  }, [query, state.favorites, state.spaces, state.tabs, archivedTabs]);

  const activateTabWithFallback = useCallback(
    (tabId: number, url?: string) => {
      if (windowId === null) return;
      if (isOverlay && isRestrictedTabUrl(url)) {
        // Open native Side Panel synchronously inside the user click when switching to brave:// / chrome://
        chrome.sidePanel?.open?.({ windowId }).catch(() => undefined);
      }
      void runCmd({ type: 'activateTab', windowId, tabId });
    },
    [windowId, isOverlay, runCmd],
  );

  const openSearchHit = useCallback(
    (hit: QuickSearchHit) => {
      if (windowId === null || !activeSpace) return;
      if (hit.kind === 'favorite') {
        void runCmd({ type: 'openFavorite', windowId, favoriteId: String(hit.id) });
      } else if (hit.kind === 'pin') {
        void runCmd({ type: 'openPin', windowId, pinId: String(hit.id) });
      } else if (hit.kind === 'archived') {
        void runCmd({
          type: 'restoreArchived',
          windowId,
          spaceId: activeSpace.id,
          archiveId: String(hit.id),
        });
      } else {
        activateTabWithFallback(Number(hit.id), hit.url);
      }
      setQuery('');
      setSearchOpen(false);
    },
    [windowId, activeSpace, runCmd, activateTabWithFallback],
  );

  useEffect(() => {
    if (searchOpen) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      });
    }
  }, [searchOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!settingsOpen && windowId !== null) {
        const matchedUrl = matchFavoriteShortcut(e, settings.favoriteShortcuts);
        if (matchedUrl) {
          e.preventDefault();
          void sendCommand({ type: 'openFavoriteByUrl', windowId, url: matchedUrl });
          return;
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        requestAnimationFrame(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        });
      } else if (e.key === 'Escape' && (query || searchOpen)) {
        setQuery('');
        setSearchOpen(false);
        searchInputRef.current?.blur();
      } else if (e.key === 'Escape' && isOverlay && !overlayLocked && window.parent !== window) {
        window.parent.postMessage({ type: 'arcline:overlay-close' }, '*');
      } else if (e.key === 'Escape' && isStandaloneNativeSidePanel && !overlayLocked) {
        void sendCommand({ type: 'closeNativeSidePanel' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    query,
    searchOpen,
    isOverlay,
    isStandaloneNativeSidePanel,
    overlayLocked,
    settingsOpen,
    windowId,
    settings.favoriteShortcuts,
  ]);

  if (windowId === null || !activeSpace) {
    return (
      <div
        className="flex h-full items-center justify-center text-xs"
        style={{ color: 'var(--text-muted)' }}
      >
        Loading Arcline...
      </div>
    );
  }

  const menuPoint = (e: React.MouseEvent) => {
    // When overlay transitions from 6px-inset sidebar frame to 0-inset full viewport stage,
    // offset pointer coords by +6px so the menu pops at the exact right-clicked screen pixel.
    const offset = isOverlay && !stageExpanded ? 6 : 0;
    return { x: e.clientX + offset, y: e.clientY + offset };
  };

  const copyText = (text: string, feedback: string) => {
    void navigator.clipboard
      .writeText(text)
      .then(() => showToast(feedback))
      .catch(() => showToast(t('common.toast.copyFailed')));
  };

  const exportSingleSpace = (space: Space) => {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      space: {
        name: space.name,
        hue: space.hue,
        icon: space.icon,
        theme: space.theme,
        pinned: space.pinned,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = space.name.toLowerCase().replace(/[^a-z0-9-_]+/gi, '-') || 'space';
    a.href = url;
    a.download = `arcline-space-${safeName}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('sidebar.toast.exported', { name: space.name }));
  };

  const handleModalDismiss = (meta?: { backdropOutsideSidebar?: boolean }) => {
    if (isOverlay && meta?.backdropOutsideSidebar && window.parent !== window) {
      window.parent.postMessage({ type: 'arcline:overlay-close' }, '*');
    }
  };

  const handleDropOnFavorites = (payload: DragPayload, targetIndex?: number) => {
    if (payload.kind === 'favorite') {
      if (targetIndex !== undefined) {
        void runCmd({ type: 'moveFavorite', favoriteId: payload.id, index: targetIndex });
      }
    } else if (payload.kind === 'pin') {
      void runCmd({ type: 'favoritePin', windowId, pinId: payload.id, index: targetIndex });
      showToast(t('common.toast.addedToFavorites'));
    } else if (payload.kind === 'tab') {
      void runCmd({ type: 'addFavorite', windowId, tabId: payload.tabId, index: targetIndex });
      showToast(t('common.toast.addedToFavorites'));
    }
  };

  const handleDropOnPinnedParent = (payload: DragPayload, parentId: string, index?: number) => {
    if (payload.kind === 'pin' || payload.kind === 'folder' || payload.kind === 'favorite') {
      void runCmd({ type: 'moveNode', windowId, id: payload.id, parentId, index });
    } else if (payload.kind === 'tab') {
      void runCmd({ type: 'pinTab', windowId, tabId: payload.tabId, parentId, index });
      showToast(t('common.toast.pinned'));
    }
  };

  const handleDropOnTemporary = (payload: DragPayload, targetIndex?: number) => {
    if (payload.kind === 'tab') {
      void runCmd({
        type: 'moveTab',
        windowId,
        tabId: payload.tabId,
        spaceId: activeSpace.id,
        index: targetIndex,
      });
    } else if (payload.kind === 'pin') {
      void runCmd({
        type: 'unpin',
        windowId,
        pinId: payload.id,
        spaceId: activeSpace.id,
        index: targetIndex,
      });
      showToast(t('common.toast.unpinned'));
    }
  };

  const handleDropOnSpace = (payload: DragPayload, targetSpaceId: string) => {
    const targetSpace = state.spaces.find((s) => s.id === targetSpaceId);
    if (payload.kind === 'tab') {
      void runCmd({ type: 'moveTab', windowId, tabId: payload.tabId, spaceId: targetSpaceId });
      if (targetSpace) showToast(t('common.toast.movedTo', { name: targetSpace.name }));
    } else if (payload.kind === 'pin' || payload.kind === 'folder') {
      void runCmd({ type: 'moveNode', windowId, id: payload.id, parentId: targetSpaceId });
      if (targetSpace) showToast(t('common.toast.movedTo', { name: targetSpace.name }));
    }
  };

  const openFavoriteMenu = (e: React.MouseEvent, fav: Favorite) => {
    const live = fav.tabId !== undefined ? state.tabs.get(fav.tabId) : undefined;
    const isOpen = live !== undefined;
    const navigatedAway = isOpen && Boolean(live.url && live.url !== fav.url);
    const pt = menuPoint(e);

    const items: ContextMenuItem[] = [
      {
        kind: 'action',
        id: 'open',
        label: isOpen ? t('sidebar.menu.goToTab') : t('sidebar.menu.open'),
        icon: <ExternalLink size={13.5} />,
        onSelect: () => void runCmd({ type: 'openFavorite', windowId, favoriteId: fav.id }),
      },
      ...(isOpen && fav.tabId !== undefined
        ? [
            {
              kind: 'action' as const,
              id: 'reload',
              label: t('sidebar.menu.reload'),
              icon: <RefreshCw size={13.5} />,
              onSelect: () => {
                if (fav.tabId !== undefined) void runCmd({ type: 'reloadTab', tabId: fav.tabId });
              },
            },
            {
              kind: 'action' as const,
              id: 'mute',
              label: live.muted ? t('sidebar.tab.unmute') : t('sidebar.menu.muteTab'),
              icon: live.muted ? <Volume2 size={13.5} /> : <VolumeX size={13.5} />,
              onSelect: () => {
                if (fav.tabId !== undefined) {
                  void runCmd({ type: 'toggleMuteTab', tabId: fav.tabId });
                }
              },
            },
            ...(navigatedAway
              ? [
                  {
                    kind: 'action' as const,
                    id: 'reset',
                    label: t('sidebar.menu.resetUrl'),
                    icon: <RotateCcw size={13.5} />,
                    onSelect: () => {
                      void runCmd({ type: 'resetFavorite', windowId, favoriteId: fav.id });
                      showToast(t('sidebar.toast.urlReset'));
                    },
                  },
                  {
                    kind: 'action' as const,
                    id: 'replace-url',
                    label: t('sidebar.menu.updateFavoriteUrl'),
                    icon: <Link2 size={13.5} />,
                    onSelect: () => {
                      void runCmd({ type: 'replaceFavoriteUrl', windowId, favoriteId: fav.id });
                      showToast(t('sidebar.toast.favoriteUrlUpdated'));
                    },
                  },
                ]
              : []),
            {
              kind: 'action' as const,
              id: 'unload',
              label: t('sidebar.menu.closeTabKeepFavorite'),
              icon: <Minus size={13.5} />,
              onSelect: () => void runCmd({ type: 'unloadFavorite', windowId, favoriteId: fav.id }),
            },
          ]
        : []),
      { kind: 'separator' },
      {
        kind: 'action',
        id: 'copy',
        label: t('sidebar.menu.copyUrl'),
        icon: <Copy size={13.5} />,
        onSelect: () => copyText(live?.url || fav.url, t('common.toast.urlCopied')),
      },
      {
        kind: 'action',
        id: 'copy-md',
        label: t('sidebar.menu.copyMarkdown'),
        icon: <FileCode2 size={13.5} />,
        onSelect: () =>
          copyText(
            `[${escapeMarkdownLinkTitle(live?.title || fav.title)}](${live?.url || fav.url})`,
            t('common.toast.markdownCopied'),
          ),
      },
      {
        kind: 'action',
        id: 'to-space',
        label: t('sidebar.menu.moveToSpacePinned', { name: activeSpace.name }),
        icon: <Pin size={13.5} />,
        onSelect: () => {
          void runCmd({ type: 'moveNode', windowId, id: fav.id, parentId: activeSpace.id });
          showToast(t('common.toast.movedTo', { name: activeSpace.name }));
        },
      },
      { kind: 'separator' },
      {
        kind: 'action',
        id: 'remove',
        label: t('sidebar.menu.removeFavorite'),
        icon: <Trash2 size={13.5} />,
        danger: true,
        onSelect: () => void runCmd({ type: 'removeFavorite', windowId, favoriteId: fav.id }),
      },
    ];

    setMenu({ x: pt.x, y: pt.y, items });
  };

  const openPinMenu = (e: React.MouseEvent, pin: PinnedTab) => {
    const live = pin.tabId !== undefined ? state.tabs.get(pin.tabId) : undefined;
    const isOpen = live !== undefined;
    const navigatedAway = isOpen && Boolean(live.url && live.url !== pin.url);
    const otherSpaces = state.spaces.filter((s) => s.id !== activeSpace.id);
    const pt = menuPoint(e);

    const items: ContextMenuItem[] = [
      {
        kind: 'action',
        id: 'open',
        label: isOpen ? t('sidebar.menu.goToTab') : t('sidebar.menu.open'),
        icon: <ExternalLink size={13.5} />,
        onSelect: () => void runCmd({ type: 'openPin', windowId, pinId: pin.id }),
      },
      ...(isOpen && pin.tabId !== undefined
        ? [
            {
              kind: 'action' as const,
              id: 'reload',
              label: t('sidebar.menu.reload'),
              icon: <RefreshCw size={13.5} />,
              onSelect: () => {
                if (pin.tabId !== undefined) void runCmd({ type: 'reloadTab', tabId: pin.tabId });
              },
            },
            {
              kind: 'action' as const,
              id: 'mute',
              label: live.muted ? t('sidebar.tab.unmute') : t('sidebar.menu.muteTab'),
              icon: live.muted ? <Volume2 size={13.5} /> : <VolumeX size={13.5} />,
              onSelect: () => {
                if (pin.tabId !== undefined) {
                  void runCmd({ type: 'toggleMuteTab', tabId: pin.tabId });
                }
              },
            },
            ...(navigatedAway
              ? [
                  {
                    kind: 'action' as const,
                    id: 'reset',
                    label: t('sidebar.menu.resetUrl'),
                    icon: <RotateCcw size={13.5} />,
                    onSelect: () => {
                      void runCmd({ type: 'resetPin', windowId, pinId: pin.id });
                      showToast(t('sidebar.toast.pinReset'));
                    },
                  },
                  {
                    kind: 'action' as const,
                    id: 'replace-url',
                    label: t('sidebar.menu.updatePinUrl'),
                    icon: <Link2 size={13.5} />,
                    onSelect: () => {
                      void runCmd({ type: 'replacePinUrl', windowId, pinId: pin.id });
                      showToast(t('sidebar.toast.pinUrlUpdated'));
                    },
                  },
                ]
              : []),
            {
              kind: 'action' as const,
              id: 'unload',
              label: t('sidebar.menu.closeTabKeepPin'),
              icon: <Minus size={13.5} />,
              onSelect: () => void runCmd({ type: 'unloadPin', windowId, pinId: pin.id }),
            },
          ]
        : []),
      { kind: 'separator' },
      {
        kind: 'action',
        id: 'fav',
        label: t('sidebar.menu.addToFavorites'),
        icon: <Star size={13.5} />,
        onSelect: () => {
          void runCmd({ type: 'favoritePin', windowId, pinId: pin.id });
          showToast(t('common.toast.addedToFavorites'));
        },
      },
      {
        kind: 'action',
        id: 'rename',
        label: t('sidebar.menu.rename'),
        icon: <Pencil size={13.5} />,
        onSelect: () => setRenamingId(pin.id),
      },
      {
        kind: 'action',
        id: 'copy',
        label: t('sidebar.menu.copyUrl'),
        icon: <Copy size={13.5} />,
        onSelect: () => copyText(live?.url || pin.url, t('common.toast.urlCopied')),
      },
      {
        kind: 'action',
        id: 'copy-md',
        label: t('sidebar.menu.copyMarkdown'),
        icon: <FileCode2 size={13.5} />,
        onSelect: () =>
          copyText(
            `[${escapeMarkdownLinkTitle(pin.title)}](${live?.url || pin.url})`,
            t('common.toast.markdownCopied'),
          ),
      },
      ...(otherSpaces.length > 0
        ? [
            {
              kind: 'submenu' as const,
              id: 'move-space',
              label: t('sidebar.menu.moveToOtherSpace'),
              icon: <ArrowRightLeft size={13.5} />,
              items: otherSpaces.map((sp) => ({
                kind: 'action' as const,
                id: `move-pin-${sp.id}`,
                label: sp.name,
                icon: <SpaceGlyph icon={sp.icon} size={13} />,
                onSelect: () => {
                  void runCmd({ type: 'moveNode', windowId, id: pin.id, parentId: sp.id });
                  showToast(t('common.toast.movedTo', { name: sp.name }));
                },
              })),
            },
          ]
        : []),
      { kind: 'separator' },
      {
        kind: 'action',
        id: 'unpin',
        label: t('sidebar.menu.unpinToTemp'),
        icon: <PinOff size={13.5} />,
        onSelect: () =>
          void runCmd({ type: 'unpin', windowId, pinId: pin.id, spaceId: activeSpace.id }),
      },
      {
        kind: 'action',
        id: 'delete',
        label: t('sidebar.menu.delete'),
        icon: <Trash2 size={13.5} />,
        danger: true,
        onSelect: () => void runCmd({ type: 'deleteBookmark', windowId, id: pin.id }),
      },
    ];

    setMenu({ x: pt.x, y: pt.y, items });
  };

  const openFolderMenu = (e: React.MouseEvent, folder: PinnedFolder) => {
    const isOpen = state.openFolders.has(folder.id);
    const otherSpaces = state.spaces.filter((s) => s.id !== activeSpace.id);
    const pt = menuPoint(e);

    const items: ContextMenuItem[] = [
      {
        kind: 'action',
        id: 'toggle',
        label: isOpen ? t('sidebar.menu.folderCollapse') : t('sidebar.menu.folderExpand'),
        icon: <FolderOpen size={13.5} />,
        onSelect: () => {
          setState((prev) => {
            const next = new Set(prev.openFolders);
            if (next.has(folder.id)) next.delete(folder.id);
            else next.add(folder.id);
            return { ...prev, openFolders: next };
          });
          void toggleFolderOpen(folder.id);
        },
      },
      {
        kind: 'action',
        id: 'open-all',
        label: t('sidebar.menu.folderOpenAll'),
        icon: <ExternalLink size={13.5} />,
        disabled: folder.children.length === 0,
        onSelect: () => {
          void runCmd<number>({ type: 'openFolderPins', windowId, folderId: folder.id }).then(
            (count) => {
              if (count > 0)
                showToast(
                  t(count === 1 ? 'sidebar.toast.openedTabsOne' : 'sidebar.toast.openedTabsOther', {
                    count,
                  }),
                );
            },
          );
        },
      },
      { kind: 'separator' },
      {
        kind: 'action',
        id: 'pin-active',
        label: t('sidebar.menu.folderPinHere'),
        icon: <Pin size={13.5} />,
        disabled: state.activeTabId === undefined,
        onSelect: () => {
          if (state.activeTabId !== undefined) {
            void runCmd({
              type: 'pinTab',
              windowId,
              tabId: state.activeTabId,
              parentId: folder.id,
            });
            showToast(t('sidebar.toast.pinnedToFolder', { name: folder.title }));
          }
        },
      },
      {
        kind: 'action',
        id: 'new-sub',
        label: t('sidebar.menu.newSubfolder'),
        icon: <FolderPlus size={13.5} />,
        onSelect: () =>
          void runCmd({ type: 'createFolder', parentId: folder.id, title: 'New Folder' }).then(
            (id) => {
              if (typeof id === 'string') setRenamingId(id);
            },
          ),
      },
      {
        kind: 'action',
        id: 'rename',
        label: t('sidebar.menu.renameFolder'),
        icon: <Pencil size={13.5} />,
        onSelect: () => setRenamingId(folder.id),
      },
      ...(otherSpaces.length > 0
        ? [
            {
              kind: 'submenu' as const,
              id: 'move-folder-space',
              label: t('sidebar.menu.moveToOtherSpace'),
              icon: <ArrowRightLeft size={13.5} />,
              items: otherSpaces.map((sp) => ({
                kind: 'action' as const,
                id: `move-folder-${sp.id}`,
                label: sp.name,
                icon: <SpaceGlyph icon={sp.icon} size={13} />,
                onSelect: () => {
                  void runCmd({ type: 'moveNode', windowId, id: folder.id, parentId: sp.id });
                  showToast(t('common.toast.movedTo', { name: sp.name }));
                },
              })),
            },
          ]
        : []),
      { kind: 'separator' },
      {
        kind: 'action',
        id: 'delete',
        label: t('sidebar.menu.deleteFolder'),
        icon: <Trash2 size={13.5} />,
        danger: true,
        onSelect: () => void runCmd({ type: 'deleteBookmark', windowId, id: folder.id }),
      },
    ];

    setMenu({ x: pt.x, y: pt.y, items });
  };

  const openTabMenu = (e: React.MouseEvent, tab: LiveTab) => {
    const otherSpaces = state.spaces.filter((s) => s.id !== activeSpace.id);
    const hasOtherTempTabs = activeSpace.tabIds.filter((id) => id !== tab.id).length > 0;
    const pt = menuPoint(e);

    const items: ContextMenuItem[] = [
      {
        kind: 'action',
        id: 'fav',
        label: t('sidebar.menu.addToFavorites'),
        icon: <Star size={13.5} />,
        onSelect: () => {
          void runCmd({ type: 'addFavorite', windowId, tabId: tab.id });
          showToast(t('common.toast.addedToFavorites'));
        },
      },
      {
        kind: 'action',
        id: 'pin',
        label: t('sidebar.menu.pinToSpace', { name: activeSpace.name }),
        icon: <Pin size={13.5} />,
        shortcut: '⌃D',
        onSelect: () => {
          void runCmd({
            type: 'pinTab',
            windowId,
            tabId: tab.id,
            parentId: activeSpace.id,
          });
          showToast(t('common.toast.pinned'));
        },
      },
      { kind: 'separator' },
      {
        kind: 'action',
        id: 'reload',
        label: t('sidebar.menu.reload'),
        icon: <RefreshCw size={13.5} />,
        onSelect: () => void runCmd({ type: 'reloadTab', tabId: tab.id }),
      },
      {
        kind: 'action',
        id: 'mute',
        label: tab.muted ? t('sidebar.tab.unmute') : t('sidebar.menu.muteTab'),
        icon: tab.muted ? <Volume2 size={13.5} /> : <VolumeX size={13.5} />,
        onSelect: () => void runCmd({ type: 'toggleMuteTab', tabId: tab.id }),
      },
      {
        kind: 'action',
        id: 'duplicate',
        label: t('sidebar.menu.duplicateTab'),
        icon: <Copy size={13.5} />,
        onSelect: () => void runCmd({ type: 'duplicateTab', windowId, tabId: tab.id }),
      },
      {
        kind: 'action',
        id: 'copy',
        label: t('sidebar.menu.copyUrl'),
        icon: <Link2 size={13.5} />,
        onSelect: () => copyText(tab.url, t('common.toast.urlCopied')),
      },
      {
        kind: 'action',
        id: 'copy-md',
        label: t('sidebar.menu.copyMarkdown'),
        icon: <FileCode2 size={13.5} />,
        onSelect: () =>
          copyText(
            `[${escapeMarkdownLinkTitle(tab.title)}](${tab.url})`,
            t('common.toast.markdownCopied'),
          ),
      },
      ...(otherSpaces.length > 0
        ? [
            {
              kind: 'submenu' as const,
              id: 'move-tab-space',
              label: t('sidebar.menu.moveToOtherSpace'),
              icon: <ArrowRightLeft size={13.5} />,
              items: otherSpaces.map((sp) => ({
                kind: 'action' as const,
                id: `move-${sp.id}`,
                label: sp.name,
                icon: <SpaceGlyph icon={sp.icon} size={13} />,
                onSelect: () => {
                  void runCmd({ type: 'moveTab', windowId, tabId: tab.id, spaceId: sp.id });
                  showToast(t('common.toast.movedTo', { name: sp.name }));
                },
              })),
            },
          ]
        : []),
      { kind: 'separator' },
      ...(hasOtherTempTabs
        ? [
            {
              kind: 'action' as const,
              id: 'close-others',
              label: t('sidebar.menu.closeOtherTemp'),
              icon: <Minus size={13.5} />,
              onSelect: () => {
                void runCmd<number>({
                  type: 'closeOtherSpaceTabs',
                  windowId,
                  spaceId: activeSpace.id,
                  keepTabId: tab.id,
                }).then((n) => {
                  if (n > 0)
                    showToast(
                      t(n === 1 ? 'sidebar.toast.closedTabsOne' : 'sidebar.toast.closedTabsOther', {
                        count: n,
                      }),
                    );
                });
              },
            },
          ]
        : []),
      {
        kind: 'action',
        id: 'close',
        label: t('sidebar.tab.close'),
        icon: <X size={13.5} />,
        danger: true,
        onSelect: () => void runCmd({ type: 'closeTab', windowId, tabId: tab.id }),
      },
    ];

    setMenu({ x: pt.x, y: pt.y, items });
  };

  const openSpaceMenu = (e: React.MouseEvent, space: Space) => {
    const pt = menuPoint(e);
    const isCurrent = space.id === activeSpace.id;

    setMenu({
      x: pt.x,
      y: pt.y,
      items: [
        { kind: 'label', id: 'space-hdr', text: space.name },
        {
          kind: 'action',
          id: 'theme',
          label: t('sidebar.menu.editTheme'),
          icon: <Palette size={13.5} />,
          onSelect: () => setThemeModalSpace(space),
        },
        {
          kind: 'action',
          id: 'icon',
          label: t('sidebar.menu.changeSpaceIcon'),
          icon: <Smile size={13.5} />,
          onSelect: () =>
            setSpaceModal({
              mode: 'edit',
              spaceId: space.id,
              initialName: space.name,
              initialHue: space.hue,
              initialIcon: space.icon,
              initialFocus: 'icon',
            }),
        },
        {
          kind: 'action',
          id: 'edit',
          label: t('sidebar.menu.renameSpace'),
          icon: <Pencil size={13.5} />,
          onSelect: () => {
            if (isCurrent) {
              setRenamingSpace(true);
            } else {
              setSpaceModal({
                mode: 'edit',
                spaceId: space.id,
                initialName: space.name,
                initialHue: space.hue,
                initialIcon: space.icon,
              });
            }
          },
        },
        { kind: 'separator' },
        {
          kind: 'action',
          id: 'new-folder',
          label: t('sidebar.menu.newFolderInSpace'),
          icon: <FolderPlus size={13.5} />,
          onSelect: () =>
            void runCmd({ type: 'createFolder', parentId: space.id, title: 'New Folder' }).then(
              (id) => {
                if (typeof id === 'string') setRenamingId(id);
              },
            ),
        },
        {
          kind: 'action',
          id: 'export-space',
          label: t('sidebar.menu.exportSpace'),
          icon: <Download size={13.5} />,
          onSelect: () => exportSingleSpace(space),
        },
        {
          kind: 'action',
          id: 'clear',
          label: t('sidebar.menu.closeAllTemp'),
          icon: <Minus size={13.5} />,
          disabled: space.tabIds.length === 0,
          onSelect: () => {
            const count = space.tabIds.length;
            void runCmd({ type: 'clearSpaceTabs', windowId, spaceId: space.id });
            showToast(
              t(
                count === 1
                  ? 'sidebar.toast.closedTempTabsOne'
                  : 'sidebar.toast.closedTempTabsOther',
                { count },
              ),
            );
          },
        },
        { kind: 'separator' },
        {
          kind: 'action',
          id: 'delete',
          label: t('sidebar.menu.deleteSpace'),
          icon: <Trash2 size={13.5} />,
          danger: true,
          disabled: state.spaces.length <= 1,
          onSelect: () => void runCmd({ type: 'deleteSpace', windowId, spaceId: space.id }),
        },
      ],
    });
  };

  const openBlankAreaMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const pt = menuPoint(e);
    setMenu({
      x: pt.x,
      y: pt.y,
      items: [
        {
          kind: 'action',
          id: 'new-tab',
          label: t('sidebar.menu.openNewTab'),
          icon: <Plus size={13.5} />,
          onSelect: () => void runCmd({ type: 'openTab', windowId, spaceId: activeSpace.id }),
        },
        {
          kind: 'action',
          id: 'new-folder',
          label: t('sidebar.pinned.newFolder'),
          icon: <FolderPlus size={13.5} />,
          onSelect: () =>
            void runCmd({
              type: 'createFolder',
              parentId: activeSpace.id,
              title: 'New Folder',
            }).then((id) => {
              if (typeof id === 'string') setRenamingId(id);
            }),
        },
        { kind: 'separator' },
        {
          kind: 'action',
          id: 'theme',
          label: t('sidebar.menu.editTheme'),
          icon: <Palette size={13.5} />,
          onSelect: () => setThemeModalSpace(activeSpace),
        },
        {
          kind: 'action',
          id: 'new-space',
          label: t('sidebar.menu.createSpace'),
          icon: <Sparkles size={13.5} />,
          onSelect: () => setSpaceModal({ mode: 'create' }),
        },
        { kind: 'separator' },
        {
          kind: 'action',
          id: 'settings',
          label: t('sidebar.menu.openSettings'),
          icon: <SettingsIcon size={13.5} />,
          onSelect: () => {
            setSettingsTab('general');
            setSettingsOpen(true);
          },
        },
      ],
    });
  };

  const activeTab = state.activeTabId !== undefined ? state.tabs.get(state.activeTabId) : undefined;
  let activeHostLabel = '';
  if (activeTab?.url) {
    try {
      const parsed = new URL(activeTab.url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        activeHostLabel = parsed.hostname.replace(/^www\./, '');
      }
    } catch {
      // Ignore malformed URLs
    }
  }

  const customBackground = activeTheme
    ? buildSpaceBackgroundCss(activeTheme, resolvedScheme, isOverlay)
    : undefined;
  const grainOpacity = activeTheme ? Math.min(0.32, (activeTheme.grain / 100) * 0.28) : 0;

  const swipeTargetSpace =
    swipe.dragging && swipe.direction !== 0
      ? state.spaces[activeSpaceIndex + swipe.direction]
      : undefined;

  return (
    <div
      ref={shellRef}
      className="arcline-shell flex h-full flex-col"
      data-arcline-ready="true"
      data-arcline-mode={isOverlay ? 'overlay' : 'sidepanel'}
      data-stage-expanded={hostStageExpanded ? 'true' : 'false'}
      data-active-space={activeSpace.name}
      style={customBackground ? { backgroundImage: customBackground } : undefined}
    >
      {grainOpacity > 0.01 && (
        <div aria-hidden="true" className="arcline-grain-layer" style={{ opacity: grainOpacity }} />
      )}

      {/* Viewport-Safe Centered Space Swipe Preview Pill (never overflows sidebar, follows Light/Dark mode) */}
      {swipeTargetSpace && Math.abs(swipe.offset) > 10 && (
        <div
          aria-hidden="true"
          data-swipe-preview-pill="true"
          className="arcline-swipe-pill"
          style={{
            opacity: Math.min(1, Math.abs(swipe.progress) * 3.4),
          }}
        >
          {swipe.direction < 0 && <ChevronLeft size={12} className="shrink-0 opacity-70" />}
          <SpaceGlyph icon={swipeTargetSpace.icon} size={12} />
          <span className="truncate">{swipeTargetSpace.name}</span>
          {swipe.direction > 0 && <ChevronRight size={12} className="shrink-0 opacity-70" />}
        </div>
      )}

      {/* Optional Top URL / Quick-Search Pill Bar (hidden by default; shown when enabled in Settings or triggered via ⌘K) */}
      {settings.showTopBar || searchOpen || query ? (
        <header className="flex shrink-0 items-center px-3 pt-2.5 pb-1.5">
          <div
            className="flex h-[34px] flex-1 items-center gap-1.5 rounded-[10px] px-2.5 transition-[background-color,box-shadow] duration-150"
            style={{
              backgroundColor: searchOpen ? 'var(--pill)' : 'var(--urlbar)',
              boxShadow: searchOpen ? 'var(--pill-shadow)' : 'none',
            }}
          >
            <Search
              size={13}
              className="shrink-0"
              style={{ color: 'var(--ink-muted)', opacity: searchOpen ? 0.9 : 0.7 }}
            />
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => {
                if (!query) setSearchOpen(false);
              }}
              onChange={(e) => {
                setSearchOpen(true);
                setQuery(e.target.value);
                setSelectedHitIdx(0);
              }}
              onKeyDown={(e) => {
                if (!searchResults.length) return;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSelectedHitIdx((i) => (i + 1) % searchResults.length);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSelectedHitIdx((i) => (i - 1 + searchResults.length) % searchResults.length);
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  const hit = searchResults[selectedHitIdx];
                  if (hit) openSearchHit(hit);
                }
              }}
              placeholder={activeHostLabel || t('sidebar.search.placeholder')}
              aria-label={t('sidebar.search.label')}
              className="w-full border-0 bg-transparent text-[13px] outline-none placeholder:text-[var(--ink-muted)]"
            />
            {query ? (
              <button
                type="button"
                aria-label={t('sidebar.search.clear')}
                onClick={() => {
                  setQuery('');
                  setSearchOpen(false);
                }}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md hover:bg-[var(--hover)] cursor-pointer"
                style={{ color: 'var(--ink-muted)' }}
              >
                <X size={12} />
              </button>
            ) : (
              activeTab?.url &&
              /^https?:\/\//i.test(activeTab.url) && (
                <button
                  type="button"
                  title={t('sidebar.search.copyCurrentUrl')}
                  aria-label={t('sidebar.search.copyCurrentUrl')}
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(activeTab.url)
                      .then(() => {
                        setCopiedUrl(true);
                        showToast(t('common.toast.urlCopied'));
                        setTimeout(() => setCopiedUrl(false), 1400);
                      })
                      .catch(() => undefined);
                  }}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-all hover:bg-[var(--hover)] active:scale-90 cursor-pointer"
                  style={{ color: copiedUrl ? 'var(--accent)' : 'var(--ink-muted)' }}
                >
                  {copiedUrl ? <Check size={13} /> : <Link2 size={13} />}
                </button>
              )
            )}
          </div>
        </header>
      ) : (
        <div aria-hidden="true" className="h-2 shrink-0" />
      )}

      {/* Global Favorites Grid — authentic 4-column Arc tiles */}
      <FavoritesGrid
        favorites={state.favorites}
        tabs={state.tabs}
        activeTabId={state.activeTabId}
        onOpen={(favoriteId) => void runCmd({ type: 'openFavorite', windowId, favoriteId })}
        onUnload={(favoriteId) => void runCmd({ type: 'unloadFavorite', windowId, favoriteId })}
        onToggleMute={(tabId) => void runCmd({ type: 'toggleMuteTab', tabId })}
        onAddActiveTab={() => {
          if (state.activeTabId !== undefined) {
            void runCmd({ type: 'addFavorite', windowId, tabId: state.activeTabId });
            showToast(t('common.toast.addedToFavorites'));
          }
        }}
        onDropPayload={handleDropOnFavorites}
        onContextMenu={openFavoriteMenu}
      />

      {/* Main scrollable area with Space swipe stage + empty-area context menu */}
      <main
        className="arcline-scroll relative flex min-h-0 flex-1 flex-col"
        onContextMenu={openBlankAreaMenu}
      >
        {query.trim() ? (
          <section aria-label={t('sidebar.search.results')} className="px-2 py-1">
            {searchResults.length === 0 ? (
              <p className="py-6 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
                {t('sidebar.search.noResults')}
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                {searchResults.map((hit, idx) => (
                  <li key={hit.key}>
                    <button
                      type="button"
                      onClick={() => openSearchHit(hit)}
                      onMouseEnter={() => setSelectedHitIdx(idx)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors cursor-pointer"
                      style={{
                        backgroundColor: idx === selectedHitIdx ? 'var(--bg-hover)' : undefined,
                      }}
                    >
                      <Favicon
                        url={hit.url}
                        favIconUrl={hit.favIconUrl}
                        title={hit.title}
                        size={15}
                      />
                      <span className="min-w-0 flex-1 truncate text-[12.5px]">{hit.title}</span>
                      {hit.spaceName && (
                        <span
                          className="shrink-0 rounded px-1.5 py-0.5 text-[10px]"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {hit.spaceName}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <div
            className={`arcline-space-stage flex flex-1 flex-col ${
              spaceAnimDir === 'right'
                ? 'arcline-space-enter-right'
                : spaceAnimDir === 'left'
                  ? 'arcline-space-enter-left'
                  : ''
            }`}
            style={{
              transform:
                swipe.offset !== 0 ? `translate3d(${Math.round(swipe.offset)}px, 0, 0)` : undefined,
              opacity: swipe.dragging ? Math.max(0.72, 1 - Math.abs(swipe.progress) * 0.45) : 1,
              transition: swipe.dragging
                ? 'none'
                : 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 160ms ease',
            }}
          >
            <PinnedTree
              spaceId={activeSpace.id}
              spaceName={activeSpace.name}
              spaceIcon={activeSpace.icon}
              nodes={activeSpace.pinned}
              tabs={state.tabs}
              activeTabId={state.activeTabId}
              openFolders={state.openFolders}
              showOpenInCollapsedFolders={settings.showOpenInCollapsedFolders}
              renamingId={renamingId}
              renamingSpace={renamingSpace}
              onStartRenameSpace={() => setRenamingSpace(true)}
              onFinishRenameSpace={(nextName) => {
                setRenamingSpace(false);
                if (nextName?.trim() && nextName.trim() !== activeSpace.name) {
                  void runCmd({
                    type: 'updateSpace',
                    spaceId: activeSpace.id,
                    name: nextName.trim(),
                  });
                  showToast(t('sidebar.toast.spaceRenamed', { name: nextName.trim() }));
                }
              }}
              onOpenIconPicker={() =>
                setSpaceModal({
                  mode: 'edit',
                  spaceId: activeSpace.id,
                  initialName: activeSpace.name,
                  initialHue: activeSpace.hue,
                  initialIcon: activeSpace.icon,
                  initialFocus: 'icon',
                })
              }
              onSpaceHeaderContextMenu={(e) => openSpaceMenu(e, activeSpace)}
              onFinishRename={(id, nextTitle) => {
                setRenamingId(null);
                if (nextTitle?.trim()) {
                  void runCmd({ type: 'renameBookmark', id, title: nextTitle.trim() });
                }
              }}
              onToggleFolder={(folderId) => {
                // Optimistic folder toggle for 0ms latency
                setState((prev) => {
                  const next = new Set(prev.openFolders);
                  if (next.has(folderId)) next.delete(folderId);
                  else next.add(folderId);
                  return { ...prev, openFolders: next };
                });
                void toggleFolderOpen(folderId);
              }}
              onOpenPin={(pinId) => void runCmd({ type: 'openPin', windowId, pinId })}
              onUnloadPin={(pinId) => void runCmd({ type: 'unloadPin', windowId, pinId })}
              onResetPin={(pinId) => {
                void runCmd({ type: 'resetPin', windowId, pinId });
                showToast(t('sidebar.toast.pinReset'));
              }}
              onToggleMute={(tabId) => void runCmd({ type: 'toggleMuteTab', tabId })}
              onCreateFolder={(parentId) =>
                void runCmd({ type: 'createFolder', parentId, title: 'New Folder' }).then((id) => {
                  if (typeof id === 'string') setRenamingId(id);
                })
              }
              onOpenTheme={() => setThemeModalSpace(activeSpace)}
              onPinActiveTab={(parentId) => {
                if (state.activeTabId !== undefined) {
                  void runCmd({
                    type: 'pinTab',
                    windowId,
                    tabId: state.activeTabId,
                    parentId,
                  });
                  showToast(t('common.toast.pinned'));
                }
              }}
              onDropOnParent={handleDropOnPinnedParent}
              onPinContextMenu={openPinMenu}
              onFolderContextMenu={openFolderMenu}
            />

            <TemporaryTabs
              spaceId={activeSpace.id}
              spaceName={activeSpace.name}
              openEmptySpacePage={settings.openEmptySpacePage}
              tabIds={activeSpace.tabIds}
              tabs={state.tabs}
              activeTabId={state.activeTabId}
              onActivate={activateTabWithFallback}
              onClose={(tabId) => void runCmd({ type: 'closeTab', windowId, tabId })}
              onPin={(tabId) => {
                void runCmd({ type: 'pinTab', windowId, tabId, parentId: activeSpace.id });
                showToast(t('common.toast.pinned'));
              }}
              onToggleMute={(tabId) => void runCmd({ type: 'toggleMuteTab', tabId })}
              onNewTab={() => void runCmd({ type: 'openTab', windowId, spaceId: activeSpace.id })}
              onClearAll={() => {
                const count = activeSpace.tabIds.length;
                void runCmd({ type: 'clearSpaceTabs', windowId, spaceId: activeSpace.id });
                if (count > 0)
                  showToast(
                    t(
                      count === 1
                        ? 'sidebar.toast.closedTempTabsOne'
                        : 'sidebar.toast.closedTempTabsOther',
                      { count },
                    ),
                  );
              }}
              onDropPayload={handleDropOnTemporary}
              onContextMenu={openTabMenu}
            />
          </div>
        )}
      </main>

      {/* Non-intrusive Action Confirmation Toast */}
      {toast && (
        <output aria-live="polite" className="arcline-toast">
          <Check size={12} style={{ color: 'var(--accent)' }} />
          <span className="truncate">{toast}</span>
        </output>
      )}

      {/* Bottom Arc-style Space Switcher */}
      <SpaceSwitcher
        spaces={state.spaces}
        activeSpaceId={activeSpace.id}
        onSelect={switchToSpace}
        onCreate={() => setSpaceModal({ mode: 'create' })}
        onOpenArchive={() => {
          setSettingsTab('archive');
          setSettingsOpen(true);
        }}
        onOpenSettings={() => {
          setSettingsTab('general');
          setSettingsOpen(true);
        }}
        onMoveSpace={(spaceId, index) => void runCmd({ type: 'moveSpace', spaceId, index })}
        onDropOnSpace={handleDropOnSpace}
        onSpaceContextMenu={openSpaceMenu}
      />

      {/* Native Popover Context Menu (overflows sidebar freely in overlay stage mode) */}
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />

      {/* Native <dialog> Modals (centered in full browser window in overlay mode) */}
      <SpaceModal
        target={spaceModal}
        sidebarWidthPx={hostSidebarWidth}
        onClose={(meta) => {
          setSpaceModal(null);
          handleModalDismiss(meta);
        }}
        onSubmit={({ name, hue, icon }) => {
          if (spaceModal?.mode === 'edit' && spaceModal.spaceId) {
            void runCmd({ type: 'updateSpace', spaceId: spaceModal.spaceId, name, hue, icon });
            showToast(t('sidebar.toast.spaceUpdated', { name }));
          } else {
            void runCmd({
              type: 'createSpace',
              windowId,
              name,
              hue,
              icon: icon || undefined,
            });
            showToast(t('sidebar.toast.spaceCreated', { name }));
          }
        }}
      />

      <SpaceThemeModal
        space={themeModalSpace}
        sidebarWidthPx={hostSidebarWidth}
        onPreview={setPreviewTheme}
        onClose={(meta) => {
          setThemeModalSpace(null);
          handleModalDismiss(meta);
        }}
        onSave={(spaceId, theme) => {
          void runCmd({
            type: 'updateSpace',
            spaceId,
            hue: primaryHueFromTheme(theme),
            theme,
          });
          showToast(t('sidebar.toast.themeApplied'));
        }}
      />

      <SettingsModal
        open={settingsOpen}
        initialTab={settingsTab}
        settings={settings}
        archivedTabs={archivedTabs}
        sidebarState={state}
        sidebarWidthPx={hostSidebarWidth}
        onClose={(meta) => {
          setSettingsOpen(false);
          handleModalDismiss(meta);
        }}
        onUpdateSettings={(next) => {
          setSettings(next);
          void saveSettings(next);
        }}
        onRestoreArchived={(archiveId) => {
          void runCmd({ type: 'restoreArchived', windowId, spaceId: activeSpace.id, archiveId });
          showToast(t('sidebar.toast.archiveRestored'));
        }}
        onRemoveArchived={(archiveId) => void runCmd({ type: 'removeArchived', archiveId })}
        onClearArchive={() => {
          void runCmd({ type: 'clearArchive' });
          showToast(t('sidebar.toast.archiveCleared'));
        }}
        onConfirmImport={async (data: ImportedSidebar) => {
          await runCmd({ type: 'importArc', windowId, data });
          showToast(t('sidebar.toast.arcImported'));
        }}
      />
    </div>
  );
}
