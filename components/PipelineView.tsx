'use client';

import { useState } from 'react';
import {
  Check,
  Copy,
  Cpu,
  GitBranch,
  Layers,
  Network,
  Server,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { DEFAULT_ADAPTER_DESCRIPTORS } from '@/lib/adapters/types';

interface PipelineViewProps {
  onGoToAnalyzer: () => void;
}

const SLASH_ENGINES = [
  {
    name: 'URLmind Engine (Web Intelligence)',
    icon: Layers,
    role: 'Preserved intact for URL classification, DOM/Jina/OpenAPI/Social oEmbed crawling, CSV stack import, 60s explainer, and URL comparison.',
  },
  {
    name: 'Repo Intelligence Engine',
    icon: GitBranch,
    role: 'Inspects GitHub repository metadata, recursive git trees, npm/Python/Go/Rust manifests, and Next.js/Express/FastAPI routes with file-path citations.',
  },
  {
    name: 'Unified Graph Engine',
    icon: Network,
    role: 'Merges URLmind and Repo reports into one interactive knowledge graph, surfacing shared packages, matching routes, and cross-system boundaries.',
  },
  {
    name: 'AI Copilot (Human-Approved)',
    icon: ShieldCheck,
    role: 'Answers architecture questions grounded in graph evidence and emits pending action proposals requiring explicit user approval before execution.',
  },
];

const CONVERSION_MATRIX = [
  {
    input: 'Website URL',
    output: 'Website Architecture',
    extracts: 'Pages, navigation, internal links, sitemap, content hierarchy, user journeys',
  },
  {
    input: 'Web App URL',
    output: 'Application Map',
    extracts: 'Visible modules, UI flows, routes, integrations, detected client technologies',
  },
  {
    input: 'API Documentation',
    output: 'API Architecture',
    extracts: 'REST endpoints, OpenAPI request/response schemas, authentication, dependencies',
  },
  {
    input: 'Article / Docs',
    output: 'Knowledge Graph',
    extracts: 'Topics, concepts, references, relationships, summarized knowledge',
  },
  {
    input: 'GitHub Repository',
    output: 'Repo Intelligence + Unified Graph',
    extracts: 'Recursive git trees, package manifests, discovered API/page routes, dependency graph',
  },
  {
    input: 'Video & Media URL',
    output: 'Media & Creator Map',
    extracts: 'YouTube oEmbed metadata, creator channel links, topic breakdown, takeaways',
  },
  {
    input: 'Social Post / Thread',
    output: 'Social Intelligence Map',
    extracts: 'Public X/Twitter oEmbed posts, OpenGraph previews, and gated-access transparency',
  },
];

const ROADMAP_PHASES = [
  {
    phase: 'Phase 1 · URLmind Web Intelligence',
    detail: 'Crawl public websites, extract pages, generate sitemaps, and render interactive React Flow + Mermaid node graphs.',
  },
  {
    phase: 'Phase 2 · Deep Repo Intelligence Engine',
    detail: 'Parse GitHub REST git trees, multi-ecosystem manifests (npm, Python, Go, Rust), and framework routes with file citations.',
  },
  {
    phase: 'Phase 3 · Unified Cross-Engine Graph',
    detail: 'Merge URLmind web reports and Repo Intelligence trees into a single namespace-safe interactive architecture graph.',
  },
  {
    phase: 'Phase 4 · Human-Approved AI Copilot',
    detail: 'Structured Q&A across single URLs, repos, or unified graphs with explicit Approve & Execute controls on proposed actions.',
  },
  {
    phase: 'Phase 5 · Open-Source Self-Hosting',
    detail: 'Containerized Next.js deployment with server-only environment configuration and extensible modular adapters.',
  },
];

const ENV_VARIABLES = [
  {
    name: 'GEMINI_API_KEY',
    requirement: 'Required',
    purpose: 'Server-side Gemini synthesis & Copilot key used exclusively by /api/* routes.',
  },
  {
    name: 'GITHUB_TOKEN',
    requirement: 'Optional',
    purpose: 'GitHub personal access token for higher REST API rate limits during deep Repo Intelligence scans.',
  },
  {
    name: 'GITHUB_OAUTH_CLIENT_ID',
    requirement: 'Optional',
    purpose: 'GitHub OAuth App Client ID for popup sign-in and user-owned private repository scanning.',
  },
  {
    name: 'GITHUB_OAUTH_CLIENT_SECRET',
    requirement: 'Optional',
    purpose: 'Server-only GitHub OAuth App Client Secret used during authorization code exchange.',
  },
  {
    name: 'OAUTH_SESSION_SECRET',
    requirement: 'Optional',
    purpose: '32+ char key for AES-256-GCM HttpOnly GitHub session cookies and HMAC-signed OAuth state.',
  },
  {
    name: 'OLLAMA_BASE_URL',
    requirement: 'Optional',
    purpose: 'Local Ollama endpoint (e.g. http://ollama:11434) for offline self-hosted AI synthesis.',
  },
  {
    name: 'OLLAMA_MODEL',
    requirement: 'Optional',
    purpose: 'Default local Ollama model tag (defaults to llama3.1:8b).',
  },
  {
    name: 'AI_PROVIDER',
    requirement: 'Optional',
    purpose: 'Server-side AI Router target (auto | gemini | ollama | deterministic).',
  },
  {
    name: 'OPENAI_API_KEY',
    requirement: 'Optional (BYOK)',
    purpose: 'Server-only BYOK OpenAI credential configured via environment variables (never entered in browser UI).',
  },
  {
    name: 'ANTHROPIC_API_KEY',
    requirement: 'Optional (BYOK)',
    purpose: 'Server-only BYOK Anthropic credential configured via environment variables (never entered in browser UI).',
  },
  {
    name: 'META_OEMBED_TOKEN',
    requirement: 'Optional',
    purpose: 'Meta App token enabling authenticated Instagram Graph oEmbed previews.',
  },
  {
    name: 'JINA_API_KEY',
    requirement: 'Optional',
    purpose: 'Optional Jina Reader Bearer token for higher-rate r.jina.ai SPA & anti-bot markdown fallback.',
  },
  {
    name: 'CACHE_TTL_HOURS',
    requirement: 'Optional',
    purpose: 'Server disk & memory cache lifetime in hours (defaults to 24).',
  },
];

const DOCKER_SNIPPET = `# Full self-hosted stack (Next.js + PG17/pgvector/Apache AGE + Valkey)
docker compose up -d

# Optional offline local LLM profile (Ollama)
docker compose --profile local-llm up -d`;

export default function PipelineView({ onGoToAnalyzer }: PipelineViewProps) {
  const [copiedDocker, setCopiedDocker] = useState(false);

  const handleCopyDocker = async () => {
    try {
      await navigator.clipboard.writeText(DOCKER_SNIPPET);
      setCopiedDocker(true);
      setTimeout(() => setCopiedDocker(false), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
            SLASH · Repo Unifier Platform
          </p>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Platform Architecture, Adapters & Pipeline
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            URLmind web ingestion, Repo Intelligence scanning, Unified Graph synthesis,
            and transparent Detected vs. Inferred modeling.
          </p>
        </div>

        <button
          type="button"
          onClick={onGoToAnalyzer}
          className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
        >
          Open Analyzer
        </button>
      </div>

      {/* SLASH Core Engines */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SLASH_ENGINES.map((engine) => {
          const Icon = engine.icon;
          return (
            <div
              key={engine.name}
              className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />
                <span>{engine.name}</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {engine.role}
              </p>
            </div>
          );
        })}
      </section>

      {/* Modular Adapter Engine Registry */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Modular Adapter Engine ({DEFAULT_ADAPTER_DESCRIPTORS.length} Registered)
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Typed ingestion adapters
          </span>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {DEFAULT_ADAPTER_DESCRIPTORS.map((adapter) => (
            <div
              key={adapter.id}
              className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {adapter.name}
                  </span>
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {adapter.id}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  {adapter.description}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                {adapter.authEnvVar && (
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {adapter.authEnvVar}
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded ${
                    adapter.status === 'active'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                      : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                  }`}
                >
                  {adapter.status === 'active' ? 'Ready' : 'Optional Key'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Conversion Matrix */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Supported URL & Repository Conversions
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/50">
                <th className="py-2.5 px-4 font-medium">Input Type</th>
                <th className="py-2.5 px-4 font-medium">Intelligence Output</th>
                <th className="py-2.5 px-4 font-medium">Extracted Entities & Views</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {CONVERSION_MATRIX.map((row) => (
                <tr key={row.input}>
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                    {row.input}
                  </td>
                  <td className="py-3 px-4 text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">
                    {row.output}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                    {row.extracts}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Open-Source & Self-Hosting */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Open-Source & Self-Hosting
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Keys remain server-side via environment variables
          </span>
        </div>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <Terminal className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                <span>Run with Docker</span>
              </div>
              <button
                type="button"
                onClick={() => void handleCopyDocker()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                {copiedDocker ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" aria-hidden="true" />
                    <span>Copy command</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3.5 rounded-lg bg-slate-950 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed">
              <code>{DOCKER_SNIPPET}</code>
            </pre>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Repository ships{' '}
              <code className="font-mono text-slate-800 dark:text-slate-200">docker-compose.yml</code>{' '}
              and{' '}
              <code className="font-mono text-slate-800 dark:text-slate-200">db/schema.sql</code>{' '}
              (PostgreSQL 17 + <code className="font-mono text-slate-800 dark:text-slate-200">pgvector</code> + Apache AGE + Valkey).
              Public report caching uses{' '}
              <code className="font-mono text-slate-800 dark:text-slate-200">.cache/urlmind/</code>{' '}
              while private OAuth-scanned repositories bypass shared disk cache.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-3 font-medium">Environment Variable</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {ENV_VARIABLES.map((env) => (
                  <tr key={env.name}>
                    <td className="py-2.5 pr-3 font-mono font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {env.name}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {env.requirement}
                    </td>
                    <td className="py-2.5 text-slate-600 dark:text-slate-400">
                      {env.purpose}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Open-Core Distribution & BYOK Architecture */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Open-Core Editions &amp; Server-Side BYOK Router
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Zero browser API key entry · 100% env-configured
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <p className="font-semibold text-slate-900 dark:text-white">
              Community Edition (MIT / Apache-2.0)
            </p>
            <p>
              Full URLmind ingestion, Repo Intelligence, 4-Zone Business Grid,
              Auto-Bridging gap detector, and local Docker Compose Run Business
              export using Gemini, Ollama, or server-side BYOK keys.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <p className="font-semibold text-slate-900 dark:text-white">
              Managed Cloud (1-Click Run Business)
            </p>
            <p>
              Zero-DevOps hosted gateway runtime, isolated container execution,
              shared workspace memory (pgvector), and team RBAC with audit
              trails.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <p className="font-semibold text-slate-900 dark:text-white">
              Verified Business Blocks Ecosystem
            </p>
            <p>
              Pre-audited Clerk, Supabase, Stripe, Razorpay, Shared pgvector
              Memory, and n8n adapters that snap cleanly into any unified
              workspace.
            </p>
          </div>
        </div>
      </section>

      {/* Security Architecture & Shared Graph Contract */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Security Architecture &amp; Shared Graph Contract
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <p className="font-semibold text-slate-900 dark:text-white">
              SSRF &amp; URL Fetch Guard
            </p>
            <p>
              Validates protocols, blocks RFC1918/link-local/metadata/CGNAT/ULA IPs
              plus DNS resolution checks, validates redirect hops manually, and enforces
              response byte caps.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <p className="font-semibold text-slate-900 dark:text-white">
              Untrusted Repo &amp; AI Isolation
            </p>
            <p>
              Enforces 500 MB repo and 1,500-entry tree limits, skips symlinks and
              traversal paths, never executes code, and isolates webpage/README
              payloads inside untrusted-data boundaries.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <p className="font-semibold text-slate-900 dark:text-white">
              Provenance &amp; Approval Audit
            </p>
            <p>
              Every unified node and edge preserves entityType, semanticRelation,
              verificationStatus, source references, and traceable audit logs for
              user-approved Copilot actions.
            </p>
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
          Platform Evolution Roadmap
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ROADMAP_PHASES.map((item) => (
            <div
              key={item.phase}
              className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
            >
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                {item.phase}
              </h3>
              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

