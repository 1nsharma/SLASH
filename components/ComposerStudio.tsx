'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Download,
  Eye,
  FileCode2,
  Loader2,
  Play,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { approveCompositionPlan } from '@/lib/composer/engine';
import type {
  CompositionPlan,
  UnifiedGraphProject,
  VirtualProjectBundle,
} from '@/lib/types';

interface ComposerStudioProps {
  project: UnifiedGraphProject;
  onUpdateProject: (
    next: UnifiedGraphProject,
    auditAction?: { action: string; target: string },
  ) => void;
}

const DEFAULT_GOAL =
  'Combine the connected frontend documentation/UI patterns, streaming backend logic, OpenAPI endpoints, and PostgreSQL schema into one unified SaaS application.';

export default function ComposerStudio({
  project,
  onUpdateProject,
}: ComposerStudioProps) {
  const [goalPrompt, setGoalPrompt] = useState(
    project.compositionPlan?.goalPrompt || DEFAULT_GOAL,
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(
    project.virtualBundle?.files[0]?.path ?? null,
  );
  const [bundleTab, setBundleTab] = useState<'files' | 'checks' | 'preview'>(
    'files',
  );

  const plan: CompositionPlan | undefined = project.compositionPlan;
  const bundle: VirtualProjectBundle | undefined = project.virtualBundle;

  const handleAnalyzePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalPrompt.trim() || isAnalyzing) return;
    setErrorMsg(null);
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/composer/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, goalPrompt }),
      });
      const data = (await res.json()) as {
        plan?: CompositionPlan;
        error?: string;
      };
      if (!res.ok || !data.plan) {
        throw new Error(data.error || 'Failed to analyze composition plan.');
      }

      const initialRes: Record<string, string> = {};
      for (const c of data.plan.conflicts) {
        if (c.selectedResolution) initialRes[c.id] = c.selectedResolution;
      }
      setResolutions(initialRes);

      onUpdateProject(
        {
          ...project,
          compositionPlan: data.plan,
          virtualBundle: undefined,
        },
        {
          action: 'Generated draft composition plan',
          target: `${project.sources.length} source(s)`,
        },
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to build plan.',
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApproveAndGenerate = async () => {
    if (!plan || isGenerating) return;
    setErrorMsg(null);
    setIsGenerating(true);
    try {
      const approvedPlan = approveCompositionPlan(plan, resolutions);
      const res = await fetch('/api/composer/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, plan: approvedPlan }),
      });
      const data = (await res.json()) as {
        bundle?: VirtualProjectBundle;
        error?: string;
      };
      if (!res.ok || !data.bundle) {
        throw new Error(data.error || 'Failed to generate unified project.');
      }

      setSelectedFilePath(data.bundle.files[0]?.path ?? null);
      setBundleTab('files');
      onUpdateProject(
        {
          ...project,
          compositionPlan: approvedPlan,
          virtualBundle: data.bundle,
        },
        {
          action: 'Approved Composer plan & generated virtual bundle',
          target: `${data.bundle.files.length} files (${data.bundle.checks.filter((c) => c.status === 'passed').length}/${data.bundle.checks.length} checks passed)`,
        },
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Code generation failed.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadZip = async () => {
    if (!bundle || isExporting) return;
    setErrorMsg(null);
    setIsExporting(true);
    try {
      const res = await fetch('/api/composer/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, bundle }),
      });
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errData.error || 'ZIP export failed.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${bundle.projectName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onUpdateProject(project, {
        action: 'Exported unified project ZIP',
        target: `${bundle.projectName}.zip`,
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Could not export ZIP archive.',
      );
    } finally {
      setIsExporting(false);
    }
  };

  const activeFile =
    bundle?.files.find((f) => f.path === selectedFilePath) || bundle?.files[0];

  return (
    <div className="space-y-5">
      {/* Stage 1: Natural Language Goal & Compatibility Analyzer */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
              AI Project Composer · 4-Stage Human-Approved Synthesis
            </p>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Compose Connected Sources into a Unified Application
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {project.sources.length} source(s) attached
          </span>
        </div>

        <form onSubmit={handleAnalyzePlan} className="space-y-3">
          <label
            htmlFor="composer-goal-prompt"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300"
          >
            Describe the unified application you want SLASH to architect
          </label>
          <textarea
            id="composer-goal-prompt"
            rows={2}
            value={goalPrompt}
            onChange={(e) => setGoalPrompt(e.target.value)}
            placeholder="e.g., Combine repository A's frontend, repository B's backend, OpenAPI billing endpoints, and Prisma PostgreSQL schema into one SaaS app..."
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Stage 1 analyzes compatibility, auth collisions &amp; SPDX licenses
              before any code is synthesized.
            </span>
            <button
              type="submit"
              disabled={isAnalyzing || !goalPrompt.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg cursor-pointer"
            >
              {isAnalyzing ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="w-4 h-4" aria-hidden="true" />
              )}
              <span>Analyze Compatibility &amp; Plan</span>
            </button>
          </div>
        </form>

        {errorMsg && (
          <div
            role="alert"
            className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 px-3 py-2 rounded-lg"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}
      </section>

      {/* Stage 2: Plan, Component Mapping, Conflicts & Explicit Approval Gate */}
      {plan && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span
                  className={
                    plan.approvalStatus === 'approved'
                      ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                      : 'text-amber-700 dark:text-amber-400 font-semibold'
                  }
                >
                  {plan.approvalStatus === 'approved'
                    ? 'Plan Approved'
                    : 'Awaiting Human Approval (Draft)'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-slate-600 dark:text-slate-400">
                  Compatibility Score: {plan.compatibilityScore}/100
                </span>
              </div>
              <h3 className="mt-1 font-display text-base font-semibold text-slate-900 dark:text-white">
                {plan.summary}
              </h3>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {plan.architectureOverview}
              </p>
            </div>

            <button
              type="button"
              disabled={isGenerating}
              onClick={() => void handleApproveAndGenerate()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg cursor-pointer shrink-0"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="w-4 h-4" aria-hidden="true" />
              )}
              <span>
                {plan.approvalStatus === 'approved'
                  ? 'Regenerate & Re-Validate Bundle'
                  : 'Approve Plan & Generate Project'}
              </span>
            </button>
          </div>

          {/* Conflict Resolution Cards */}
          {plan.conflicts.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Compatibility &amp; License Conflict Checks ({plan.conflicts.length})</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {plan.conflicts.map((conflict) => (
                  <div
                    key={conflict.id}
                    className="p-3.5 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono uppercase text-amber-800 dark:text-amber-300">
                        {conflict.category} · {conflict.severity}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">
                      {conflict.title}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {conflict.description}
                    </p>
                    <div>
                      <label
                        htmlFor={`res-${conflict.id}`}
                        className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
                      >
                        Selected Resolution
                      </label>
                      <select
                        id={`res-${conflict.id}`}
                        value={
                          resolutions[conflict.id] ||
                          conflict.selectedResolution ||
                          conflict.resolutionOptions[0]
                        }
                        onChange={(e) =>
                          setResolutions((prev) => ({
                            ...prev,
                            [conflict.id]: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
                      >
                        {conflict.resolutionOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Component Mapping & Implementation Steps */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-2">
              <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Component Role Mapping ({plan.componentMappings.length})
              </h4>
              <ul className="space-y-2 text-xs">
                {plan.componentMappings.map((m) => (
                  <li
                    key={m.sourceId}
                    className="flex items-start justify-between gap-2 pb-2 border-b border-slate-200/70 dark:border-slate-800 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="font-mono font-semibold text-slate-900 dark:text-white truncate">
                        {m.sourceLabel}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 truncate">
                        {m.targetDirectory}
                      </p>
                    </div>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 shrink-0">
                      {m.assignedRole}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-2">
              <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Implementation Steps &amp; Required Adapters
              </h4>
              <ol className="list-decimal pl-4 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                {plan.implementationSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className="pt-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                Env Keys Required: {plan.envVarsRequired.join(', ')}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Stage 3 & 4: Virtual File Explorer, Automated Verification & Sandboxed Preview */}
      {bundle && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-xs font-mono text-emerald-700 dark:text-emerald-400">
                {bundle.validationMode === 'isolated-sandbox'
                  ? 'Isolated Container Sandbox Executed'
                  : 'Run Business Execution Pack · API Gateway, Docker Topology & Static Checks Complete'}
              </p>
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Generated Project Bundle: {bundle.projectName}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setBundleTab('files')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                    bundleTab === 'files'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <FileCode2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Files ({bundle.files.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBundleTab('checks')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                    bundleTab === 'checks'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    Checks ({bundle.checks.filter((c) => c.status === 'passed').length}/
                    {bundle.checks.length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setBundleTab('preview')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                    bundleTab === 'preview'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Sandboxed Preview</span>
                </button>
              </div>

              <button
                type="button"
                disabled={isExporting}
                onClick={() => void handleDownloadZip()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 rounded-lg cursor-pointer"
              >
                {isExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>Export Project (.zip)</span>
              </button>
            </div>
          </div>

          {bundleTab === 'files' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-4 border border-slate-200 dark:border-slate-800 rounded-lg p-2 bg-slate-50/70 dark:bg-slate-950/60 space-y-1 max-h-[380px] overflow-y-auto">
                {bundle.files.map((file) => {
                  const isSelected = activeFile?.path === file.path;
                  return (
                    <button
                      key={file.path}
                      type="button"
                      onClick={() => setSelectedFilePath(file.path)}
                      className={`w-full text-left px-2.5 py-2 rounded-md text-xs font-mono flex items-center justify-between gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="truncate">{file.path}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                          isSelected
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {file.provenance}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="lg:col-span-8 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-950 text-slate-100">
                {activeFile && (
                  <>
                    <div className="px-3.5 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 text-xs font-mono">
                      <span className="inline-flex items-center gap-1.5 text-slate-200">
                        <Code2 className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
                        {activeFile.path}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {activeFile.provenance} · {activeFile.sourceLabel}
                      </span>
                    </div>
                    <pre className="p-4 text-xs font-mono overflow-auto max-h-[340px] leading-relaxed">
                      <code>{activeFile.content}</code>
                    </pre>
                  </>
                )}
              </div>
            </div>
          )}

          {bundleTab === 'checks' && (
            <div className="space-y-2.5">
              {bundle.checks.map((chk) => (
                <div
                  key={chk.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60"
                >
                  <CheckCircle2
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      chk.status === 'passed'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : chk.status === 'warning'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                    }`}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">
                      {chk.label}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      {chk.details}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {bundleTab === 'preview' && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-50">
              <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                Isolated &lt;iframe sandbox=&quot;allow-scripts&quot;&gt; Preview (No host origin access)
              </div>
              <iframe
                title="SLASH Composed App Sandboxed Preview"
                sandbox="allow-scripts"
                srcDoc={bundle.previewHtml}
                className="w-full h-[360px] bg-white border-0"
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
