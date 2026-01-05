# Arcline Sync Architecture

This document describes the synchronization architecture between Chrome Bookmarks, IndexedDB (Dexie), and FlexSearch in Arcline.

## Overview

Arcline uses a multi-layer data architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                   Chrome Bookmarks API                          │
│                 (Source of Truth - Persistent)                  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ sync.ts (onCreated/Changed/Removed/Moved)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   IndexedDB (Dexie.js)                          │
│                    (Local Cache - Fast)                         │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ searchService.buildIndex()
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FlexSearch Index                              │
│                 (Full-Text Search - Fast)                       │
└─────────────────────────────────────────────────────────────────┘
```

## Bookmark Structure

Arcline stores data in Chrome Bookmarks with the following hierarchy:

```
📚 Bookmarks Bar
└── 📁 Arcline                          ← Root Folder
    ├── 📁 Work                         ← Space 1
    │   ├── 🔖 GitHub - https://github.com
    │   ├── 🔖 Notion - https://notion.so
    │   └── 📁 Design Resources         ← Subfolder
    │       └── 🔖 Figma - https://figma.com
    ├── 📁 Personal                     ← Space 2
    │   └── 🔖 Netflix - https://netflix.com
    └── 📁 Research                     ← Space 3
        └── 🔖 arXiv - https://arxiv.org
```

**Key Mapping:**
- **Space** = Arcline folder's direct child folder
- **Pinned Tab** = Bookmark inside a Space folder
- **Folder** = Subfolder inside a Space folder

## Data Flow

### 1. Pinning a Tab (Arcline UI)

```
User Action: Drag tab to "Pinned" area
     │
     ▼
Content Script: onDrop event
     │
     ▼
ServiceWorkerBridge.createPinnedTab(spaceName, title, url)
     │
     ▼ chrome.runtime.sendMessage
Background Script: commandHandlers.createPinnedTab
     │
     ▼
bookmarks.ts: createPinnedTab()
  1. getOrCreateSpaceFolder(spaceName)
  2. chrome.bookmarks.create({ parentId, title, url })
     │
     ▼ chrome.bookmarks.onCreated
sync.ts: handleBookmarkCreated()
  1. Find parent in db.spaces or db.items
  2. db.items.add(newItem)
  3. searchService.updateItem(item)
```

### 2. Native Bookmark Addition (Chrome UI)

```
User Action: Ctrl+D → Save to Arcline/Work
     │
     ▼
Chrome Bookmarks API: Internal creation
     │
     ▼ chrome.bookmarks.onCreated
sync.ts: handleBookmarkCreated()
  1. Check if parent is an Arcline space
  2. Add to IndexedDB if in scope
  3. Update FlexSearch index
     │
     ▼ (Next getSpacesSnapshot call)
browser.ts: getSpacesSnapshot()
  1. Read from Chrome Bookmarks
  2. Display in UI
```

### 3. Unpinning a Tab

```
User Action: Click "Unpin" button
     │
     ▼
removePinnedItem(itemId)
     │
     ▼
chrome.bookmarks.remove(itemId)
     │
     ▼ chrome.bookmarks.onRemoved
sync.ts: handleBookmarkRemoved()
  1. Find in db.items or db.spaces
  2. Delete from IndexedDB
  3. Remove from FlexSearch index
```

## Sync Scenarios Analysis

### ✅ Working Correctly

| Scenario | Behavior | Risk |
|----------|----------|------|
| Fresh Install | Skips sync if no Arcline folder exists | None |
| Extension Update | Full resync on `onInstalled` | None |
| Browser Restart | Full resync on `onStartup` | None |
| Multiple Windows | Single Background Script handles all events | None |
| Basic Pin/Unpin | Events properly handled | None |
| Subfolders | Recursive sync and search | None |

### ⚠️ Edge Cases

| Scenario | Issue | Mitigation |
|----------|-------|------------|
| Chrome Sync (Multi-device) | Event timing unpredictable | Next startup triggers full resync |
| Large Bookmark Collection | Startup may be slower | Async operation, non-blocking |
| Rapid Operations | Race conditions possible | Eventually consistent |

### 🔧 Fixed Issues (v1.1)

| Issue | Description | Fix |
|-------|-------------|-----|
| Space Creation Not Synced | New space folders weren't added to IndexedDB | Added Arcline root folder detection |
| Space Deletion Not Synced | Deleted spaces remained as ghost data | Added space-level handling in onRemoved |
| Space Rename Not Synced | Renamed spaces kept old name in IndexedDB | Added space-level handling in onChanged |

## Key Design Decisions

### 1. Chrome Bookmarks as Source of Truth

**Rationale:**
- Persistent across browser reinstalls
- Chrome Sync provides multi-device support
- Users can manage via native Chrome UI
- No data loss if extension is removed

### 2. IndexedDB as Search Cache

**Rationale:**
- Fast local queries
- Structured data storage
- Supports complex indexes
- Independent of Chrome API rate limits

### 3. Full Resync on Startup

**Rationale:**
- Guarantees consistency
- Simple recovery from edge cases
- No incremental sync complexity

**Trade-off:**
- Startup may be slower with large datasets
- Acceptable for typical usage (< 1000 bookmarks)

## Files Reference

| File | Purpose |
|------|---------|
| `bookmarks.ts` | Chrome Bookmarks API wrapper, CRUD operations |
| `browser.ts` | Space snapshots, tab operations |
| `sync.ts` | Chrome Bookmarks ↔ IndexedDB synchronization |
| `search.ts` | FlexSearch index management |
| `db/schema.ts` | Dexie database schema |

## Future Improvements

1. **Incremental Sync**: Track changes instead of full resync
2. **Conflict Resolution**: Handle Chrome Sync conflicts
3. **Background Refresh**: Periodic resync without restart
4. **Performance Monitoring**: Track sync duration for large datasets
