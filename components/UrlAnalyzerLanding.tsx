'use client';

import { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronDown,
  Code2,
  Database,
  FileCode2,
  FileSpreadsheet,
  GitBranch,
  Globe,
  Layers,
  Layout,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import {
  buildReportFromTechCsv,
  SAMPLE_WAPPALYZER_CSV,
} from '@/lib/csvImporter';
import { REPO_PRESET_METAS } from '@/lib/repo/presets';
import { SHOWCASE_PRESET_METAS } from '@/lib/showcasePresets';
import { detectSmartInputKind } from '@/lib/smartInput';
import type { UrlIntelligenceReport } from '@/lib/types';

interface UrlAnalyzerLandingProps {
  onAnalyze: (
    url: string,
    options?: { usePreset?: boolean; forceRefresh?: boolean },
  ) => Promise<void>;
  onAnalyzeRepo: (
    repoUrl: string,
    options?: { usePreset?: boolean; forceRefresh?: boolean },
  ) => Promise<void>;
  onImportCsv: (report: UrlIntelligenceReport) => void;
  onLaunchSampleUnified: () => Promise<void>;
  isLoading: boolean;
  pipelineStage: number;
  errorMessage: string | null;
}

const PROGRESS_STEPS = [
  {
    step: '01',
    title: 'Inspect Link or Repo',
    detail: 'Identifies website pages, API docs, or GitHub repository manifests.',
  },
  {
    step: '02',
    title: 'Extract Components',
    detail: 'Reads routes, packages, integrations, and page structure.',
  },
  {
    step: '03',
    title: 'Build Visual Map',
    detail: 'Creates interactive diagrams, flows, and AI Copilot workspace.',
  },
];

const PREVIEW_STAGES = [
  {
    id: 'frontend',
    label: '01. Frontend UI',
    icon: Layout,
    scrapName: 'Lovable / Next.js prototype',
    statusText: 'Connected UI pages & navigation',
    bridgeOutput: 'Exposes landing page, dashboard routes, and checkout entry.',
  },
  {
    id: 'brain',
    label: '02. AI Brain',
    icon: Bot,
    scrapName: 'vercel/ai or Python API repo',
    statusText: 'Connected model & agent routes',
    bridgeOutput: 'Routes /api/gateway/ai/* safely without exposing API keys.',
  },
  {
    id: 'data',
    label: '03. Shared Memory',
    icon: Database,
    scrapName: 'Auto-Bridged Postgres + pgvector',
    statusText: 'Filled missing database layer',
    bridgeOutput: 'Adds vector memory schema & Docker Postgres service.',
  },
  {
    id: 'operations',
    label: '04. Auth & Billing',
    icon: ShieldCheck,
    scrapName: 'Auto-Bridged Clerk + Stripe',
    statusText: 'Filled missing login & checkout',
    bridgeOutput: 'Wires user sessions, webhook handlers, and .env.bridge.example.',
  },
] as const;

function getPresetIcon(id: string) {
  if (id.includes('github'))
    return <Code2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />;
  if (id.includes('petstore'))
    return <FileCode2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />;
  if (id.includes('nextjs'))
    return <BookOpen className="w-4 h-4 text-slate-500 dark:text-slate-400" />;
  return <Globe className="w-4 h-4 text-slate-500 dark:text-slate-400" />;
}

export default function UrlAnalyzerLanding({
  onAnalyze,
  onAnalyzeRepo,
  onImportCsv,
  onLaunchSampleUnified,
  isLoading,
  pipelineStage,
  errorMessage,
}: UrlAnalyzerLandingProps) {
  const [smartInput, setSmartInput] = useState('');
  const [forceRefresh, setForceRefresh] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCsvForm, setShowCsvForm] = useState(false);
  const [csvDomain, setCsvDomain] = useState('');
  const [csvText, setCsvText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedPreviewZone, setSelectedPreviewZone] = useState<
    (typeof PREVIEW_STAGES)[number]['id']
  >('frontend');

  const trimmed = smartInput.trim();
  const detectedPreview = trimmed ? detectSmartInputKind(trimmed) : null;
  const displayError = validationError || errorMessage;
  const activeStage =
    PREVIEW_STAGES.find((item) => item.id === selectedPreviewZone) ??
    PREVIEW_STAGES[0];

  const handleSmartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const detected = detectSmartInputKind(smartInput);
    if (detected.kind === 'invalid') {
      setValidationError(detected.error);
      return;
    }

    setValidationError(null);
    if (detected.kind === 'repo') {
      await onAnalyzeRepo(detected.normalizedUrl, {
        usePreset: false,
        forceRefresh,
      });
      return;
    }

    await onAnalyze(detected.normalizedUrl, {
      usePreset: false,
      forceRefresh,
    });
  };

  const handleCsvSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const report = buildReportFromTechCsv(csvText, csvDomain);
      setValidationError(null);
      onImportCsv(report);
    } catch (err) {
      setValidationError(
        err instanceof Error
          ? err.message
          : 'Could not parse CSV technology rows.',
      );
    }
  };

  const handleCsvFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setCsvText(text);
      setValidationError(null);
    } catch {
      setValidationError('Unable to read the selected CSV file.');
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-12">
      {/* Hero + Single Smart Input */}
      <section className="max-w-3xl mx-auto text-center">
        <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-3">
          Step 1 of 3 · Connect any link or codebase
        </p>
        <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
          Connect your unfinished AI projects, websites, and repos into one live
          business.
        </h1>
        <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Paste any public website, GitHub repository, or API doc below. SLASH
          maps the architecture, detects missing login, database, and billing
          pieces, and builds a ready-to-run project.
        </p>

        {/* Single Unified Smart Input */}
        <form
          onSubmit={handleSmartSubmit}
          noValidate
          className="mt-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <label htmlFor="slash-smart-input" className="sr-only">
              Website URL or GitHub repository
            </label>
            <div className="flex-1 flex items-center gap-3 px-3">
              {detectedPreview?.kind === 'repo' ? (
                <GitBranch
                  className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <Globe
                  className="w-4 h-4 text-slate-400 shrink-0"
                  aria-hidden="true"
                />
              )}
              <input
                id="slash-smart-input"
                type="text"
                value={smartInput}
                onChange={(e) => {
                  setSmartInput(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder="Paste a Website URL, GitHub repo (vercel/ai), or API link"
                disabled={isLoading}
                className="w-full py-2.5 text-sm sm:text-base bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Mapping...</span>
                </>
              ) : (
                <>
                  <span>Analyze &amp; Map</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </>
              )}
            </button>
          </div>

          <div className="px-3 pt-2 pb-1 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex flex-wrap items-center gap-2">
              {detectedPreview && detectedPreview.kind !== 'invalid' ? (
                <span>
                  Auto-detected:{' '}
                  <strong className="font-medium text-slate-800 dark:text-slate-200">
                    {detectedPreview.label}
                  </strong>
                </span>
              ) : (
                <>
                  <span>Try pasting:</span>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => {
                      setValidationError(null);
                      setSmartInput('vercel/ai');
                    }}
                    className="font-mono text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    vercel/ai
                  </button>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => {
                      setValidationError(null);
                      setSmartInput('https://nextjs.org/docs');
                    }}
                    className="font-mono text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    nextjs.org/docs
                  </button>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => {
                      setValidationError(null);
                      setSmartInput('https://www.youtube.com/watch?v=M7lc1UVf-VE');
                    }}
                    className="font-mono text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    YouTube
                  </button>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => {
                      setValidationError(null);
                      setSmartInput('https://x.com/vercel');
                    }}
                    className="font-mono text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    X Profile
                  </button>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              aria-expanded={showAdvanced}
              className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <span>Advanced options</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  showAdvanced ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>
          </div>
        </form>

        {/* Secondary direct action into Build & Fix */}
        <div className="mt-4 flex flex-col items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              setValidationError(null);
              void onLaunchSampleUnified();
            }}
            className="inline-flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer disabled:opacity-50"
          >
            <Layers className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Open Interactive Demo Business in Step 2 (Build &amp; Fix)</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <span className="hidden sm:inline text-slate-500 dark:text-slate-400">
            Tip: prepend our domain before any URL (e.g.{' '}
            <code className="font-mono text-slate-700 dark:text-slate-300">
              /github.com/vercel/ai
            </code>
            )
          </span>
        </div>

        {/* Collapsible Advanced Options & CSV Import */}
        {showAdvanced && (
          <div className="mt-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-left space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={forceRefresh}
                  disabled={isLoading}
                  onChange={(e) => setForceRefresh(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-600"
                />
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                <span>Bypass server cache (Force fresh scan)</span>
              </label>

              <button
                type="button"
                onClick={() => setShowCsvForm((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                <span>{showCsvForm ? 'Hide Tech CSV Importer' : 'Import Tech Stack CSV'}</span>
              </button>
            </div>

            {showCsvForm && (
              <form
                onSubmit={handleCsvSubmit}
                noValidate
                className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Upload or paste Wappalyzer / BuiltWith CSV rows to generate a stack map.
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setCsvDomain('https://gitdiagram.com');
                        setCsvText(SAMPLE_WAPPALYZER_CSV);
                        setValidationError(null);
                      }}
                      className="px-2.5 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer"
                    >
                      Load Sample CSV
                    </button>
                    <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Upload .csv</span>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(e) => void handleCsvFileUpload(e)}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="csv-domain-input"
                    className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1"
                  >
                    Target Domain / URL (optional if included in CSV)
                  </label>
                  <input
                    id="csv-domain-input"
                    type="text"
                    value={csvDomain}
                    onChange={(e) => setCsvDomain(e.target.value)}
                    placeholder="https://gitdiagram.com"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="csv-payload-textarea"
                    className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1"
                  >
                    CSV Rows
                  </label>
                  <textarea
                    id="csv-payload-textarea"
                    rows={4}
                    value={csvText}
                    onChange={(e) => {
                      setCsvText(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    placeholder={
                      'URL,Technology,Categories,Version\nhttps://example.com,Next.js,Web frameworks,15'
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                  >
                    <span>Build Stack Map</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {displayError && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 text-left px-4 py-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{displayError}</span>
          </div>
        )}

        {isLoading && (
          <div
            aria-live="polite"
            className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 text-left"
          >
            <p className="text-xs font-semibold text-slate-900 dark:text-white mb-4">
              Building your visual map
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {PROGRESS_STEPS.map((item, idx) => {
                const active = pipelineStage === idx + 1;
                const done = pipelineStage > idx + 1;
                return (
                  <div
                    key={item.step}
                    className={`p-3 rounded-lg border transition-colors ${
                      active
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                        : done
                          ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20'
                          : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-medium mb-1">
                      <span className="font-mono text-slate-500 dark:text-slate-400">
                        {item.step}. {item.title}
                      </span>
                      {done ? (
                        <CheckCircle2
                          className="w-3.5 h-3.5 text-emerald-600"
                          aria-hidden="true"
                        />
                      ) : active ? (
                        <Loader2
                          className="w-3.5 h-3.5 text-blue-600 animate-spin"
                          aria-hidden="true"
                        />
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {item.detail}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Interactive Live Mini-Preview: How Scraps Turn into a Business */}
      <section
        aria-label="Interactive Scrap-to-Business preview"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1 max-w-2xl">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
              How SLASH works in 3 steps
            </p>
            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              From scattered prototypes to one unified business app
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Click any zone below to see how SLASH merges your UI, AI engine,
              database, and billing into a single deployable bundle.
            </p>
          </div>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              setValidationError(null);
              void onLaunchSampleUnified();
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Load Demo Business</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <div
            role="tablist"
            aria-label="Business OS zone preview"
            className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {PREVIEW_STAGES.map((stage) => {
              const Icon = stage.icon;
              const isSelected = stage.id === activeStage.id;
              return (
                <button
                  key={stage.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedPreviewZone(stage.id)}
                  className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-900 dark:text-white">
                    <span>{stage.label}</span>
                    <Icon
                      className={`w-4 h-4 ${
                        isSelected
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-slate-400'
                      }`}
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-1.5 font-mono text-xs text-slate-700 dark:text-slate-300">
                    {stage.scrapName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {stage.statusText}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5 flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Generated Business Output · {activeStage.label}
              </p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {activeStage.scrapName}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {activeStage.bridgeOutput}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-xs font-mono text-slate-600 dark:text-slate-400">
              <p>src/gateway/routes.json</p>
              <p>src/app/api/gateway/[...slug]/route.ts</p>
              <p>docker-compose.yml + .env.bridge.example</p>
            </div>
          </div>
        </div>
      </section>

      {/* Instant Starter Examples */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Or start from a sample link or repository
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Click any card below to inspect a single website, API, or GitHub
            repository in detail.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SHOWCASE_PRESET_METAS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={isLoading}
              onClick={() => {
                setValidationError(null);
                setSmartInput(preset.url);
                void onAnalyze(preset.url, { usePreset: true });
              }}
              className="group text-left p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 rounded-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  {preset.categoryLabel}
                </span>
                {getPresetIcon(preset.id)}
              </div>
              <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                {preset.label}
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {preset.tagline}
              </p>
            </button>
          ))}

          {REPO_PRESET_METAS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={isLoading}
              onClick={() => {
                setValidationError(null);
                setSmartInput(preset.fullName);
                void onAnalyzeRepo(preset.url, { usePreset: true });
              }}
              className="group text-left p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-60"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  GitHub Repo · {preset.language}
                </span>
                <GitBranch className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              </div>
              <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate">
                {preset.fullName}
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {preset.tagline}
              </p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
