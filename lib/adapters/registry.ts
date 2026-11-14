import { classifyUrl } from '../classifier';
import { crawlPublicUrl } from '../crawler';
import { buildReportFromTechCsv } from '../csvImporter';
import type { AdapterDescriptor } from '../types';
import { extractSocialEvidence } from './social';
import type { AdapterOptions, IntelligenceAdapter } from './types';

export class AdapterRegistry {
  private readonly adapters: IntelligenceAdapter[] = [];

  register<T>(adapter: IntelligenceAdapter<T>): void {
    const idx = this.adapters.findIndex(
      (a) => a.descriptor.id === adapter.descriptor.id,
    );
    if (idx >= 0) {
      this.adapters[idx] = adapter;
    } else {
      this.adapters.push(adapter);
    }
  }

  listDescriptors(): AdapterDescriptor[] {
    return this.adapters.map((a) => a.descriptor);
  }

  resolve(target: string): IntelligenceAdapter | null {
    for (const adapter of this.adapters) {
      if (adapter.canHandle(target)) {
        return adapter;
      }
    }
    return null;
  }

  async extractWith<T = unknown>(
    adapterId: string,
    target: string,
    options?: AdapterOptions,
  ): Promise<T> {
    const found = this.adapters.find((a) => a.descriptor.id === adapterId);
    if (!found) {
      throw new Error(`Adapter "${adapterId}" is not registered.`);
    }
    return (await found.extract(target, options)) as T;
  }
}

export function createDefaultAdapterRegistry(): AdapterRegistry {
  const registry = new AdapterRegistry();

  // 1. Social & Media oEmbed Adapter
  registry.register({
    descriptor: {
      id: 'social-oembed',
      name: 'Social & Media oEmbed Adapter',
      kind: 'social',
      description:
        'Extracts YouTube & X/Twitter public oEmbed metadata, OpenGraph tags, and optional Meta Graph Instagram oEmbed.',
      authEnvVar: 'META_OEMBED_TOKEN',
      status: 'optional-auth',
    },
    canHandle: (target: string) => {
      const cat = classifyUrl(target);
      return cat === 'social' || cat === 'media';
    },
    extract: async (target: string) => extractSocialEvidence(target),
  });

  // 2. Deep GitHub Repository Adapter
  registry.register({
    descriptor: {
      id: 'github-repo',
      name: 'GitHub Repository Adapter',
      kind: 'repo',
      description:
        'Inspects GitHub repository metadata, recursive git file trees, package manifests, and API route structures.',
      authEnvVar: 'GITHUB_TOKEN',
      status: 'optional-auth',
    },
    canHandle: (target: string) => {
      const lower = target.toLowerCase();
      return lower.includes('github.com/');
    },
    extract: async (target: string) => {
      const host = new URL(
        /^https?:\/\//i.test(target) ? target : `https://${target}`,
      ).hostname.replace(/^www\./, '');
      return crawlPublicUrl(target, host);
    },
  });

  // 3. OpenAPI / REST Specification Adapter
  registry.register({
    descriptor: {
      id: 'openapi-rest',
      name: 'OpenAPI / REST Spec Adapter',
      kind: 'api',
      description:
        'Parses OpenAPI / Swagger JSON schemas, endpoints, models, and security schemes.',
      status: 'active',
    },
    canHandle: (target: string) => classifyUrl(target) === 'api',
    extract: async (target: string) => {
      const host = new URL(
        /^https?:\/\//i.test(target) ? target : `https://${target}`,
      ).hostname.replace(/^www\./, '');
      return crawlPublicUrl(target, host);
    },
  });

  // 4. Wappalyzer / BuiltWith CSV Adapter
  registry.register({
    descriptor: {
      id: 'wappalyzer-csv',
      name: 'Wappalyzer / BuiltWith CSV Adapter',
      kind: 'data',
      description:
        'Synthesizes deterministic architecture maps from exported technology CSV datasets.',
      status: 'active',
    },
    canHandle: (target: string) =>
      target.includes(',') && target.includes('\n'),
    extract: async (target: string) => buildReportFromTechCsv(target),
  });

  // 5. Web DOM + Jina Reader Adapter
  registry.register({
    descriptor: {
      id: 'web-dom-jina',
      name: 'Web DOM & Jina Reader Adapter',
      kind: 'web',
      description:
        'Crawls live HTML DOM, HTTP headers, Wappalyzer-grade fingerprints, and Jina Reader Markdown fallback.',
      authEnvVar: 'JINA_API_KEY',
      status: 'optional-auth',
    },
    canHandle: (target: string) => /^https?:\/\//i.test(target),
    extract: async (target: string) => {
      const host = new URL(target).hostname.replace(/^www\./, '');
      return crawlPublicUrl(target, host);
    },
  });

  return registry;
}

export const defaultAdapterRegistry = createDefaultAdapterRegistry();
