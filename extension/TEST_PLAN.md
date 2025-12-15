# Arcline Test Plan

This document tracks the testing coverage for the Arcline extension. The goal is to achieve 100% feature coverage with robust automated tests.

## 1. Background Services (Core Logic)

| Service | File | Test Status | Priority | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Auto Archive** | `auto-archive.ts` | ✅ Covered | High | Existing `auto-archive.test.ts` |
| **Bookmarks** | `bookmarks.ts` | ✅ Covered | High | Existing `bookmarks.test.ts` |
| **Browser/Tabs** | `browser.ts` | ✅ Covered | Critical | Existing `browser.test.ts` |
| **Favorites** | `favorites.ts` | ✅ Covered | High | Existing `favorites.test.ts` |
| **Gestures** | `gestures.ts` | ✅ Covered | Medium | Existing `gestures.test.ts` |
| **Activate Tab** | `activateTab` | ✅ Covered | Critical | Newly created `activateTab.spec.ts` |
| **Space Navigation** | `space-navigation.ts` | ✅ Covered | Critical | Handles swipe logic & next/prev space calculation. |
| **Spaces Persistence** | `spaces.ts` | ✅ Covered | High | Data integrity for saving SpaceState. |

## 2. UI Components (Frontend)

| Component | File | Test Status | Priority | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **EnhancedTabList** | `EnhancedTabList.tsx` | ✅ Covered | Critical | Core component for tab lists. |
| **FavoritesBar** | `FavoritesBar.tsx` | ✅ Covered | High | |
| **SpaceManager** | `SpaceManager.tsx` | ✅ Covered | High | Space creation/switching. |
| **SettingsPanel** | `SettingsPanel.tsx` | ✅ Covered | Medium | Settings form & persistence. |
| **ArchiveManager** | `ArchiveManager.tsx` | ✅ Covered | Medium | Archive list & restoration. |
| **GlobalPinnedTabs** | `GlobalPinnedTabs.tsx` | ✅ Covered | Medium | Global pins display. |
| **SpacesWorkspace** | `SpacesWorkspace.tsx` | ✅ Covered | High | Main layout integration. |
| **ActiveTabHeader** | `ActiveTabHeader.tsx` | ❌ **MISSING** | Low | Header display logic. |
| **TabContextMenu** | `TabContextMenu.tsx` | ❌ **MISSING** | Low | Context menu interactions. |

## 3. Implementation Plan

**Completed:**
*   ✅ Background Logic (`spaces.ts`, `space-navigation.ts`, `activateTab`)
*   ✅ UI Components (`SettingsPanel`, `ArchiveManager`, `GlobalPinnedTabs`, `SpacesWorkspace`)

**Remaining:**
*   `ActiveTabHeader` (Low Priority)
*   `TabContextMenu` (Low Priority)
