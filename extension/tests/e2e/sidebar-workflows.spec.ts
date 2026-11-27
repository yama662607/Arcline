import { expect, test } from './fixtures';

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

test.describe('Sidebar workflows, Arc import, Command Bar & Cmd+T', () => {
  test('Arc JSON import, Global Favorites, Folders, Cmd+K, Theme Studio, inline rename & onboarding smoke', async ({
    arcline,
  }) => {
    const t1 = await arcline.context.newPage();
    await t1.goto(`${arcline.serverUrl}/page/alpha`);

    const panel = await arcline.openPanel({ width: 300, height: 760 });
    const errors: string[] = [];
    panel.on('pageerror', (e) => errors.push(e.message));

    // 1. Arc JSON import with dedupe/empty/search cleanup preview
    await panel.getByRole('button', { name: '設定・アーカイブ・Arcインポート' }).click();
    await expect(panel.getByRole('heading', { name: 'Arcline 設定' })).toBeVisible();
    await panel.getByRole('button', { name: 'Arc移行 / 出力' }).click();
    await panel.locator('input[type="file"]').setInputFiles({
      name: 'StorableSidebar.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(SYNTHETIC_ARC_SIDEBAR), 'utf-8'),
    });
    await expect(panel.getByTestId('arc-import-preview-tree')).toBeVisible();
    await expect(panel.getByText('取り込む Space を選択 (2 / 2)')).toBeVisible();
    await expect(
      panel.getByText('自動整理: 重複 1 件、空フォルダ 1 個、検索 URL 1 件を除外しました。'),
    ).toBeVisible();
    await panel.getByRole('button', { name: 'インポート実行' }).click();
    await expect(panel.getByRole('heading', { name: 'Arcline 設定' })).toBeHidden();

    // 2. Global Favorites persist across Space switches; Folders expand
    await expect(panel.getByLabel('GitHub')).toBeVisible();
    await panel.getByRole('button', { name: 'Space: Work' }).click();
    await panel.getByText('Engineering Docs').click();
    await expect(panel.getByText('MDN Web Docs')).toBeVisible();

    await panel.getByRole('button', { name: 'Space: Research' }).click();
    await expect(panel.getByLabel('GitHub')).toBeVisible();
    await expect(panel.getByText('arXiv')).toBeVisible();
    await expect(panel.getByText('Engineering Docs')).toBeHidden();

    // 3. Context menu stays within tight viewport bounds
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
    await panel.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    // 4. Transient Cmd+K quick search & Escape hide
    const search = panel.getByRole('searchbox', { name: 'クイック検索' });
    await expect(search).toBeHidden();
    await panel.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
    await expect(search).toBeFocused();
    await search.fill('MDN');
    await expect(panel.getByText('MDN Web Docs')).toBeVisible();
    await panel.keyboard.press('Escape');
    await expect(search).toBeHidden();

    // 5. Space Theme Studio (multi-node gradient + grain)
    await panel.setViewportSize({ width: 320, height: 760 });
    await panel.getByRole('button', { name: 'テーマカラーを編集' }).click();
    await panel.getByRole('button', { name: 'Active Matter' }).click();
    await panel.getByRole('button', { name: 'テーマを適用' }).click();
    await expect
      .poll(() =>
        panel.evaluate(() => ({
          hasRadial: (
            document.querySelector<HTMLElement>('.arcline-shell')?.style.backgroundImage ?? ''
          ).includes('radial-gradient'),
          hasGrain:
            Number.parseFloat(
              document.querySelector<HTMLElement>('.arcline-grain-layer')?.style.opacity ?? '0',
            ) > 0,
        })),
      )
      .toEqual({ hasRadial: true, hasGrain: true });

    // 6. Space header inline rename + Icon Picker + Space context menu
    const headerTitle = panel.locator('[data-space-header-title="true"]');
    await headerTitle.dblclick();
    const spaceRenameInput = panel.getByLabel('Space 名を変更');
    await spaceRenameInput.fill('Physics Lab');
    await spaceRenameInput.press('Enter');
    await expect(headerTitle).toHaveText('Physics Lab');

    await panel.getByRole('button', { name: 'Space アイコンを変更' }).click();
    await panel.getByRole('button', { name: 'アイコン: Sparkles' }).click();
    await panel.getByRole('button', { name: '保存' }).click();
    await expect(panel.getByRole('heading', { name: 'Space を編集' })).toBeHidden();

    // 7. Onboarding page smoke check (zero errors + live EN toggle)
    const onb = await arcline.context.newPage();
    onb.on('pageerror', (e) => errors.push(e.message));
    await onb.goto(`chrome-extension://${arcline.extensionId}/onboarding.html`);
    await expect(onb.getByTestId('onboarding-step-1')).toBeVisible();
    await onb.getByTestId('onboarding-language-toggle').locator('[data-value="en"]').click();
    await expect(onb.getByRole('heading', { level: 1 })).toContainText('A calmer way to browse');

    expect(errors).toEqual([]);
  });

  test('Command Bar & Cmd+T: popup vs newtab mode, Customize bar elimination, alias/site-search & Escape', async ({
    arcline,
  }) => {
    // Seed Favorites + alias directly via chrome APIs (fast, no duplicate Arc import)
    await arcline.worker.evaluate(async () => {
      const rootRes = await chrome.storage.local.get('arcline:root');
      const rootId = (rootRes['arcline:root'] as { rootId?: string } | undefined)?.rootId;
      if (!rootId) return;
      const children = await chrome.bookmarks.getChildren(rootId);
      const favFolder = children.find((c) => c.title === 'Favorites');
      if (favFolder) {
        await chrome.bookmarks.create({
          parentId: favFolder.id,
          title: 'GitHub',
          url: 'https://github.com/',
        });
        await chrome.bookmarks.create({
          parentId: favFolder.id,
          title: 'Notion',
          url: 'https://www.notion.so/',
        });
      }
      const cur = (await chrome.storage.local.get('arcline:settings'))['arcline:settings'] ?? {};
      await chrome.storage.local.set({
        'arcline:settings': {
          ...cur,
          favoriteShortcuts: { 'https://www.notion.so/': { alias: 'docs' } },
        },
      });
    });

    const tabA = await arcline.context.newPage();
    await tabA.setViewportSize({ width: 1280, height: 800 });
    await tabA.emulateMedia({ colorScheme: 'dark' });
    await tabA.goto(`${arcline.serverUrl}/page/cmd-t-host`);
    // Paint host webpage bright red (light-mode default) under OS dark mode to verify
    // Chromium's iframe color-scheme mismatch never paints an opaque backdrop over the webpage!
    await tabA.evaluate(() => {
      document.body.style.background = '#e11d48';
    });
    await expect
      .poll(() => tabA.evaluate(() => Boolean(document.getElementById('arcline-overlay-host'))))
      .toBe(true);

    // 1. Popup mode: Cmd+T opens transparent modal directly over active webpage (never opens empty-space tab)
    await arcline.setSettings({ commandBarOpenMode: 'popup' });
    await tabA.mouse.move(640, 320); // Stationary cursor must NOT steal #0 highlight
    await tabA.waitForTimeout(80);
    const tabsBeforePopup = await arcline.worker.evaluate(
      async () => (await chrome.tabs.query({})).length,
    );
    await arcline.worker.evaluate(async () => {
      await chrome.tabs.create({ active: true });
    });

    const modalIframe = tabA.locator('#arcline-overlay-host iframe[title="Arcline Command Bar"]');
    await expect(modalIframe).toBeVisible({ timeout: 5000 });
    await expect(modalIframe).toHaveClass(/ready/);
    expect(
      await arcline.worker.evaluate(async () => (await chrome.tabs.query({})).length),
    ).toBe(tabsBeforePopup);

    const modalFrame = tabA.frameLocator(
      '#arcline-overlay-host iframe[title="Arcline Command Bar"]',
    );
    await expect(modalFrame.locator('[data-arcline-command-mode="modal"]')).toBeVisible();
    // Pixel-level transparency verification: corner pixel (20, 20) MUST still show bright red host page (#e11d48)!
    const shotBuf = await tabA.screenshot();
    const cornerRgb = await tabA.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await new Promise((r) => {
        img.onload = r;
      });
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx2 = c.getContext('2d');
      ctx2?.drawImage(img, 0, 0);
      const [r, g, b] = ctx2?.getImageData(20, 20, 1, 1).data ?? [0, 0, 0];
      return { r, g, b };
    }, shotBuf.toString('base64'));
    expect(cornerRgb.r).toBeGreaterThan(180);
    expect(cornerRgb.g).toBeLessThan(80);
    expect(cornerRgb.b).toBeLessThan(110);
    // #0 stays highlighted and active tab URL is excluded from candidates
    await expect(modalFrame.locator('button[data-command-item-kind]').first()).toHaveAttribute(
      'data-selected',
      'true',
    );
    await expect(
      modalFrame.locator('button[data-command-item-kind]', { hasText: '127.0.0.1' }),
    ).toHaveCount(0);

    // Filtering keeps input vertical top rock-solid (<= 2px), and Escape dismisses modal cleanly
    const modalInput = modalFrame.getByRole('textbox', { name: 'Arcline コマンドバー' });
    const initialTop = await modalInput.evaluate((el) => el.getBoundingClientRect().top);
    await modalInput.fill('zzz-no-match-query');
    const narrowedTop = await modalInput.evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.abs(narrowedTop - initialTop)).toBeLessThanOrEqual(2);
    await modalInput.press('Escape');
    await expect(modalInput).toHaveValue('');
    await modalInput.press('Escape');
    await expect(modalIframe).toHaveCount(0);

    // 2. Newtab mode: Cmd+T redirects off chrome://newtab / brave://newtab (eliminates Brave Customize bar),
    //    supports @alias + site-search + live i18n, and closes tab on Escape
    await arcline.setSettings({ commandBarOpenMode: 'newtab' });
    await tabA.waitForTimeout(80);
    const tabsBeforeNewtab = await arcline.worker.evaluate(
      async () => (await chrome.tabs.query({})).length,
    );
    await arcline.worker.evaluate(async () => {
      await chrome.tabs.create({ active: true });
    });

    let newTabUrl = '';
    await expect
      .poll(async () => {
        const active = await arcline.worker.evaluate(async () => {
          const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          return t?.url ?? '';
        });
        newTabUrl = active;
        return active;
      })
      .toContain(`chrome-extension://${arcline.extensionId}/empty-space.html?commandBar=1`);
    expect(newTabUrl).not.toMatch(/^(?:chrome|brave):\/\/newtab/i);
    // Ensure chrome_url_overrides.newtab uses a separate redirector path (newtab.html),
    // never empty-space.html, so Chromium/Brave's NewTabFooter ("Customize") never attaches.
    const manifestNtp = await arcline.worker.evaluate(
      () => chrome.runtime.getManifest().chrome_url_overrides?.newtab ?? '',
    );
    expect(manifestNtp).toBe('newtab.html');
    expect(newTabUrl).not.toContain(`/${manifestNtp}`);

    const newTabPage = arcline.context
      .pages()
      .find((p) => p.url().includes('/empty-space.html?commandBar=1'));
    expect(newTabPage).toBeTruthy();
    await expect(newTabPage!.locator('[data-arcline-command-mode="page"]')).toBeVisible();

    const pageInput = newTabPage!.getByRole('textbox', { name: 'Arcline コマンドバー' });
    await expect(pageInput).toBeFocused();
    await expect(newTabPage!.locator('[data-command-item-kind="favorite"]').first()).toBeVisible();

    // Alias ranking ("docs" -> Notion @docs) & Site Search ("gh react")
    await pageInput.fill('docs');
    const topResult = newTabPage!.locator('button[data-command-item-kind]').first();
    await expect(topResult).toContainText('Notion');
    await expect(topResult).toContainText('@docs');

    await pageInput.fill('gh react');
    await expect(newTabPage!.getByRole('button', { name: /GitHub フィルターを解除/ })).toBeVisible();
    await expect(
      newTabPage!.locator('[data-command-item-kind="siteSearch"]').first(),
    ).toBeVisible();

    // Live i18n switch & Escape clears active site-search chip/query, then closes empty New Tab back to tabA
    await arcline.setSettings({ language: 'en' });
    const enInput = newTabPage!.getByRole('textbox', { name: 'Arcline Command Bar' });
    await expect(enInput).toBeVisible();
    await enInput.press('Escape'); // clears active query + site-search chip
    await enInput.press('Escape'); // closes empty New Tab
    await expect
      .poll(async () => (await arcline.worker.evaluate(async () => (await chrome.tabs.query({})).length)))
      .toBe(tabsBeforeNewtab);
  });
});
