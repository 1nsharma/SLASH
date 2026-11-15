'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import {
  AlertCircle,
  AlertTriangle,
  Braces,
  Code2,
  Database,
  Download,
  FileCode2,
  FileJson,
  FileText,
  GitBranch,
  Globe,
  History,
  Link2,
  Loader2,
  Lock,
  LogOut,
  MessageSquare,
  Network,
  Plus,
  Sparkles,
  Trash2,
  Wrench,
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

type ResourceTabKind = 'url' | 'repo' | 'openapi' | 'database' | 'document';

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
  onApproveProposal: (proposal: CopilotActionProposal) => Promise<void>;
  isDark: boolean;
  isBusy: boolean;
  errorMessage: string | null;
}

export default function UnifiedGraphWorkspace({
  project,
  urlHistory,
  repoHistory,
  onAttachUrl,
  onAttachRepo,
  onAttachConnector,
  onUpdateProject,
  onLaunchSampleUnified,
  onAddBusinessBlock,
  onRemoveSource,
  onApproveProposal,
  isDark,
  isBusy,
  errorMessage,
}: UnifiedGraphWorkspaceProps) {
  const [resourceKind, setResourceKind] = useState<ResourceTabKind>('url');
  const [resourceInput, setResourceInput] = useState('');
  const [connectorPayload, setConnectorPayload] = useState('');
  const [activeTab, setActiveTab] = useState<'graph' | 'composer' | 'copilot'>(
    'graph',
  );
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
      return;
    }

    if (resourceKind === 'repo') {
      const trimmed = resourceInput.trim();
      if (!trimmed) return;
      await onAttachRepo(trimmed);
      setResourceInput('');
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
  };

  const handleAskAboutNode = (node: IntelligenceNode) => {
    setCopilotPrompt(
      `Explain how "${node.label}" (${node.sourceEngine || 'unified'}) connects across this unified project graph and what evidence supports its edges.`,
    );
    setActiveTab('copilot');
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

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Unified Header & Multi-Source Connector */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
              Universal Digital Integration &amp; App Composer
            </p>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {project ? project.title : 'SLASH Unified Intelligence Graph'}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {project
                ? project.summary
                : 'Connect URLs, GitHub repositories, OpenAPI specs, database schemas, and docs into one graph and composed application.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {project && (
              <>
                <div
                  role="group"
                  aria-label="Unified workspace view"
                  className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg"
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab('graph')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                      activeTab === 'graph'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Network className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Unified Graph</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('composer')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                      activeTab === 'composer'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>App Composer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('copilot')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                      activeTab === 'copilot'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>AI Copilot</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadBlueprintJson}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <FileJson
                    className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                  <span>Blueprint JSON</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadMermaid}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <FileCode2
                    className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400"
                    aria-hidden="true"
                  />
                  <span>Mermaid (.mmd)</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadBlueprint}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Export Blueprint</span>
                </button>
              </>
            )}

            <button
              type="button"
              disabled={isBusy}
              onClick={() => void onLaunchSampleUnified()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Load Demo Pair (Docs + Repo)</span>
            </button>
          </div>
        </div>

        {/* Multi-Source Connector Bar */}
        <form
          onSubmit={handleAttachSubmit}
          className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(
                [
                  { id: 'url', label: 'URLmind Target', icon: Globe },
                  { id: 'repo', label: 'GitHub Repo', icon: Code2 },
                  { id: 'openapi', label: 'OpenAPI / Webhook', icon: Braces },
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
                    ? 'Connect a public or authorized GitHub repo (e.g., vercel/ai or fastapi/fastapi)'
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
              <span>Connect to Graph</span>
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
                      ? 'Paste SQL CREATE TABLE DDL or Prisma schema models (no live DB credentials needed)...'
                      : 'Paste Markdown docs or .env.example (secret values are automatically redacted)...'
                }
                className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          )}
        </form>

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
            <span>Attach from history:</span>
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
                + URL: {u.domain}
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
                + Repo: {r.fullName}
              </button>
            ))}
          </div>
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

      {!project || !adaptedReport ? (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
          <Link2 className="w-8 h-8 text-blue-600 mx-auto" aria-hidden="true" />
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            No resources unified yet
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
            Connect any URL, GitHub repository, OpenAPI spec, database schema,
            or config file above—or load the pre-linked Demo Pair to explore
            cross-engine bridges and launch the App Composer.
          </p>
        </section>
      ) : (
        <>
          {/* Connected Sources & Shared Stack Strip (full cards on Graph tab, compact strip on Composer/Copilot) */}
          {activeTab === 'graph' ? (
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                    Connected Resources ({project.sources.length})
                  </h2>
                <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                  {project.crossLinksCount} cross-engine bridge(s)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {project.sources.map((src) => (
                  <div
                    key={src.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                        <span>
                          {src.kind === 'repo'
                            ? 'Repo Engine'
                            : src.kind === 'connector'
                              ? 'Connector'
                              : 'URLmind Engine'}
                        </span>
                        {src.businessZone && (
                          <>
                            <span>·</span>
                            <span className="text-slate-700 dark:text-slate-300">
                              {BUSINESS_ZONE_META[src.businessZone].shortLabel} Zone
                            </span>
                          </>
                        )}
                        <span>·</span>
                        <span>{src.categoryOrLanguage}</span>
                        {src.licenseSpdx && (
                          <>
                            <span>·</span>
                            <span className="font-mono text-slate-600 dark:text-slate-300">
                              {src.licenseSpdx}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="font-mono text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {src.label}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {src.nodeCount} nodes ({src.detectedCount} detected)
                        {src.authScheme ? ` · ${src.authScheme}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${src.label} from unified graph`}
                      onClick={() => onRemoveSource(src.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Shared Technology Bridges
              </h2>
              {project.sharedTech.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Connect multiple sources to detect shared dependencies, APIs,
                  and integration adapters.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {project.sharedTech.map((tech) => (
                    <span
                      key={tech}
                      className="px-2 py-1 text-xs font-mono rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              )}
              {project.aiSynthesis && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 prose prose-xs dark:prose-invert max-w-none">
                  <Markdown>{project.aiSynthesis}</Markdown>
                </div>
              )}
            </div>
          </section>
          ) : (
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900 dark:text-white">
                  Connected Resources ({project.sources.length}):
                </span>
                {project.sources.map((src) => (
                  <span
                    key={src.id}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-200"
                  >
                    <span>{src.label}</span>
                  </span>
                ))}
              </div>
              <span className="font-mono text-emerald-700 dark:text-emerald-400">
                {project.crossLinksCount} cross-engine bridge(s)
              </span>
            </section>
          )}

          {/* Compatibility & Conflict Banner */}
          {project.conflicts && project.conflicts.length > 0 && (
            <div
              role="status"
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle
                  className="w-4 h-4 mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-semibold">
                    {project.conflicts.length} Compatibility / Architecture Check(s) Flagged
                  </p>
                  <p>{project.conflicts.map((c) => c.title).join(' · ')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('composer')}
                className="px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 cursor-pointer shrink-0"
              >
                Resolve in App Composer
              </button>
            </div>
          )}

          {project.truncationWarnings && project.truncationWarnings.length > 0 && (
            <div
              role="status"
              className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-300"
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <div className="space-y-0.5">
                <p className="font-semibold">Repository Safety Limits Applied</p>
                <p>{project.truncationWarnings.join(' ')}</p>
              </div>
            </div>
          )}

          {activeTab === 'graph' ? (
            <div className="space-y-4">
              <BusinessGridPanel
                project={project}
                onAddBusinessBlock={onAddBusinessBlock}
                isBusy={isBusy}
              />
              <ArchitectureMap
                report={adaptedReport}
                onAskAboutNode={handleAskAboutNode}
                isDark={isDark}
              />
            </div>
          ) : activeTab === 'composer' ? (
            <ComposerStudio
              project={project}
              onUpdateProject={onUpdateProject}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-7">
                <AskUrlChat
                  key={`${project.id}-${copilotPrompt ?? ''}`}
                  unifiedProject={project}
                  initialPrompt={copilotPrompt}
                  onApproveProposal={onApproveProposal}
                />
              </div>
              <div className="lg:col-span-5">
                <BusinessGridPanel
                  project={project}
                  onAddBusinessBlock={onAddBusinessBlock}
                  isBusy={isBusy}
                  compact
                />
              </div>
            </div>
          )}

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
        </>
      )}
    </div>
  );
}
