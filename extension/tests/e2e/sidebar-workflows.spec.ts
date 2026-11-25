import { join } from 'node:path';
import { expect, test, VISUAL_DIR } from './fixtures';

const SYNTHETIC_ARC_SIDEBAR = {
  sidebar: {
    containers: [
      { global: {} },
      {
        spaces: [
          'space-work',
          {
            id: 'space-work',
            title: 'Work',
            containerIDs: ['pinned', 'pinned-work', 'unpinned', 'unpinned-work'],
            customInfo: {
              iconType: { icon: 'thumbsUp' },
              windowTheme: {
                primaryColorPalette: {
                  midTone: { red: 0, green: 0, blue: 0 },
                },
              },
            },
          },
          'space-lab',
          {
            id: 'space-lab',
            title: 'Research',
            containerIDs: ['pinned', 'pinned-lab', 'unpinned', 'unpinned-lab'],
            customInfo: {
              iconType: { icon: 'leaf' },
              windowTheme: {
                primaryColorPalette: {
                  midTone: { red: 0.72, green: 0.68, blue: 0.42 },
                },
              },
            },
          },
        ],
        topAppsContainerIDs: ['top-apps'],
        items: [
          'top-apps',
          { id: 'top-apps', childrenIds: ['fav-github', 'fav-mail', 'fav-cal', 'fav-docs'] },
          'fav-github',
          {
            id: 'fav-github',
            parentID: 'top-apps',
            data: { tab: { savedTitle: 'GitHub', savedURL: 'https://github.com/' } },
          },
          'fav-mail',
          {
            id: 'fav-mail',
            parentID: 'top-apps',
            data: { tab: { savedTitle: 'Gmail', savedURL: 'https://mail.google.com/' } },
          },
          'fav-cal',
          {
            id: 'fav-cal',
            parentID: 'top-apps',
            data: { tab: { savedTitle: 'Calendar', savedURL: 'https://calendar.google.com/' } },
          },
          'fav-docs',
          {
            id: 'fav-docs',
            parentID: 'top-apps',
            data: { tab: { savedTitle: 'Notion', savedURL: 'https://www.notion.so/' } },
          },
          'pinned-work',
          { id: 'pinned-work', childrenIds: ['folder-docs', 'folder-empty', 'pin-search'] },
          'folder-docs',
          {
            id: 'folder-docs',
            parentID: 'pinned-work',
            title: 'Engineering Docs',
            childrenIds: ['pin-mdn', 'pin-mdn-dup'],
            data: { list: {} },
          },
          'pin-mdn',
          {
            id: 'pin-mdn',
            parentID: 'folder-docs',
            data: {
              tab: { savedTitle: 'MDN Web Docs', savedURL: 'https://developer.mozilla.org/' },
            },
          },
          'pin-mdn-dup',
          {
            id: 'pin-mdn-dup',
            parentID: 'folder-docs',
            data: {
              tab: { savedTitle: 'MDN Duplicate', savedURL: 'https://developer.mozilla.org/' },
            },
          },
          'folder-empty',
          {
            id: 'folder-empty',
            parentID: 'pinned-work',
            title: 'Empty Trash',
            childrenIds: [],
            data: { list: {} },
          },
          'pin-search',
          {
            id: 'pin-search',
            parentID: 'pinned-work',
            data: {
              tab: { savedTitle: 'Google Search', savedURL: 'https://www.google.com/search?q=arc' },
            },
          },
          'pinned-lab',
          { id: 'pinned-lab', childrenIds: ['pin-arxiv'] },
          'pin-arxiv',
          {
            id: 'pin-arxiv',
            parentID: 'pinned-lab',
            data: { tab: { savedTitle: 'arXiv', savedURL: 'https://arxiv.org/' } },
          },
        ],
      },
    ],
  },
};

test.describe('Sidebar workflows, Arc import, context menu geometry & themes', () => {
  test('Favorites across Spaces, Folders, Arc JSON import, Cmd+K search, context menu bounds & screenshots', async ({
    arcline,
  }) => {
    // Open a few real web tabs first so Today section is populated
    const t1 = await arcline.context.newPage();
    await t1.goto(`${arcline.serverUrl}/page/alpha`);
    const t2 = await arcline.context.newPage();
    await t2.goto(`${arcline.serverUrl}/page/beta`);

    const panel = await arcline.openPanel({ width: 300, height: 760 });
    const errors: string[] = [];
    panel.on('pageerror', (e) => errors.push(e.message));

    // 1. Open Settings -> Arc移行 / 出力 -> Import synthetic StorableSidebar.json
    await panel.getByRole('button', { name: '設定・アーカイブ・Arcインポート' }).click();
    await expect(panel.getByRole('heading', { name: 'Arcline 設定' })).toBeVisible();
    await panel.screenshot({ path: join(VISUAL_DIR, 'sidebar-settings-modal.png') });

    await panel.getByRole('button', { name: 'Arc移行 / 出力' }).click();
    const fileInput = panel.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'StorableSidebar.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(SYNTHETIC_ARC_SIDEBAR), 'utf-8'),
    });

    // Verify interactive ArcImportPreview: 4 favorites, 2 spaces, 1 deduped, 1 empty folder skipped, 1 Google search skipped
    await expect(panel.getByTestId('arc-import-preview-tree')).toBeVisible();
    await expect(panel.getByText('取り込む Space を選択 (2 / 2)')).toBeVisible();
    await expect(
      panel.getByText('自動整理: 重複 1 件、空フォルダ 1 個、検索 URL 1 件を除外しました。'),
    ).toBeVisible();

    await panel.getByRole('button', { name: 'インポート実行' }).click();
    await expect(panel.getByRole('heading', { name: 'Arcline 設定' })).toBeHidden();

    // 2. Verify Global Favorites and Work Space folder are present
    await expect(panel.getByLabel('GitHub')).toBeVisible();
    await expect(panel.getByLabel('Gmail')).toBeVisible();
    await expect(panel.getByLabel('Calendar')).toBeVisible();

    // Switch to Work space and expand Engineering Docs folder
    await panel.getByRole('button', { name: 'Space: Work' }).click();
    await expect(panel.getByText('Engineering Docs')).toBeVisible();
    await panel.getByText('Engineering Docs').click();
    await expect(panel.getByText('MDN Web Docs')).toBeVisible();

    // Capture Light mode visual QA screenshot
    await arcline.setSettings({ theme: 'light' });
    await pageWaitForTheme(panel, 'light');
    await panel.screenshot({ path: join(VISUAL_DIR, 'sidebar-light.png') });

    // Capture Dark mode visual QA screenshot
    await arcline.setSettings({ theme: 'dark' });
    await pageWaitForTheme(panel, 'dark');
    await panel.screenshot({ path: join(VISUAL_DIR, 'sidebar-dark.png') });

    // 3. Switch to Research Space -> Favorites MUST remain visible while Space pins switch!
    await panel.getByRole('button', { name: 'Space: Research' }).click();
    await expect(panel.getByLabel('GitHub')).toBeVisible();
    await expect(panel.getByText('arXiv')).toBeVisible();
    await expect(panel.getByText('Engineering Docs')).toBeHidden();

    // 4. Context menu geometry inside a tight 300x520 viewport must never overflow bounds
    await panel.setViewportSize({ width: 300, height: 520 });
    await panel.getByText('arXiv').click({ button: 'right' });
    const menu = panel.getByRole('menu');
    await expect(menu).toBeVisible();
    const box = await menu.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(300);
      expect(box.y + box.height).toBeLessThanOrEqual(520);
    }
    await panel.screenshot({ path: join(VISUAL_DIR, 'sidebar-context-menu.png') });
    await panel.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    // 5. Top search bar is hidden by default; Cmd+K / Ctrl+K transiently reveals & focuses it, and Escape hides it again
    const search = panel.getByRole('searchbox', { name: 'クイック検索' });
    await expect(search).toBeHidden();
    await panel.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
    await expect(search).toBeVisible();
    await expect(search).toBeFocused();
    await search.fill('MDN');
    await expect(panel.getByText('MDN Web Docs')).toBeVisible();
    await panel.keyboard.press('Escape');
    await expect(search).toBeHidden();

    // 6. Powered-Up Arc Space Theme Studio: multi-node gradient + wavy intensity + grain dial
    await panel.setViewportSize({ width: 320, height: 760 });
    await panel.getByRole('button', { name: 'テーマカラーを編集' }).click();
    await expect(panel.getByRole('heading', { name: 'Research のテーマ' })).toBeVisible();
    await panel.getByRole('button', { name: 'Active Matter' }).click();
    await expect(panel.getByRole('button', { name: /グラデーションノード 3/ })).toBeVisible();
    await panel.screenshot({ path: join(VISUAL_DIR, 'sidebar-theme-studio.png') });
    await panel.getByRole('button', { name: 'テーマを適用' }).click();
    await expect(panel.getByRole('heading', { name: 'Research のテーマ' })).toBeHidden();
    // Wait for async updateSpace persistence & React reload before inspecting applied theme
    await expect
      .poll(() =>
        panel.evaluate(() => ({
          hasRadial: (document.querySelector<HTMLElement>('.arcline-shell')?.style.backgroundImage ?? '').includes(
            'radial-gradient',
          ),
          hasGrain: Boolean(
            document.querySelector<HTMLElement>('.arcline-grain-layer') &&
              Number.parseFloat(
                document.querySelector<HTMLElement>('.arcline-grain-layer')?.style.opacity ?? '0',
              ) > 0,
          ),
          dataTheme: document.documentElement.getAttribute('data-theme'),
        })),
      )
      .toEqual({ hasRadial: true, hasGrain: true, dataTheme: 'light' });
    await panel.screenshot({ path: join(VISUAL_DIR, 'sidebar-gradient-active-matter.png') });

    // 7. Space header double-click inline rename, Icon Picker, and Space header context menu
    const headerTitle = panel.locator('[data-space-header-title="true"]');
    await expect(headerTitle).toHaveText('Research');
    await headerTitle.dblclick();
    const spaceRenameInput = panel.getByLabel('Space 名を変更');
    await expect(spaceRenameInput).toBeVisible();
    await spaceRenameInput.fill('Physics Lab');
    await spaceRenameInput.press('Enter');
    await expect(panel.locator('[data-space-header-title="true"]')).toHaveText('Physics Lab');

    // Open Space Icon Picker directly from header icon button and select Sparkles icon
    await panel.getByRole('button', { name: 'Space アイコンを変更' }).click();
    await expect(panel.getByRole('heading', { name: 'Space を編集' })).toBeVisible();
    await panel.getByRole('button', { name: 'アイコン: Sparkles' }).click();
    await panel.getByRole('button', { name: '保存' }).click();
    await expect(panel.getByRole('heading', { name: 'Space を編集' })).toBeHidden();

    // Right-click Space header -> verify Space actions including Export JSON
    await panel.locator('[data-space-header-title="true"]').click({ button: 'right' });
    await expect(panel.getByRole('menuitem', { name: 'Space を JSON エクスポート' })).toBeVisible();
    await panel.keyboard.press('Escape');

    expect(errors).toEqual([]);
  });

  test('unified Command Bar New Tab fuses open tabs, favorites, site searches, and live i18n', async ({
    arcline,
  }) => {
    const page = await arcline.context.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${arcline.serverUrl}/normal`);

    const panel = await arcline.openPanel();
    await panel.getByRole('button', { name: '設定・アーカイブ・Arcインポート' }).click();
    await panel.getByRole('button', { name: 'Arc移行 / 出力' }).click();
    await panel.locator('input[type="file"]').setInputFiles({
      name: 'StorableSidebar.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(SYNTHETIC_ARC_SIDEBAR), 'utf-8'),
    });
    await panel.getByRole('button', { name: 'インポート実行' }).click();
    await expect(panel.getByRole('button', { name: 'GitHub' })).toBeVisible();

    // Set a Favorite alias ("docs" for Notion) in Settings -> Shortcuts
    await panel.getByRole('button', { name: '設定・アーカイブ・Arcインポート' }).click();
    await panel.getByRole('button', { name: /ショートカット|キー/ }).click();
    const notionAliasInput = panel.getByRole('textbox', { name: 'Notion のエイリアス' });
    await expect(notionAliasInput).toBeVisible();
    await notionAliasInput.fill('docs');
    await panel.getByRole('button', { name: '閉じる' }).click();

    // Apply a purple Space theme (#9e78b0 Soft Plum) to the active Space
    await panel.getByRole('button', { name: 'テーマカラーを編集' }).click();
    await panel.getByRole('button', { name: /#9e78b0/i }).click();
    await panel.getByRole('button', { name: 'テーマを適用' }).click();
    await expect(panel.getByRole('button', { name: 'テーマを適用' })).toBeHidden();
    await panel.close();

    const cmdPage = await arcline.context.newPage();
    const errors: string[] = [];
    cmdPage.on('pageerror', (e) => errors.push(e.message));
    await cmdPage.setViewportSize({ width: 1280, height: 800 });
    await cmdPage.goto(`chrome-extension://${arcline.extensionId}/empty-space.html?commandBar=1`);
    await cmdPage.locator('[data-arcline-command-bar="true"]').waitFor({ state: 'visible' });

    const input = cmdPage.getByRole('textbox', { name: 'Arcline コマンドバー' });
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
    // Open tab + Favorite items are fused in the initial view
    await expect(cmdPage.locator('[data-command-item-kind="tab"]').first()).toBeVisible();
    await expect(cmdPage.locator('[data-command-item-kind="favorite"]').first()).toBeVisible();

    // Selected row accent color must reflect the purple Space theme (not OKLCH-shifted blue)
    const selectedRgb = await cmdPage.evaluate(() => {
      const row = document.querySelector<HTMLElement>('button[data-selected="true"]');
      if (!row) return null;
      const bg = getComputedStyle(row).backgroundColor;
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return { r, g, b, bg };
    });
    expect(selectedRgb).not.toBeNull();
    if (selectedRgb) {
      expect(selectedRgb.r).toBeGreaterThan(selectedRgb.g + 10);
      expect(selectedRgb.b).toBeGreaterThan(selectedRgb.g + 15);
      expect(selectedRgb.b - selectedRgb.r).toBeLessThan(40);
    }

    // Searching by the Favorite alias ("docs") ranks Notion #1 with its @docs badge
    await input.fill('docs');
    const topResult = cmdPage.locator('button[data-command-item-kind]').first();
    await expect(topResult).toHaveAttribute('data-command-item-kind', 'favorite');
    await expect(topResult).toContainText('Notion');
    await expect(topResult).toContainText('@docs');
    await input.fill('');

    // Typing "gh react" activates the GitHub Site Search chip and builds the site-search row
    await input.fill('gh react');
    await expect(cmdPage.getByRole('button', { name: /GitHub フィルターを解除/ })).toBeVisible();
    await expect(cmdPage.locator('[data-command-item-kind="siteSearch"]').first()).toBeVisible();

    // Live language switch updates the Command Bar copy immediately
    await arcline.setSettings({ language: 'en' });
    await expect(cmdPage.getByRole('textbox', { name: 'Arcline Command Bar' })).toBeVisible();

    // Pure empty Space canvas (?spaceId=...&openOverlay=1) renders only the Space theme background
    await cmdPage.goto(
      `chrome-extension://${arcline.extensionId}/empty-space.html?spaceId=1&openOverlay=1`,
    );
    await expect(cmdPage.locator('[data-arcline-empty-space="true"]')).toHaveAttribute(
      'data-arcline-command-bar',
      'false',
    );
    await expect(cmdPage.getByRole('textbox', { name: 'Arcline Command Bar' })).toBeHidden();
    await cmdPage.close();

    // Over an active webpage, arclineCommandBar: 'toggle' renders the centered modal popup directly
    // on top of the page (without opening a new tab), excludes the active tab from candidates,
    // keeps item #0 highlighted even under a stationary cursor, handles rapid toggling cleanly,
    // and Escape dismisses and removes the lazy modal iframe cleanly.
    await page.bringToFront();
    // Place stationary cursor near the center where candidate rows appear
    await page.mouse.move(640, 320);
    const tabsBefore = await arcline.worker.evaluate(async () => (await chrome.tabs.query({})).length);
    await arcline.worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({ url: 'http://127.0.0.1/*' });
      const target = tabs.find((t) => t.id !== undefined);
      if (target?.id !== undefined) {
        // Rapid toggle sequence (open -> close -> open) must settle cleanly with zero duplicate iframes
        await chrome.tabs.sendMessage(target.id, { arclineCommandBar: 'toggle' });
        await chrome.tabs.sendMessage(target.id, { arclineCommandBar: 'toggle' });
        await chrome.tabs.sendMessage(target.id, { arclineCommandBar: 'toggle' });
      }
    });
    const modalIframeEl = page.locator('#arcline-overlay-host iframe[title="Arcline Command Bar"]');
    await expect(modalIframeEl).toHaveCount(1);
    await expect(modalIframeEl).toHaveClass(/ready/);
    const modalFrame = page.frameLocator('#arcline-overlay-host iframe[title="Arcline Command Bar"]');
    await expect(modalFrame.getByRole('textbox', { name: 'Arcline Command Bar' })).toBeVisible();
    // No extra tab should have been created
    const tabsAfter = await arcline.worker.evaluate(async () => (await chrome.tabs.query({})).length);
    expect(tabsAfter).toBe(tabsBefore);
    // First candidate row must stay selected (#0), never stolen by stationary cursor
    const selectedItems = modalFrame.locator('button[data-selected="true"]');
    await expect(selectedItems).toHaveCount(1);
    await expect(modalFrame.locator('button[data-command-item-kind]').first()).toHaveAttribute(
      'data-selected',
      'true',
    );
    // Active tab URL (127.0.0.1 fixture) must not appear in any candidate row
    await expect(
      modalFrame.locator('button[data-command-item-kind]', { hasText: '127.0.0.1' }),
    ).toHaveCount(0);
    await modalFrame.getByRole('textbox', { name: 'Arcline Command Bar' }).press('Escape');
    await expect(modalIframeEl).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('interactive 4-step Start Guide onboarding renders in EN and JA without errors', async ({
    arcline,
  }) => {
    const page = await arcline.context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`chrome-extension://${arcline.extensionId}/onboarding.html`);

    await expect(page.getByTestId('onboarding-step-1')).toBeVisible();
    // Toggle live from Japanese to English via the header language switcher
    await page.getByTestId('onboarding-language-toggle').locator('[data-value="en"]').click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('A calmer way to browse');

    // Step through all 4 steps
    await page.getByTestId('onboarding-next').click();
    await expect(page.getByTestId('onboarding-step-2')).toBeVisible();
    await page.getByTestId('onboarding-next').click();
    await expect(page.getByTestId('onboarding-step-3')).toBeVisible();

    // Verify OS auto-path + interactive sample import preview & Space filtering
    await expect(page.getByTestId('onboarding-arc-path')).toContainText('StorableSidebar.json');
    await page.getByTestId('onboarding-try-sample').click();
    await expect(page.getByTestId('onboarding-import-preview')).toBeVisible();
    await expect(page.getByTestId('onboarding-sample-banner')).toBeVisible();
    await expect(page.getByTestId('import-space-check-0')).toBeChecked();
    await page.getByTestId('import-space-check-0').uncheck();
    await expect(page.getByTestId('import-space-check-0')).not.toBeChecked();

    await page.getByTestId('onboarding-next').click();
    await expect(page.getByTestId('onboarding-step-4')).toBeVisible();
    // Verify interactive mini Command Bar & Site Search chip click
    await page.getByTestId('onboarding-site-chip-gh').click();
    await expect(page.getByTestId('onboarding-command-input')).toHaveValue('gh ');
    expect(errors).toEqual([]);
  });
});

async function pageWaitForTheme(panel: import('@playwright/test').Page, expected: 'light' | 'dark') {
  await expect
    .poll(() => panel.evaluate(() => document.documentElement.getAttribute('data-theme')))
    .toBe(expected);
  await panel.waitForTimeout(80);
}
