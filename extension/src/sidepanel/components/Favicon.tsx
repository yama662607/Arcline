import { useEffect, useState } from 'react';

interface FaviconProps {
  url: string;
  favIconUrl?: string;
  title?: string;
  size?: number;
}

function buildChromeFaviconUrl(pageUrl: string, size: number): string | undefined {
  if (!/^https?:\/\//i.test(pageUrl)) return undefined;
  if (typeof chrome === 'undefined' || !chrome.runtime?.id) return undefined;
  return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`;
}

export function Favicon({ url, favIconUrl, size = 16 }: FaviconProps) {
  // Prefer the browser's local `/_favicon/` cache so rendering favicons never triggers
  // outbound third-party network requests; only allow already-local `chrome-extension:` / `data:image/` URLs.
  const localFavIcon =
    favIconUrl && /^(?:chrome-extension:\/\/|data:image\/)/i.test(favIconUrl)
      ? favIconUrl
      : undefined;
  const src = buildChromeFaviconUrl(url, size * 2) ?? localFavIcon;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    // Authentic Arc Browser fallback: quiet rounded square placeholder instead of a noisy globe
    return (
      <span
        aria-hidden="true"
        className="inline-block shrink-0 rounded-[4px]"
        style={{
          width: size,
          height: size,
          backgroundColor: 'var(--ink-muted)',
          opacity: 0.35,
        }}
      />
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-[3px] object-contain"
      style={{ width: size, height: size }}
    />
  );
}
