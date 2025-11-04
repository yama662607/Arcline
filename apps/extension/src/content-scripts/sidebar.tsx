import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useSpacesSync } from '@/lib/useSpacesSync';
import { SpaceManager } from '@/ui/components/SpaceManager';
import { EnhancedTabList } from '@/ui/components/EnhancedTabList';
import { ArchiveManager } from '@/ui/components/ArchiveManager';
import { SettingsPanel } from '@/ui/components/SettingsPanel';
import { TabContextMenu } from '@/ui/components/TabContextMenu';
import { useSpacesStore } from '@/store';
import type { TabEntry } from '@/shared/types';
import { queryClient } from '@/lib/query-client';

function SidebarApp() {
  const [activeTab, setActiveTab] = useState<'spaces' | 'archive' | 'settings'>('spaces');
  const [isCollapsed, setIsCollapsed] = useState(false);
  useSpacesSync();

  const spaces = useSpacesStore((state) => state.spaces);
  const activeSpaceId = useSpacesStore((state) => state.activeSpaceId);
  const activeSpace = useMemo(
    () => spaces.find((space) => space.id === activeSpaceId) ?? null,
    [spaces, activeSpaceId]
  );
  const [contextMenu, setContextMenu] = useState<{
    tab: TabEntry;
    x: number;
    y: number;
  } | null>(null);

  if (isCollapsed) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="w-8 h-full bg-surface border-r border-white/10 flex flex-col items-center py-2">
          <button
            onClick={() => setIsCollapsed(false)}
            className="p-1 text-slate-400 hover:text-white transition-colors"
            title="Expand Arcline"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
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
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-2 py-1 text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'text-white bg-white/10'
                  : 'text-slate-400 hover:text-slate-300'
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
                  <EnhancedTabList
                    tabs={activeSpace.pinnedTabs}
                    title="Pinned"
                    emptyMessage="No pinned tabs"
                    variant="floating"
                    onTabContextMenu={(tab, event) => {
                      const rect = (event.target as HTMLElement).getBoundingClientRect();
                      setContextMenu({ 
                        tab, 
                        x: rect.left, 
                        y: rect.top 
                      });
                    }}
                  />
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
                        y: rect.top 
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

          {activeTab === 'archive' && (
            <ArchiveManager variant="floating" />
          )}

          {activeTab === 'settings' && (
            <SettingsPanel variant="floating" />
          )}
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
    </QueryClientProvider>
  );
}

// Sidebar injection and management
export class SidebarManager {
  private container: HTMLDivElement | null = null;
  private root: any = null;
  private isVisible = false;

  constructor() {
    this.createContainer();
  }

  private createContainer() {
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
  }

  show() {
    if (!this.root || this.isVisible) return;
    
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
  }
}

// Global sidebar instance
let sidebarManager: SidebarManager | null = null;

// Initialize sidebar
export function initializeSidebar() {
  if (sidebarManager) {
    sidebarManager.destroy();
  }
  sidebarManager = new SidebarManager();
}

// Export for use in content scripts
export function getSidebarManager(): SidebarManager | null {
  return sidebarManager;
}
