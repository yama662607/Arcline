import { Utils } from './utils.js';

const AUTO_ARCHIVE_ALARM_NAME = 'autoArchiveTabsAlarm';
const TAB_ACTIVITY_STORAGE_KEY = 'tabLastActivity'; // タブごとの最終操作時刻を保存するためのキー

// 拡張機能のアクションボタンを押したら常にサイドパネルが開くように設定する
chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true
}).catch(error => console.error(error));


// インストール／更新時の初期セットアップを実行
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install' || details.reason === 'update') {
        chrome.tabs.create({ url: 'onboarding.html', active: true });
    }
    // コンテキストメニューを作成
    if (chrome.contextMenus) {
        chrome.contextMenus.create({
            id: "openArcify",
            title: "Arcify",
            contexts: ["all"]
        });
    }
});

// コンテキストメニューから選択されたときにサイドパネルを開く、これによって拡張機能アイコンがなくても右クリックでサイドパネルを開けるようにする
if (chrome.contextMenus) {
    chrome.contextMenus.onClicked.addListener((info, tab) => {
        info.menuItemId === "openArcify" && chrome.sidePanel.open({
            windowId: tab.windowId
        })
    });
}

// サイドバー（content script）からのメッセージを受け取って処理
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    // ピンのトグル要求をそのままサイドバーへ中継
    if (request.command === "toggleSpacePin") {
        chrome.runtime.sendMessage({ command: "toggleSpacePin", tabId: request.tabId });
    }
});

chrome.commands.onCommand.addListener(function (command) {
    if (command === "quickPinToggle") {
        console.log("sending");
        // ショートカットで受け取ったピントグル要求をサイドバーへ送る
        chrome.runtime.sendMessage({ command: "quickPinToggle" });
    }
});


// --- ヘルパー: タブの最終アクティビティ時刻を記録 ---
async function updateTabLastActivity(tabId) {
    if (!tabId) return;
    try {
        const result = await chrome.storage.local.get(TAB_ACTIVITY_STORAGE_KEY);
        const activityData = result[TAB_ACTIVITY_STORAGE_KEY] || {};
        activityData[tabId] = Date.now();
        // 必要に応じてストレージが肥大化した際に古いレコードを削除する余地あり（まだ実装していない）
        await chrome.storage.local.set({ [TAB_ACTIVITY_STORAGE_KEY]: activityData });
    } catch (error) {
        console.error("Error updating tab activity:", error);
    }
}

// --- ヘルパー: タブのアクティビティ記録を削除 ---
async function removeTabLastActivity(tabId) {
    if (!tabId) return;
    try {
        const result = await chrome.storage.local.get(TAB_ACTIVITY_STORAGE_KEY);
        const activityData = result[TAB_ACTIVITY_STORAGE_KEY] || {};
        delete activityData[tabId];
        await chrome.storage.local.set({ [TAB_ACTIVITY_STORAGE_KEY]: activityData });
    } catch (error) {
        console.error("Error removing tab activity:", error);
    }
}


// --- アラーム生成処理 ---
async function setupAutoArchiveAlarm() {
    try {
        const settings = await Utils.getSettings();
        if (settings.autoArchiveEnabled && settings.autoArchiveIdleMinutes > 0) {
            // 一定間隔で発火するアラームを登録（Chrome のアラームは指定間隔以上で発火する点に注意）
            // Chrome アラームの最小間隔は 1 分
            const period = Math.max(1, settings.autoArchiveIdleMinutes / 2); // アイドル時間の半分の間隔でチェックするよう短めに設定
            await chrome.alarms.create(AUTO_ARCHIVE_ALARM_NAME, {
                periodInMinutes: period
            });
            console.log(`Auto-archive alarm set to run every ${period} minutes.`);
        } else {
            // 無効化されている場合は既存のアラームを解除
            await chrome.alarms.clear(AUTO_ARCHIVE_ALARM_NAME);
            console.log("Auto-archive disabled, alarm cleared.");
        }
    } catch (error) {
        console.error("Error setting up auto-archive alarm:", error);
    }
}

// --- アラーム発火時のリスナー ---
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === AUTO_ARCHIVE_ALARM_NAME) {
        console.log("Auto-archive alarm triggered.");
        await runAutoArchiveCheck();
    }
});

// --- 自動アーカイブのメインロジック ---
async function runAutoArchiveCheck() {
    const settings = await Utils.getSettings();
    if (!settings.autoArchiveEnabled || settings.autoArchiveIdleMinutes <= 0) {
        console.log("Auto-archive check skipped (disabled or invalid time).");
        return;
    }

    const idleThresholdMillis = settings.autoArchiveIdleMinutes * 60 * 1000;
    const now = Date.now();

    try {
        const activityResult = await chrome.storage.local.get(TAB_ACTIVITY_STORAGE_KEY);
        const tabActivity = activityResult[TAB_ACTIVITY_STORAGE_KEY] || {};

        // --- スペース情報を取得し、ブックマーク済み URL を抽出 ---
        const spacesResult = await chrome.storage.local.get('spaces');
        const spaces = spacesResult.spaces || [];
        const bookmarkedUrls = new Set();
        spaces.forEach(space => {
            if (space.spaceBookmarks) {
                // spaceBookmarks が URL を保持している想定（オブジェクト構造の場合はここを調整する）
                space.spaceBookmarks.forEach(bookmark => {
                    // 文字列か URL プロパティを持つオブジェクトかを場合分け
                    if (typeof bookmark === 'string') {
                        bookmarkedUrls.add(bookmark);
                    } else if (bookmark && bookmark.url) {
                        bookmarkedUrls.add(bookmark.url);
                    }
                });
            }
        });
        console.log("Bookmarked URLs for exclusion:", bookmarkedUrls);

        // すべてのウィンドウからピン留めされていないタブを取得
        const tabs = await chrome.tabs.query({ pinned: false });
        const tabsToArchive = [];

        for (const tab of tabs) {
            // 音声再生中・アクティブ・直近で操作されたタブは対象外
            if (tab.audible || tab.active) {
                await updateTabLastActivity(tab.id); // 対象外としたタブのタイムスタンプも更新しておく
                continue;
            }

            if (bookmarkedUrls.has(tab.url)) {
                console.log(`Skipping archive for tab ${tab.id} - URL is bookmarked in a space.`);
                // ブックマークに紐づくタブは繰り返しチェックしないようタイムスタンプを更新
                await updateTabLastActivity(tab.id);
                continue;
            }

            const lastActivity = tabActivity[tab.id];

            // 記録がない／最終記録が閾値より古いタブをアーカイブ候補にする
            // 記録がない場合は追跡開始以降アクティブになっていないとみなす
            if (!lastActivity || (now - lastActivity > idleThresholdMillis)) {
                // アーカイブ前にタブがまだ存在するかを確認
                try {
                    await chrome.tabs.get(tab.id); // タブが既に閉じられていれば例外になる
                    tabsToArchive.push(tab);
                } catch (e) {
                    console.log(`Tab ${tab.id} closed before archiving, removing activity record.`);
                    await removeTabLastActivity(tab.id); // 閉じられていた場合は記録を掃除
                }
            }
        }

        console.log(`Found ${tabsToArchive.length} tabs eligible for auto-archiving.`);

        for (const tab of tabsToArchive) {
            console.log(`Auto-archiving tab: ${tab.id} - ${tab.title}`);
            const tabData = {
                url: tab.url,
                name: tab.title || tab.url, // タイトルが空の場合は URL を名前として保存
                spaceId: tab.groupId // 現在所属しているタブグループ（スペース）に紐づけて保存
            };

            // スペース ID が有効か（タブが正しくグループに所属しているか）を確認
            if (tabData.spaceId && tabData.spaceId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
                await Utils.addArchivedTab(tabData);
                await chrome.tabs.remove(tab.id); // 保存後にタブを閉じる
                await removeTabLastActivity(tab.id); // タイムスタンプの記録も削除
            } else {
                console.log(`Skipping archive for tab ${tab.id} - not in a valid group.`);
                // 必要ならここでタイムスタンプを更新する（現在は未実行）
                // await updateTabLastActivity(tab.id);
            }
        }

    } catch (error) {
        console.error("Error during auto-archive check:", error);
    }
}

// --- アクティビティ監視とアラーム設定に関するイベント束 ---

// 拡張がインストールまたは更新されたときに初期設定を実行
chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed/updated. Setting up alarm.");
    setupAutoArchiveAlarm();
    // 既存タブの初期タイムスタンプを付与する案もあるがコストが高いため、アラームで徐々に捕捉する
});

// Chrome 起動時にもアラームを再設定
chrome.runtime.onStartup.addListener(() => {
    console.log("Chrome started. Setting up alarm.");
    setupAutoArchiveAlarm();
});

// ストレージ変更（オプション画面での設定更新など）を監視
chrome.storage.onChanged.addListener((changes, areaName) => {
    // オートアーカイブ関連のキーが変更されたかどうかを判定
    const settingsChanged = ['autoArchiveEnabled', 'autoArchiveIdleMinutes'].some(key => key in changes);

    if ((areaName === 'sync' || areaName === 'local') && settingsChanged) {
        console.log("Auto-archive settings changed. Re-evaluating alarm setup.");
        setupAutoArchiveAlarm(); // 新しい設定内容に合わせてアラームを再生成／解除
    }

    // タブ削除時のクリーニングは別イベントで対応済み
    if (areaName === 'local' && TAB_ACTIVITY_STORAGE_KEY in changes) {
        // tabId ごとの変更通知だけでは網羅できないことがある点に注意
    }
});

// タブがアクティブ化された際にタイムスタンプを更新
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    console.log(`Tab activated: ${activeInfo.tabId}`);
    await updateTabLastActivity(activeInfo.tabId);
});

// タブの状態変化（読み込み完了・音声再生など）を監視
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // ナビゲーション完了や音声発生など、操作中とみなせる状態になったら記録を更新
    if (changeInfo.status === 'complete' || changeInfo.audible !== undefined) {
        if (tab.active || tab.audible) {
            await updateTabLastActivity(tabId);
        }
    }
});

// タブが閉じられたタイミングで記録を破棄
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    console.log(`Tab removed: ${tabId}`);
    await removeTabLastActivity(tabId);
});

// オプション画面からのリクエストでアラームを即座に更新
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateAutoArchiveSettings') {
        console.log("Received message to update auto-archive settings.");
        setupAutoArchiveAlarm();
        sendResponse({ success: true });
    }
    // 非同期レスポンスが必要になった場合は return true; を有効にする
    // return true;
});
