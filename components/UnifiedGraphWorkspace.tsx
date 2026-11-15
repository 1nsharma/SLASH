'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Braces,
  ChevronDown,
  Code2,
  Database,
  Download,
  ExternalLink,
  FileCode2,
  FileJson,
  FileText,
  GitBranch,
  Globe,
  History,
  LayoutGrid,
  Link2,
  Loader2,
  Lock,
  LogOut,
  Network,
  Plus,
  Rocket,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { BUSINESS_ZONE_META } from '@/lib/business/zones';
import {
  generateUnifiedBlueprintJson,
  generateUnifiedMarkdownBlueprint,
  generateUnifiedMermaidDiagram,
} from '@/lib/graph/blueprintExport';
import { unifiedGraphToReportAdapter } from '@/lib/graph/unifier';
import type { PublicGitHubAuthStatus } from '@/lib/security/tokenVault';
import type {
  BusinessZone,
  ConnectorSourceKind,
  CopilotActionProposal,
  IntelligenceNode,
  RepoIntelligenceReport,
  UnifiedGraphProject,
  UrlIntelligenceReport,
} from '@/lib/types';
import ArchitectureMap from './ArchitectureMap';
import AskUrlChat from './AskUrlChat';
import BusinessGridPanel from './BusinessGridPanel';
import ComposerStudio from './ComposerStudio';
import type { UnifiedFocusTab } from './TopNav';

type ResourceTabKind = 'url' | 'repo' | 'openapi' | 'database' | 'document';
type BuildSubView = 'grid_copilot' | 'map' | 'details';

interface GitHubRepoListItem {
  id: number;
  fullName: string;
  url: string;
  isPrivate: boolean;
  language: string;
  description: string;
  licenseSpdx?: string;
}

interface UnifiedGraphWorkspaceProps {
  project: UnifiedGraphProject | null;
  focusTab: UnifiedFocusTab;
  onChangeFocusTab: (tab: UnifiedFocusTab) => void;
  onBackToConnect: () => void;
  urlHistory: UrlIntelligenceReport[];
  repoHistory: RepoIntelligenceReport[];
  onAttachUrl: (url: string, options?: { usePreset?: boolean }) => Promise<void>;
  onAttachRepo: (
    repoUrl: string,
    options?: { usePreset?: boolean },
  ) => Promise<void>;
  onAttachConnector: (input: {
    kind: ConnectorSourceKind;
    label?: string;
    urlOrLocator?: string;
    rawContent?: string;
    usePreset?: boolean;
  }) => Promise<void>;
  onUpdateProject: (
    next: UnifiedGraphProject,
    auditAction?: { action: string; target: string },
  ) => void;
  onLaunchSampleUnified: () => Promise<void>;
  onAddBusinessBlock: (blockId: string) => Promise<void> | void;
  onRemoveSource: (sourceId: string) => void;
  onInspectSource?: (sourceId: string) => void;
  onApproveProposal: (proposal: CopilotActionProposal) => Promise<void>;
  isDark: boolean;
  isBusy: boolean;
  errorMessage: string | null;
}

export default function UnifiedGraphWorkspace({
  project,
  focusTab,
  onChangeFocusTab,
  onBackToConnect,
  urlHistory,
  repoHistory,
  onAttachUrl,
  onAttachRepo,
  onAttachConnector,
  onUpdateProject,
  onLaunchSampleUnified,
  onAddBusinessBlock,
  onRemoveSource,
  onInspectSource,
  onApproveProposal,
  isDark,
  isBusy,
  errorMessage,
}: UnifiedGraphWorkspaceProps) {
  const [resourceKind, setResourceKind] = useState<ResourceTabKind>('url');
  const [resourceInput, setResourceInput] = useState('');
  const [connectorPayload, setConnectorPayload] = useState('');
  const [connectorOpen, setConnectorOpen] = useState(false);
  const [buildSubView, setBuildSubView] =
    useState<BuildSubView>('grid_copilot');
  const [copilotPrompt, setCopilotPrompt] = useState<string | null>(null);

  // GitHub OAuth session state (token never leaves server cookies)
  const [ghStatus, setGhStatus] = useState<PublicGitHubAuthStatus | null>(null);
  const [ghRepos, setGhRepos] = useState<GitHubRepoListItem[]>([]);
  const [ghIncludePrivate, setGhIncludePrivate] = useState(false);
  const [ghNotice, setGhNotice] = useState<string | null>(null);
  const [ghLoadingRepos, setGhLoadingRepos] = useState(false);

  const fetchGitHubStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/github/status');
      if (res.ok) {
        const data = (await res.json()) as PublicGitHubAuthStatus;
        setGhStatus(data);
        if (data.authenticated) {
          setGhLoadingRepos(true);
          const reposRes = await fetch('/api/auth/github/repos');
          if (reposRes.ok) {
            const reposData = (await reposRes.json()) as {
              repos?: GitHubRepoListItem[];
            };
            setGhRepos(reposData.repos ?? []);
          }
          setGhLoadingRepos(false);
        } else {
          setGhRepos([]);
        }
      }
    } catch {
      setGhLoadingRepos(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchGitHubStatus();
    });

    const handleOAuthMessage = (event: MessageEvent) => {
      const origin = event.origin || '';
      if (
        origin &&
        !origin.endsWith('.run.app') &&
        !origin.includes('localhost') &&
        !origin.includes('127.0.0.1')
      ) {
        return;
      }
      if (event.data?.type === 'GITHUB_OAUTH_SUCCESS') {
        setGhNotice(
          `Connected read-only GitHub account @${event.data.login || 'user'}.`,
        );
        void fetchGitHubStatus();
      } else if (event.data?.type === 'GITHUB_OAUTH_ERROR') {
        setGhNotice(
          event.data.error || 'GitHub OAuth authorization did not complete.',
        );
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [fetchGitHubStatus]);

  const handleConnectGitHub = async () => {
    setGhNotice(null);
    try {
      const res = await fetch(
        `/api/auth/github/url?includePrivate=${ghIncludePrivate ? '1' : '0'}`,
      );
      const data = (await res.json()) as {
        url?: string;
        error?: string;
        callbackUrl?: string;
      };
      if (!res.ok || !data.url) {
        setGhNotice(
          `${data.error || 'OAuth setup required.'}${
            data.callbackUrl ? ` Callback URL: ${data.callbackUrl}` : ''
          }`,
        );
        return;
      }
      const popup = window.open(
        data.url,
        'slash_github_oauth',
        'width=600,height=720',
      );
      if (!popup) {
        setGhNotice(
          'Popup blocked by browser. Allow popups for this site to complete GitHub OAuth.',
        );
      }
    } catch {
      setGhNotice('Failed to initialize GitHub OAuth flow.');
    }
  };

  const handleDisconnectGitHub = async () => {
    await fetch('/api/auth/github/logout', { method: 'POST' });
    setGhRepos([]);
    setGhNotice('Disconnected GitHub OAuth session.');
    await fetchGitHubStatus();
  };

  const adaptedReport = useMemo(
    () => (project ? unifiedGraphToReportAdapter(project) : null),
    [project],
  );

  const handleAttachSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy) return;

    if (resourceKind === 'url') {
      const trimmed = resourceInput.trim();
      if (!trimmed) return;
      await onAttachUrl(trimmed);
      setResourceInput('');
      setConnectorOpen(false);
      return;
    }

    if (resourceKind === 'repo') {
      const trimmed = resourceInput.trim();
      if (!trimmed) return;
      await onAttachRepo(trimmed);
      setResourceInput('');
      setConnectorOpen(false);
      return;
    }

    const kindMap: Record<
      Exclude<ResourceTabKind, 'url' | 'repo'>,
      ConnectorSourceKind
    > = {
      openapi: 'openapi_spec',
      database: 'database_schema',
      document: 'document_pdf',
    };

    const trimmedUrl = resourceInput.trim();
    const trimmedRaw = connectorPayload.trim();
    if (!trimmedUrl && !trimmedRaw) return;

    await onAttachConnector({
      kind: kindMap[resourceKind],
      urlOrLocator: trimmedUrl || undefined,
      rawContent: trimmedRaw || undefined,
    });
    setResourceInput('');
    setConnectorPayload('');
    setConnectorOpen(false);
  };

  const handleAskAboutNode = (node: IntelligenceNode) => {
    setCopilotPrompt(
      `Explain how "${node.label}" (${node.sourceEngine || 'unified'}) connects across this unified project graph and what evidence supports its edges.`,
    );
    onChangeFocusTab('build');
    setBuildSubView('grid_copilot');
  };

  const triggerDownload = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadBlueprint = () => {
    if (!project) return;
    triggerDownload(
      'slash-unified-blueprint.md',
      generateUnifiedMarkdownBlueprint(project),
      'text/markdown;charset=utf-8',
    );
  };

  const handleDownloadBlueprintJson = () => {
    if (!project) return;
    triggerDownload(
      'slash-unified-blueprint.json',
      generateUnifiedBlueprintJson(project),
      'application/json;charset=utf-8',
    );
  };

  const handleDownloadMermaid = () => {
    if (!project) return;
    triggerDownload(
      'slash-unified-architecture.mmd',
      generateUnifiedMermaidDiagram(project),
      'text/plain;charset=utf-8',
    );
  };

  const isTextPayloadMode =
    resourceKind === 'openapi' ||
    resourceKind === 'database' ||
    resourceKind === 'document';

  // Clean Empty State when user clicks Step 2 or Step 3 before adding any sources
  if (!project || !adaptedReport) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10">
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 sm:p-12 text-center space-y-4">
          <Link2 className="w-8 h-8 text-blue-600 mx-auto" aria-hidden="true" />
          <div className="space-y-2 max-w-lg mx-auto">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
              {focusTab === 'launch' ? 'Step 3 of 3 · Launch' : 'Step 2 of 3 · Build & Fix'}
            </p>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              No business sources connected yet
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Load our interactive Demo Business stack to explore the 4-Zone
              Grid and AI Copilot immediately, or go back to Step 1 to connect
              your own website, repository, or API.
            </p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void onLaunchSampleUnified()}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg cursor-pointer"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              <span>Load Demo Business Stack</span>
            </button>
            <button
              type="button"
              onClick={onBackToConnect}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Back to Step 1: Connect</span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  // Dedicated Step 3: Launch & Export Studio entry point
  if (focusTab === 'launch') {
    return (
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
        <ComposerStudio
          project={project}
          onUpdateProject={onUpdateProject}
          onBackToBuild={() => onChangeFocusTab('build')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Streamlined Workspace Header Bar */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-blue-600 dark:text-blue-400">
                Step 2 of 3 · Build &amp; Fix
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {project.sources.length} connected source(s)
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                {project.crossLinksCount} bridge(s)
              </span>
            </div>
            <h1 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">
              {project.title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
              {project.summary}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              aria-expanded={connectorOpen}
              onClick={() => setConnectorOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add Source</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  connectorOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              onClick={() => onChangeFocusTab('launch')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Rocket className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Continue to Step 3: Launch</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Collapsible Multi-Source Connector Drawer */}
        {connectorOpen && (
          <form
            onSubmit={handleAttachSubmit}
            className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                {(
                  [
                    { id: 'url', label: 'Website / URL', icon: Globe },
                    { id: 'repo', label: 'GitHub Repo', icon: Code2 },
                    { id: 'openapi', label: 'OpenAPI / API', icon: Braces },
                    { id: 'database', label: 'DB Schema', icon: Database },
                    { id: 'document', label: 'Docs / Config', icon: FileText },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setResourceKind(tab.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                        resourceKind === tab.id
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* GitHub Read-Only OAuth Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {ghStatus?.authenticated ? (
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-800 dark:text-emerald-300">
                    <GitBranch className="w-3.5 h-3.5" aria-hidden="true" />
                    <span className="font-mono">@{ghStatus.login}</span>
                    <button
                      type="button"
                      onClick={() => void handleDisconnectGitHub()}
                      aria-label="Disconnect GitHub"
                      className="text-slate-500 hover:text-red-600 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ghIncludePrivate}
                        onChange={(e) => setGhIncludePrivate(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      <span>Include private repos</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleConnectGitHub()}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Connect GitHub (Read-Only)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <label htmlFor="unified-resource-input" className="sr-only">
                Resource URL or GitHub repository to connect
              </label>
              <input
                id="unified-resource-input"
                type="text"
                value={resourceInput}
                onChange={(e) => setResourceInput(e.target.value)}
                disabled={isBusy}
                placeholder={
                  resourceKind === 'url'
                    ? 'Connect a public URL (e.g., https://nextjs.org/docs or https://stripe.com)'
                    : resourceKind === 'repo'
                      ? 'Connect a GitHub repo (e.g., vercel/ai or fastapi/fastapi)'
                      : resourceKind === 'openapi'
                        ? 'Optional OpenAPI JSON URL (or paste OpenAPI JSON below)'
                        : resourceKind === 'database'
                          ? 'Schema label (e.g., saas-postgres.prisma) — paste DDL/Prisma below'
                          : 'Config/Doc label (e.g., .env.example) — paste content below'
                }
                className="flex-1 px-3.5 py-2 text-xs sm:text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />

              {isTextPayloadMode && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    void onAttachConnector({
                      kind:
                        resourceKind === 'openapi'
                          ? 'openapi_spec'
                          : resourceKind === 'database'
                            ? 'database_schema'
                            : 'document_pdf',
                      usePreset: true,
                    })
                  }
                  className="px-3 py-2 text-xs font-medium border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-950/30 hover:bg-blue-100/70 rounded-lg cursor-pointer shrink-0"
                >
                  Load Sample{' '}
                  {resourceKind === 'openapi'
                    ? 'OpenAPI'
                    : resourceKind === 'database'
                      ? 'Schema'
                      : 'Config'}
                </button>
              )}

              <button
                type="submit"
                disabled={
                  isBusy ||
                  (!resourceInput.trim() && !connectorPayload.trim())
                }
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-50 rounded-lg cursor-pointer shrink-0"
              >
                {isBusy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>Attach</span>
              </button>
            </div>

            {isTextPayloadMode && (
              <div>
                <label htmlFor="connector-raw-payload" className="sr-only">
                  Connector payload content
                </label>
                <textarea
                  id="connector-raw-payload"
                  rows={3}
                  value={connectorPayload}
                  onChange={(e) => setConnectorPayload(e.target.value)}
                  disabled={isBusy}
                  placeholder={
                    resourceKind === 'openapi'
                      ? 'Paste OpenAPI 3.x JSON specification...'
                      : resourceKind === 'database'
                        ? 'Paste SQL CREATE TABLE DDL or Prisma schema models...'
                        : 'Paste Markdown docs or .env.example (secret values are automatically redacted)...'
                  }
                  className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            )}

            {/* Authenticated GitHub Repos Picker */}
            {ghStatus?.authenticated && (ghRepos.length > 0 || ghLoadingRepos) && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  Your GitHub repos:
                </span>
                {ghLoadingRepos ? (
                  <span className="text-slate-400">Loading...</span>
                ) : (
                  ghRepos.slice(0, 6).map((repo) => (
                    <button
                      key={repo.id}
                      type="button"
                      disabled={isBusy}
                      onClick={() => void onAttachRepo(repo.fullName)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:border-blue-500 font-mono text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      {repo.isPrivate && (
                        <Lock className="w-3 h-3 text-amber-600" aria-hidden="true" />
                      )}
                      <span>+ {repo.fullName}</span>
                    </button>
                  ))
                )}
              </div>
            )}

            {ghNotice && (
              <p className="text-xs font-mono text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-lg">
                {ghNotice}
              </p>
            )}

            {/* Quick attach from history */}
            {(urlHistory.length > 0 || repoHistory.length > 0) && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Recent scans:</span>
                {urlHistory.slice(0, 3).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                      void onAttachUrl(u.normalizedUrl, { usePreset: true })
                    }
                    className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:border-blue-500 font-mono text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    + {u.domain}
                  </button>
                ))}
                {repoHistory.slice(0, 3).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                      void onAttachRepo(r.normalizedUrl, { usePreset: true })
                    }
                    className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:border-blue-500 font-mono text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    + {r.fullName}
                  </button>
                ))}
              </div>
            )}
          </form>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 px-3 py-2 rounded-lg"
          >
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}
      </section>

      {/* Compatibility & Safety Banners */}
      {project.conflicts && project.conflicts.length > 0 && (
        <div
          role="status"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              className="w-4 h-4 mt-0.5 shrink-0"
              aria-hidden="true"
            />
            <p>
              <span className="font-semibold">
                {project.conflicts.length} Compatibility Check(s):{' '}
              </span>
              {project.conflicts.map((c) => c.title).join(' · ')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChangeFocusTab('launch')}
            className="px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 cursor-pointer shrink-0"
          >
            Review in Launch
          </button>
        </div>
      )}

      {project.truncationWarnings && project.truncationWarnings.length > 0 && (
        <div
          role="status"
          className="flex items-start gap-2 px-4 py-2.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-300"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold">Repository Safety Limits Applied: </span>
            {project.truncationWarnings.join(' ')}
          </p>
        </div>
      )}

      {/* STEP 2: BUILD & FIX */}
      <div className="space-y-4">
          {/* Sub-view Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label="Build and inspect views"
              className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800"
            >
              <button
                type="button"
                role="tab"
                aria-selected={buildSubView === 'grid_copilot'}
                onClick={() => setBuildSubView('grid_copilot')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  buildSubView === 'grid_copilot'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Business Grid + AI Copilot</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={buildSubView === 'map'}
                onClick={() => setBuildSubView('map')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  buildSubView === 'map'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Network className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Architecture Map</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={buildSubView === 'details'}
                onClick={() => setBuildSubView('details')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  buildSubView === 'details'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Sources &amp; Exports</span>
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Connected:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 truncate max-w-md">
                {project.sources.map((s) => s.label).join(' · ')}
              </span>
            </div>
          </div>

          {buildSubView === 'grid_copilot' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
              <div className="xl:col-span-7">
                <BusinessGridPanel
                  project={project}
                  onAddBusinessBlock={onAddBusinessBlock}
                  isBusy={isBusy}
                />
              </div>
              <div className="xl:col-span-5">
                <AskUrlChat
                  key={`${project.id}-${copilotPrompt ?? ''}`}
                  unifiedProject={project}
                  initialPrompt={copilotPrompt}
                  onApproveProposal={onApproveProposal}
                />
              </div>
            </div>
          )}

          {buildSubView === 'map' && (
            <ArchitectureMap
              report={adaptedReport}
              onAskAboutNode={handleAskAboutNode}
              onQuickAddZone={(zone) => {
                if (zone === 'operations') {
                  void onAddBusinessBlock('clerk-auth');
                  return;
                }
                if (zone === 'data') {
                  void onAddBusinessBlock('shared-memory-pgvector');
                  return;
                }
                setConnectorOpen(true);
                setResourceKind(zone === 'frontend' ? 'url' : 'repo');
              }}
              isDark={isDark}
            />
          )}

          {buildSubView === 'details' && (
            <div className="space-y-4">
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                      Connected Resources ({project.sources.length})
                    </h2>
                    <span className="text-xs font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                      {project.crossLinksCount} cross-engine bridge(s)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {project.sources.map((src) => (
                      <div
                        key={src.id}
                        className="flex items-center justify-between gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                            <span>
                              {src.kind === 'repo'
                                ? 'Repo'
                                : src.kind === 'connector'
                                  ? 'Connector'
                                  : 'Website'}
                            </span>
                            {src.businessZone && (
                              <>
                                <span>·</span>
                                <span className="text-slate-700 dark:text-slate-300">
                                  {BUSINESS_ZONE_META[src.businessZone].shortLabel}
                                </span>
                              </>
                            )}
                            <span>·</span>
                            <span>{src.categoryOrLanguage}</span>
                          </div>
                          <p className="font-mono text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {src.label}
                          </p>
                          <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                            {src.nodeCount} nodes ({src.detectedCount} detected)
                            {src.authScheme ? ` · ${src.authScheme}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {onInspectSource && src.kind !== 'connector' && (
                            <button
                              type="button"
                              aria-label={`Inspect deep report for ${src.label}`}
                              onClick={() => onInspectSource(src.id)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            aria-label={`Remove ${src.label} from unified graph`}
                            onClick={() => onRemoveSource(src.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                  <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                    Blueprint Exports &amp; Shared Tech
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadBlueprintJson}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <FileJson className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                      <span>JSON</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadMermaid}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <FileCode2 className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                      <span>Mermaid (.mmd)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadBlueprint}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Markdown</span>
                    </button>
                  </div>

                  {project.sharedTech.length > 0 && (
                    <p className="text-xs font-mono text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
                      Shared: {project.sharedTech.join(' · ')}
                    </p>
                  )}

                  {project.aiSynthesis && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 prose prose-xs dark:prose-invert max-w-none">
                      <Markdown>{project.aiSynthesis}</Markdown>
                    </div>
                  )}
                </div>
              </section>

              {project.auditLog && project.auditLog.length > 0 && (
                <section
                  aria-label="Graph action audit trail"
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <History className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                    <span>Action Audit Log ({project.auditLog.length})</span>
                  </div>
                  <ul className="space-y-1 text-xs font-mono text-slate-600 dark:text-slate-400">
                    {project.auditLog.slice(0, 6).map((entry) => (
                      <li key={entry.id} className="truncate">
                        [{entry.actor}] {entry.action} — {entry.target}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
