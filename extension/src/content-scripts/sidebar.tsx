import { QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  useCreatePinnedFolder,
  useExportSpaceBookmarks,
  useImportSpaceBookmarks,
} from '@/hooks/use-spaces-query';
import { queryClient } from '@/lib/query-client';
import { useSpacesSync } from '@/lib/useSpacesSync';
import type { TabEntry } from '@/shared/types';
import { useSpacesStore } from '@/store';
import { ArchiveManager } from '@/ui/components/ArchiveManager';
import { EnhancedTabList } from '@/ui/components/EnhancedTabList';
import { PinnedItemList } from '@/ui/components/PinnedItems';
import { SettingsPanel } from '@/ui/components/SettingsPanel';
import { SpaceManager } from '@/ui/components/SpaceManager';
import { TabContextMenu } from '@/ui/components/TabContextMenu';

function SidebarAppContent() {
  const [activeTab, setActiveTab] = useState<'spaces' | 'archive' | 'settings'>('spaces');
  const [isCollapsed, setIsCollapsed] = useState(false);
  useSpacesSync();

  const spaces = useSpacesStore((state) => state.spaces);
  const activeSpaceId = useSpacesStore((state) => state.activeSpaceId);
  const activeSpace = useMemo(
    () => spaces.find((space) => space.id === activeSpaceId) ?? null,
    [spaces, activeSpaceId]
  );
  const { mutate: createPinnedFolder } = useCreatePinnedFolder();
  const { mutateAsync: exportBookmarks } = useExportSpaceBookmarks();
  const { mutate: importBookmarks } = useImportSpaceBookmarks();

  const [contextMenu, setContextMenu] = useState<{
    tab: TabEntry;
    x: number;
    y: number;
  } | null>(null);

  // Pinned context menu is now handled by PinnedItemContextMenu (Radix UI)

  if (isCollapsed) {
    return (
      <div className="w-8 h-full bg-surface border-r border-white/10 flex flex-col items-center py-2">
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="p-1 text-slate-400 hover:text-white transition-colors"
          title="Expand Arcline"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            role="img"
            aria-hidden="true"
          >
            <title>Expand sidebar</title>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 h-full bg-surface border-r border-white/10 flex flex-col text-slate-100">
      <header className="flex items-center justify-between border-b border-white/10 px-3 py-2 flex-shrink-0">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Arcline</p>
          <h1 className="text-sm font-semibold text-white">Spaces</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md bg-white/10 px-2 py-1 text-xs text-slate-200 transition hover:bg-white/20"
            onClick={() => setIsCollapsed(true)}
            title="Collapse sidebar"
          >
            ←
          </button>
        </div>
      </header>

      <div className="flex border-b border-white/10 flex-shrink-0">
        {(['spaces', 'archive', 'settings'] as const).map((tab) => (
          <button
            type="button"
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-2 py-1 text-xs font-medium transition-colors ${
              activeTab === tab ? 'text-white bg-white/10' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'spaces' && (
          <div className="space-y-3">
            <SpaceManager variant="floating" />

            {activeSpace && (
              <div className="space-y-2">
                <div>
                  <div className="px-3 py-2 flex items-center justify-between group">
                    <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Pinned ({activeSpace.pinnedItems.length})
                    </h3>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10"
                        title="New Folder"
                        onClick={() => {
                          const title = prompt('Folder Name:');
                          if (title) createPinnedFolder({ spaceName: activeSpace.name, title });
                        }}
                      >
                        <svg
                          aria-hidden="true"
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10"
                        title="Import Bookmarks"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = '.html';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              if (typeof evt.target?.result === 'string') {
                                importBookmarks({
                                  spaceName: activeSpace.name,
                                  htmlContent: evt.target.result,
                                });
                              }
                            };
                            reader.readAsText(file);
                          };
                          input.click();
                        }}
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <title>Import Bookmarks</title>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10"
                        title="Export Bookmarks"
                        onClick={async () => {
                          const html = await exportBookmarks(activeSpace.name);
                          const blob = new Blob([html], { type: 'text/html' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${activeSpace.name}_bookmarks.html`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <title>Export Bookmarks</title>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <PinnedItemList items={activeSpace.pinnedItems} spaceName={activeSpace.name} />
                </div>
                <EnhancedTabList
                  tabs={activeSpace.temporaryTabs}
                  title="Temporary"
                  emptyMessage="No temporary tabs"
                  variant="floating"
                  onTabContextMenu={(tab, event) => {
                    const rect = (event.target as HTMLElement).getBoundingClientRect();
                    setContextMenu({
                      tab,
                      x: rect.left,
                      y: rect.top,
                    });
                  }}
                />
              </div>
            )}

            {!activeSpace && (
              <div className="px-3 py-6 text-center text-xs text-slate-500">
                No spaces available. Create a space to get started.
              </div>
            )}
          </div>
        )}

        {activeTab === 'archive' && <ArchiveManager variant="floating" />}

        {activeTab === 'settings' && <SettingsPanel variant="floating" />}
      </div>

      <footer className="border-t border-white/10 px-3 py-1 text-[10px] text-slate-400 text-center flex-shrink-0">
        Content Script Sidebar • Press Ctrl+E to toggle
      </footer>

      {contextMenu && (
        <TabContextMenu
          tab={contextMenu.tab}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

function SidebarApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <SidebarAppContent />
    </QueryClientProvider>
  );
}

// Sidebar injection and management
export class SidebarManager {
  private container: HTMLDivElement | null = null;
  private root: Root | null = null;
  private isVisible = false;
  private isInitialized = false;

  private ensureInitialized() {
    if (this.isInitialized) return;

    // Create shadow DOM container
    this.container = document.createElement('div');
    this.container.id = 'arcline-sidebar-container';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      height: 100vh;
      z-index: 2147483647;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
    `;

    // Create shadow root
    const shadowRoot = this.container.attachShadow({ mode: 'closed' });

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
        font-family: system-ui, -apple-system, sans-serif;
      }
    `;
    shadowRoot.appendChild(style);

    // Create React root container
    const reactContainer = document.createElement('div');
    reactContainer.id = 'arcline-sidebar-root';
    shadowRoot.appendChild(reactContainer);

    // Inject Tailwind styles
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('assets/index.css');
    shadowRoot.appendChild(link);

    document.body.appendChild(this.container);

    // Create React root
    this.root = createRoot(reactContainer);
    this.isInitialized = true;
  }

  show() {
    if (this.isVisible) return;

    this.ensureInitialized();

    if (!this.root) return;

    this.root.render(<SidebarApp />);
    this.isVisible = true;

    // Adjust page layout to accommodate sidebar
    document.body.style.marginLeft = '320px';
    document.body.style.transition = 'margin-left 0.3s ease';
  }

  hide() {
    if (!this.isVisible) return;

    // Clear React content
    if (this.root) {
      this.root.render(null);
    }

    this.isVisible = false;

    // Restore page layout
    document.body.style.marginLeft = '';
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  destroy() {
    this.hide();
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.root = null;
    this.isInitialized = false;
  }
}

// Global sidebar instance
let sidebarManager: SidebarManager | null = null;

// Initialize sidebar
export function initializeSidebar() {
  destroySidebar();
  sidebarManager = new SidebarManager();
}

export function destroySidebar() {
  if (!sidebarManager) {
    return;
  }
  sidebarManager.destroy();
  sidebarManager = null;
}

// Export for use in content scripts
export function getSidebarManager(): SidebarManager | null {
  return sidebarManager;
}
