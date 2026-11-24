export type UrlPurpose = 'navigation' | 'background';

const ALLOWED_PROTOCOLS: Record<UrlPurpose, ReadonlySet<string>> = {
  navigation: new Set(['http:', 'https:', 'chrome:', 'chrome-extension:', 'about:']),
  background: new Set(['http:', 'https:', 'data:']),
};

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

export function parseSafeUrl(url: string): URL | null {
  const trimmed = url.trim();
  if (!trimmed || CONTROL_CHARS.test(trimmed)) return null;
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
  return safeBackgroundCssUrl(url) !== null;
}

const RASTER_IMAGE_MIME_RE = /^image\/[a-z0-9.+-]+$/;

function isAllowedDataImageHref(href: string): boolean {
  const commaIdx = href.indexOf(',');
  if (commaIdx === -1) return false;
  const header = href.slice('data:'.length, commaIdx).toLowerCase();
  const mime = header.split(';')[0]?.trim() ?? '';
  return RASTER_IMAGE_MIME_RE.test(mime) && !mime.includes('svg');
}

export function isAllowedDataImageUrl(url: string): boolean {
  const parsed = parseSafeUrl(url);
  if (!parsed || parsed.protocol !== 'data:') return false;
  return isAllowedDataImageHref(parsed.href);
}

/** Canonical href for a background image, or null when the URL is unsafe. */
export function safeBackgroundCssUrl(url: string): string | null {
  const parsed = parseSafeUrl(url);
  if (!parsed || !isAllowedProtocol(parsed.protocol, 'background')) return null;
  if (parsed.protocol === 'data:' && !isAllowedDataImageHref(parsed.href)) return null;
  return parsed.href;
}

export function validateBackgroundImageUrl(url: string): { ok: true } | { ok: false; message: string } {
  const trimmed = url.trim();
  if (!trimmed) return { ok: true };
  if (isSafeBackgroundUrl(trimmed)) return { ok: true };
  return {
    ok: false,
    message: 'URL must use http, https, or a raster data:image URL.',
  };
}
