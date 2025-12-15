import { useState } from 'react';

import { useArchivedTabs, useRestoreArchivedTab } from '@/hooks/use-spaces-query';
import type { ArchivedTab } from '@/shared/types';

interface ArchiveManagerProps {
  variant?: 'standalone' | 'floating';
}

export function ArchiveManager({ variant = 'standalone' }: ArchiveManagerProps) {
  const [selectedTab, setSelectedTab] = useState<ArchivedTab | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: archivedTabs = [] } = useArchivedTabs();
  const restoreTabMutation = useRestoreArchivedTab();

  // Filter archived tabs based on search
  const filteredTabs = archivedTabs.filter(
    (tab) =>
      tab.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tab.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tab.spaceName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort by archived date (newest first)
  const sortedTabs = filteredTabs.sort((a, b) => b.archivedAt - a.archivedAt);

  const handleRestoreTab = async (tab: ArchivedTab) => {
    try {
      await restoreTabMutation.mutateAsync(tab);
      setSelectedTab(null);
    } catch (error) {
      console.error('Failed to restore tab:', error);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    } catch {
      return undefined;
    }
  };

  if (variant === 'floating') {
    return (
      <div className="space-y-2">
        <div className="px-3 py-2">
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Archive ({sortedTabs.length})
          </h3>
        </div>

        {sortedTabs.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-slate-500">No archived tabs</div>
        ) : (
          <>
            <div className="px-3 py-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search archived tabs..."
                className="w-full px-2 py-1 text-xs bg-surface-light rounded border border-surface-light focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1 max-h-64 overflow-y-auto">
              {sortedTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleRestoreTab(tab)}
                  className="flex items-center gap-2 px-3 py-2 rounded hover:bg-surface-light cursor-pointer transition-colors group w-full text-left"
                >
                  <img
                    src={getFaviconUrl(tab.url)}
                    alt=""
                    className="w-3 h-3 rounded flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-200 truncate">{tab.title}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {new URL(tab.url).hostname}
                    </div>
                    <div className="text-xs text-slate-600">
                      {tab.spaceName} • {formatDate(tab.archivedAt)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRestoreTab(tab);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-blue-400 hover:text-blue-300"
                    title="Restore tab"
                  >
                    ↵
                  </button>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium text-white">Archive ({sortedTabs.length})</h2>
      </div>

      {sortedTabs.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          No archived tabs. Tabs you archive will appear here for easy restoration.
        </div>
      ) : (
        <>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search archived tabs by title, URL, or space..."
              className="w-full px-4 py-2 bg-surface-light border border-surface-light rounded focus:outline-none focus:border-blue-500 text-white placeholder-slate-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                ×
              </button>
            )}
          </div>

          <div className="grid gap-2">
            {sortedTabs.map((tab) => (
              <div
                key={tab.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-surface-light bg-surface/50 hover:bg-surface transition-all group"
              >
                <img
                  src={getFaviconUrl(tab.url)}
                  alt=""
                  className="w-4 h-4 rounded flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    const placeholder = e.target as HTMLImageElement;
                    placeholder.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden w-4 h-4 bg-surface-light rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-slate-400">🌐</span>
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white truncate">{tab.title}</h3>
                  <p className="text-sm text-slate-400 truncate">{tab.url}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="px-2 py-1 bg-surface-light rounded">{tab.spaceName}</span>
                    <span>Archived {formatDate(tab.archivedAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => setSelectedTab(tab)}
                    className="px-3 py-1 text-sm bg-surface-light text-slate-300 rounded hover:bg-surface"
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRestoreTab(tab)}
                    disabled={restoreTabMutation.isPending}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {restoreTabMutation.isPending ? 'Restoring...' : 'Restore'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {selectedTab && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface p-6 rounded-lg border border-surface-light max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-medium text-white">Archived Tab Details</h3>
              <button
                type="button"
                onClick={() => setSelectedTab(null)}
                className="text-slate-500 hover:text-slate-300"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="block text-sm font-medium text-slate-300 mb-1">Title</div>
                <p className="text-white">{selectedTab.title}</p>
              </div>

              <div>
                <div className="block text-sm font-medium text-slate-300 mb-1">URL</div>
                <p className="text-slate-300 break-all">{selectedTab.url}</p>
              </div>

              <div>
                <div className="block text-sm font-medium text-slate-300 mb-1">Space</div>
                <p className="text-white">{selectedTab.spaceName}</p>
              </div>

              <div>
                <div className="block text-sm font-medium text-slate-300 mb-1">Archived</div>
                <p className="text-white">{formatDate(selectedTab.archivedAt)}</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    handleRestoreTab(selectedTab);
                    setSelectedTab(null);
                  }}
                  disabled={restoreTabMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {restoreTabMutation.isPending ? 'Restoring...' : 'Restore Tab'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTab(null)}
                  className="flex-1 px-4 py-2 bg-surface-light text-slate-300 rounded hover:bg-surface"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
