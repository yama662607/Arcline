/**
 * Local wallpaper storage backed by the Background Service Worker's unpartitioned IndexedDB.
 * Routing through the Service Worker guarantees that wallpapers saved from an overlay iframe
 * embedded inside any webpage (e.g. Brave with third-party storage partitioning) are immediately
 * visible in `empty-space.html` and the native Side Panel.
 */
const DB_NAME = 'arcline-wallpapers';
const DB_VERSION = 1;
const STORE_NAME = 'wallpapers';
export const WALLPAPER_VERSION_KEY = 'arcline:wallpaperVersion';
export const GLOBAL_WALLPAPER_KEY = 'global';
export const MAX_WALLPAPER_BYTES = 15 * 1024 * 1024; // 15 MB

export interface WallpaperRecord {
  key: string;
  dataUrl: string;
  name: string;
  mime: string;
  updatedAt: number;
}

export type WallpaperRpcMessage =
  | { op: 'save'; key: string; dataUrl: string; name: string; mime: string }
  | { op: 'remove'; key: string }
  | { op: 'load'; key: string }
  | { op: 'resolve'; spaceId?: string };

export function spaceWallpaperKey(spaceId: string): string {
  return `space:${spaceId}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open wallpaper DB'));
  });
}

async function notifyWallpaperChanged(): Promise<void> {
  try {
    await chrome.storage?.local?.set?.({ [WALLPAPER_VERSION_KEY]: Date.now() });
  } catch {
    // Ignore outside extension context
  }
}

/** Background-only: persists a wallpaper record directly in the SW's unpartitioned IndexedDB. */
export async function swSaveWallpaper(
  key: string,
  dataUrl: string,
  name: string,
  mime: string,
): Promise<void> {
  if (!mime.startsWith('image/') || !dataUrl.startsWith('data:image/')) {
    throw new Error('Only image or GIF files are supported.');
  }
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const record: WallpaperRecord = {
        key,
        dataUrl,
        name: name.slice(0, 120),
        mime,
        updatedAt: Date.now(),
      };
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to save wallpaper'));
    });
  } finally {
    db.close();
  }
  await notifyWallpaperChanged();
}

/** Background-only: removes a wallpaper record from the SW's IndexedDB. */
export async function swRemoveWallpaper(key: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to remove wallpaper'));
    });
  } finally {
    db.close();
  }
  await notifyWallpaperChanged();
}

/** Background-only: loads a wallpaper record by key from the SW's IndexedDB. */
export async function swLoadWallpaper(key: string): Promise<WallpaperRecord | null> {
  try {
    const db = await openDb();
    try {
      return await new Promise<WallpaperRecord | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = () => resolve((req.result as WallpaperRecord | undefined) ?? null);
        req.onerror = () => reject(req.error ?? new Error('Failed to load wallpaper'));
      });
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

/** Background-only: resolves per-Space wallpaper first, falling back to global. */
export async function swResolveWallpaper(spaceId?: string): Promise<WallpaperRecord | null> {
  if (spaceId) {
    const perSpace = await swLoadWallpaper(spaceWallpaperKey(spaceId));
    if (perSpace) return perSpace;
  }
  return swLoadWallpaper(GLOBAL_WALLPAPER_KEY);
}

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to read image file'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

async function sendWallpaperRpc<T>(rpc: WallpaperRpcMessage): Promise<T> {
  const res = (await chrome.runtime.sendMessage({ arclineWallpaper: rpc })) as
    | { ok?: boolean; result?: T; error?: string }
    | undefined;
  if (!res?.ok) {
    throw new Error(res?.error || 'Wallpaper operation failed');
  }
  return res.result as T;
}

export async function saveWallpaper(key: string, file: Blob, name: string): Promise<string> {
  const mime = file.type || (name.toLowerCase().endsWith('.gif') ? 'image/gif' : '');
  if (!mime.startsWith('image/')) {
    throw new Error('Only image or GIF files are supported.');
  }
  if (file.size > MAX_WALLPAPER_BYTES) {
    throw new Error('Wallpaper file is too large (max 15 MB).');
  }
  const dataUrl = await fileToDataUrl(file);
  await sendWallpaperRpc<void>({ op: 'save', key, dataUrl, name, mime });
  return dataUrl;
}

export async function removeWallpaper(key: string): Promise<void> {
  await sendWallpaperRpc<void>({ op: 'remove', key });
}

export async function loadWallpaper(key: string): Promise<WallpaperRecord | null> {
  try {
    return await sendWallpaperRpc<WallpaperRecord | null>({ op: 'load', key });
  } catch {
    return null;
  }
}

export async function resolveEffectiveWallpaper(spaceId?: string): Promise<WallpaperRecord | null> {
  try {
    return await sendWallpaperRpc<WallpaperRecord | null>({ op: 'resolve', spaceId });
  } catch {
    return null;
  }
}
