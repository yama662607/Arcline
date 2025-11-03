import { Utils } from './utils.js';
import { RESTORE_ICON } from './icons.js';

// --- サイドバーで頻繁に参照する DOM 要素を先にキャッシュ ---
const spacesList = document.getElementById('spacesList');
const spaceSwitcher = document.getElementById('spaceSwitcher');
const addSpaceBtn = document.getElementById('addSpaceBtn');
const newTabBtn = document.getElementById('newTabBtn');
const spaceTemplate = document.getElementById('spaceTemplate');

// サイドバー初期化時に各種イベントリスナーを配線し、UI の初期状態を整える
export function setupDOMElements(createNewSpace, createNewTab) {
    spaceSwitcher.addEventListener('wheel', (event) => {
        event.preventDefault();

        const scrollAmount = event.deltaY;

        spaceSwitcher.scrollLeft += scrollAmount;
    }, { passive: false });

    // 各種ボタンのクリック処理をまとめて登録する
    addSpaceBtn.addEventListener('click', () => {
        const inputContainer = document.getElementById('addSpaceInputContainer');
        const spaceNameInput = document.getElementById('newSpaceName');
        const isInputVisible = inputContainer.classList.contains('visible');

        // 入力欄をスライド表示／非表示させる
        inputContainer.classList.toggle('visible');
        addSpaceBtn.classList.toggle('active');

        // スペーススイッチャーを一時的に隠し、入力にフォーカスさせる
        if (isInputVisible) {
            spaceSwitcher.style.opacity = '1';
            spaceSwitcher.style.visibility = 'visible';
        } else {
            spaceNameInput.value = '';
            spaceSwitcher.style.opacity = '0';
            spaceSwitcher.style.visibility = 'hidden';
        }
    });

    document.getElementById('createSpaceBtn').addEventListener('click', createNewSpace);
    newTabBtn.addEventListener('click', createNewTab);

    const createSpaceColorSwatch = document.getElementById('createSpaceColorSwatch');
    createSpaceColorSwatch.addEventListener('click', (e) => {
        if (e.target.classList.contains('color-swatch')) {
            const colorPicker = document.getElementById('createSpaceColorSwatch');
            const select = document.getElementById('spaceColor');
            const color = e.target.dataset.color;

            // カラーパレットの選択状態を更新
            colorPicker.querySelectorAll('.color-swatch').forEach(swatch => {
                swatch.classList.remove('selected');
            });
            e.target.classList.add('selected');

            // 実際の select 要素にも値を反映する
            select.value = color;

            // 呼び出し元のロジックのために change イベントを発火
            const event = new Event('change');
            select.dispatchEvent(event);
        }
    });

    // 初期表示時に選択済みカラーを反映
    document.querySelectorAll('.space-color-select').forEach(select => {
        const colorPicker = select.nextElementSibling;
        const currentColor = select.value;
        const swatch = colorPicker.querySelector(`[data-color="${currentColor}"]`);
        if (swatch) {
            swatch.classList.add('selected');
        }
    });

    // スペース名が空のままでは作成できないよう簡易バリデーション
    document.getElementById('newSpaceName').addEventListener('input', (e) => {
        const createSpaceBtn = document.getElementById('createSpaceBtn');
        createSpaceBtn.disabled = !e.target.value.trim();
    });
}

// 新規スペース名が既存とかぶった際にエラーポップアップを表示
export function showSpaceNameInput() {
    const addSpaceBtn = document.getElementById('addSpaceBtn');
    const addSpaceInputContainer = document.getElementById('addSpaceInputContainer');

    addSpaceBtn.classList.toggle('active');
    addSpaceInputContainer.classList.toggle('visible');
    const errorPopup = document.createElement('div');
    errorPopup.className = 'error-popup';
    errorPopup.textContent = 'A space with this name already exists';
    const inputContainer = document.getElementById('addSpaceInputContainer');
    inputContainer.appendChild(errorPopup);

    // 3 秒後にエラー通知を自動で消して UI を元に戻す
    setTimeout(() => {
        errorPopup.remove();
    }, 3000);
    return;
}

// 指定タブ ID を UI 上でアクティブ表示にする
export function activateTabInDOM(tabId) {
    // すべてのタブとピン留めアイコンからアクティブ状態を除去
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.pinned-favicon').forEach(f => f.classList.remove('active'));

    // 対象のタブ要素が存在する場合のみアクティブ表示へ切り替える
    const targetTab = document.querySelector(`[data-tab-id="${tabId}"]`);
    if (targetTab) {
        targetTab.classList.add('active');
    }
}

// UI 上でアクティブなスペースを切り替え、テーマカラーとスイッチャーを更新
export function activateSpaceInDOM(spaceId, spaces, updateSpaceSwitcher) {
    // 渡された spaceId に一致するスペースだけを可視化し、それ以外は非表示にする
    document.querySelectorAll('.space').forEach(s => {
        const isActive = s.dataset.spaceId === String(spaceId);
        s.classList.toggle('active', isActive);
        s.style.display = isActive ? 'block' : 'none';
    });

    // スペースのテーマカラーを取得し、サイドバー背景に反映
    const space = spaces.find(s => s.id === spaceId);
    if (space) {
        // CSS カスタムプロパティを介してライト／ダーク両方の背景色を設定
        const sidebarContainer = document.getElementById('sidebar-container');
        sidebarContainer.style.setProperty('--space-bg-color', `var(--chrome-${space.color}-color, rgba(255, 255, 255, 0.1))`);
        sidebarContainer.style.setProperty('--space-bg-color-dark', `var(--chrome-${space.color}-color-dark, rgba(255, 255, 255, 0.1))`);
    }

    // スペース切り替え UI も最新状態へ更新
    updateSpaceSwitcher();
}

// サイドバー上のタブ行に応じたコンテキストメニューを動的生成し表示する
export function showTabContextMenu(x, y, tab, isPinned, isBookmarkOnly, tabElement, closeTab, spaces, moveTabToSpace, setActiveSpace, allBookmarkSpaceFolders, createSpaceFromInactive) {
    // 表示中のメニューがあれば一旦破棄し、複数重ならないようにする
    const existingMenu = document.getElementById('tab-context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    const contextMenu = document.createElement('div');
    contextMenu.id = 'tab-context-menu';
    contextMenu.className = 'context-menu'; // 共通スタイルを流用
    contextMenu.style.position = 'fixed';
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;

    // --- メニュー項目群の構築 ---

    // 実タブ（ブックマーク専用行でないもの）のみに表示する項目
    if (!isBookmarkOnly) {
        const addToFavoritesOption = document.createElement('div');
        addToFavoritesOption.className = 'context-menu-item';
        addToFavoritesOption.textContent = 'Add to Favorites';
        addToFavoritesOption.addEventListener('click', async () => {
            await chrome.tabs.update(tab.id, { pinned: true });
            contextMenu.remove();
        });
        contextMenu.appendChild(addToFavoritesOption);

        const pinInSpaceOption = document.createElement('div');
        pinInSpaceOption.className = 'context-menu-item';
        pinInSpaceOption.textContent = isPinned ? 'Unpin Tab' : 'Pin Tab';
        pinInSpaceOption.addEventListener('click', () => {
            chrome.runtime.sendMessage({ command: 'toggleSpacePin', tabId: tab.id });
            contextMenu.remove();
        });
        contextMenu.appendChild(pinInSpaceOption);

        // ピン操作と移動操作を区切る罫線
        const separator = document.createElement('div');
        separator.className = 'context-menu-separator';
        contextMenu.appendChild(separator);

        // 別スペースへ移動するサブメニュー
        const moveToSpaceItem = document.createElement('div');
        moveToSpaceItem.className = 'context-menu-item with-submenu';
        moveToSpaceItem.textContent = 'Move to Space';

        const submenu = document.createElement('div');
        submenu.className = 'context-menu submenu';

        // 現在存在するスペース一覧をサブメニューに展開
        const currentSpace = spaces.find(s => s.temporaryTabs.includes(tab.id) || s.spaceBookmarks.includes(tab.id));
        const otherActiveSpaces = spaces.filter(s => s.id !== currentSpace?.id);
        otherActiveSpaces.forEach(space => {
            const submenuItem = document.createElement('div');
            submenuItem.className = 'context-menu-item';
            submenuItem.textContent = space.name;
            submenuItem.addEventListener('click', async (e) => {
                e.stopPropagation();
                contextMenu.remove(); // 操作後すぐにメニューを閉じて操作感を高める

                await moveTabToSpace(tab.id, space.id, false);
                // 新しいスペースをアクティブにしつつ、別タブを勝手に選ばせない
                await setActiveSpace(space.id, false); 
                // 移動直後のタブを明示的にアクティブ化
                await chrome.tabs.update(tab.id, { active: true });
            });
            submenu.appendChild(submenuItem);
        });

        // ブックマーク上の「休眠スペース」を候補に表示
        const activeSpaceNames = new Set(spaces.map(s => s.name));
        const inactiveSpaceFolders = allBookmarkSpaceFolders.filter(f => !f.url && !activeSpaceNames.has(f.title));
        
        if (otherActiveSpaces.length > 0 && inactiveSpaceFolders.length > 0) {
            const separator = document.createElement('div');
            separator.className = 'context-menu-separator';
            submenu.appendChild(separator);
        }

        inactiveSpaceFolders.forEach(folder => {
            const submenuItem = document.createElement('div');
            submenuItem.className = 'context-menu-item';
            submenuItem.textContent = folder.title;
            submenuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                createSpaceFromInactive(folder.title, tab);
                contextMenu.remove();
            });
            submenu.appendChild(submenuItem);
        });

        // 候補がない場合は「Move to Space」メニュー自体を表示しない
        if (submenu.hasChildNodes()) {
            moveToSpaceItem.appendChild(submenu);
            contextMenu.appendChild(moveToSpaceItem);
        }
    }

    // アクティブなタブのみアーカイブ操作を許可（ブックマークは除外）
    if (!isBookmarkOnly) {
        const archiveOption = document.createElement('div');
        archiveOption.className = 'context-menu-item';
        archiveOption.textContent = 'Archive Tab';
        archiveOption.addEventListener('click', async () => {
            await Utils.archiveTab(tab.id); // 共通ユーティリティを介してアーカイブ
            contextMenu.remove();
        });
        contextMenu.appendChild(archiveOption);
    }

    // タブを閉じる／ブックマーク行を削除する共通項目
    const closeOption = document.createElement('div');
    closeOption.className = 'context-menu-item';
    closeOption.textContent = isBookmarkOnly ? 'Remove Bookmark' : 'Close Tab';
    closeOption.addEventListener('click', () => {
        closeTab(tabElement, tab, isPinned, isBookmarkOnly);
        contextMenu.remove();
    });
    contextMenu.appendChild(closeOption);

    // --- DOM に追加し、閉じる条件を紐付ける ---
    document.body.appendChild(contextMenu);

    // メニュー外をクリックしたら閉じる（キャプチャで最優先に処理）
    const closeContextMenu = (e) => {
        if (!contextMenu.contains(e.target)) {
            contextMenu.remove();
            document.removeEventListener('click', closeContextMenu, { capture: true }); // キャプチャフェーズで登録したものを解除
        }
    };
    // バブリング前にハンドリングするため capture: true を指定
    document.addEventListener('click', closeContextMenu, { capture: true });
}

// アクティブスペースのアーカイブ一覧ポップアップを描画し、設定トグルも差し込む
export async function showArchivedTabsPopup(activeSpaceId) {
    const spaceElement = document.querySelector(`[data-space-id="${activeSpaceId}"]`);
    const popup = spaceElement.querySelector('.archived-tabs-popup');
    const list = popup.querySelector('.archived-tabs-list');
    const message = popup.querySelector('.no-archived-tabs-message');
    list.innerHTML = '';

    // --- オートアーカイブ設定 UI の構築 ---
    let controls = popup.querySelector('.archiving-controls');
    if (!controls) {
        controls = document.createElement('div');
        controls.className = 'archiving-controls';
        popup.insertBefore(controls, list);
    } else {
        controls.innerHTML = '';
    }

    // 現在の設定値をストレージから取得
    const settings = await Utils.getSettings();
    const archivingEnabled = settings.autoArchiveEnabled;
    const archiveTime = settings.autoArchiveIdleMinutes;

    // ON/OFF トグル（見た目はスイッチ風）
    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'archiving-toggle-label';
    const toggleWrapper = document.createElement('span');
    toggleWrapper.className = 'archiving-toggle';
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = archivingEnabled;
    const slider = document.createElement('span');
    slider.className = 'archiving-toggle-slider';
    toggleWrapper.appendChild(toggle);
    toggleWrapper.appendChild(slider);
    toggleLabel.appendChild(toggleWrapper);
    toggleLabel.appendChild(document.createTextNode('Enable Archiving'));
    controls.appendChild(toggleLabel);

    // アーカイブまでの待機時間を入力するボックス
    const timeContainer = document.createElement('div');
    timeContainer.className = 'archiving-time-container';
    const timeInput = document.createElement('input');
    timeInput.type = 'number';
    timeInput.min = '1';
    timeInput.value = archiveTime;
    timeInput.className = 'archiving-time-input';
    timeInput.disabled = !archivingEnabled;
    const minLabel = document.createElement('span');
    minLabel.textContent = 'min';
    timeContainer.appendChild(timeInput);
    timeContainer.appendChild(minLabel);
    controls.appendChild(timeContainer);

    // 入力に応じて設定を即時保存
    toggle.addEventListener('change', async (e) => {
        const enabled = toggle.checked;
        timeInput.disabled = !enabled;
        await Utils.setArchivingEnabled(enabled);
    });
    timeInput.addEventListener('change', async (e) => {
        let val = parseInt(timeInput.value, 10);
        if (isNaN(val) || val < 1) val = 1;
        timeInput.value = val;
        await Utils.setArchiveTime(val);
    });

    // --- 設定 UI 構築ここまで ---

    if (!archivingEnabled) {
        message.textContent = 'Tab Archiving is disabled. Use the toggle above to enable.';
        list.style.display = 'none';
        return;
    }

    if (!(await Utils.isArchivingEnabled())) {
        message.textContent = 'Tab Archiving is disabled. Go to extension settings to enable.';
        list.style.display = 'none';
        return;
    }

    const allArchived = await Utils.getArchivedTabs();
    if (allArchived.length === 0) {
        message.textContent = 'No archived tabs.';
        list.style.display = 'none';
    } else {
        message.textContent = '';
        list.style.display = 'block';
        allArchived.forEach(archivedTab => {
            const item = document.createElement('div');
            item.className = 'tab archived-item';
            item.title = `${archivedTab.name}\n${archivedTab.url}\nArchived: ${new Date(archivedTab.archivedAt).toLocaleString()}`;

            const favicon = document.createElement('img');
            favicon.src = Utils.getFaviconUrl(archivedTab.url);
            favicon.className = 'tab-favicon';
            favicon.onerror = () => { favicon.src = 'assets/default_icon.png'; };

            const details = document.createElement('div');
            details.className = 'tab-details';
            const titleSpan = document.createElement('span');
            titleSpan.className = 'tab-title-display';
            titleSpan.textContent = archivedTab.name;
            details.appendChild(titleSpan);

            const restoreButton = document.createElement('button');
            restoreButton.innerHTML = RESTORE_ICON;
            restoreButton.className = 'tab-restore';
            restoreButton.style.marginLeft = 'auto';
            restoreButton.addEventListener('click', (e) => {
                e.stopPropagation();
                Utils.restoreArchivedTab(archivedTab);
                item.remove();
                if (list.children.length === 0) {
                    message.style.display = 'block';
                    list.style.display = 'none';
                }
            });

            item.appendChild(favicon);
            item.appendChild(details);
            item.appendChild(restoreButton);
            list.appendChild(item);
        });
    }
}

// Quick Pin ショートカット／メニュー操作を受け取り、該当タブをピン／解除するリスナーを登録
export function setupQuickPinListener(moveTabToSpace, moveTabToPinned, moveTabToTemp) {
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.command === "quickPinToggle" || request.command === "toggleSpacePin") {
            console.log(`[QuickPin] Received command: ${request.command}`, { request });
            chrome.storage.local.get('spaces', function(result) {
                // 現在のスペース状態をローカルストレージから読み出す
                const spaces = result.spaces || [];
                console.log("[QuickPin] Loaded spaces from storage:", spaces);

                // 対象タブがテンポラリ配列かブックマーク配列にいるかでピン状態を反転させるヘルパー
                const getTabAndToggle = (tabToToggle) => {
                    if (!tabToToggle) {
                        console.error("[QuickPin] No tab found to toggle.");
                        return;
                    }
                    console.log("[QuickPin] Toggling pin state for tab:", tabToToggle);

                    const spaceWithTempTab = spaces.find(space =>
                        space.temporaryTabs.includes(tabToToggle.id)
                    );

                    if (spaceWithTempTab) {
                        console.log(`[QuickPin] Tab ${tabToToggle.id} is a temporary tab in space "${spaceWithTempTab.name}". Pinning it.`);
                        moveTabToSpace(tabToToggle.id, spaceWithTempTab.id, true);
                        moveTabToPinned(spaceWithTempTab, tabToToggle);
                    } else {
                        const spaceWithBookmark = spaces.find(space =>
                            space.spaceBookmarks.includes(tabToToggle.id)
                        );

                        if (spaceWithBookmark) {
                            console.log(`[QuickPin] Tab ${tabToToggle.id} is a bookmarked tab in space "${spaceWithBookmark.name}". Unpinning it.`);
                            moveTabToSpace(tabToToggle.id, spaceWithBookmark.id, false);
                            moveTabToTemp(spaceWithBookmark, tabToToggle);
                        } else {
                            console.warn(`[QuickPin] Tab ${tabToToggle.id} not found in any space as temporary or bookmarked.`);
                        }
                    }
                };

                // アクティブタブ全体に対するショートカットと、個別タブ指定のコマンドを振り分け
                if (request.command === "quickPinToggle") {
                    console.log("[QuickPin] Handling quickPinToggle for active tab.");
                    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                        getTabAndToggle(tabs[0]);
                    });
                } else if (request.command === "toggleSpacePin" && request.tabId) {
                    console.log(`[QuickPin] Handling toggleSpacePin for tabId: ${request.tabId}`);
                    chrome.tabs.get(request.tabId, function(tab) {
                        getTabAndToggle(tab);
                    });
                }
            });
        }
    });
}
