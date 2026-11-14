export const REPO_LIMITS = {
  maxRepoSizeKb: 512_000, // 500 MB
  maxTreeEntries: 1500,
  maxManifestFiles: 4,
  maxManifestBytes: 256 * 1024, // 256 KB per manifest
  maxReadmeChars: 5000,
} as const;

export function checkGitHubRepoLimits(sizeKb?: number): {
  allowed: boolean;
  reason?: string;
} {
  if (typeof sizeKb === 'number' && sizeKb > REPO_LIMITS.maxRepoSizeKb) {
    return {
      allowed: false,
      reason: `Repository size (${Math.round(sizeKb / 1024)} MB) exceeds SLASH safety limit (${Math.round(REPO_LIMITS.maxRepoSizeKb / 1024)} MB).`,
    };
  }
  return { allowed: true };
}

export function isSafeRepoPath(rawPath: string): boolean {
  if (!rawPath || rawPath.length > 512) return false;
  if (rawPath.startsWith('/') || rawPath.startsWith('\\')) return false;
  if (/[\x00-\x1f]/.test(rawPath)) return false;
  const segments = rawPath.split(/[\\/]/);
  return !segments.some((seg) => seg === '..' || seg === '.');
}

export function filterSafeRepoTreeEntries<
  T extends { path: string; type: string; mode?: string },
>(
  entries: T[],
): {
  safeEntries: T[];
  skippedSymlinks: number;
  skippedUnsafePaths: number;
} {
  const safeEntries: T[] = [];
  let skippedSymlinks = 0;
  let skippedUnsafePaths = 0;

  for (const entry of entries) {
    if (entry.mode === '120000') {
      skippedSymlinks += 1;
      continue;
    }
    if (!isSafeRepoPath(entry.path)) {
      skippedUnsafePaths += 1;
      continue;
    }
    safeEntries.push(entry);
  }

  return { safeEntries, skippedSymlinks, skippedUnsafePaths };
}

export function wrapUntrustedContent(sourceLabel: string, rawText: string): string {
  const cleanLabel = sourceLabel.replace(/["<>]/g, '');
  const neutralized = rawText.replace(/<\/untrusted_data>/gi, '[escaped_tag]');
  return `<untrusted_data source="${cleanLabel}">\n${neutralized}\n</untrusted_data>`;
}
