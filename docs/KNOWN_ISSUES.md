# Arcline — Known Limitations & Browser Notes

## 1. Internal Browser Pages (`chrome://`, `brave://`, Chrome Web Store)

- **Browser Security Boundary**: Chromium prohibits content script injection (`overlay.js`) on internal browser pages (`chrome://`, `brave://`, `edge://`) and on `https://chromewebstore.google.com/`.
- **How Arcline Handles It**:
  - When you switch Spaces or click a tab pointing to an internal page from the sidebar, Arcline automatically opens the browser's native `chrome.sidePanel` styled with the same rounded card frame, width (`overlayWidthPx`), and Space theme.
  - Because content scripts cannot run inside `brave://` or `chrome://` pages, moving the cursor to the left edge while already on an internal page cannot be detected by JavaScript; therefore, once the native Side Panel is open on an internal page, it intentionally **stays open** even when you move your cursor away (press `Ctrl+B` or `Esc` inside the panel if you want to close it manually, or switch back to any normal webpage where it closes automatically).
  - Clicking `+ New Tab` inside Arcline opens Arcline's Space-themed color canvas (`empty-space.html`) rather than `chrome://newtab`, so left-edge cursor hover works immediately on newly opened tabs.

## 2. Brave Browser Vertical Tab Bar (`0px` Setup)

- In Brave, enabling **Hide completely when minimized** for vertical tabs also forces Brave's native hover-expansion on whichever edge the native vertical tab bar is docked to.
- **Recommended Setup**: In `brave://settings/appearance`, set **Tabs → Use vertical tabs → Show on the right** with **Hide completely when minimized** enabled, and set **Side panel → Left**. This keeps the native tab bar at `0px` and dedicates the entire left screen edge exclusively to Arcline.

## 3. Auto-Archive Capacity

- Auto-archived temporary tabs are stored locally in `chrome.storage.local` (up to the most recent 200 entries). Permanent links should be saved as **Favorites** or **Pinned Tabs** (which are stored directly in `chrome.bookmarks` under `Other Bookmarks / Arcline` with no limit).

## 4. Reporting Issues

Please report bugs or feature requests at:
https://github.com/yama662607/Arcline/issues
