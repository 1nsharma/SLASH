import type { AdapterDescriptor } from '../types';

export interface AdapterOptions {
  forceRefresh?: boolean;
  includeTree?: boolean;
}

export interface IntelligenceAdapter<TOutput = unknown> {
  descriptor: AdapterDescriptor;
  canHandle: (target: string) => boolean;
  extract: (target: string, options?: AdapterOptions) => Promise<TOutput>;
}

export const DEFAULT_ADAPTER_DESCRIPTORS: AdapterDescriptor[] = [
  {
    id: 'social-oembed',
    name: 'Social & Media oEmbed Adapter',
    kind: 'social',
    description:
      'Extracts YouTube & X/Twitter public oEmbed metadata, OpenGraph tags, and optional Meta Graph Instagram oEmbed.',
    authEnvVar: 'META_OEMBED_TOKEN',
    status: 'optional-auth',
  },
  {
    id: 'github-repo',
    name: 'GitHub Repository Adapter',
    kind: 'repo',
    description:
      'Inspects GitHub repository metadata, recursive git file trees, package manifests, and API route structures.',
    authEnvVar: 'GITHUB_TOKEN',
    status: 'optional-auth',
  },
  {
    id: 'openapi-rest',
    name: 'OpenAPI / REST Spec Adapter',
    kind: 'api',
    description:
      'Parses OpenAPI / Swagger JSON schemas, endpoints, models, and security schemes.',
    status: 'active',
  },
  {
    id: 'wappalyzer-csv',
    name: 'Wappalyzer / BuiltWith CSV Adapter',
    kind: 'data',
    description:
      'Synthesizes deterministic architecture maps from exported technology CSV datasets.',
    status: 'active',
  },
  {
    id: 'web-dom-jina',
    name: 'Web DOM & Jina Reader Adapter',
    kind: 'web',
    description:
      'Crawls live HTML DOM, HTTP headers, Wappalyzer-grade fingerprints, and Jina Reader Markdown fallback.',
    authEnvVar: 'JINA_API_KEY',
    status: 'optional-auth',
  },
];

