import { normalizeVersionTag } from './compareVersions';

export interface GithubRelease {
  version: string;
  url: string;
}

const FETCH_TIMEOUT_MS = 8000;

function repoSlugFromUrl(repoUrl: string): string | null {
  const match = /github\.com\/([^/?#]+\/[^/?#]+)/i.exec(repoUrl.trim());
  if (!match) return null;
  return match[1].replace(/\.git$/i, '');
}

function isValidGithubReleaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.toLowerCase() === 'github.com';
  } catch {
    return false;
  }
}

export async function fetchLatestGithubRelease(repoUrl: string): Promise<GithubRelease | null> {
  const slug = repoSlugFromUrl(repoUrl);
  if (!slug) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`https://api.github.com/repos/${slug}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const data: unknown = await res.json();
    if (!data || typeof data !== 'object') return null;

    const { tag_name: tagName, html_url: htmlUrl } = data as {
      tag_name?: unknown;
      html_url?: unknown;
    };
    if (typeof tagName !== 'string' || typeof htmlUrl !== 'string') return null;

    const version = normalizeVersionTag(tagName);
    if (!version) return null;

    if (!isValidGithubReleaseUrl(htmlUrl)) return null;

    return { version, url: htmlUrl };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
