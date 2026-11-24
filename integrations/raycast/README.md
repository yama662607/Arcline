# Arcline — Raycast Extension

Call Arcline's Command Bar, Favorites, Space Pinned Folders, and Browser History from **anywhere on macOS** with a single global hotkey (e.g. `⌥ Space` or `⌘ ⇧ K`).

<a href="#japanese">日本語ガイドはこちら ↓</a>

---

## Commands

| Command | Mode | What It Does |
| --- | --- | --- |
| **Search Arcline Command Bar** | View | Instant fused search across Global Favorites, Space Pinned Links/Folders, and copied-DB Browser History — plus `g `, `gh `, `yt `, `wiki `, `gpt `, `pplx ` Site Search shortcuts and Web Search fallback. |
| **Browse Arcline Spaces** | View | Inspect all Arcline Spaces, pin/folder counts, nested folders, and launch or copy URLs. |
| **Open Arcline New Tab** | No-View | Focuses Brave / Chrome from any app and opens a fresh Arcline Command Bar New Tab via global hotkey. |
| **Add Pin to Arcline Space** | Form | Save a URL + optional Title & Folder Path straight into any Arcline Space. |

## Setup (Local Import into Raycast)

1. Install dependencies once inside this directory:
   ```bash
   cd integrations/raycast
   bun install
   ```
2. Open **Raycast** → run **Import Extension** → select `<your-clone>/integrations/raycast` (or run `bun run dev` once so Raycast registers the extension locally).
3. Open **Raycast Settings → Extensions → Arcline**:
   - Choose your **Browser** (`Brave Browser`, `Google Chrome`, or `Chromium`) and **Profile Directory** (`Default` by default).
   - Assign a **Global Hotkey** (for example, `⌘ ⇧ Space` or `⌥ T`) to **Search Arcline Command Bar** or **Open Arcline New Tab**.

---

<a id="japanese"></a>
## 日本語セットアップガイド

どのアプリを使っていても、グローバルホットキー 1 つで Arcline のお気に入り・Space ピン留め・履歴検索や新規タブ検索を呼び出せる公式 Raycast 拡張です。

1. `integrations/raycast` で一度だけ依存をインストールします：
   ```bash
   cd integrations/raycast
   bun install
   ```
2. **Raycast** を開き、**Import Extension** コマンドから `<クローン先>/integrations/raycast` を選択します（または `bun run dev` を一度実行して Raycast にローカル登録します）。
3. **Raycast 設定 → Extensions → Arcline** で以下を設定します：
   - **Browser**（Brave / Chrome / Chromium）と **Profile Directory**（通常は `Default`）を選択
   - **Search Arcline Command Bar**（どこからでもお気に入り・Space・履歴・Site Search 検索）や **Open Arcline New Tab**（新規タブ検索画面を即起動）に好きな **グローバルホットキー（例: `⌥ Space` や `⌘ ⇧ K`）** を割り当てれば完了です。
