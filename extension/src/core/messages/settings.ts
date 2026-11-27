export const settingsEn = {
  // Dialog chrome
  'settings.title': 'Arcline Settings',
  'settings.close': 'Close',
  'settings.navLabel': 'Settings sections',
  'settings.privacyNote': 'Arcline makes no network requests and sends no telemetry.',

  // Navigation
  'settings.nav.general': 'General',
  'settings.nav.generalShort': 'General',
  'settings.nav.interaction': 'Hover & Gestures',
  'settings.nav.interactionShort': 'Controls',
  'settings.nav.archive': 'Archive ({count})',
  'settings.nav.import': 'Arc Import / Export',
  'settings.nav.shortcuts': 'Shortcuts',
  'settings.nav.shortcutsShort': 'Keys',

  // General: language / search engine / start guide
  'settings.language.label': 'Language',
  'settings.language.description': 'Choose the language used across Arcline.',
  'settings.language.ariaLabel': 'Language / 言語',
  'settings.language.auto': 'Auto',
  'settings.searchEngine.label': 'Search engine',
  'settings.searchEngine.description':
    'Used by the Command Bar when a query is searched on the web.',
  'settings.startGuide.label': 'Start Guide',
  'settings.startGuide.description': 'Replay the Arcline introduction and setup tips.',
  'settings.startGuide.open': 'Open Start Guide',

  // General: appearance & toggles
  'settings.theme.label': 'Appearance',
  'settings.theme.system': 'System',
  'settings.theme.light': 'Light',
  'settings.theme.dark': 'Dark',
  'settings.commandBarMode.title': 'New Tab / Command Bar style',
  'settings.commandBarMode.description':
    'Choose whether New Tab pops the Command Bar over your current page or opens a full empty page.',
  'settings.commandBarMode.popup': 'Popup overlay',
  'settings.commandBarMode.newtab': 'Empty page',
  'settings.wallpaper.title': 'Empty page wallpaper (Image / GIF)',
  'settings.wallpaper.description':
    'Set a custom image or animated GIF for all Spaces or each individual Space (stored 100% locally).',
  'settings.wallpaper.scopeAria': 'Wallpaper target Space',
  'settings.wallpaper.scopeAll': 'All Spaces (shared)',
  'settings.wallpaper.defaultTheme': 'Theme color',
  'settings.wallpaper.pick': 'Choose Image / GIF',
  'settings.wallpaper.reset': 'Reset',
  'settings.wallpaper.error': 'Could not save the image. Choose an image/GIF under 25 MB.',
  'settings.topBar.title': 'Show search / URL copy bar at the top',
  'settings.topBar.description':
    'Hidden by default, like current Arc. Turn it on if you want it (search is still available with ⌘K when off).',
  'settings.collapsedFolders.title': 'Show open tabs inside closed folders',
  'settings.collapsedFolders.description':
    'Like Arc, open pinned tabs are still shown below a collapsed folder.',
  'settings.emptySpacePage.title': 'Open the theme color page when switching to an empty Space',
  'settings.emptySpacePage.description':
    "When the target Space has no open tabs, show a dedicated page with that Space's theme colors.",
  'settings.emptySpacePage.interactionDescription':
    'When off, the current page stays open and only the sidebar switches.',
  'settings.emptySpacePage.interactionAria':
    'Open the theme color page when switching to an empty Space (Controls tab)',
  'settings.autoArchive.title': 'Auto-archive temporary tabs (saves memory)',
  'settings.autoArchive.off': 'Off',
  'settings.autoArchive.hours12': 'After 12 hours',
  'settings.autoArchive.hours24': 'After 24 hours (recommended)',
  'settings.autoArchive.days7': 'After 7 days',
  'settings.autoArchive.description':
    'Temporary tabs that have not been used for the chosen time are closed and moved to the archive to reduce memory usage.',
  'settings.swipe.title': 'Switch Spaces with a two-finger horizontal swipe',
  'settings.swipe.descriptionGeneral':
    'Swipe left or right on the sidebar with the trackpad to move between Spaces (no conflict with page back / forward).',
  'settings.swipe.descriptionInteraction':
    'Only horizontal scrolling inside the sidebar is captured, so page back / forward gestures are not affected.',
  'settings.swipe.interactionAria':
    'Switch Spaces with a two-finger horizontal swipe (Controls tab)',

  // Interaction tab
  'settings.edgeHover.title': 'Show the sidebar when hovering the left edge',
  'settings.edgeHover.description':
    'Normally fully hidden at 0px; it slides in only when the cursor reaches the left screen edge.',
  'settings.edgeHover.triggerWidth': 'Trigger width',
  'settings.edgeHover.triggerWidthAria': 'Left edge trigger width',
  'settings.edgeHover.openDelay': 'Show delay',
  'settings.edgeHover.openDelayAria': 'Hover show delay',
  'settings.edgeHover.closeDelay': 'Hide delay',
  'settings.edgeHover.closeDelayAria': 'Hover hide delay',
  'settings.recommendedValue': '{value} (recommended)',
  'settings.brave.title': "Guide: hide Brave's native tabs at 0px",
  'settings.brave.step1':
    '→ turn on "Use vertical tabs" → turn on "Hide completely when minimized"',
  'settings.brave.step2Pre': 'To avoid conflicts with left-edge hover, place the vertical tabs',
  'settings.brave.step2Strong': '"Show on the right"',
  'settings.brave.step2Post': 'and minimize them (the left edge then belongs 100% to Arcline).',
  'settings.brave.step3Pre':
    'On pages where the overlay cannot be shown, such as settings or extension management (',
  'settings.brave.step3Mid': '), press',
  'settings.brave.step3Post':
    'or click the Arcline toolbar icon to open the native Side Panel on the left.',

  // Archive tab
  'settings.archive.searchPlaceholder': 'Search archive...',
  'settings.archive.clearAll': 'Clear all',
  'settings.archive.empty': 'No archived tabs',
  'settings.archive.restore': 'Restore',
  'settings.archive.restoreLabel': 'Restore {title}',
  'settings.archive.remove': 'Delete',
  'settings.archive.removeLabel': 'Delete {title}',
  'settings.time.minutesAgo': '{count}m ago',
  'settings.time.hoursAgo': '{count}h ago',
  'settings.time.daysAgo': '{count}d ago',

  // Import / export tab
  'settings.import.introPre': "When you select Arc's",
  'settings.import.introPost':
    "Top Apps become shared Favorites across all Spaces, and each Space's theme, icon, pins and folders are imported in one go.",
  'settings.import.copied': 'Copied',
  'settings.import.copyPath': 'Path',
  'settings.import.pickFile': 'Select StorableSidebar.json',
  'settings.import.pickFileHint': 'In the file picker, press Cmd+Shift+G to paste the path.',
  'settings.import.skipEmpty': 'Exclude empty folders',
  'settings.import.skipSearches': 'Exclude Google search result URLs',
  'settings.import.dedupe': 'Merge duplicate URLs within a Space',
  'settings.import.previewTitle': 'Import preview',
  'settings.import.previewFavorites': 'Shared Favorites across all Spaces: {count}',
  'settings.import.previewSpaces': 'Spaces ({count}): {names}',
  'settings.import.previewPins': 'Pins: {pins} / Folders: {folders}',
  'settings.import.previewCleanup':
    'Auto cleanup: excluded {deduped} duplicates / {empty} empty folders / {searches} search URLs',
  'settings.import.exportBackup': 'Export JSON backup',
  'settings.import.run': 'Run import',
  'settings.import.running': 'Importing...',
  'settings.import.errorParse': 'Failed to parse the JSON.',
  'settings.import.errorFile': 'Please select a valid JSON file.',
  'settings.import.errorFailed': 'Import failed.',

  // Shortcuts tab
  'settings.shortcuts.customTitle': 'Arcline Shortcuts (Custom)',
  'settings.shortcuts.customHint':
    'Click a key box and press any combo to customize directly inside Arcline. Works on all webpages.',
  'settings.shortcuts.browserTitle': 'Browser Extension Shortcuts',
  'settings.shortcuts.browserHint':
    'System-level shortcuts (also work on brave:// and chrome:// pages). Edit in browser shortcut settings.',
  'settings.shortcuts.openBrowserShortcuts': 'Open Extension Shortcuts',
  'settings.shortcuts.openBraveShortcuts': 'Brave Shortcuts',
  'settings.shortcuts.notSet': 'Not set',
  'settings.shortcuts.openCommandBar': 'Open Command Bar',
  'settings.shortcuts.toggleSidebar': 'Open / close the sidebar',
  'settings.shortcuts.toggleSidebarNote':
    'macOS: Control+Shift+B (avoids ⌃B / ⌘B) · Windows/Linux: Alt+Shift+B',
  'settings.shortcuts.nextSpace': 'Next Space',
  'settings.shortcuts.previousSpace': 'Previous Space',
  'settings.shortcuts.switchSpace': 'Switch to the previous / next Space',
  'settings.shortcuts.switchSpaceNote': 'Windows/Linux: Alt+Shift+←/→',
  'settings.shortcuts.swipeKey': 'Two-finger swipe',
  'settings.shortcuts.swipe': 'Swipe left / right on the sidebar to switch Spaces',
  'settings.shortcuts.pin': 'Pin / unpin the current tab',
  'settings.shortcuts.pinNote': 'Windows/Linux: Alt+Shift+D',
  'settings.shortcuts.search': 'Focus quick search',
  'settings.shortcuts.searchNote': 'Windows/Linux: Ctrl+K',
  'settings.shortcuts.escape': 'Close search, menus and the overlay',

  // Favorite aliases & shortcuts
  'settings.favShortcuts.title': 'Favorite Aliases & Shortcuts',
  'settings.favShortcuts.hint':
    'Alias: type in New Tab or Raycast to jump straight to #1. Shortcut: click and press any key combo (e.g. ⌥1, ⌃⇧M) to open that Favorite from anywhere in the browser.',
  'settings.favShortcuts.empty': 'Add Favorites in the sidebar to configure aliases and shortcuts.',
  'settings.favShortcuts.aliasPlaceholder': 'alias',
  'settings.favShortcuts.aliasAria': 'Alias for {title}',
  'settings.favShortcuts.keyPlaceholder': 'Set key…',
  'settings.favShortcuts.recording': 'Press keys…',
  'settings.favShortcuts.keyAria': 'Shortcut combo for {title}',
  'settings.favShortcuts.clearKeyAria': 'Clear shortcut for {title}',

  // Custom site searches
  'settings.siteSearch.title': 'Site-Search Shortcuts (Tab-to-Search)',
  'settings.siteSearch.hint':
    'Type a prefix + Tab (or Space) in New Tab or Raycast to search any site. Use %s where the query goes.',
  'settings.siteSearch.prefixPlaceholder': 'prefix',
  'settings.siteSearch.labelPlaceholder': 'Site name (e.g. Docs)',
  'settings.siteSearch.urlPlaceholder': 'URL template with %s',
  'settings.siteSearch.add': 'Add',
  'settings.siteSearch.save': 'Save',
  'settings.siteSearch.cancel': 'Cancel',
  'settings.siteSearch.editAria': 'Edit {label} site search',
  'settings.siteSearch.toggleAria': 'Toggle {label} site search',
  'settings.siteSearch.invalid':
    'Enter a lowercase prefix (a-z/0-9), a label, and an http(s):// URL containing %s.',
  'settings.siteSearch.removeAria': 'Remove {label} site search',
  'settings.siteSearch.builtInTitle': 'Built-in AI & web shortcuts (click to enable / disable)',

  // Feedback & support
  'settings.feedback.title': 'Feedback & Support',
  'settings.feedback.description': 'Share ideas or report bugs (no account required).',
  'settings.feedback.form': 'Feedback Form',
  'settings.feedback.github': 'GitHub Issues',
} as const;

export const settingsJa: Record<keyof typeof settingsEn, string> = {
  'settings.title': 'Arcline 設定',
  'settings.close': '閉じる',
  'settings.navLabel': '設定セクション',
  'settings.privacyNote': 'ネットワーク通信・テレメトリは一切行いません。',

  'settings.nav.general': '一般',
  'settings.nav.generalShort': '一般',
  'settings.nav.interaction': 'ホバー＆ジェスチャー',
  'settings.nav.interactionShort': '操作',
  'settings.nav.archive': 'アーカイブ ({count})',
  'settings.nav.import': 'Arc移行 / 出力',
  'settings.nav.shortcuts': 'ショートカット',
  'settings.nav.shortcutsShort': 'キー',

  'settings.language.label': '言語',
  'settings.language.description': 'Arcline 全体の表示言語を選択します。',
  'settings.language.ariaLabel': 'Language / 言語',
  'settings.language.auto': '自動',
  'settings.searchEngine.label': '検索エンジン',
  'settings.searchEngine.description': 'コマンドバーでWeb検索する際に使用します。',
  'settings.startGuide.label': 'スタートガイド',
  'settings.startGuide.description': 'Arcline の紹介とセットアップのヒントをもう一度表示します。',
  'settings.startGuide.open': 'スタートガイドを開く',

  'settings.theme.label': '外観テーマ',
  'settings.theme.system': 'システム',
  'settings.theme.light': 'ライト',
  'settings.theme.dark': 'ダーク',
  'settings.commandBarMode.title': '新規タブ / コマンドバーの開き方',
  'settings.commandBarMode.description':
    '現在のページにポップアップで重ねるか、壁紙付きの空ページへ移動して開くかを選びます。',
  'settings.commandBarMode.popup': 'ページ上にポップアップ',
  'settings.commandBarMode.newtab': '空ページで開く',
  'settings.wallpaper.title': '空ページの壁紙（画像・GIF）',
  'settings.wallpaper.description':
    '全 Space 共通または Space ごとに画像・アニメーション GIF を設定できます（完全ローカル保存）。',
  'settings.wallpaper.scopeAria': '壁紙の適用先 Space',
  'settings.wallpaper.scopeAll': '全 Space 共通',
  'settings.wallpaper.defaultTheme': 'テーマカラー',
  'settings.wallpaper.pick': '画像 / GIF を選択',
  'settings.wallpaper.reset': 'リセット',
  'settings.wallpaper.error':
    '画像を保存できませんでした。25 MB 以下の画像 / GIF を選んでください。',
  'settings.topBar.title': '上部に検索・URLコピーバーを表示',
  'settings.topBar.description':
    '現在の Arc と同様に標準では非表示にし、必要な方だけ表示できます（オフ時も ⌘K で検索可能）',
  'settings.collapsedFolders.title': '閉じたフォルダ内の開いているタブを表示',
  'settings.collapsedFolders.description':
    'Arc と同様に、折りたたんだフォルダでも開いているピン留めタブを下に表示します',
  'settings.emptySpacePage.title': '空の Space へ移動時にテーマカラーページを開く',
  'settings.emptySpacePage.description':
    '移動先 Space に開いているタブがない場合、その Space のテーマ配色の専用ページを表示します',
  'settings.emptySpacePage.interactionDescription':
    'オフにすると現在のページを開いたままサイドバーだけ切り替わります',
  'settings.emptySpacePage.interactionAria':
    '空の Space へ移動時にテーマカラーページを開く（操作タブ）',
  'settings.autoArchive.title': '一時タブの自動アーカイブ（メモリ節約）',
  'settings.autoArchive.off': 'オフ',
  'settings.autoArchive.hours12': '12 時間後',
  'settings.autoArchive.hours24': '24 時間後（推奨）',
  'settings.autoArchive.days7': '7 日間後',
  'settings.autoArchive.description':
    '指定時間アクセスがない一時タブを自動で閉じてアーカイブへ退避し、メモリ使用量を抑えます。',
  'settings.swipe.title': '二本指の横スワイプで Space を切替',
  'settings.swipe.descriptionGeneral':
    'サイドバー上でトラックパッドを左右にスワイプして Space を移動します（ページの戻る／進むとは競合しません）',
  'settings.swipe.descriptionInteraction':
    'サイドバー内の水平スクロールのみを捕捉し、Web ページ側の「戻る／進む」ジェスチャーには干渉しません',
  'settings.swipe.interactionAria': '二本指の横スワイプで Space を切替（操作タブ）',

  'settings.edgeHover.title': '左端ホバーでサイドバーを自動表示',
  'settings.edgeHover.description':
    '通常は 0px で完全非表示にし、カーソルを画面左端に合わせた時だけスライド表示',
  'settings.edgeHover.triggerWidth': '反応幅',
  'settings.edgeHover.triggerWidthAria': '左端の反応幅',
  'settings.edgeHover.openDelay': '表示遅延',
  'settings.edgeHover.openDelayAria': 'ホバー表示遅延',
  'settings.edgeHover.closeDelay': '非表示遅延',
  'settings.edgeHover.closeDelayAria': 'ホバー非表示遅延',
  'settings.recommendedValue': '{value}（推奨）',
  'settings.brave.title': 'Brave 0px ネイティブタブ非表示ガイド',
  'settings.brave.step1': '→「垂直タブを使用」ON →「最小化時に完全に隠す」ON',
  'settings.brave.step2Pre': '左端ホバーの競合を防ぐため、垂直タブの配置を',
  'settings.brave.step2Strong': '「右側に表示（Show on the right）」',
  'settings.brave.step2Post': 'に設定して最小化（左端が 100% Arcline 専用になります）',
  'settings.brave.step3Pre': '設定画面や拡張機能管理（',
  'settings.brave.step3Mid': '）などオーバーレイが出せない画面では、',
  'settings.brave.step3Post':
    'またはツールバーの Arcline アイコンで左側にネイティブ Side Panel を表示できます',

  'settings.archive.searchPlaceholder': 'アーカイブを検索...',
  'settings.archive.clearAll': '全削除',
  'settings.archive.empty': 'アーカイブされたタブはありません',
  'settings.archive.restore': '復元',
  'settings.archive.restoreLabel': '{title} を復元',
  'settings.archive.remove': '削除',
  'settings.archive.removeLabel': '{title} を削除',
  'settings.time.minutesAgo': '{count}分前',
  'settings.time.hoursAgo': '{count}時間前',
  'settings.time.daysAgo': '{count}日前',

  'settings.import.introPre': 'Arc の',
  'settings.import.introPost':
    'を選択すると、Top Apps を全 Space 共通 Favorite に、各 Space のテーマ・アイコン・ピン留め・フォルダを一括取り込みします。',
  'settings.import.copied': 'コピー済',
  'settings.import.copyPath': 'パス',
  'settings.import.pickFile': 'StorableSidebar.json を選択',
  'settings.import.pickFileHint': 'ファイル選択画面で Cmd+Shift+G を押すとパスを貼り付けできます',
  'settings.import.skipEmpty': '空のフォルダを除外する',
  'settings.import.skipSearches': 'Google 検索結果URLを除外する',
  'settings.import.dedupe': 'Space 内の重複URLをまとめる',
  'settings.import.previewTitle': 'インポート内容プレビュー',
  'settings.import.previewFavorites': '全Space共通 Favorite: {count} 件',
  'settings.import.previewSpaces': 'Spaces ({count}): {names}',
  'settings.import.previewPins': 'ピン留め: {pins} 件 / フォルダ: {folders} 個',
  'settings.import.previewCleanup':
    '自動整理: 重複 {deduped} / 空フォルダ {empty} / 検索URL {searches} 件を除外',
  'settings.import.exportBackup': 'JSON バックアップ出力',
  'settings.import.run': 'インポート実行',
  'settings.import.running': 'インポート中...',
  'settings.import.errorParse': 'JSON の解析に失敗しました。',
  'settings.import.errorFile': '有効な JSON ファイルを選択してください。',
  'settings.import.errorFailed': 'インポートに失敗しました。',

  'settings.shortcuts.customTitle': 'Arcline ショートカット（カスタム設定）',
  'settings.shortcuts.customHint':
    'キー欄をクリックして任意のキーを押すと、Arcline の設定画面から直接変更できます（全 Web ページで動作）。',
  'settings.shortcuts.browserTitle': 'ブラウザ拡張ショートカット',
  'settings.shortcuts.browserHint':
    'brave:// などの特殊ページでも動作するシステムショートカットです。変更はブラウザのショートカット設定から行えます。',
  'settings.shortcuts.openBrowserShortcuts': '拡張ショートカット設定を開く',
  'settings.shortcuts.openBraveShortcuts': 'Brave ショートカット',
  'settings.shortcuts.notSet': '未設定',
  'settings.shortcuts.openCommandBar': 'コマンドバーを開く',
  'settings.shortcuts.toggleSidebar': 'サイドバーを開く / 閉じる',
  'settings.shortcuts.toggleSidebarNote':
    'macOS: Control+Shift+B（⌃B / ⌘B と競合しません）· Win/Linux: Alt+Shift+B',
  'settings.shortcuts.nextSpace': '次の Space へ移動',
  'settings.shortcuts.previousSpace': '前の Space へ移動',
  'settings.shortcuts.switchSpace': '前後の Space へ切替',
  'settings.shortcuts.switchSpaceNote': 'Windows/Linux: Alt+Shift+←/→',
  'settings.shortcuts.swipeKey': '2本指スワイプ',
  'settings.shortcuts.swipe': 'サイドバー上で左右スワイプして Space 切替',
  'settings.shortcuts.pin': '現在のタブをピン留め / 解除',
  'settings.shortcuts.pinNote': 'Windows/Linux: Alt+Shift+D',
  'settings.shortcuts.search': 'クイック検索にフォーカス',
  'settings.shortcuts.searchNote': 'Windows/Linux: Ctrl+K',
  'settings.shortcuts.escape': '検索・メニュー・オーバーレイを閉じる',

  // Favorite aliases & shortcuts
  'settings.favShortcuts.title': 'Favorite エイリアス ＆ ショートカット',
  'settings.favShortcuts.hint':
    'Alias: 新規タブ検索・Raycast で打つと最上位に表示。ショートカット: ボタンを押して任意のキー組み合わせ（例: ⌥1, ⌃⇧M）を登録するとブラウザのどこからでも 1 発で開けます。',
  'settings.favShortcuts.empty': 'サイドバーに Favorite を追加すると設定できます。',
  'settings.favShortcuts.aliasPlaceholder': 'alias',
  'settings.favShortcuts.aliasAria': '{title} のエイリアス',
  'settings.favShortcuts.keyPlaceholder': 'キー設定…',
  'settings.favShortcuts.recording': 'キーを入力…',
  'settings.favShortcuts.keyAria': '{title} のショートカットキー',
  'settings.favShortcuts.clearKeyAria': '{title} のショートカットを解除',

  // Custom site searches
  'settings.siteSearch.title': 'サイト内検索ショートカット（Tab-to-Search）',
  'settings.siteSearch.hint':
    '新規タブや Raycast で「接頭辞 + Tab（またはスペース）」と打つと特定サイトを直接検索できます。URL 内の検索語の位置に %s を入れてください。',
  'settings.siteSearch.prefixPlaceholder': '接頭辞',
  'settings.siteSearch.labelPlaceholder': 'サイト名（例: 社内Wiki）',
  'settings.siteSearch.urlPlaceholder': '%s を含む検索 URL',
  'settings.siteSearch.add': '追加',
  'settings.siteSearch.save': '保存',
  'settings.siteSearch.cancel': 'キャンセル',
  'settings.siteSearch.editAria': '{label} のサイト検索を編集',
  'settings.siteSearch.toggleAria': '{label} のサイト検索を有効/無効切替',
  'settings.siteSearch.invalid':
    '半角英数字の接頭辞、サイト名、および %s を含む http(s):// URL を入力してください。',
  'settings.siteSearch.removeAria': '{label} のサイト検索を削除',
  'settings.siteSearch.builtInTitle':
    'ビルトイン AI・Web ショートカット（クリックで有効 / 無効切替）',

  // Feedback & support
  'settings.feedback.title': 'フィードバック・バグ報告',
  'settings.feedback.description': '感想・要望・不具合を気軽に送れます（ログイン不要）。',
  'settings.feedback.form': 'フィードバックフォーム',
  'settings.feedback.github': 'GitHub Issues',
};
