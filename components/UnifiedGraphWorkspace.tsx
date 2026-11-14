'use client';

import { useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import {
  AlertCircle,
  AlertTriangle,
  Code2,
  Download,
  FileCode2,
  FileJson,
  Globe,
  History,
  Link2,
  Loader2,
  MessageSquare,
  Network,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  generateUnifiedBlueprintJson,
  generateUnifiedMarkdownBlueprint,
  generateUnifiedMermaidDiagram,
} from '@/lib/graph/blueprintExport';
import { unifiedGraphToReportAdapter } from '@/lib/graph/unifier';
import type {
  CopilotActionProposal,
  IntelligenceNode,
  RepoIntelligenceReport,
  UnifiedGraphProject,
  UrlIntelligenceReport,
} from '@/lib/types';
import ArchitectureMap from './ArchitectureMap';
import AskUrlChat from './AskUrlChat';

interface UnifiedGraphWorkspaceProps {
  project: UnifiedGraphProject | null;
  urlHistory: UrlIntelligenceReport[];
  repoHistory: RepoIntelligenceReport[];
  onAttachUrl: (url: string, options?: { usePreset?: boolean }) => Promise<void>;
  onAttachRepo: (
    repoUrl: string,
    options?: { usePreset?: boolean },
  ) => Promise<void>;
  onLaunchSampleUnified: () => Promise<void>;
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
  onLaunchSampleUnified,
  onRemoveSource,
  onApproveProposal,
  isDark,
  isBusy,
  errorMessage,
}: UnifiedGraphWorkspaceProps) {
  const [resourceKind, setResourceKind] = useState<'url' | 'repo'>('url');
  const [resourceInput, setResourceInput] = useState('');
  const [activeTab, setActiveTab] = useState<'graph' | 'copilot'>('graph');
  const [copilotPrompt, setCopilotPrompt] = useState<string | null>(null);

  const adaptedReport = useMemo(
    () => (project ? unifiedGraphToReportAdapter(project) : null),
    [project],
  );

  const handleAttachSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = resourceInput.trim();
    if (!trimmed || isBusy) return;
    if (resourceKind === 'url') {
      await onAttachUrl(trimmed);
    } else {
      await onAttachRepo(trimmed);
    }
    setResourceInput('');
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

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Unified Header & Resource Connector */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
              Unified Graph Engine
            </p>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {project ? project.title : 'SLASH Unified Intelligence Graph'}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {project
                ? project.summary
                : 'Connect URLMIND web analyses and Repo Intelligence scans into one interactive knowledge graph.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                  <FileJson className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  <span>Blueprint JSON</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadMermaid}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <FileCode2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
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

        {/* Add Resource Bar */}
        <form
          onSubmit={handleAttachSubmit}
          className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
        >
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => setResourceKind('url')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                resourceKind === 'url'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Globe className="w-3.5 h-3.5" aria-hidden="true" />
              <span>URLmind Target</span>
            </button>
            <button
              type="button"
              onClick={() => setResourceKind('repo')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                resourceKind === 'repo'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>GitHub Repo</span>
            </button>
          </div>

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
                : 'Connect a GitHub repository (e.g., vercel/ai or https://github.com/fastapi/fastapi)'
            }
            className="flex-1 px-3.5 py-2 text-xs sm:text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          />

          <button
            type="submit"
            disabled={isBusy || !resourceInput.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-50 rounded-lg cursor-pointer shrink-0"
          >
            {isBusy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>Connect to Graph</span>
          </button>
        </form>

        {/* Quick attach from history */}
        {(urlHistory.length > 0 || repoHistory.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Attach from history:</span>
            {urlHistory.slice(0, 3).map((u) => (
              <button
                key={u.id}
                type="button"
                disabled={isBusy}
                onClick={() => void onAttachUrl(u.normalizedUrl, { usePreset: true })}
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
            Connect any public URL and GitHub repository above, send an analyzed
            URL or Repo to the graph, or load the pre-linked Demo Pair to explore
            cross-engine dependency bridges.
          </p>
        </section>
      ) : (
        <>
          {/* Connected Sources & Shared Stack Strip */}
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
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                        <span>{src.kind === 'repo' ? 'Repo Engine' : 'URLmind Engine'}</span>
                        <span>·</span>
                        <span>{src.categoryOrLanguage}</span>
                      </div>
                      <p className="font-mono text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {src.label}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {src.nodeCount} nodes ({src.detectedCount} detected)
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
                  Connect both a web URL and repository to automatically detect
                  shared packages and routes.
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
            <ArchitectureMap
              report={adaptedReport}
              onAskAboutNode={handleAskAboutNode}
              isDark={isDark}
            />
          ) : (
            <AskUrlChat
              key={`${project.id}-${copilotPrompt ?? ''}`}
              unifiedProject={project}
              initialPrompt={copilotPrompt}
              onApproveProposal={onApproveProposal}
            />
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
                {project.auditLog.slice(0, 5).map((entry) => (
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
