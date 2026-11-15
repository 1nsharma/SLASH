'use client';

import { useMemo, useState } from 'react';
import {
  ChevronDown,
  Code2,
  Cpu,
  Database,
  Download,
  ExternalLink,
  FolderTree,
  GitBranch,
  MessageSquare,
  Moon,
  Network,
  Package,
  PlayCircle,
  RefreshCw,
  Share2,
  Sun,
} from 'lucide-react';
import type {
  CopilotActionProposal,
  IntelligenceNode,
  RepoIntelligenceReport,
  UrlIntelligenceReport,
  WorkspaceView,
} from '@/lib/types';
import ArchitectureMap from './ArchitectureMap';
import AskUrlChat from './AskUrlChat';
import ExplainerPlayer from './ExplainerPlayer';
import ExportView from './ExportView';
import SitemapView from './SitemapView';
import SponsorBanner from './SponsorBanner';
import TechStackView from './TechStackView';
import WorkflowView from './WorkflowView';

interface RepoWorkspaceProps {
  repoReport: RepoIntelligenceReport;
  repoHistory: RepoIntelligenceReport[];
  activeView: WorkspaceView;
  onSelectView: (view: WorkspaceView) => void;
  onSelectRepoReport: (report: RepoIntelligenceReport) => void;
  onSendToUnified: (report: RepoIntelligenceReport) => void;
  onRefreshLive: () => void;
  isRefreshing: boolean;
  isDark: boolean;
  onToggleTheme: () => void;
  onApproveProposal?: (proposal: CopilotActionProposal) => Promise<void> | void;
}

const PRIMARY_VIEW_ITEMS: Array<{
  id: WorkspaceView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'map', label: 'Visual Map', icon: Network },
  { id: 'ask', label: 'AI Copilot', icon: MessageSquare },
];

const DETAIL_VIEW_ITEMS: Array<{
  id: WorkspaceView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'sitemap', label: 'Tree & Routes', icon: FolderTree },
  { id: 'flows', label: 'Module Flows', icon: GitBranch },
  { id: 'tech', label: 'Dependencies & Tech', icon: Cpu },
  { id: 'explainer', label: '60s Explainer', icon: PlayCircle },
  { id: 'export', label: 'Export Report', icon: Download },
];

export default function RepoWorkspace({
  repoReport,
  repoHistory,
  activeView,
  onSelectView,
  onSelectRepoReport,
  onSendToUnified,
  onRefreshLive,
  isRefreshing,
  isDark,
  onToggleTheme,
  onApproveProposal,
}: RepoWorkspaceProps) {
  const [askNodePrompt, setAskNodePrompt] = useState<string | null>(null);
  const isDetailActive = DETAIL_VIEW_ITEMS.some((v) => v.id === activeView);
  const [detailsOpen, setDetailsOpen] = useState(isDetailActive);

  const adaptedReport: UrlIntelligenceReport = useMemo(
    () => ({
      id: repoReport.id,
      url: repoReport.repoUrl,
      normalizedUrl: repoReport.normalizedUrl,
      domain: repoReport.fullName,
      title: repoReport.title,
      category: 'github',
      summary: repoReport.summary,
      executiveOverview: repoReport.executiveOverview,
      analyzedAt: repoReport.analyzedAt,
      sourceMethod:
        repoReport.sourceMethod === 'preset-repo'
          ? 'preset-showcase'
          : 'live-crawl',
      cacheStatus: repoReport.cacheStatus,
      cachedAt: repoReport.cachedAt,
      crawlMetrics: {
        httpStatus: 200,
        internalLinksCount: repoReport.metrics.filesCount,
        externalLinksCount: repoReport.metrics.dependenciesCount,
        headingsCount: repoReport.metrics.directoriesCount,
        scriptsCount: repoReport.metrics.routesCount,
        inspectedLabel: repoReport.metrics.inspectedLabel,
      },
      nodes: repoReport.nodes,
      edges: repoReport.edges,
      sitemap: repoReport.directoryTree,
      workflows: repoReport.workflows,
      techStack: repoReport.techStack,
      explainerScript: repoReport.explainerScript,
      limitationsNote: repoReport.limitationsNote,
      suggestedQuestions: repoReport.suggestedQuestions,
    }),
    [repoReport],
  );

  const detectedCount = repoReport.nodes.filter(
    (n) => n.confidence === 'detected',
  ).length;

  const handleAskAboutNode = (node: IntelligenceNode) => {
    setAskNodePrompt(
      `Explain the role of "${node.label}" (${node.confidence}) in ${repoReport.fullName} and cite the repository file evidence.`,
    );
    onSelectView('ask');
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Sidebar */}
        <aside
          aria-label="Repo intelligence navigation"
          className="w-full lg:w-[256px] shrink-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-5"
        >
          <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
              Repo Intelligence Engine
            </p>
            <h2 className="mt-1 font-display text-sm font-bold text-slate-900 dark:text-white truncate">
              {repoReport.fullName}
            </h2>
            <a
              href={repoReport.normalizedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 hover:text-blue-600 dark:text-slate-400 truncate max-w-full"
            >
              <span className="truncate">{repoReport.normalizedUrl}</span>
              <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
            </a>
          </div>

          <nav aria-label="Repo intelligence views" className="space-y-1">
            {PRIMARY_VIEW_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectView(item.id)}
                  aria-current={active ? 'true' : undefined}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}

            <div className="pt-2">
              <button
                type="button"
                aria-expanded={detailsOpen || isDetailActive}
                onClick={() => setDetailsOpen((prev) => !prev)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <span>Details &amp; Export</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${
                    detailsOpen || isDetailActive ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              {(detailsOpen || isDetailActive) && (
                <div className="mt-1 space-y-1 pl-1">
                  {DETAIL_VIEW_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const active = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectView(item.id)}
                        aria-current={active ? 'true' : undefined}
                        className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                          active
                            ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          <button
            type="button"
            onClick={() => onSendToUnified(repoReport)}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Unify in Business Grid</span>
          </button>

          {repoHistory.length > 1 && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                Recent Repos
              </p>
              <ul className="space-y-1 max-h-36 overflow-y-auto">
                {repoHistory.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelectRepoReport(item)}
                      className={`w-full text-left px-2.5 py-1.5 text-xs font-mono rounded-md truncate transition-colors cursor-pointer ${
                        item.id === repoReport.id
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      {item.fullName}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {repoReport.primaryLanguage}
            </span>
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              {isDark ? (
                <Sun className="w-3.5 h-3.5" />
              ) : (
                <Moon className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 w-full space-y-5">
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-1.5 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>Repo Intelligence</span>
                  <span aria-hidden="true">/</span>
                  <span className="font-mono">{repoReport.fullName}</span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                    <Database className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                    <span>
                      {repoReport.cacheStatus === 'hit'
                        ? 'Cached Repo'
                        : repoReport.sourceMethod === 'preset-repo'
                          ? 'Reference Preset'
                          : 'Live GitHub Scan'}
                    </span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    disabled={isRefreshing}
                    onClick={onRefreshLive}
                    className="inline-flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    <span>{isRefreshing ? 'Scanning...' : 'Rescan Live'}</span>
                  </button>
                </div>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white text-balance">
                  {repoReport.title}
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {repoReport.summary}
                </p>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
                <div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Files
                  </p>
                  <p className="font-mono text-base font-semibold text-slate-900 dark:text-white tabular-nums">
                    {repoReport.metrics.filesCount}
                  </p>
                </div>
                <div className="h-7 w-px bg-slate-200 dark:bg-slate-800" />
                <div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Routes
                  </p>
                  <p className="font-mono text-base font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
                    {repoReport.metrics.routesCount}
                  </p>
                </div>
                <div className="h-7 w-px bg-slate-200 dark:bg-slate-800" />
                <div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Detected
                  </p>
                  <p className="font-mono text-base font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {detectedCount}/{repoReport.nodes.length}
                  </p>
                </div>
              </div>
            </div>

            {activeView === 'map' && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                    <Package className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                    <span>Inspected Manifests ({repoReport.manifests.length})</span>
                  </div>
                  {repoReport.manifests.length === 0 ? (
                    <p className="text-xs text-slate-500">No root manifests found.</p>
                  ) : (
                    <ul className="space-y-1 text-xs font-mono text-slate-600 dark:text-slate-400">
                      {repoReport.manifests.map((m) => (
                        <li key={m.path} className="truncate">
                          {m.path} ({m.ecosystem}: {m.dependencies.length} deps)
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                    <Code2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                    <span>Discovered Routes ({repoReport.discoveredRoutes.length})</span>
                  </div>
                  {repoReport.discoveredRoutes.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Library/monorepo structure without standard HTTP route directories.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-xs font-mono text-slate-600 dark:text-slate-400">
                      {repoReport.discoveredRoutes.slice(0, 4).map((r) => (
                        <li key={r.path} className="truncate">
                          [{r.kind.toUpperCase()}] {r.routePattern} ({r.path})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </section>

          {activeView === 'map' && (
            <ArchitectureMap
              report={adaptedReport}
              onAskAboutNode={handleAskAboutNode}
              isDark={isDark}
              onRegenerate={onRefreshLive}
              isRegenerating={isRefreshing}
            />
          )}
          {activeView === 'sitemap' && <SitemapView report={adaptedReport} />}
          {activeView === 'flows' && <WorkflowView report={adaptedReport} />}
          {activeView === 'tech' && <TechStackView report={adaptedReport} />}
          {activeView === 'explainer' && (
            <ExplainerPlayer report={adaptedReport} />
          )}
          {activeView === 'ask' && (
            <AskUrlChat
              key={`${repoReport.id}-${askNodePrompt ?? ''}`}
              repoReport={repoReport}
              initialPrompt={askNodePrompt}
              onApproveProposal={onApproveProposal}
            />
          )}
          {activeView === 'export' && <ExportView report={adaptedReport} />}

          <SponsorBanner />
        </main>
      </div>
    </div>
  );
}
