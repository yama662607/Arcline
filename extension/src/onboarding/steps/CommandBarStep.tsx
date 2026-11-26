import {
  ChevronDown,
  Clock,
  ExternalLink,
  Globe,
  Keyboard,
  Search,
  Settings2,
  Sparkles,
  Star,
  Terminal,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildCommandBarResults,
  type CommandBarHistoryEntry,
  type CommandBarItem,
  type CommandBarTab,
} from '../../core/command-bar';
import type { Favorite } from '../../core/types';
import { useI18n } from '../../sidepanel/i18n';
import {
  BRAVE_EXT_SHORTCUTS_URL,
  BRAVE_SHORTCUTS_URL,
  detectBrave,
  isMacPlatform,
  newTabKeys,
  openBrowserPage,
  openNewTab,
  SHORTCUTS_URL,
} from '../platform';
import { CopyButton, Keycaps, Segmented, StepHeading } from '../ui';
import type { StepProps } from './types';

type Browser = 'brave' | 'chrome';

const ARCLINE_GITHUB_URL = 'https://github.com/yama662607/Arcline#readme';
const ARCLINE_FEEDBACK_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSdXf5b7sSiMUez01iu137XaH0u2D9kvgQLBIUUF4D4MRR7yIg/viewform';

const AGENT_SETUP_PROMPT_EN = `Install the Arcline 1.0.0 companion tools from https://github.com/yama662607/Arcline (see llms.txt):
1. Inspect my OS, Node/Bun/pnpm, AI agent skill directories, and whether Raycast is installed.
2. Install the Arcline Agent Skill via \`npx skills add yama662607/Arcline\` (or \`gh skill install yama662607/Arcline\`, falling back to copying \`skills/arcline/\`).
3. Clone/link \`packages/arcline-cli\` so \`arcline\` works in my shell, and verify with \`arcline --help\` and \`arcline doctor --json\`.
4. On macOS with Raycast installed, build \`integrations/raycast\` (\`npm install && npm run build\`) so Search Arcline and Arcline Favorites appear in Raycast.
5. Run read-only verification (\`arcline spaces --json\`) without modifying any bookmarks or personal data, and summarize what was installed.`;

const AGENT_SETUP_PROMPT_JA = `https://github.com/yama662607/Arcline（llms.txt 参照）から Arcline 1.0.0 の連携ツールを一括セットアップしてください：
1. 私の環境（OS・Node/Bun/pnpm・AI エージェントのスキルフォルダ・Raycast の有無）を確認する。
2. \`npx skills add yama662607/Arcline\`（または \`gh skill install yama662607/Arcline\`、不可なら \`skills/arcline/\` をコピー）で Agent Skill を導入する。
3. \`packages/arcline-cli\` をセットアップして \`arcline\` コマンドを使えるようにし、\`arcline --help\` と \`arcline doctor --json\` で確認する。
4. macOS で Raycast が入っている場合は \`integrations/raycast\` を \`npm install && npm run build\` して Search Arcline と Arcline Favorites を登録する。
5. ブックマークや個人データは一切変更せず、読み取り専用で \`arcline spaces --json\` の動作確認をして結果を報告する。`;

const SITES = [
  { prefix: 'g', name: 'Google' },
  { prefix: 'gh', name: 'GitHub' },
  { prefix: 'yt', name: 'YouTube' },
  { prefix: 'gpt', name: 'ChatGPT' },
] as const;

const DEMO_TABS: readonly CommandBarTab[] = [
  {
    id: 1,
    windowId: 1,
    title: 'Building Fast MV3 Sidebars',
    url: 'https://developer.chrome.com/docs/extensions',
  },
  {
    id: 2,
    windowId: 1,
    title: 'OKLCH Color Spaces & Tactile UI',
    url: 'https://oklch.com',
  },
];

const DEMO_FAVORITES: readonly Favorite[] = [
  { id: 'f1', title: 'GitHub', url: 'https://github.com' },
  { id: 'f2', title: 'Linear', url: 'https://linear.app' },
];

const DEMO_HISTORY: readonly CommandBarHistoryEntry[] = [
  {
    title: 'Playwright Testing Docs',
    url: 'https://playwright.dev/docs/intro',
    lastVisitTime: Date.now() - 3600_000,
    visitCount: 8,
  },
];

function itemIcon(kind: CommandBarItem['kind']) {
  switch (kind) {
    case 'tab':
      return <Globe size={13} aria-hidden="true" />;
    case 'favorite':
      return <Star size={13} aria-hidden="true" />;
    case 'history':
      return <Clock size={13} aria-hidden="true" />;
    case 'quickAction':
      return <Sparkles size={13} aria-hidden="true" />;
    default:
      return <Search size={13} aria-hidden="true" />;
  }
}

export function CommandBarStep({ headingRef }: StepProps) {
  const { t, lang } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [browser, setBrowser] = useState<Browser>('brave');
  const mac = isMacPlatform();
  const keys = newTabKeys(mac);
  const setupPrompt = lang === 'ja' ? AGENT_SETUP_PROMPT_JA : AGENT_SETUP_PROMPT_EN;

  useEffect(() => {
    let active = true;
    void detectBrave().then((isBrave) => {
      if (active) setBrowser(isBrave ? 'brave' : 'chrome');
    });
    return () => {
      active = false;
    };
  }, []);

  const result = useMemo(
    () =>
      buildCommandBarResults({
        query,
        openTabs: DEMO_TABS,
        favorites: DEMO_FAVORITES,
        spaces: [],
        history: DEMO_HISTORY,
        archived: [],
        searchEngine: 'google',
        limit: 4,
      }),
    [query],
  );

  const applyPrefix = (prefix: string) => {
    setQuery(`${prefix} `);
    inputRef.current?.focus();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
      <div className="onb-rise flex min-w-0 flex-col gap-4">
        <StepHeading
          title={t('onboarding.command.title')}
          body={t('onboarding.command.body')}
          headingRef={headingRef}
        />

        {/* Real interactive Mini Command Bar */}
        <div className="onb-cmd" data-testid="onboarding-command-mock">
          <div className="onb-cmd-input">
            <Search size={17} style={{ color: 'var(--ink-muted)' }} aria-hidden="true" />
            {result.activeSiteSearch && (
              <span
                className="shrink-0 rounded-md px-2 py-0.5 text-[11.5px] font-semibold text-white"
                style={{ backgroundColor: result.activeSiteSearch.accent }}
              >
                {result.activeSiteSearch.label}
              </span>
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('onboarding.command.mock.tryPlaceholder')}
              aria-label={t('onboarding.command.mock.tryPlaceholder')}
              data-testid="onboarding-command-input"
              className="min-w-0 flex-1 border-0 bg-transparent text-[14px] outline-none"
              style={{ color: 'var(--ink)' }}
            />
            {query && (
              <button
                type="button"
                aria-label="Clear"
                onClick={() => setQuery('')}
                className="flex size-5 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0"
                style={{ color: 'var(--ink-muted)' }}
              >
                <X size={13} aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-0.5 pt-1">
            {result.items.map((item, idx) => (
              <div
                key={item.id}
                className="onb-cmd-row"
                data-active={idx === 0 ? 'true' : undefined}
                data-demo-kind={item.kind}
              >
                <span className={`onb-ico ${idx === 0 ? 'onb-ico-accent' : ''}`}>
                  {itemIcon(item.kind)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">
                    {item.kind === 'siteSearch'
                      ? `${item.subtitle}: ${item.term || '…'}`
                      : item.title}
                  </div>
                  {item.subtitle && (
                    <div className="truncate text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                      {item.subtitle}
                    </div>
                  )}
                </div>
                {item.badge && (
                  <span
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium"
                    style={{
                      background: idx === 0 ? 'var(--onb-accent-soft)' : 'var(--tile)',
                      color: idx === 0 ? 'var(--onb-accent)' : 'var(--ink-muted)',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Compact site-search chips + 3 essential keyboard tips */}
        <div className="onb-surface flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-semibold">{t('onboarding.command.sites.title')}</span>
            <span className="onb-small">{t('onboarding.command.sites.clickHint')}</span>
          </div>
          <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-4">
            {SITES.map((site) => (
              <li key={site.prefix}>
                <button
                  type="button"
                  onClick={() => applyPrefix(site.prefix)}
                  data-testid={`onboarding-site-chip-${site.prefix}`}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-xl border-0 px-2.5 py-1.5 text-left text-[12.5px] transition-transform hover:scale-[1.02]"
                  style={{ background: 'var(--tile)', color: 'inherit' }}
                >
                  <code
                    className="onb-code"
                    style={{ background: 'var(--onb-accent-soft)', color: 'var(--onb-accent)' }}
                  >
                    {site.prefix}
                  </code>
                  <span className="min-w-0 truncate">{site.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <div
            className="flex flex-wrap gap-1.5 pt-0.5 text-[11.5px]"
            style={{ color: 'var(--ink-muted)' }}
          >
            <span className="rounded-lg px-2 py-1" style={{ background: 'var(--tile)' }}>
              {t('onboarding.command.tips.space')}
            </span>
            <span className="rounded-lg px-2 py-1" style={{ background: 'var(--tile)' }}>
              {t('onboarding.command.tips.cmdEnter')}
            </span>
            <span className="rounded-lg px-2 py-1" style={{ background: 'var(--tile)' }}>
              {t('onboarding.command.tips.ctrlPN')}
            </span>
          </div>
        </div>
      </div>

      {/* Highlighted Recommended Setup: Zero-flicker Cmd+T */}
      <section
        aria-labelledby="onb-hotkey"
        className="onb-surface onb-rise flex min-w-0 flex-col gap-4 self-start p-5"
        style={{
          borderColor: 'var(--onb-accent-soft)',
          boxShadow: '0 0 0 1px var(--onb-accent-soft)',
        }}
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span
              className="onb-badge"
              style={{ background: 'var(--onb-accent-soft)', color: 'var(--onb-accent)' }}
            >
              {t('onboarding.command.hotkey.badge')}
            </span>
            <div className="flex items-center gap-1.5" data-testid="onboarding-hotkey">
              <Keycaps keys={keys} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Keyboard size={16} style={{ color: 'var(--onb-accent)' }} aria-hidden="true" />
            <h2 id="onb-hotkey" className="onb-h2 text-[16px]">
              {browser === 'brave'
                ? t('onboarding.command.hotkey.title')
                : t('onboarding.command.hotkey.globalTitle')}
            </h2>
          </div>
          <p className="onb-small">
            {browser === 'brave'
              ? t('onboarding.command.hotkey.body')
              : t('onboarding.command.hotkey.global')}
          </p>
        </div>

        <Segmented<Browser>
          label={t('onboarding.command.hotkey.title')}
          value={browser}
          onChange={setBrowser}
          testId="onboarding-command-browser-toggle"
          options={[
            { value: 'brave', label: t('onboarding.edge.browser.brave') },
            { value: 'chrome', label: t('onboarding.edge.browser.chrome') },
          ]}
        />

        {browser === 'brave' ? (
          <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
            <li className="flex items-start gap-2.5">
              <span className="onb-list-num shrink-0">1</span>
              <span className="text-[13px] leading-[1.55]">
                {t('onboarding.command.hotkey.braveStep1')}
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="onb-list-num shrink-0">2</span>
              <span className="text-[13px] leading-[1.55]">
                {t('onboarding.command.hotkey.braveStep2')}
              </span>
            </li>
          </ol>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {browser === 'brave' && (
            <button
              type="button"
              className="onb-btn onb-btn-soft onb-btn-sm"
              data-testid="onboarding-open-brave-shortcuts"
              onClick={() => void openBrowserPage(BRAVE_SHORTCUTS_URL)}
            >
              <Settings2 size={14} aria-hidden="true" />
              <span>{t('onboarding.command.hotkey.openBraveShortcuts')}</span>
            </button>
          )}
          <button
            type="button"
            className="onb-btn onb-btn-accent onb-btn-sm"
            data-testid="onboarding-open-shortcuts"
            onClick={() =>
              void openBrowserPage(browser === 'brave' ? BRAVE_EXT_SHORTCUTS_URL : SHORTCUTS_URL)
            }
          >
            <Settings2 size={14} aria-hidden="true" />
            <span>
              {browser === 'brave'
                ? t('onboarding.command.openShortcuts')
                : t('onboarding.command.openShortcutsChrome')}
            </span>
          </button>
          <button
            type="button"
            className="onb-btn onb-btn-soft onb-btn-sm"
            data-testid="onboarding-try-command-bar"
            onClick={() => void openNewTab()}
          >
            <Search size={14} aria-hidden="true" />
            <span>{t('onboarding.command.try')}</span>
          </button>
        </div>

        {/* Optional Companion Tools tucked neatly into a collapsible disclosure */}
        <details
          className="rounded-xl border px-3.5 py-2.5"
          style={{ borderColor: 'var(--onb-line)', background: 'var(--tile)' }}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[12.5px] font-semibold">
            <span className="flex items-center gap-1.5">
              <Terminal size={13} style={{ color: 'var(--onb-accent)' }} aria-hidden="true" />
              <span>{t('onboarding.command.raycast.title')}</span>
            </span>
            <ChevronDown size={14} style={{ color: 'var(--ink-muted)' }} aria-hidden="true" />
          </summary>
          <div className="flex flex-col gap-2.5 pt-2.5">
            <p className="onb-small m-0">{t('onboarding.command.raycast.body')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton text={setupPrompt} label={t('onboarding.command.companion.copyPrompt')} />
              <a
                href={ARCLINE_GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="onb-btn onb-btn-soft onb-btn-sm no-underline"
              >
                <ExternalLink size={13} aria-hidden="true" />
                <span>{t('onboarding.command.companion.openGithub')}</span>
              </a>
              <a
                href={ARCLINE_FEEDBACK_FORM_URL}
                target="_blank"
                rel="noreferrer"
                className="onb-btn onb-btn-soft onb-btn-sm no-underline"
              >
                <ExternalLink size={13} aria-hidden="true" />
                <span>{t('onboarding.command.companion.feedback')}</span>
              </a>
            </div>
          </div>
        </details>

        <p className="onb-small m-0">{t('onboarding.command.done')}</p>
      </section>
    </div>
  );
}
