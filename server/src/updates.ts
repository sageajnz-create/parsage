import { APP_VERSION, RELEASES_REPO } from './version.js';

export interface UpdateStatus {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  source: 'github' | 'unavailable';
  checkedAt: string;
}

type ReleaseFetcher = (url: string) => Promise<{ tag_name?: string; html_url?: string } | null>;

function parseVersion(value: string): number[] {
  return value.replace(/^v/i, '').split('.').map(part => parseInt(part.replace(/\D/g, ''), 10) || 0);
}

export function isNewerVersion(latest: string, current: string): boolean {
  const left = parseVersion(latest);
  const right = parseVersion(current);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index++) {
    const a = left[index] || 0;
    const b = right[index] || 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}

export async function checkForUpdate(options: {
  fetchRelease?: ReleaseFetcher;
  current?: string;
  now?: () => Date;
} = {}): Promise<UpdateStatus> {
  const current = options.current || APP_VERSION;
  const checkedAt = (options.now ?? (() => new Date()))().toISOString();
  const fetchRelease = options.fetchRelease ?? (async (url: string) => {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'parsage-update-check', Accept: 'application/vnd.github+json' }
    });
    if (!response.ok) return null;
    return await response.json() as { tag_name?: string; html_url?: string };
  });

  try {
    const release = await fetchRelease(`https://api.github.com/repos/${RELEASES_REPO}/releases/latest`);
    const latest = typeof release?.tag_name === 'string' ? release.tag_name.replace(/^v/i, '') : null;
    return {
      current,
      latest,
      updateAvailable: Boolean(latest && isNewerVersion(latest, current)),
      releaseUrl: release?.html_url || null,
      source: latest ? 'github' : 'unavailable',
      checkedAt
    };
  } catch {
    return {
      current,
      latest: null,
      updateAvailable: false,
      releaseUrl: null,
      source: 'unavailable',
      checkedAt
    };
  }
}
