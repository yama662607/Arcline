# **ブラウザ環境におけるウィンドウ境界操作とリサイズ検出技術に関する包括的研究報告書**

## **1\. 序論：ウェブとネイティブデスクトップの境界**

現代のウェブブラウザは、オペレーティングシステム（OS）上で動作するアプリケーションでありながら、その内部に独自のサンドボックス化されたレンダリングエンジンを持つ特殊な環境です。ユーザーがブラウザのウィンドウ枠（ボーダー）にマウスカーソルを合わせた際、カーソル形状が「リサイズモード（双方向矢印）」に変化する挙動は、OSのウィンドウマネージャによって制御される「非クライアント領域（Non-Client Area）」の機能です。

本報告書は、Chrome拡張機能の開発者が、JavaScriptおよびブラウザAPIを使用してこの「リサイズモード」の状態を検出するための技術的課題、OSごとの挙動の差異、そしてヒューリスティックな検出アルゴリズムについて、提供された膨大な技術資料に基づき網羅的に分析したものです。特に、Windows 10/11における「不可視の境界線（Invisible Borders）」やmacOSのシャドウレンダリングが座標計算に与える影響について深く掘り下げます。

## **2\. ウィンドウアーキテクチャとイベント伝播のメカニズム**

ブラウザウィンドウのリサイズ検出を理解するためには、まずOSレベルでのウィンドウ構成と、それがブラウザエンジン（Chromium）によってどのように抽象化され、DOM（Document Object Model）イベントとして露出されるかを解明する必要があります。

### **2.1 クライアント領域と非クライアント領域の分離**

Windows APIおよび一般的なGUIフレームワークにおいて、ウィンドウは大きく二つの領域に分類されます1。

1. **クライアント領域 (Client Area):** アプリケーションがコンテンツを描画する領域です。ブラウザにおいては、Webページが表示されるビューポート（window.innerWidth / window.innerHeight で計測される領域）がこれに相当します3。  
2. **非クライアント領域 (Non-Client Area, NCA):** ウィンドウのタイトルバー、最小化/最大化/閉じるボタン、そしてウィンドウ枠（ボーダー）を含む領域です。この領域の描画とイベント処理は、伝統的にOS（WindowsのDWMやmacOSのQuartzなど）が管轄します1。

マウスカーソルがウィンドウ枠上にあり、リサイズ用の矢印（IDC\_SIZEWEやns-resizeなど）として表示されている瞬間、マウスイベントは「非クライアント領域」で発生しています。セキュリティと抽象化の観点から、ブラウザはこの非クライアント領域のイベントをWebページのJavaScriptコンテキスト（DOMイベント）として直接的には通知しません5。

### **2.2 OSレベルでのヒットテスト：WM\_NCHITTEST**

Windows環境において、カーソル形状の変化はWM\_NCHITTESTというウィンドウメッセージによって制御されています6。OSはマウスの移動に伴い、アプリケーションに対して「現在の座標はウィンドウのどの部分に該当するか？」を問い合わせます。

| 戻り値 | 定数名 | 意味 | カーソル挙動 |
| :---- | :---- | :---- | :---- |
| 1 | HTCLIENT | クライアント領域 | アプリ指定（通常は矢印やIビーム） |
| 10 | HTLEFT | 左側の境界 | 水平リサイズ (\<- \-\>) |
| 11 | HTRIGHT | 右側の境界 | 水平リサイズ (\<- \-\>) |
| 12 | HTTOP | 上側の境界 | 垂直リサイズ |
| 15 | HTBOTTOM | 下側の境界 | 垂直リサイズ |
| 17 | HTBOTTOMRIGHT | 右下の角 | 対角リサイズ |

資料1および6が示すように、ブラウザウィンドウの枠上にマウスがある場合、ブラウザプロセスはOSに対してHTLEFTやHTRIGHTなどを返却します。これによりOSがカーソルを描画します。しかし、Chrome拡張機能のJavaScript（Content Script）はこのWM\_NCHITTESTメッセージを傍受できません。したがって、拡張機能側からは「カーソルがリサイズモードになった」という事実を直接知るAPIが存在しないという根本的な制約があります。

### **2.3 イベントの断絶**

JavaScriptのmousemoveやmouseoverイベントは、基本的にHTCLIENT（クライアント領域）内でのみ発火します。マウスが境界線（非クライアント領域）に移動した瞬間、DOMの観点からは「マウスがウィンドウから出た（mouseleave / mouseout）」と判定されます7。この挙動の差異が、リサイズ検出を困難にする主要因です。

## **3\. 現代OSにおける「不可視の境界線」の複雑性**

Windows 10および11の導入により、ウィンドウのデザイン言語は大きく変化しました。かつてのWindows 7（Aeroテーマ）のような太い半透明の枠線は廃止され、視覚的には1ピクセル程度の極細の線、あるいは枠線なしのデザインが採用されています。この変化は、リサイズ検出のロジックに重大な影響を与えます。

### **3.1 視覚的境界と論理的境界の乖離**

Windows 10以降では、リサイズ操作のユーザビリティを維持するため、視覚的な枠線の外側に「透明なパディング領域」が存在します。これが「不可視の境界線（Invisible Borders）」です。

資料8によると、この不可視領域の幅はシステムメトリクスSM\_CXPADDEDBORDERによって定義されます。デフォルトでは92ツゥイップ（twips）などの値が設定され、画面のDPIスケーリングに応じて物理ピクセルに変換されますが、一般的には**7px〜8px**程度の幅となります10。

この不可視領域は以下のパラドックスを引き起こします：

* **ユーザーの認識:** マウスはウィンドウの「外」にある（ウィンドウの視覚的な端より外側にある）。  
* **OSの認識:** マウスはウィンドウの「枠上」にある（リサイズカーソルを表示する）。  
* **JavaScriptの認識:** マウスはドキュメントの外にある。

### **3.2 window.outerWidth と座標の矛盾**

Chrome拡張機能からウィンドウサイズを取得する際、window.outerWidthプロパティが使用されます。これはウィンドウ全体の幅を返すと定義されています12。しかし、Windows 10におけるouterWidthには、この「不可視の境界線（影の領域）」が含まれているか否かについて、ブラウザやバージョンによる挙動の揺れや開発者の混乱が見られます。

Electronの不具合報告（Issue \#4045）に関する資料14は、この問題を明確に示しています。BrowserWindow.getBounds()（Chromiumの内部実装に依存）が返すX座標が0であっても、実際にはデスクトップの背景がウィンドウの左側に7px程度見えている現象が報告されています。これは、OSが報告するウィンドウの境界（不可視領域を含む）と、ユーザーが認識するウィンドウの境界（可視領域）が一致していないことを意味します。

この事実は、検出アルゴリズムにおいて「座標の補正（Offset Calculation）」が不可欠であることを示唆しています。単に window.screenX \+ window.outerWidth を計算するだけでは、実際の可視境界とずれてしまい、リサイズカーソルが表示される正確な位置を特定できません。

## **4\. 座標系と測定プロパティの完全分析**

リサイズ検出のヒューリスティックを構築するためには、ブラウザが提供する多様な座標系とその相互関係を正確に理解する必要があります。以下の表は、各プロパティの特性と本課題への関連性を整理したものです。

| プロパティ | 定義と特性 | リサイズ検出への関連性 | 参照資料 |
| :---- | :---- | :---- | :---- |
| screenX/Y (MouseEvent) | モニター左上を原点とするマウスの絶対座標。マルチモニター環境では値が連続する。 | 最も信頼できる「真のマウス位置」。OSレベルでの判定基準となる。 | 15 |
| window.screenX/Y | モニター左上を原点とするウィンドウ左上の座標。 | ウィンドウの位置特定に必須。ただし、最大化時に負の値（例: \-8px）を取るケースがある。 | 16 |
| clientX/Y (MouseEvent) | ビューポート左上を原点とするマウス座標。スクロールの影響を受けない。 | コンテンツ領域内でのマウス位置追跡に使用。境界への接近検知に利用。 | 18 |
| pageX/Y (MouseEvent) | ドキュメント左上を原点とするマウス座標。スクロール量を含む。 | ページ全体に対する位置。リサイズ検出にはclientXの方が適している場合が多い。 | 20 |
| window.outerWidth | ボーダー、スクロールバーを含めたウィンドウ全体の幅。 | ウィンドウの右端の座標計算に使用（window.screenX \+ outerWidth）。 | 4 |
| window.innerWidth | コンテンツ表示領域（ビューポート）の幅。スクロールバーを含む。 | DOMイベントが発火する限界値の目安。 | 3 |

### **4.1 最大化時の負座標問題**

資料17および22で議論されているように、Windows 10でウィンドウを最大化した際、window.screenX や window.screenY が \-8 や \-7 といった負の値を返す現象が確認されています。これはバグではなく、ウィンドウマネージャの仕様です。最大化時にはリサイズ用の不可視ボーダーが画面外にはみ出すように配置されるため、論理的な原点は画面の左上（0,0）よりも左上側（-8, \-8）に位置することになります。

検出アルゴリズムでは、window.state（最大化状態）を確認し、この負のオフセットを補正する必要があります。さもなければ、マウスが画面端にあるにもかかわらず、計算上はウィンドウ内部にあると誤判定されるリスクがあります。

## **5\. リサイズカーソル検出のためのヒューリスティックアルゴリズム**

APIによる直接的な状態取得が不可能であるため、複数のデータポイントを組み合わせた推論（ヒューリスティック）による検出が必要です。以下に、研究資料から導き出される最適なアルゴリズムを詳述します。

### **5.1 「接近」と「離脱」の監視 (Approach and Exit Strategy)**

最も確実なシグナルは、マウスカーソルがビューポートの端に接近し、その後「ドキュメントから出た（mouseleave）」という一連のイベントフローです。

#### **フェーズ1：接近検知 (Proximity Detection)**

mousemoveイベントを監視し、カーソル座標がビューポートの境界付近にあるかを判定します23。

JavaScript

const EDGE\_THRESHOLD \= 5; // 境界判定の閾値（ピクセル）

document.addEventListener('mousemove', (e) \=\> {  
    const isNearRight \= (window.innerWidth \- e.clientX) \< EDGE\_THRESHOLD;  
    const isNearBottom \= (window.innerHeight \- e.clientY) \< EDGE\_THRESHOLD;  
      
    if (isNearRight |

| isNearBottom) {  
        // リサイズ領域に接近中  
        extensionState.isNearBorder \= true;  
    }  
});

#### **フェーズ2：離脱検知 (Exit Detection)**

マウスが実際にリサイズハンドル（非クライアント領域）に入ると、ドキュメントからはmouseleaveイベントが発火します。この際、relatedTargetプロパティを確認することが重要です24。

* **relatedTarget が null の場合:** マウスはブラウザのウィンドウ外、または非クライアント領域（リサイズ枠、タイトルバー）に移動した可能性が高いです。  
* **relatedTarget が要素の場合:** マウスはドキュメント内の別の要素（iframeなど）に移動しただけです26。

資料27によると、mouseleaveはバブリングしないため、mouseoutよりも正確に「ウィンドウからの退出」を捉えることができます。

### **5.2 座標による確定ロジック (Coordinate Confirmation Logic)**

mouseleaveが発火した瞬間のマウス座標（screenX, screenY）と、ウィンドウの境界座標を比較することで、カーソルがリサイズハンドル上にあるかを高い確率で推定できます。

右側境界の判定式:

$$\\text{IsRightResize} \= (\\text{MouseScreenX} \\ge (\\text{WindowScreenX} \+ \\text{WindowInnerWidth})) \\land (\\text{MouseScreenX} \\le (\\text{WindowScreenX} \+ \\text{WindowOuterWidth}))$$  
ただし、前述のWindows 10の「不可視ボーダー」の問題があるため、この判定には許容誤差（Padding Tolerance）を含める必要があります。

### **5.3 状態機械による推論モデル**

検出精度を高めるためには、単純な条件分岐ではなく、状態機械（State Machine）として実装することが推奨されます。

1. **State: INSIDE** \- マウスはコンテンツ内にある。  
2. **State: PROXIMITY** \- マウスは境界から数ピクセル以内にある。  
3. **State: BORDER\_HOVER** \- mouseleaveが発生し、かつ座標がウィンドウ枠の範囲内にある（ここでカーソルはリサイズモードになっていると推定）。  
4. **State: RESIZING** \- mousedown が発生し、その後 window.resize イベントが連続して発火している状態28。

資料30や31では、リサイズの「開始」と「終了」を検知するために、resizeイベントとsetTimeout（デバウンス処理）を組み合わせる手法が議論されています。リサイズ中はイベントが頻発するため、パフォーマンスへの配慮（Throttling）が不可欠です29。

## **6\. プラットフォーム別・環境別の考慮事項**

### **6.1 Windows環境における特異点**

Windows 10/11では、ウィンドウがアクティブか非アクティブかによって、影の描画や境界の判定が微妙に変化する可能性があります。また、資料11にあるように、DwmGetWindowAttributeを使用してDWMWA\_EXTENDED\_FRAME\_BOUNDSを取得しない限り、真の視覚的な境界を取得するのは困難です（ただし、これはネイティブコードの話であり、JSからはアクセスできません）。  
したがって、Chrome拡張機能としては、OSバージョンを判定し（User Agent等から）、Windows 10/11であれば「左右および下に約7px〜8pxの不可視ヒットエリアがある」という前提で補正値をハードコーディングまたは設定可能にするアプローチが現実的です。

### **6.2 macOS環境における特異点**

macOS（Cocoa）のウィンドウは、Windowsのような「不可視の太い枠」を持たず、シャドウはCore Graphicsによって描画されます32。しかし、リサイズ操作の許容範囲（ヒットエリア）は存在します。  
特筆すべきは、macOSではOptionキーを押しながらリサイズすることで「中心を基準としたリサイズ（対角リサイズ）」が可能になる点です33。この挙動を考慮し、拡張機能側でもevent.altKey（MacのOptionキーに対応）の状態を監視する必要があります。

### **6.3 Chrome API chrome.windows の活用**

通常のWebページ内のJavaScriptだけでなく、Chrome拡張機能特有のAPIであるchrome.windowsを利用することで、より正確な情報を得られる可能性があります35。

JavaScript

chrome.windows.get(windowId, (win) \=\> {  
    console.log(win.width, win.height, win.left, win.top);  
});

chrome.windows.getで取得できるwidthはouterWidthに相当します。これをバックグラウンドスクリプトで定期的に、あるいはonBoundsChangedイベント35で監視し、コンテンツスクリプトとメッセージングを行うことで、現在のウィンドウ座標を正確に把握し続けることが可能です。これにより、screenXの計算精度を補完できます。

## **7\. 実装上の課題と解決策**

### **7.1 iframeとマルチフレーム問題**

ページ内にiframeが存在し、それが画面端に接している場合、マウスがiframeに入ると親フレームからはmouseoutが発生します26。これを「ウィンドウ外に出た」と誤認しないためには、all\_frames: trueを設定したコンテンツスクリプトを注入し、フレーム間でのメッセージ連携を行うか、relatedTargetがiframe要素であるかをチェックするロジックが必要です。

### **7.2 高DPI（HiDPI）スケーリング**

Windowsの「拡大縮小とレイアウト（125%, 150%など）」設定は、screenXやouterWidthの値に影響を与えます。物理ピクセルと論理ピクセル（CSSピクセル）の変換において、ブラウザやOSのバージョンにより挙動が異なるケースがあります36。window.devicePixelRatioを用いて座標を正規化する処理を組み込むことが、クロスデバイスでの動作保証には不可欠です。

### **7.3 パフォーマンスへの影響**

マウス移動のたびに座標計算やメッセージングを行うことは、CPU負荷を高める要因となります。資料29で指摘されているように、requestAnimationFrameを用いたスロットリング（Throttling）や、境界付近でのみ詳細な計算を行う最適化が必要です。

## **8\. 結論と推奨実装方針**

「Chrome拡張機能でウィンドウ枠のリサイズカーソル状態を検出する」という要件は、ブラウザのサンドボックス設計により、直接的なAPI（cursor: resizeの状態取得など）では実現不可能です。しかし、本調査により、以下の複合的なアプローチによって高い精度で状態を推定できることが明らかになりました。

1. **境界進入の検知:** mousemoveイベントでビューポート端（内部バッファ数ピクセル）への接近を監視する。  
2. **境界滞在の推定:** mouseleaveイベントが発火し、かつrelatedTargetがnullであり、直前のマウス座標がウィンドウ境界の計算値（screenX \+ outerWidth \- OS補正値）と一致する場合、「リサイズ待機状態」と判定する。  
3. **OS固有の補正:** Windows 10/11環境下では、左右および下端に対して約7pxの不可視ヒットエリア（パディング）を考慮した当たり判定を行う。  
4. **リサイズ動作の追跡:** resizeイベントの発火頻度や、ResizeObserverによる要素サイズの変動を監視し、実際にリサイズが行われていることを確認する。

この実装においては、OSの差異（特にWindowsの影の領域）とDPIスケーリングによる座標ズレが最大のリスク要因となります。したがって、固定値に頼りすぎず、ユーザー環境に応じたキャリブレーションや、chrome.windowsAPIからの情報を補助的に使用する設計が推奨されます。

### ---

**参考文献リスト（文中引用）**

* **CSS/JS基礎:** 3  
* **マウスイベント・座標:** 7  
* **Windows OS仕様・API:** 1  
* **macOS仕様:** 13  
* **Chrome/Electron内部挙動・バグ:** 13  
* **リサイズ監視・最適化:** 28

#### **引用文献**

1. Nonclient-Area Mouse Messages \- TU Chemnitz, 12月 19, 2025にアクセス、 [https://www-user.tu-chemnitz.de/\~heha/hs/chm/petzold.chm/petzoldi/ch07d.htm](https://www-user.tu-chemnitz.de/~heha/hs/chm/petzold.chm/petzoldi/ch07d.htm)  
2. Solved: Mouse leaving the client area \- Experts Exchange, 12月 19, 2025にアクセス、 [https://www.experts-exchange.com/questions/10787921/Mouse-leaving-the-client-area.html](https://www.experts-exchange.com/questions/10787921/Mouse-leaving-the-client-area.html)  
3. Window: innerWidth property \- Web APIs | MDN, 12月 19, 2025にアクセス、 [https://developer.mozilla.org/en-US/docs/Web/API/Window/innerWidth](https://developer.mozilla.org/en-US/docs/Web/API/Window/innerWidth)  
4. What is Difference Between innerWidth and outerWidth in JavaScript? \- GeeksforGeeks, 12月 19, 2025にアクセス、 [https://www.geeksforgeeks.org/javascript/what-is-difference-between-innerwidth-and-outerwidth-in-javascript/](https://www.geeksforgeeks.org/javascript/what-is-difference-between-innerwidth-and-outerwidth-in-javascript/)  
5. Element: mouseenter event \- Web APIs | MDN, 12月 19, 2025にアクセス、 [https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseenter\_event](https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseenter_event)  
6. WM\_NCHITTEST message (Winuser.h) \- Win32 apps | Microsoft Learn, 12月 19, 2025にアクセス、 [https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-nchittest](https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-nchittest)  
7. Element: mouseleave event \- Web APIs | MDN, 12月 19, 2025にアクセス、 [https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseleave\_event](https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseleave_event)  
8. How to increase border thickness? : r/windows \- Reddit, 12月 19, 2025にアクセス、 [https://www.reddit.com/r/windows/comments/dukizv/how\_to\_increase\_border\_thickness/](https://www.reddit.com/r/windows/comments/dukizv/how_to_increase_border_thickness/)  
9. GetSystemMetrics function (winuser.h) \- Win32 apps | Microsoft Learn, 12月 19, 2025にアクセス、 [https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getsystemmetrics](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getsystemmetrics)  
10. WPF and WIndows 10\. Invisible border around windows? \- Stack Overflow, 12月 19, 2025にアクセス、 [https://stackoverflow.com/questions/35259756/wpf-and-windows-10-invisible-border-around-windows](https://stackoverflow.com/questions/35259756/wpf-and-windows-10-invisible-border-around-windows)  
11. GetWindowRect returns a size including "invisible" borders \- Stack Overflow, 12月 19, 2025にアクセス、 [https://stackoverflow.com/questions/34139450/getwindowrect-returns-a-size-including-invisible-borders](https://stackoverflow.com/questions/34139450/getwindowrect-returns-a-size-including-invisible-borders)  
12. What is the difference between window.innerWidth window.outerWidth? \- Stack Overflow, 12月 19, 2025にアクセス、 [https://stackoverflow.com/questions/12066093/what-is-the-difference-between-window-innerwidth-window-outerwidth](https://stackoverflow.com/questions/12066093/what-is-the-difference-between-window-innerwidth-window-outerwidth)  
13. Window: outerWidth property \- Web APIs \- MDN Web Docs, 12月 19, 2025にアクセス、 [https://developer.mozilla.org/en-US/docs/Web/API/Window/outerWidth](https://developer.mozilla.org/en-US/docs/Web/API/Window/outerWidth)  
14. Windows 10 Browser Window Bounds Calculating Incorrectly · Issue ..., 12月 19, 2025にアクセス、 [https://github.com/electron/electron/issues/4045](https://github.com/electron/electron/issues/4045)  
15. MouseEvent: screenX property \- Web APIs | MDN, 12月 19, 2025にアクセス、 [https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/screenX](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/screenX)  
16. Browser Object Model \- JavaScript Institute, 12月 19, 2025にアクセス、 [https://www.javascriptinstitute.org/javascript-tutorial/browser-object-model/](https://www.javascriptinstitute.org/javascript-tutorial/browser-object-model/)  
17. Window position ignoring negative values : r/Windows10 \- Reddit, 12月 19, 2025にアクセス、 [https://www.reddit.com/r/Windows10/comments/4qey6e/window\_position\_ignoring\_negative\_values/](https://www.reddit.com/r/Windows10/comments/4qey6e/window_position_ignoring_negative_values/)  
18. Mouse events \- The Modern JavaScript Tutorial, 12月 19, 2025にアクセス、 [https://javascript.info/mouse-events-basics](https://javascript.info/mouse-events-basics)  
19. clientX vs pageX vs screenX vs offsetX \- YouTube, 12月 19, 2025にアクセス、 [https://www.youtube.com/watch?v=dxADq\_DlS-w](https://www.youtube.com/watch?v=dxADq_DlS-w)  
20. MouseEvent: pageX property \- Web APIs | MDN, 12月 19, 2025にアクセス、 [https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/pageX](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/pageX)  
21. Why is the X/Y position of a Maximized Frame negative instead of Zero?, 12月 19, 2025にアクセス、 [https://community.appeon.com/qna/q-a/why-is-the-x-y-position-of-a-maximized-frame-negative-instead-of-zero](https://community.appeon.com/qna/q-a/why-is-the-x-y-position-of-a-maximized-frame-negative-instead-of-zero)  
22. window.screenX inconsistencies in Windows 10 with Electron (Chrome) \- Stack Overflow, 12月 19, 2025にアクセス、 [https://stackoverflow.com/questions/53241601/window-screenx-inconsistencies-in-windows-10-with-electron-chrome](https://stackoverflow.com/questions/53241601/window-screenx-inconsistencies-in-windows-10-with-electron-chrome)  
23. How to Get Mouse Position in JavaScript | by ryan \- Medium, 12月 19, 2025にアクセス、 [https://medium.com/@ryan\_forrester\_/how-to-get-mouse-position-in-javascript-37e4772a3f21](https://medium.com/@ryan_forrester_/how-to-get-mouse-position-in-javascript-37e4772a3f21)  
24. Javascript event when mouse leaves browser window \[duplicate\] \- Stack Overflow, 12月 19, 2025にアクセス、 [https://stackoverflow.com/questions/1672142/javascript-event-when-mouse-leaves-browser-window](https://stackoverflow.com/questions/1672142/javascript-event-when-mouse-leaves-browser-window)  
25. How can I detect when the mouse leaves the window? \- Stack Overflow, 12月 19, 2025にアクセス、 [https://stackoverflow.com/questions/923299/how-can-i-detect-when-the-mouse-leaves-the-window](https://stackoverflow.com/questions/923299/how-can-i-detect-when-the-mouse-leaves-the-window)  
26. Detect mouse move event when over an iframe in chrome extension \- Stack Overflow, 12月 19, 2025にアクセス、 [https://stackoverflow.com/questions/78332800/detect-mouse-move-event-when-over-an-iframe-in-chrome-extension](https://stackoverflow.com/questions/78332800/detect-mouse-move-event-when-over-an-iframe-in-chrome-extension)  
27. MouseLeave vs Mouseout. Yeah, they behave very different | by Saravanan M | Nerd For Tech | Medium, 12月 19, 2025にアクセス、 [https://medium.com/nerd-for-tech/mouseleave-vs-mouseout-85ccea942317](https://medium.com/nerd-for-tech/mouseleave-vs-mouseout-85ccea942317)  
28. resize event \- jQuery API Documentation, 12月 19, 2025にアクセス、 [https://api.jquery.com/resize/](https://api.jquery.com/resize/)  
29. Avoiding pitfalls with the resize event in JavaScript \- OpenReplay Blog, 12月 19, 2025にアクセス、 [https://blog.openreplay.com/avoiding-resize-event-pitfalls-js/](https://blog.openreplay.com/avoiding-resize-event-pitfalls-js/)  
30. Detect when a window is resized using JavaScript ? \[duplicate\] \- Stack Overflow, 12月 19, 2025にアクセス、 [https://stackoverflow.com/questions/2996431/detect-when-a-window-is-resized-using-javascript](https://stackoverflow.com/questions/2996431/detect-when-a-window-is-resized-using-javascript)  
31. Detect click on resizable element's resize handle \- Stack Overflow, 12月 19, 2025にアクセス、 [https://stackoverflow.com/questions/49136251/detect-click-on-resizable-elements-resize-handle](https://stackoverflow.com/questions/49136251/detect-click-on-resizable-elements-resize-handle)  
32. Mac OS X 10.7 Window Shadow Params \- Ask Different \- Apple Stack Exchange, 12月 19, 2025にアクセス、 [https://apple.stackexchange.com/questions/73849/mac-os-x-10-7-window-shadow-params](https://apple.stackexchange.com/questions/73849/mac-os-x-10-7-window-shadow-params)  
33. How to Resize a Window from the Centre on macOS \- YouTube, 12月 19, 2025にアクセス、 [https://www.youtube.com/watch?v=QU1\_wSr56wc](https://www.youtube.com/watch?v=QU1_wSr56wc)  
34. Window resize handle cheat sheet : r/MacOS \- Reddit, 12月 19, 2025にアクセス、 [https://www.reddit.com/r/MacOS/comments/13rqrca/window\_resize\_handle\_cheat\_sheet/](https://www.reddit.com/r/MacOS/comments/13rqrca/window_resize_handle_cheat_sheet/)  
35. chrome.windows | API \- Chrome for Developers, 12月 19, 2025にアクセス、 [https://developer.chrome.com/docs/extensions/reference/api/windows](https://developer.chrome.com/docs/extensions/reference/api/windows)  
36. MouseEvent: movementX property \- Web APIs | MDN, 12月 19, 2025にアクセス、 [https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/movementX](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/movementX)  
37. How to change the cursor shape using CSS \- SheCodes, 12月 19, 2025にアクセス、 [https://www.shecodes.io/athena/127602-how-to-change-the-cursor-shape-using-css](https://www.shecodes.io/athena/127602-how-to-change-the-cursor-shape-using-css)  
38. cursor \- CSS \- MDN Web Docs, 12月 19, 2025にアクセス、 [https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor)  
39. Window: resize event \- Web APIs | MDN, 12月 19, 2025にアクセス、 [https://developer.mozilla.org/en-US/docs/Web/API/Window/resize\_event](https://developer.mozilla.org/en-US/docs/Web/API/Window/resize_event)  
40. Is it possible to turn visible the invisible window's borders of Windows 10? \- Super User, 12月 19, 2025にアクセス、 [https://superuser.com/questions/1098708/is-it-possible-to-turn-visible-the-invisible-windows-borders-of-windows-10](https://superuser.com/questions/1098708/is-it-possible-to-turn-visible-the-invisible-windows-borders-of-windows-10)  
41. GetThemeSysSize function (uxtheme.h) \- Win32 apps | Microsoft Learn, 12月 19, 2025にアクセス、 [https://learn.microsoft.com/en-us/windows/win32/api/uxtheme/nf-uxtheme-getthemesyssize](https://learn.microsoft.com/en-us/windows/win32/api/uxtheme/nf-uxtheme-getthemesyssize)  
42. Window \- Web APIs, 12月 19, 2025にアクセス、 [https://udn.realityripple.com/docs/Web/API/Window](https://udn.realityripple.com/docs/Web/API/Window)  
43. Is there a workaround for Windows 10 invisible frame border in java? \- Stack Overflow, 12月 19, 2025にアクセス、 [https://stackoverflow.com/questions/54096071/is-there-a-workaround-for-windows-10-invisible-frame-border-in-java](https://stackoverflow.com/questions/54096071/is-there-a-workaround-for-windows-10-invisible-frame-border-in-java)  
44. Move and arrange app windows on Mac \- Apple support (MM), 12月 19, 2025にアクセス、 [https://support.apple.com/my-mm/guide/mac-help/mchlp2469/mac](https://support.apple.com/my-mm/guide/mac-help/mchlp2469/mac)  
45. Resizing Window with Cocoa \- AppleScript Studio & Xcode \- MacScripter, 12月 19, 2025にアクセス、 [https://www.macscripter.net/t/resizing-window-with-cocoa/40843](https://www.macscripter.net/t/resizing-window-with-cocoa/40843)  
46. chrome.app.window | Platform Apps APIs \- Chrome for Developers, 12月 19, 2025にアクセス、 [https://developer.chrome.com/docs/apps/reference/app/window](https://developer.chrome.com/docs/apps/reference/app/window)  
47. chrome.windows.create() incorrectly interpret width & height starting from 25.0.1364.58 \[40300745\] \- Chromium Issue, 12月 19, 2025にアクセス、 [https://issues.chromium.org/issues/40300745](https://issues.chromium.org/issues/40300745)  
48. BrowserWindow.getBounds() includes transparent space taken up by shadows on Wayland · Issue \#48589 \- GitHub, 12月 19, 2025にアクセス、 [https://github.com/electron/electron/issues/49209/linked\_closing\_reference?reference\_location=REPO\_ISSUES\_INDEX](https://github.com/electron/electron/issues/49209/linked_closing_reference?reference_location=REPO_ISSUES_INDEX)  
49. ResizeObserver \- Web APIs | MDN, 12月 19, 2025にアクセス、 [https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver)  
50. window.resize or ResizeObserver. Learn the difference between… | by Dhrutijoshi \- Medium, 12月 19, 2025にアクセス、 [https://medium.com/@dhrutijoshi348/window-resize-or-resizeobserver-122d1e5346c0](https://medium.com/@dhrutijoshi348/window-resize-or-resizeobserver-122d1e5346c0)