import { Command } from 'cmdk';
import {
  Archive,
  Bookmark,
  Clipboard,
  Folder,
  Globe,
  History,
  Layout,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useDebounce } from '@/hooks/use-debounce';
import { useServiceWorkerBridge } from '@/hooks/use-service-worker-bridge';
import { useUniversalSearch } from '@/hooks/use-universal-search';
import { useCommands, type CommandAction } from '@/hooks/use-commands';
import { getSpaceAccentVariants } from '@/lib/space-theme';
import type { SearchResult } from '@/shared/types';
import { useSpacesStore } from '@/store';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateSpace?: () => void;
  onOpenSettings?: () => void;
  onOpenArchive?: () => void;
}

const CommandIcon = ({ icon }: { icon: CommandAction['icon'] }) => {
  const iconMap = {
    plus: Plus,
    folder: Folder,
    pin: Pin,
    close: X,
    refresh: RefreshCw,
    settings: Settings,
    archive: Archive,
    copy: Clipboard,
    terminal: Settings,
  };
  const IconComponent = iconMap[icon] || Settings;
  return <IconComponent className="h-4 w-4" />;
};

export function CommandPalette({
  isOpen,
  onClose,
  onCreateSpace,
  onOpenSettings,
  onOpenArchive,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 150);
  const { results, isLoading } = useUniversalSearch(debouncedQuery, isOpen);
  const bridge = useServiceWorkerBridge();
  const spaces = useSpacesStore((state) => state.spaces);
  const activeSpaceId = useSpacesStore((state) => state.activeSpaceId);

  // Get active space color for dynamic accent theming
  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const accentColors = useMemo(
    () => getSpaceAccentVariants(activeSpace?.themeColor || activeSpace?.color),
    [activeSpace?.themeColor, activeSpace?.color]
  );

  // Command actions
  const commandActions = useMemo(
    () => ({
      createSpace: async () => {
        onClose();
        onCreateSpace?.();
      },
      activateSpace: async (spaceUuidOrId: string | number) => {
        if (!bridge) return;
        onClose();
        if (typeof spaceUuidOrId === 'number') {
          await bridge.setActiveSpace(spaceUuidOrId);
        } else {
          // For UUID-based activation, we need to use the space's ID
          const space = spaces.find((s) => s.uuid === spaceUuidOrId);
          if (space) {
            await bridge.setActiveSpace(space.id);
          }
        }
      },
      pinCurrentTab: async () => {
        if (!bridge) return;
        onClose();
        const activeTab = await bridge.getActiveTab();
        if (activeTab?.id) {
          await bridge.toggleTabPinned(activeTab.id, true);
        }
      },
      closeCurrentTab: async () => {
        onClose();
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) await chrome.tabs.remove(tab.id);
      },
      reloadCurrentTab: async () => {
        onClose();
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) await chrome.tabs.reload(tab.id);
      },
      openSettings: () => {
        onClose();
        onOpenSettings?.();
      },
      openArchive: () => {
        onClose();
        onOpenArchive?.();
      },
      copyCurrentUrl: async () => {
        onClose();
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url) {
          await navigator.clipboard.writeText(tab.url);
        }
      },
    }),
    [bridge, onClose, onCreateSpace, onOpenSettings, onOpenArchive, spaces]
  );

  const commands = useCommands(debouncedQuery, spaces, commandActions);

  // Reset query when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      // Force focus after a short delay to ensure visibility
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelectResult = useCallback(
    async (item: SearchResult) => {
      if (!bridge) return;
      onClose();

      try {
        if (item.type === 'tab') {
          const tabId = parseInt(item.id, 10);
          if (Number.isNaN(tabId)) {
            if (item.url) await bridge.openUrlInTab(item.url);
          } else {
            await bridge.activateTab(tabId);
          }
        } else if (item.url) {
          await bridge.openUrlInTab(item.url);
        }
      } catch (error) {
        console.error('Failed to navigate:', error);
      }
    },
    [bridge, onClose]
  );

  const handleSelectCommand = useCallback(async (cmd: CommandAction) => {
    try {
      await cmd.execute();
    } catch (error) {
      console.error('Failed to execute command:', error);
    }
  }, []);

  if (!isOpen) return null;

  const hasSearchResults = results.length > 0;
  const hasCommands = commands.length > 0;
  const showNoResults = !isLoading && !hasSearchResults && !hasCommands && query;
  const showEmptyPrompt = !isLoading && !hasSearchResults && !hasCommands && !query;

  return (
    // Backdrop - full screen overlay with subtle blur
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center"
      style={{ paddingTop: '35vh' }}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      {/* Spotlight Container - Arcify style */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command Menu"
        className="w-[650px] max-w-[90vw] overflow-hidden rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        style={{
          background: '#2D2D2D',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          e.stopPropagation();
        }}
      >
        <Command label="Command Menu" shouldFilter={false}>
          {/* Input Section - Arcify style */}
          <div
            className="flex items-center px-5 py-3"
            style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}
          >
            <Search className="mr-3 h-5 w-5 shrink-0 opacity-60 text-white" />
            <Command.Input
              ref={inputRef}
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search or enter URL..."
              className="flex-1 bg-transparent py-2 text-lg text-white placeholder:text-white/50 outline-none"
              style={{
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                fontWeight: 400,
                fontSize: '18px',
                lineHeight: '24px',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onClose();
                }
              }}
            />
          </div>

          {/* Results Section - Arcify style */}
          <Command.List
            className="max-h-[270px] overflow-y-auto py-2"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {isLoading && (
              <Command.Loading className="flex items-center justify-center py-6 text-white/60 text-sm">
                Loading...
              </Command.Loading>
            )}

            {showEmptyPrompt && (
              <div className="flex items-center justify-center py-6 text-white/60 text-sm">
                Start typing to search tabs, bookmarks, and history
              </div>
            )}

            {showNoResults && (
              <div className="flex items-center justify-center py-6 text-white/60 text-sm">
                No results found
              </div>
            )}

            {/* Commands Section */}
            {hasCommands && (
              <Command.Group>
                {commands.map((cmd) => (
                  <Command.Item
                    key={cmd.id}
                    onSelect={() => handleSelectCommand(cmd)}
                    className="flex items-center cursor-pointer transition-colors duration-150 px-5 py-3"
                    style={{ minHeight: '44px' }}
                  >
                    <div
                      className="flex h-5 w-5 items-center justify-center rounded mr-3 shrink-0"
                      style={{ color: accentColors.accent80 }}
                    >
                      <CommandIcon icon={cmd.icon} />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span
                        className="truncate text-white"
                        style={{ fontSize: '14px', fontWeight: 500 }}
                      >
                        {cmd.title}
                      </span>
                      {cmd.description && (
                        <span
                          className="truncate text-white/60"
                          style={{ fontSize: '12px', marginTop: '2px' }}
                        >
                          {cmd.description}
                        </span>
                      )}
                    </div>
                    <span
                      className="shrink-0 ml-3"
                      style={{ fontSize: '12px', color: accentColors.accent80 }}
                    >
                      Action
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Search Results Section */}
            {hasSearchResults && (
              <Command.Group>
                {results.map((item) => (
                  <Command.Item
                    key={`${item.type}-${item.id}`}
                    onSelect={() => handleSelectResult(item)}
                    className="flex items-center cursor-pointer transition-colors duration-150 px-5 py-3"
                    style={{ minHeight: '44px' }}
                  >
                    {/* Favicon/Icon */}
                    <div className="flex h-5 w-5 items-center justify-center rounded mr-3 shrink-0 text-white/60">
                      {item.type === 'tab' && <Layout className="h-4 w-4" />}
                      {item.type === 'bookmark' && <Bookmark className="h-4 w-4" />}
                      {item.type === 'history' && <History className="h-4 w-4" />}
                      {item.type === 'space' && <Globe className="h-4 w-4" />}
                    </div>
                    {/* Content */}
                    <div className="flex flex-col min-w-0 flex-1" style={{ minHeight: '32px' }}>
                      <span
                        className="truncate text-white"
                        style={{ fontSize: '14px', fontWeight: 500 }}
                      >
                        {item.title}
                      </span>
                      <span className="truncate text-white/60" style={{ fontSize: '12px' }}>
                        {item.description || item.url}
                      </span>
                    </div>
                    {/* Action indicator */}
                    <span
                      className="shrink-0 ml-3"
                      style={{ fontSize: '12px', color: accentColors.accent80 }}
                    >
                      {item.type === 'tab' ? 'Switch' : 'Open'}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>

      {/* Custom styles for cmdk item selection - dynamic based on active space color */}
      <style>{`
        [cmdk-item][data-selected="true"] {
          background: ${accentColors.accent20} !important;
        }
        [cmdk-item]:hover {
          background: ${accentColors.accent15} !important;
        }
        [cmdk-list]::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
