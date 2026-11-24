import {
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
  Zap,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import {
  buildCommandBarResults,
  type CommandBarHistoryEntry,
  type CommandBarItem,
  type CommandBarTab,
} from '../../core/command-bar';
import type { Favorite } from '../../core/types';
import { useI18n } from '../../sidepanel/i18n';
import { isMacPlatform, newTabKeys, openBrowserPage, openNewTab, SHORTCUTS_URL } from '../platform';
import { CopyButton, Keycaps, StepHeading } from '../ui';
import type { StepProps } from './types';

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
  { prefix: 'claude', name: 'Claude' },
  { prefix: 'pplx', name: 'Perplexity' },
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
  { id: 'f3', title: 'Figma', url: 'https://www.figma.com' },
];

const DEMO_HISTORY: readonly CommandBarHistoryEntry[] = [
  {
    title: 'Playwright Testing Docs',
    url: 'https://playwright.dev/docs/intro',
    lastVisitTime: Date.now() - 3600_000,
    visitCount: 8,
  },
  {
    title: 'TypeScript Release Notes',
    url: 'https://www.typescriptlang.org/docs/',
    lastVisitTime: Date.now() - 7200_000,
    visitCount: 5,
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
  const mac = isMacPlatform();
  const keys = newTabKeys(mac);
  const setupPrompt = lang === 'ja' ? AGENT_SETUP_PROMPT_JA : AGENT_SETUP_PROMPT_EN;

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
        limit: 5,
      }),
    [query],
  );

  const applyPrefix = (prefix: string) => {
    setQuery(`${prefix} `);
    inputRef.current?.focus();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
      <div className="onb-rise flex min-w-0 flex-col gap-5">
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

        <section className="onb-surface flex flex-col gap-3 p-4" aria-labelledby="onb-sites">
          <div className="flex flex-col gap-0.5">
            <h2 id="onb-sites" className="onb-h2">
              {t('onboarding.command.sites.title')}
            </h2>
            <p className="onb-small">{t('onboarding.command.sites.clickHint')}</p>
          </div>
          <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3">
            {SITES.map((site) => (
              <li key={site.prefix}>
                <button
                  type="button"
                  onClick={() => applyPrefix(site.prefix)}
                  data-testid={`onboarding-site-chip-${site.prefix}`}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-xl border-0 px-2.5 py-2 text-left text-[13px] transition-transform hover:scale-[1.02]"
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
        </section>
      </div>

      <section
        aria-labelledby="onb-hotkey"
        className="onb-surface onb-rise flex min-w-0 flex-col gap-4 self-start p-6"
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Keyboard size={17} style={{ color: 'var(--onb-accent)' }} aria-hidden="true" />
            <h2 id="onb-hotkey" className="onb-h2 text-[16px]">
              {t('onboarding.command.hotkey.title')}
            </h2>
          </div>
          <p className="onb-small">{t('onboarding.command.hotkey.body')}</p>
        </div>

        <div className="flex flex-col items-center gap-1.5 py-1" data-testid="onboarding-hotkey">
          <Keycaps keys={keys} />
          <span className="onb-small">{t('onboarding.command.hotkey.newTabCaption')}</span>
        </div>

        {/* Global hotkey option 1: Browser shortcuts */}
        <div
          className="flex flex-col gap-1.5 rounded-xl border p-3"
          style={{ borderColor: 'var(--onb-line)', background: 'var(--tile)' }}
        >
          <div className="flex items-center gap-1.5 text-[12.5px] font-semibold">
            <Zap size={13} style={{ color: 'var(--onb-accent)' }} aria-hidden="true" />
            <span>{t('onboarding.command.hotkey.globalTitle')}</span>
          </div>
          <p className="onb-small">{t('onboarding.command.hotkey.global')}</p>
        </div>

        {/* Companion tools: Raycast, CLI & AI Agent Skill with 1-click setup prompt */}
        <div
          className="flex flex-col gap-2.5 rounded-xl border p-3.5"
          style={{ borderColor: 'var(--onb-line)', background: 'var(--tile)' }}
        >
          <div className="flex items-center gap-1.5 text-[12.5px] font-semibold">
            <Terminal size={13} style={{ color: 'var(--onb-accent)' }} aria-hidden="true" />
            <span>{t('onboarding.command.raycast.title')}</span>
          </div>
          <p className="onb-small">{t('onboarding.command.raycast.body')}</p>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
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

        <div className="flex flex-col gap-2.5 sm:flex-row lg:flex-col xl:flex-row">
          <button
            type="button"
            className="onb-btn onb-btn-soft"
            data-testid="onboarding-open-shortcuts"
            onClick={() => void openBrowserPage(SHORTCUTS_URL)}
          >
            <Settings2 size={15} aria-hidden="true" />
            <span>{t('onboarding.command.openShortcuts')}</span>
          </button>
          <button
            type="button"
            className="onb-btn onb-btn-accent"
            data-testid="onboarding-try-command-bar"
            onClick={() => void openNewTab()}
          >
            <Search size={15} aria-hidden="true" />
            <span>{t('onboarding.command.try')}</span>
          </button>
        </div>
        <p className="onb-small">{t('onboarding.command.done')}</p>
      </section>
    </div>
  );
}
