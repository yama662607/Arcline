/**
 * Ephemeral frame authentication for extension pages exposed via `web_accessible_resources`.
 * Prevents arbitrary websites from framing `sidepanel.html?mode=overlay` or
 * `empty-space.html?mode=modal` for clickjacking or state/theme leakage.
 */
export function extractFrameTokenFromHash(hash: string): string | null {
  const match = /(?:^#|&)arclineToken=([0-9a-f]{32})(?:&|$)/i.exec(hash);
  return match?.[1] ?? null;
}

export async function verifyFramedAccess(kind: 'overlay' | 'modal'): Promise<boolean> {
  if (window.top === window) return true;
  const token = extractFrameTokenFromHash(window.location.hash);
  if (!token || typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return false;
  try {
    const res = (await chrome.runtime.sendMessage({
      arclineVerifyFrameToken: { token, kind },
    })) as { ok?: boolean } | undefined;
    return Boolean(res?.ok);
  } catch {
    return false;
  }
}
