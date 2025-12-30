import { ChevronDown, ChevronRight, FileText, Folder, Globe } from 'lucide-react';
import { useState } from 'react';

import type { ImportedBookmark, ImportResult } from '@/lib/bookmark-import';

interface BookmarkImportPreviewProps {
  result: ImportResult;
  onConfirm: (selectedBookmarks: ImportedBookmark[]) => void;
  onCancel: () => void;
}

const hasChildren = (
  item: ImportedBookmark
): item is ImportedBookmark & { children: ImportedBookmark[] } =>
  item.isFolder === true && Array.isArray(item.children);

const walkBookmarks = (
  items: ImportedBookmark[],
  basePath: string,
  onItem: (item: ImportedBookmark, path: string) => void
) => {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    const path = `${basePath}/${i}`;
    onItem(item, path);
    if (hasChildren(item)) {
      walkBookmarks(item.children, path, onItem);
    }
  }
};

const collectSelectedBookmarks = (
  items: ImportedBookmark[],
  basePath: string,
  selectedItems: Set<string>
): ImportedBookmark[] => {
  const selected: ImportedBookmark[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    const path = `${basePath}/${i}`;
    if (!selectedItems.has(path)) continue;

    if (hasChildren(item)) {
      const children = collectSelectedBookmarks(item.children, path, selectedItems);
      selected.push({ ...item, children });
      continue;
    }

    selected.push(item);
  }
  return selected;
};

export function BookmarkImportPreview({ result, onConfirm, onCancel }: BookmarkImportPreviewProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const toggleSelection = (path: string, item: ImportedBookmark) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
        if (item.isFolder && item.children) {
          removeChildrenFromSelection(next, item.children, path);
        }
      } else {
        next.add(path);
        if (item.isFolder && item.children) {
          addChildrenToSelection(next, item.children, path);
        }
      }
      return next;
    });
  };

  const addChildrenToSelection = (
    selection: Set<string>,
    children: ImportedBookmark[],
    parentPath: string
  ) => {
    walkBookmarks(children, parentPath, (_child, childPath) => {
      selection.add(childPath);
    });
  };

  const removeChildrenFromSelection = (
    selection: Set<string>,
    children: ImportedBookmark[],
    parentPath: string
  ) => {
    walkBookmarks(children, parentPath, (_child, childPath) => {
      selection.delete(childPath);
    });
  };

  const selectAll = () => {
    const allPaths = new Set<string>();
    walkBookmarks(result.bookmarks, '', (_item, path) => {
      allPaths.add(path);
    });
    setSelectedItems(allPaths);
  };

  const selectNone = () => {
    setSelectedItems(new Set());
  };

  const getSelectedBookmarks = (): ImportedBookmark[] => {
    return collectSelectedBookmarks(result.bookmarks, '', selectedItems);
  };

  const handleConfirm = () => {
    const selected = getSelectedBookmarks();
    onConfirm(selected);
  };

  const renderBookmarkItem = (item: ImportedBookmark, path: string, depth: number) => {
    const isSelected = selectedItems.has(path);
    const isExpanded = expandedFolders.has(path);

    return (
      <div key={path}>
        <div
          className={`flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors ${
            isSelected ? 'bg-primary/20' : 'hover:bg-slate-700/50'
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => toggleSelection(path, item)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleSelection(path, item);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelection(path, item)}
            className="h-4 w-4 rounded border-slate-500 bg-slate-700 text-primary focus:ring-primary"
            onClick={(e) => e.stopPropagation()}
          />

          {item.isFolder ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(path);
              }}
              className="p-0.5 hover:bg-slate-600 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-400" />
              )}
            </button>
          ) : (
            <div className="w-5" />
          )}

          {item.isFolder ? (
            <Folder className="h-4 w-4 text-yellow-500" />
          ) : (
            <Globe className="h-4 w-4 text-slate-400" />
          )}

          <span className="text-sm text-slate-200 truncate flex-1">{item.title}</span>

          {!item.isFolder && item.url && (
            <span className="text-xs text-slate-500 truncate max-w-[200px]">{item.url}</span>
          )}

          {item.isFolder && item.children && (
            <span className="text-xs text-slate-500">{item.children.length} items</span>
          )}
        </div>

        {item.isFolder && item.children && isExpanded && (
          <div>
            {item.children.map((child, index) =>
              renderBookmarkItem(child, `${path}/${index}`, depth + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  const sourceLabel =
    result.source === 'arc-json' ? 'Arc Browser' : result.source === 'html' ? 'HTML' : 'Unknown';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">Import Preview</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-slate-400 hover:text-white transition-colors"
        >
          Back
        </button>
      </div>

      <div className="flex items-center gap-4 rounded-lg bg-slate-800/50 p-3">
        <FileText className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-medium text-white">
            {result.stats.totalItems} items found ({sourceLabel} format)
          </p>
          <p className="text-xs text-slate-400">
            {result.stats.folders} folders, {result.stats.bookmarks} bookmarks
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs text-primary hover:text-primary/80 transition-colors"
          >
            Select All
          </button>
          <span className="text-slate-600">|</span>
          <button
            type="button"
            onClick={selectNone}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Select None
          </button>
        </div>
      </div>

      <div className="max-h-[400px] overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/30">
        {result.bookmarks.map((item, index) => renderBookmarkItem(item, `/${index}`, 0))}
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={selectedItems.size === 0}
          className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Import {selectedItems.size > 0 ? `(${selectedItems.size})` : ''}
        </button>
      </div>
    </div>
  );
}
