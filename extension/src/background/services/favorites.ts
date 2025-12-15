/// <reference types="chrome" />

import type { TabEntry } from '@/shared/types';

// Favorites storage key
const FAVORITES_STORAGE_KEY = 'arclineFavorites';

export interface FavoriteTab {
  url: string;
  title: string;
  favIconUrl?: string;
  addedAt: number;
}

/**
 * Get all favorite tabs from storage
 */
export async function getFavorites(): Promise<FavoriteTab[]> {
  try {
    const result = await chrome.storage.local.get(FAVORITES_STORAGE_KEY);
    return result[FAVORITES_STORAGE_KEY] || [];
  } catch (error) {
    console.error('[Arcline] Failed to get favorites:', error);
    return [];
  }
}

/**
 * Save favorites to storage
 */
async function saveFavorites(favorites: FavoriteTab[]): Promise<void> {
  try {
    await chrome.storage.local.set({ [FAVORITES_STORAGE_KEY]: favorites });
  } catch (error) {
    console.error('[Arcline] Failed to save favorites:', error);
  }
}

/**
 * Add a tab to favorites
 */
export async function addToFavorites(tab: TabEntry): Promise<void> {
  if (!tab.id || !tab.url) return;

  const favorites = await getFavorites();

  // Check if already in favorites
  const exists = favorites.some((fav) => fav.url === tab.url);
  if (exists) {
    console.log('[Arcline] Tab already in favorites:', tab.url);
    return;
  }

  const newFavorite: FavoriteTab = {
    url: tab.url,
    title: tab.title || 'Untitled',
    favIconUrl: tab.favIconUrl,
    addedAt: Date.now(),
  };

  favorites.push(newFavorite);
  await saveFavorites(favorites);

  console.log('[Arcline] Added to favorites:', tab.title);
}

/**
 * Remove a tab from favorites by URL
 */
export async function removeFromFavorites(url: string): Promise<void> {
  if (!url) return;

  const favorites = await getFavorites();
  const filtered = favorites.filter((fav) => fav.url !== url);

  if (filtered.length !== favorites.length) {
    await saveFavorites(filtered);
    console.log('[Arcline] Removed from favorites:', url);
  }
}

/**
 * Check if a URL is in favorites
 */
export async function isInFavorites(url: string): Promise<boolean> {
  if (!url) return false;

  const favorites = await getFavorites();
  return favorites.some((fav) => fav.url === url);
}

/**
 * Toggle favorite status for a tab
 */
export async function toggleFavorite(tab: TabEntry): Promise<boolean> {
  if (!tab.url) return false;

  const isFavorite = await isInFavorites(tab.url);

  if (isFavorite) {
    await removeFromFavorites(tab.url);
    return false;
  } else {
    await addToFavorites(tab);
    return true;
  }
}

/**
 * Reorder favorites
 */
export async function reorderFavorites(favorites: FavoriteTab[]): Promise<void> {
  await saveFavorites(favorites);
  console.log('[Arcline] Favorites reordered');
}
