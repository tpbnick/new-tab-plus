export type UrlPurpose = 'navigation' | 'background';

const ALLOWED_PROTOCOLS: Record<UrlPurpose, ReadonlySet<string>> = {
  navigation: new Set(['http:', 'https:', 'chrome:', 'chrome-extension:', 'about:']),
  background: new Set(['http:', 'https:', 'data:']),
};

export function parseSafeUrl(url: string): URL | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
}

export function isAllowedProtocol(protocol: string, purpose: UrlPurpose): boolean {
  return ALLOWED_PROTOCOLS[purpose].has(protocol);
}

export function isAllowedNavigationUrl(url: string): boolean {
  const parsed = parseSafeUrl(url);
  return parsed !== null && isAllowedProtocol(parsed.protocol, 'navigation');
}

export function isSafeBackgroundUrl(url: string): boolean {
  const parsed = parseSafeUrl(url);
  return parsed !== null && isAllowedProtocol(parsed.protocol, 'background');
}

export function validateBackgroundImageUrl(url: string): { ok: true } | { ok: false; message: string } {
  const trimmed = url.trim();
  if (!trimmed) return { ok: true };
  if (isSafeBackgroundUrl(trimmed)) return { ok: true };
  return {
    ok: false,
    message: 'URL must use http, https, or data protocol.',
  };
}
