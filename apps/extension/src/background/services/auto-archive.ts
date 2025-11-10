/// <reference types="chrome" />

import {
  archiveTab,
  getTabActivity,
  removeTabLastActivity,
  updateTabLastActivity,
} from './browser';

const AUTO_ARCHIVE_ALARM_NAME = 'autoArchiveTabsAlarm';
const MINUTE_IN_MS = 60 * 1000;

/**
 * 自動アーカイブの設定を更新する
 */
export async function setupAutoArchiveAlarm(enabled: boolean, idleMinutes: number): Promise<void> {
  try {
    // 既存のアラームをクリア
    await chrome.alarms.clear(AUTO_ARCHIVE_ALARM_NAME);

    if (enabled && idleMinutes > 0) {
      // 新しいアラームを作成
      const delayMinutes = Math.max(idleMinutes, 1); // 最低1分間隔
      await chrome.alarms.create(AUTO_ARCHIVE_ALARM_NAME, {
        delayInMinutes: delayMinutes,
        periodInMinutes: delayMinutes,
      });

      console.log(`[Arcline] Auto-archive alarm set: ${idleMinutes} minutes`);
    } else {
      console.log('[Arcline] Auto-archive alarm disabled');
    }
  } catch (error) {
    console.error('[Arcline] Failed to setup auto-archive alarm:', error);
    throw error;
  }
}

/**
 * 自動アーカイブチェックを実行する
 */
export async function runAutoArchiveCheck(): Promise<void> {
  try {
    const settings = await getAutoArchiveSettings();
    if (!settings.enabled) {
      console.log('[Arcline] Auto-archive is disabled');
      return;
    }

    const idleThreshold = settings.idleMinutes * MINUTE_IN_MS;
    const currentTime = Date.now();
    const tabActivity = await getTabActivity();
    const archivedCount = await archiveInactiveTabs(tabActivity, currentTime, idleThreshold);

    if (archivedCount > 0) {
      console.log(`[Arcline] Auto-archived ${archivedCount} inactive tabs`);
    }
  } catch (error) {
    console.error('[Arcline] Failed to run auto-archive check:', error);
  }
}

/**
 * 非アクティブなタブをアーカイブする
 */
export async function archiveInactiveTabs(
  tabActivity: Record<number, number>,
  currentTime: number,
  idleThreshold: number
): Promise<number> {
  let archivedCount = 0;

  try {
    // すべてのタブを取得
    const allTabs = await chrome.tabs.query({});

    for (const tab of allTabs) {
      if (typeof tab.id !== 'number') continue;

      // アーカイブ除外条件をチェック
      if (shouldExcludeFromAutoArchive(tab)) {
        continue;
      }

      // 最終アクティブ時刻をチェック
      const lastActivity = tabActivity[tab.id] || 0;
      const idleTime = currentTime - lastActivity;

      if (idleTime >= idleThreshold) {
        try {
          await archiveTab(tab.id);
          archivedCount++;
          console.log(`[Arcline] Auto-archived tab: ${tab.title} (${tab.url})`);
        } catch (error) {
          console.warn(`[Arcline] Failed to archive tab ${tab.id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('[Arcline] Error during auto-archive process:', error);
  }

  return archivedCount;
}

/**
 * 自動アーカイブ除外条件をチェックする
 */
export function shouldExcludeFromAutoArchive(tab: chrome.tabs.Tab): boolean {
  // ピン留めタブは除外
  if (tab.pinned) {
    return true;
  }

  // 現在アクティブなタブは除外
  if (tab.active) {
    return true;
  }

  // Chrome内部ページは除外
  if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://'))) {
    return true;
  }

  // 音声再生中のタブは除外
  if (tab.audible) {
    return true;
  }

  // ブックマーク済みタブは除外（確認が必要）
  // TODO: ブックマークチェックを実装

  return false;
}

/**
 * 自動アーカイブ設定を取得する
 */
export async function getAutoArchiveSettings(): Promise<{ enabled: boolean; idleMinutes: number }> {
  try {
    const settings = await chrome.storage.sync.get([
      'autoArchiveEnabled',
      'autoArchiveIdleMinutes',
    ]);
    return {
      enabled: Boolean(settings.autoArchiveEnabled),
      idleMinutes: Number(settings.autoArchiveIdleMinutes) || 30,
    };
  } catch (error) {
    console.error('[Arcline] Failed to get auto-archive settings:', error);
    return {
      enabled: false,
      idleMinutes: 30,
    };
  }
}

/**
 * タブアクティビティリスナーを設定する
 */
export function setupTabActivityListeners(): void {
  // タブがアクティブになったとき
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    await updateTabLastActivity(activeInfo.tabId);
  });

  // タブが更新されたとき
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (changeInfo.status === 'complete' || changeInfo.url) {
      await updateTabLastActivity(tabId);
    }
  });

  // タブが閉じられたとき
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    await removeTabLastActivity(tabId);
  });

  console.error('[Arcline] Tab activity listeners initialized');
}

/**
 * アラームリスナーを設定する
 */
export function setupAlarmListener(): void {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === AUTO_ARCHIVE_ALARM_NAME) {
      runAutoArchiveCheck();
    }
  });

  console.error('[Arcline] Alarm listener initialized');
}

/**
 * 自動アーカイブ機能を初期化する
 */
export async function initializeAutoArchive(): Promise<void> {
  try {
    // リスナーを設定
    setupTabActivityListeners();
    setupAlarmListener();

    // 現在のタブのアクティビティを記録
    const currentTabs = await chrome.tabs.query({});

    for (const tab of currentTabs) {
      if (typeof tab.id === 'number' && tab.active) {
        await updateTabLastActivity(tab.id);
      }
    }

    // 設定を読み込んでアラームを設定
    const settings = await getAutoArchiveSettings();
    await setupAutoArchiveAlarm(settings.enabled, settings.idleMinutes);

    console.error('[Arcline] Auto-archive functionality initialized');
  } catch (error) {
    console.error('[Arcline] Failed to initialize auto-archive:', error);
  }
}
