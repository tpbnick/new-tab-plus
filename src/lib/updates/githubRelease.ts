import { normalizeVersionTag } from './compareVersions';

export interface GithubRelease {
  version: string;
  url: string;
}

function repoSlugFromUrl(repoUrl: string): string | null {
  const match = /github\.com\/([^/?#]+\/[^/?#]+)/i.exec(repoUrl.trim());
  if (!match) return null;
  return match[1].replace(/\.git$/i, '');
}

export async function fetchLatestGithubRelease(repoUrl: string): Promise<GithubRelease | null> {
  const slug = repoSlugFromUrl(repoUrl);
  if (!slug) return null;

  const res = await fetch(`https://api.github.com/repos/${slug}/releases/latest`, {
    headers: {
      Accept: 'application/vnd.github+json',
    },
  });

  if (res.status === 404) return null;
  if (!res.ok) return null;

  const data = (await res.json()) as { tag_name?: string; html_url?: string };
  if (typeof data.tag_name !== 'string' || typeof data.html_url !== 'string') return null;

  const version = normalizeVersionTag(data.tag_name);
  if (!version) return null;

  return { version, url: data.html_url };
}
