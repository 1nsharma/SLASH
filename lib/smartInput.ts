import { classifyUrl, getCategoryLabel, normalizeAndValidateUrl } from './classifier';
import { parseGitHubRepoUrl } from './repo/parser';
import type { UrlCategory } from './types';

export type SmartInputDetection =
  | {
      kind: 'repo';
      normalizedUrl: string;
      fullName: string;
      label: string;
    }
  | {
      kind: 'url';
      normalizedUrl: string;
      category: UrlCategory;
      label: string;
    }
  | {
      kind: 'invalid';
      error: string;
    };

/**
 * Classifies a single unified user input (GitHub owner/repo, GitHub URL, or web/API/media URL)
 * without misclassifying domain/path strings like "nextjs.org/docs" as GitHub shorthand.
 */
export function detectSmartInputKind(rawInput: string): SmartInputDetection {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      kind: 'invalid',
      error: 'Paste a public Website URL, GitHub repo (e.g., vercel/ai), or API link.',
    };
  }

  const lower = trimmed.toLowerCase();
  const hasScheme = /^https?:\/\//i.test(trimmed);
  const explicitGitHubHost =
    lower.startsWith('github.com/') ||
    lower.startsWith('www.github.com/') ||
    lower.startsWith('https://github.com/') ||
    lower.startsWith('http://github.com/') ||
    lower.startsWith('https://www.github.com/') ||
    lower.startsWith('http://www.github.com/');

  const shorthandMatch =
    !hasScheme && !trimmed.includes(' ')
      ? trimmed.match(/^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/)
      : null;

  if (explicitGitHubHost || shorthandMatch) {
    const parsedRepo = parseGitHubRepoUrl(trimmed);
    if (parsedRepo) {
      return {
        kind: 'repo',
        normalizedUrl: parsedRepo.normalizedUrl,
        fullName: parsedRepo.fullName,
        label: `GitHub Repo (${parsedRepo.fullName})`,
      };
    }
  }

  const urlCheck = normalizeAndValidateUrl(trimmed);
  if (!urlCheck.valid || !urlCheck.normalizedUrl) {
    return {
      kind: 'invalid',
      error:
        urlCheck.error ||
        'Enter a valid public website URL or GitHub repository (e.g., vercel/ai).',
    };
  }

  const category = classifyUrl(urlCheck.normalizedUrl);
  return {
    kind: 'url',
    normalizedUrl: urlCheck.normalizedUrl,
    category,
    label: getCategoryLabel(category),
  };
}
