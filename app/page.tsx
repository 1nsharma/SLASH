'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import CompareView from '@/components/CompareView';
import IntelligenceWorkspace from '@/components/IntelligenceWorkspace';
import PipelineView from '@/components/PipelineView';
import RepoWorkspace from '@/components/RepoWorkspace';
import SavedMapsView from '@/components/SavedMapsView';
import TopNav, {
  type AppSection,
  type UnifiedFocusTab,
} from '@/components/TopNav';
import UnifiedGraphWorkspace from '@/components/UnifiedGraphWorkspace';
import UrlAnalyzerLanding from '@/components/UrlAnalyzerLanding';
import { buildBusinessBlockArtifact } from '@/lib/business/blocks';
import { normalizeAndValidateUrl } from '@/lib/classifier';
import { generateMarkdownReport } from '@/lib/graphLayout';
import {
  unifiedGraphToReportAdapter,
  unifyIntelligenceSources,
} from '@/lib/graph/unifier';
import { findRepoPreset, REPO_PRESETS } from '@/lib/repo/presets';
import { SHOWCASE_PRESETS } from '@/lib/showcasePresets';
import type {
  ConnectedConnectorArtifact,
  ConnectorSourceKind,
  CopilotActionProposal,
  GraphAuditEntry,
  RepoIntelligenceReport,
  UnifiedGraphProject,
  UrlIntelligenceReport,
  WorkspaceView,
} from '@/lib/types';

const STORAGE_HISTORY_KEY = 'urlmind_history_v1';
const STORAGE_REPO_HISTORY_KEY = 'slash_repo_history_v1';
const STORAGE_UNIFIED_KEY = 'slash_unified_project_v1';
const STORAGE_THEME_KEY = 'urlmind_theme_v1';

export default function HomePage() {
  const [section, setSection] = useState<AppSection>('analyzer');
  const [unifiedFocus, setUnifiedFocus] = useState<UnifiedFocusTab>('build');
  const [activeReport, setActiveReport] =
    useState<UrlIntelligenceReport | null>(null);
  const [activeRepoReport, setActiveRepoReport] =
    useState<RepoIntelligenceReport | null>(null);
  const [activeView, setActiveView] = useState<WorkspaceView>('map');
  const [history, setHistory] = useState<UrlIntelligenceReport[]>([]);
  const [repoHistory, setRepoHistory] = useState<RepoIntelligenceReport[]>([]);
  const [unifiedProject, setUnifiedProject] =
    useState<UnifiedGraphProject | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [unifiedBusy, setUnifiedBusy] = useState(false);
  const [pipelineStage, setPipelineStage] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unifiedError, setUnifiedError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const didHandleInitialQueryRef = useRef(false);
  const unifiedProjectRef = useRef<UnifiedGraphProject | null>(null);

  const persistUnifiedProject = useCallback(
    (project: UnifiedGraphProject | null) => {
      unifiedProjectRef.current = project;
      setUnifiedProject(project);
      try {
        if (project) {
          localStorage.setItem(STORAGE_UNIFIED_KEY, JSON.stringify(project));
        } else {
          localStorage.removeItem(STORAGE_UNIFIED_KEY);
        }
      } catch {
        // Ignore storage quota errors
      }
    },
    [],
  );

  const saveUrlReportToHistory = useCallback((report: UrlIntelligenceReport) => {
    setHistory((prev) => {
      const filtered = prev.filter(
        (item) =>
          item.normalizedUrl.replace(/\/+$/, '').toLowerCase() !==
          report.normalizedUrl.replace(/\/+$/, '').toLowerCase(),
      );
      const updated = [report, ...filtered].slice(0, 12);
      try {
        localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage error
      }
      return updated;
    });
  }, []);

  const saveRepoReportToHistory = useCallback(
    (report: RepoIntelligenceReport) => {
      setRepoHistory((prev) => {
        const filtered = prev.filter(
          (item) =>
            item.normalizedUrl.replace(/\/+$/, '').toLowerCase() !==
            report.normalizedUrl.replace(/\/+$/, '').toLowerCase(),
        );
        const updated = [report, ...filtered].slice(0, 12);
        try {
          localStorage.setItem(STORAGE_REPO_HISTORY_KEY, JSON.stringify(updated));
        } catch {
          // Ignore storage error
        }
        return updated;
      });
    },
    [],
  );

  const upsertReport = useCallback(
    (report: UrlIntelligenceReport) => {
      setActiveRepoReport(null);
      setActiveReport(report);
      setActiveView('map');
      setSection('analyzer');
      saveUrlReportToHistory(report);
    },
    [saveUrlReportToHistory],
  );

  const upsertRepoReport = useCallback(
    (report: RepoIntelligenceReport) => {
      setActiveReport(null);
      setActiveRepoReport(report);
      setActiveView('map');
      setSection('analyzer');
      saveRepoReportToHistory(report);
    },
    [saveRepoReportToHistory],
  );

  const fetchOrPresetUrlReport = useCallback(
    async (
      url: string,
      options: { usePreset?: boolean; forceRefresh?: boolean } = {},
    ): Promise<UrlIntelligenceReport> => {
      if (options.usePreset && !options.forceRefresh) {
        const clean = url.trim().replace(/\/+$/, '').toLowerCase();
        const matched = Object.entries(SHOWCASE_PRESETS).find(
          ([k]) => k.replace(/\/+$/, '').toLowerCase() === clean,
        )?.[1];
        if (matched) return matched;
      }

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          usePreset: Boolean(options.usePreset),
          forceRefresh: Boolean(options.forceRefresh),
        }),
      });
      const data = (await res.json()) as {
        report?: UrlIntelligenceReport;
        error?: string;
      };
      if (!res.ok || !data.report) {
        throw new Error(data.error || 'Failed to analyze URL.');
      }
      return data.report;
    },
    [],
  );

  const fetchOrPresetRepoReport = useCallback(
    async (
      repoUrl: string,
      options: { usePreset?: boolean; forceRefresh?: boolean } = {},
    ): Promise<RepoIntelligenceReport> => {
      if (options.usePreset && !options.forceRefresh) {
        const matched = findRepoPreset(repoUrl);
        if (matched) return matched;
      }

      const res = await fetch('/api/repo/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl,
          usePreset: Boolean(options.usePreset),
          forceRefresh: Boolean(options.forceRefresh),
        }),
      });
      const data = (await res.json()) as {
        repoReport?: RepoIntelligenceReport;
        error?: string;
      };
      if (!res.ok || !data.repoReport) {
        throw new Error(data.error || 'Failed to analyze GitHub repository.');
      }
      return data.repoReport;
    },
    [],
  );

  const rebuildUnifiedGraph = useCallback(
    async (
      nextUrls: UrlIntelligenceReport[],
      nextRepos: RepoIntelligenceReport[],
      nextConnectors: ConnectedConnectorArtifact[] = [],
      auditLogOverride?: GraphAuditEntry[],
    ) => {
      if (
        nextUrls.length === 0 &&
        nextRepos.length === 0 &&
        nextConnectors.length === 0
      ) {
        persistUnifiedProject(null);
        return;
      }

      const deterministic = unifyIntelligenceSources({
        urlReports: nextUrls,
        repoReports: nextRepos,
        connectorArtifacts: nextConnectors,
        auditLog: auditLogOverride,
      });
      persistUnifiedProject(deterministic);

      // Enrich narrative synthesis in the background without blocking interactions
      void fetch('/api/graph/unify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urlReports: nextUrls,
          repoReports: nextRepos,
          connectorArtifacts: nextConnectors,
        }),
      })
        .then(async (res) => {
          if (!res.ok) return;
          const data = (await res.json()) as {
            project?: UnifiedGraphProject;
          };
          if (data.project?.aiSynthesis) {
            setUnifiedProject((current) => {
              const updated =
                current && current.sources.length === data.project!.sources.length
                  ? { ...current, aiSynthesis: data.project!.aiSynthesis }
                  : current;
              unifiedProjectRef.current = updated;
              return updated;
            });
          }
        })
        .catch(() => {
          // Deterministic summary remains intact
        });
    },
    [persistUnifiedProject],
  );

  const attachUrlReportAndOpenBuild = useCallback(
    async (report: UrlIntelligenceReport) => {
      saveUrlReportToHistory(report);
      setUnifiedError(null);
      setUnifiedFocus('build');
      setSection('unified');
      const current = unifiedProjectRef.current;
      const existingUrls = current?.urlReports ?? [];
      const existingRepos = current?.repoReports ?? [];
      const existingConnectors = current?.connectorArtifacts ?? [];
      const dedupedUrls = [
        ...existingUrls.filter(
          (u) =>
            u.normalizedUrl.replace(/\/+$/, '').toLowerCase() !==
            report.normalizedUrl.replace(/\/+$/, '').toLowerCase(),
        ),
        report,
      ];
      await rebuildUnifiedGraph(
        dedupedUrls,
        existingRepos,
        existingConnectors,
        current?.auditLog,
      );
    },
    [rebuildUnifiedGraph, saveUrlReportToHistory],
  );

  const attachRepoReportAndOpenBuild = useCallback(
    async (report: RepoIntelligenceReport) => {
      saveRepoReportToHistory(report);
      setUnifiedError(null);
      setUnifiedFocus('build');
      setSection('unified');
      const current = unifiedProjectRef.current;
      const existingUrls = current?.urlReports ?? [];
      const existingRepos = current?.repoReports ?? [];
      const existingConnectors = current?.connectorArtifacts ?? [];
      const dedupedRepos = [
        ...existingRepos.filter(
          (r) =>
            r.normalizedUrl.replace(/\/+$/, '').toLowerCase() !==
            report.normalizedUrl.replace(/\/+$/, '').toLowerCase(),
        ),
        report,
      ];
      await rebuildUnifiedGraph(
        existingUrls,
        dedupedRepos,
        existingConnectors,
        current?.auditLog,
      );
    },
    [rebuildUnifiedGraph, saveRepoReportToHistory],
  );

  const handleAnalyze = useCallback(
    async (
      url: string,
      options: {
        usePreset?: boolean;
        forceRefresh?: boolean;
        stayInSingleView?: boolean;
      } = {},
    ) => {
      setErrorMessage(null);
      setIsLoading(true);
      setPipelineStage(1);

      const routeReport = async (report: UrlIntelligenceReport) => {
        if (options.stayInSingleView) {
          upsertReport(report);
        } else {
          await attachUrlReportAndOpenBuild(report);
        }
      };

      if (options.usePreset && !options.forceRefresh) {
        const clean = url.trim().replace(/\/+$/, '').toLowerCase();
        const matched = Object.entries(SHOWCASE_PRESETS).find(
          ([k]) => k.replace(/\/+$/, '').toLowerCase() === clean,
        )?.[1];
        if (matched) {
          setPipelineStage(2);
          setTimeout(() => {
            setPipelineStage(3);
            void routeReport(matched).finally(() => {
              setIsLoading(false);
              setPipelineStage(0);
            });
          }, 200);
          return;
        }
      }

      const stageTimer1 = setTimeout(() => setPipelineStage(2), 600);
      const stageTimer2 = setTimeout(() => setPipelineStage(3), 1800);

      try {
        const report = await fetchOrPresetUrlReport(url, options);
        await routeReport(report);
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Could not analyze that URL. Please check the address and try again.',
        );
      } finally {
        clearTimeout(stageTimer1);
        clearTimeout(stageTimer2);
        setIsLoading(false);
        setPipelineStage(0);
      }
    },
    [attachUrlReportAndOpenBuild, fetchOrPresetUrlReport, upsertReport],
  );

  const handleAnalyzeRepo = useCallback(
    async (
      repoUrl: string,
      options: {
        usePreset?: boolean;
        forceRefresh?: boolean;
        stayInSingleView?: boolean;
      } = {},
    ) => {
      setErrorMessage(null);
      setIsLoading(true);
      setPipelineStage(1);

      const routeRepoReport = async (report: RepoIntelligenceReport) => {
        if (options.stayInSingleView) {
          upsertRepoReport(report);
        } else {
          await attachRepoReportAndOpenBuild(report);
        }
      };

      if (options.usePreset && !options.forceRefresh) {
        const matched = findRepoPreset(repoUrl);
        if (matched) {
          setPipelineStage(2);
          setTimeout(() => {
            setPipelineStage(3);
            void routeRepoReport(matched).finally(() => {
              setIsLoading(false);
              setPipelineStage(0);
            });
          }, 200);
          return;
        }
      }

      const stageTimer1 = setTimeout(() => setPipelineStage(2), 600);
      const stageTimer2 = setTimeout(() => setPipelineStage(3), 1800);

      try {
        const report = await fetchOrPresetRepoReport(repoUrl, options);
        await routeRepoReport(report);
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Could not inspect that GitHub repository. Verify owner/repo and try again.',
        );
      } finally {
        clearTimeout(stageTimer1);
        clearTimeout(stageTimer2);
        setIsLoading(false);
        setPipelineStage(0);
      }
    },
    [attachRepoReportAndOpenBuild, fetchOrPresetRepoReport, upsertRepoReport],
  );

  const handleSendUrlToUnified = useCallback(
    async (report: UrlIntelligenceReport) => {
      setUnifiedError(null);
      setSection('unified');
      const existingUrls = unifiedProject?.urlReports ?? [];
      const existingRepos = unifiedProject?.repoReports ?? [];
      const existingConnectors = unifiedProject?.connectorArtifacts ?? [];
      const dedupedUrls = [
        report,
        ...existingUrls.filter((u) => u.id !== report.id),
      ];
      await rebuildUnifiedGraph(dedupedUrls, existingRepos, existingConnectors);
    },
    [rebuildUnifiedGraph, unifiedProject],
  );

  const handleSendRepoToUnified = useCallback(
    async (repoReport: RepoIntelligenceReport) => {
      setUnifiedError(null);
      setSection('unified');
      const existingUrls = unifiedProject?.urlReports ?? [];
      const existingRepos = unifiedProject?.repoReports ?? [];
      const existingConnectors = unifiedProject?.connectorArtifacts ?? [];
      const dedupedRepos = [
        repoReport,
        ...existingRepos.filter((r) => r.id !== repoReport.id),
      ];
      await rebuildUnifiedGraph(existingUrls, dedupedRepos, existingConnectors);
    },
    [rebuildUnifiedGraph, unifiedProject],
  );

  const handleAttachUrlToUnified = useCallback(
    async (url: string, options: { usePreset?: boolean } = {}) => {
      setUnifiedError(null);
      setUnifiedBusy(true);
      try {
        const check = normalizeAndValidateUrl(url);
        if (!check.valid || !check.normalizedUrl) {
          throw new Error(check.error || 'Enter a valid public URL.');
        }
        const report = await fetchOrPresetUrlReport(check.normalizedUrl, {
          usePreset: options.usePreset,
        });
        const existingUrls = unifiedProject?.urlReports ?? [];
        const existingRepos = unifiedProject?.repoReports ?? [];
        const existingConnectors = unifiedProject?.connectorArtifacts ?? [];
        const dedupedUrls = [
          ...existingUrls.filter(
            (u) =>
              u.normalizedUrl.replace(/\/+$/, '').toLowerCase() !==
              report.normalizedUrl.replace(/\/+$/, '').toLowerCase(),
          ),
          report,
        ];
        await rebuildUnifiedGraph(dedupedUrls, existingRepos, existingConnectors);
      } catch (err) {
        setUnifiedError(
          err instanceof Error ? err.message : 'Could not attach URL to graph.',
        );
      } finally {
        setUnifiedBusy(false);
      }
    },
    [fetchOrPresetUrlReport, rebuildUnifiedGraph, unifiedProject],
  );

  const handleAttachRepoToUnified = useCallback(
    async (repoUrl: string, options: { usePreset?: boolean } = {}) => {
      setUnifiedError(null);
      setUnifiedBusy(true);
      try {
        const report = await fetchOrPresetRepoReport(repoUrl, {
          usePreset: options.usePreset,
        });
        const existingUrls = unifiedProject?.urlReports ?? [];
        const existingRepos = unifiedProject?.repoReports ?? [];
        const existingConnectors = unifiedProject?.connectorArtifacts ?? [];
        const dedupedRepos = [
          ...existingRepos.filter(
            (r) =>
              r.normalizedUrl.replace(/\/+$/, '').toLowerCase() !==
              report.normalizedUrl.replace(/\/+$/, '').toLowerCase(),
          ),
          report,
        ];
        await rebuildUnifiedGraph(existingUrls, dedupedRepos, existingConnectors);
      } catch (err) {
        setUnifiedError(
          err instanceof Error
            ? err.message
            : 'Could not attach repository to graph.',
        );
      } finally {
        setUnifiedBusy(false);
      }
    },
    [fetchOrPresetRepoReport, rebuildUnifiedGraph, unifiedProject],
  );

  const handleAttachConnectorToUnified = useCallback(
    async (input: {
      kind: ConnectorSourceKind;
      label?: string;
      urlOrLocator?: string;
      rawContent?: string;
      usePreset?: boolean;
    }) => {
      setUnifiedError(null);
      setUnifiedBusy(true);
      try {
        const res = await fetch('/api/connectors/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const data = (await res.json()) as {
          artifact?: ConnectedConnectorArtifact;
          error?: string;
        };
        if (!res.ok || !data.artifact) {
          throw new Error(data.error || 'Could not ingest connector source.');
        }

        const existingUrls = unifiedProject?.urlReports ?? [];
        const existingRepos = unifiedProject?.repoReports ?? [];
        const existingConnectors = unifiedProject?.connectorArtifacts ?? [];
        const dedupedConnectors = [
          ...existingConnectors.filter(
            (c) =>
              c.locator.toLowerCase() !== data.artifact!.locator.toLowerCase(),
          ),
          data.artifact,
        ];
        await rebuildUnifiedGraph(existingUrls, existingRepos, dedupedConnectors);
      } catch (err) {
        setUnifiedError(
          err instanceof Error
            ? err.message
            : 'Could not attach connector source.',
        );
      } finally {
        setUnifiedBusy(false);
      }
    },
    [rebuildUnifiedGraph, unifiedProject],
  );

  const handleLaunchSampleUnified = useCallback(async () => {
    setUnifiedError(null);
    setUnifiedFocus('build');
    setSection('unified');
    setUnifiedBusy(true);
    try {
      const sampleDocs = SHOWCASE_PRESETS['https://nextjs.org/docs'];
      const sampleRepo = REPO_PRESETS['https://github.com/vercel/ai'];
      if (sampleDocs && sampleRepo) {
        await rebuildUnifiedGraph([sampleDocs], [sampleRepo], []);
      }
    } finally {
      setUnifiedBusy(false);
    }
  }, [rebuildUnifiedGraph]);

  const handleAddBusinessBlockToUnified = useCallback(
    async (
      blockId: string,
      actor: 'user' | 'copilot-approved' = 'user',
    ) => {
      setUnifiedError(null);
      setUnifiedBusy(true);
      try {
        const artifact = buildBusinessBlockArtifact(blockId);
        const existingUrls = unifiedProject?.urlReports ?? [];
        const existingRepos = unifiedProject?.repoReports ?? [];
        const existingConnectors = unifiedProject?.connectorArtifacts ?? [];
        const dedupedConnectors = [
          ...existingConnectors.filter(
            (c) => c.connectorId !== artifact.connectorId,
          ),
          artifact,
        ];
        const nextAudit: GraphAuditEntry = {
          id: `audit-block-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor,
          action: `Attached Business Block (${artifact.businessZone ?? 'operations'})`,
          target: artifact.label,
          status: 'applied',
        };
        await rebuildUnifiedGraph(
          existingUrls,
          existingRepos,
          dedupedConnectors,
          [nextAudit, ...(unifiedProject?.auditLog ?? [])],
        );
      } catch (err) {
        setUnifiedError(
          err instanceof Error
            ? err.message
            : 'Could not attach Business Block.',
        );
      } finally {
        setUnifiedBusy(false);
      }
    },
    [rebuildUnifiedGraph, unifiedProject],
  );

  const handleRemoveSourceFromUnified = useCallback(
    (sourceId: string) => {
      if (!unifiedProject) return;
      const nextUrls = unifiedProject.urlReports.filter(
        (u) => u.id !== sourceId,
      );
      const nextRepos = unifiedProject.repoReports.filter(
        (r) => r.id !== sourceId,
      );
      const nextConnectors = (unifiedProject.connectorArtifacts ?? []).filter(
        (c) => c.id !== sourceId,
      );
      if (
        nextUrls.length === 0 &&
        nextRepos.length === 0 &&
        nextConnectors.length === 0
      ) {
        persistUnifiedProject(null);
        return;
      }
      const nextProject = unifyIntelligenceSources({
        urlReports: nextUrls,
        repoReports: nextRepos,
        connectorArtifacts: nextConnectors,
      });
      persistUnifiedProject(nextProject);
    },
    [persistUnifiedProject, unifiedProject],
  );

  const handleUpdateUnifiedProject = useCallback(
    (
      next: UnifiedGraphProject,
      auditAction?: { action: string; target: string },
    ) => {
      if (!auditAction) {
        persistUnifiedProject(next);
        return;
      }
      const entry = {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: 'user' as const,
        action: auditAction.action,
        target: auditAction.target,
        status: 'applied' as const,
      };
      persistUnifiedProject({
        ...next,
        auditLog: [entry, ...(next.auditLog ?? [])],
      });
    },
    [persistUnifiedProject],
  );

  const handleApproveProposal = useCallback(
    async (proposal: CopilotActionProposal) => {
      if (proposal.type === 'analyze_and_link_url') {
        setSection('unified');
        await handleAttachUrlToUnified(proposal.target);
        return;
      }

      if (proposal.type === 'analyze_and_link_repo') {
        setSection('unified');
        await handleAttachRepoToUnified(proposal.target);
        return;
      }

      if (proposal.type === 'add_verified_edge' && unifiedProject) {
        const sourceId =
          proposal.payload?.sourceNodeId || unifiedProject.nodes[0]?.id;
        const targetId =
          proposal.payload?.targetNodeId ||
          unifiedProject.nodes[unifiedProject.nodes.length - 1]?.id;

        if (sourceId && targetId && sourceId !== targetId) {
          const nextEdge = {
            id: `copilot-edge-${Date.now()}`,
            source: sourceId,
            target: targetId,
            label: proposal.payload?.edgeLabel || proposal.target || 'copilot link',
            relationshipType:
              proposal.payload?.relationshipType || ('reference' as const),
            semanticRelation: 'CONNECTS_TO' as const,
            confidence: proposal.confidence,
            verificationStatus:
              proposal.confidence === 'detected'
                ? ('verified' as const)
                : ('unverified' as const),
            evidence: `Approved Copilot Proposal: ${proposal.evidence}`,
            sourceEngine: 'unified' as const,
          };
          const auditEntry = {
            id: `audit-${Date.now()}`,
            timestamp: new Date().toISOString(),
            actor: 'copilot-approved' as const,
            action: 'Added relationship edge',
            target: `${nextEdge.label} (${sourceId} -> ${targetId})`,
            status: 'applied' as const,
          };
          const updated: UnifiedGraphProject = {
            ...unifiedProject,
            edges: [...unifiedProject.edges, nextEdge],
            crossLinksCount: unifiedProject.crossLinksCount + 1,
            auditLog: [auditEntry, ...(unifiedProject.auditLog ?? [])],
          };
          persistUnifiedProject(updated);
        }
        return;
      }

      if (
        proposal.type === 'add_business_block' ||
        proposal.type === 'fill_business_gap'
      ) {
        const blockId = proposal.payload?.blockId || proposal.target;
        setSection('unified');
        await handleAddBusinessBlockToUnified(blockId, 'copilot-approved');
        return;
      }

      if (proposal.type === 'export_blueprint') {
        const targetReport = unifiedProject
          ? unifiedGraphToReportAdapter(unifiedProject)
          : activeReport;
        if (targetReport) {
          const md = generateMarkdownReport(targetReport);
          const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `slash-blueprint-${Date.now()}.md`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          if (unifiedProject) {
            const auditEntry = {
              id: `audit-${Date.now()}`,
              timestamp: new Date().toISOString(),
              actor: 'copilot-approved' as const,
              action: 'Exported Markdown blueprint',
              target: unifiedProject.title,
              status: 'applied' as const,
            };
            persistUnifiedProject({
              ...unifiedProject,
              auditLog: [auditEntry, ...(unifiedProject.auditLog ?? [])],
            });
          }
        }
      }
    },
    [
      activeReport,
      handleAddBusinessBlockToUnified,
      handleAttachRepoToUnified,
      handleAttachUrlToUnified,
      persistUnifiedProject,
      unifiedProject,
    ],
  );

  // Hydrate persisted history, theme, ?autostart=1, and /?url=... from URL prefix redirects
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const savedTheme = localStorage.getItem(STORAGE_THEME_KEY);
        if (savedTheme === 'dark') {
          setIsDark(true);
          document.documentElement.classList.add('dark');
        }

        const rawHistory = localStorage.getItem(STORAGE_HISTORY_KEY);
        if (rawHistory) {
          const parsed = JSON.parse(rawHistory) as UrlIntelligenceReport[];
          if (Array.isArray(parsed)) {
            setHistory(parsed);
          }
        }

        const rawRepoHistory = localStorage.getItem(STORAGE_REPO_HISTORY_KEY);
        if (rawRepoHistory) {
          const parsedRepos = JSON.parse(
            rawRepoHistory,
          ) as RepoIntelligenceReport[];
          if (Array.isArray(parsedRepos)) {
            setRepoHistory(parsedRepos);
          }
        }

        const rawUnified = localStorage.getItem(STORAGE_UNIFIED_KEY);
        if (rawUnified) {
          const parsedUnified = JSON.parse(rawUnified) as UnifiedGraphProject;
          if (parsedUnified && Array.isArray(parsedUnified.nodes)) {
            unifiedProjectRef.current = parsedUnified;
            setUnifiedProject(parsedUnified);
          }
        }
      } catch {
        // Ignore storage access failures
      }

      if (typeof window !== 'undefined' && !didHandleInitialQueryRef.current) {
        didHandleInitialQueryRef.current = true;
        const params = new URLSearchParams(window.location.search);
        const queryUrl = params.get('url');

        if (queryUrl) {
          const check = normalizeAndValidateUrl(queryUrl);
          if (check.valid && check.normalizedUrl) {
            void handleAnalyze(check.normalizedUrl, { usePreset: false });
          } else {
            setErrorMessage(
              check.error || 'Invalid URL provided in query parameter.',
            );
          }
          return;
        }

        if (params.get('autostart') === '1') {
          const demo = SHOWCASE_PRESETS['https://github.com/vercel/ai'];
          if (demo) {
            setActiveReport(demo);
            setActiveView('map');
            setSection('analyzer');
          }
        }
      }
    });
  }, [handleAnalyze]);

  const persistHistory = useCallback((items: UrlIntelligenceReport[]) => {
    setHistory(items);
    try {
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(items.slice(0, 12)));
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  const handleToggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
        localStorage.setItem(STORAGE_THEME_KEY, 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem(STORAGE_THEME_KEY, 'light');
      }
      return next;
    });
  };

  const hasAnyActiveWork = Boolean(
    activeReport || activeRepoReport || unifiedProject,
  );

  const handleSelectGuidedStep = (step: 'connect' | 'build' | 'launch') => {
    if (step === 'connect') {
      setActiveReport(null);
      setActiveRepoReport(null);
      setErrorMessage(null);
      setSection('analyzer');
      return;
    }
    if (step === 'build') {
      setUnifiedFocus('build');
      setSection('unified');
      return;
    }
    setUnifiedFocus('launch');
    setSection('unified');
  };

  const handlePrimaryHeaderAction = () => {
    if (hasAnyActiveWork) {
      setActiveReport(null);
      setActiveRepoReport(null);
      persistUnifiedProject(null);
      setErrorMessage(null);
      setSection('analyzer');
    } else {
      void handleLaunchSampleUnified();
    }
  };

  return (
    <div id="top" className="min-h-screen flex flex-col">
      <TopNav
        activeSection={section}
        unifiedFocus={unifiedFocus}
        onSelectStep={handleSelectGuidedStep}
        onNavigateTool={(toolSection) => setSection(toolSection)}
        hasActiveWork={hasAnyActiveWork}
        onPrimaryAction={handlePrimaryHeaderAction}
      />

      {/* Mobile Secondary Guided Flow Switcher */}
      <div className="md:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2 flex items-center gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => handleSelectGuidedStep('connect')}
          className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
            section === 'analyzer'
              ? 'bg-slate-900 dark:bg-blue-600 text-white'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          1. Connect
        </button>
        <button
          type="button"
          onClick={() => handleSelectGuidedStep('build')}
          className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
            section === 'unified' && unifiedFocus === 'build'
              ? 'bg-slate-900 dark:bg-blue-600 text-white'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          2. Build &amp; Fix
        </button>
        <button
          type="button"
          onClick={() => handleSelectGuidedStep('launch')}
          className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
            section === 'unified' && unifiedFocus === 'launch'
              ? 'bg-slate-900 dark:bg-blue-600 text-white'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          3. Launch
        </button>
        <button
          type="button"
          onClick={() => setSection('compare')}
          className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
            section === 'compare'
              ? 'bg-slate-900 dark:bg-blue-600 text-white'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Compare
        </button>
        <button
          type="button"
          onClick={() => setSection('saved')}
          className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
            section === 'saved'
              ? 'bg-slate-900 dark:bg-blue-600 text-white'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Saved Maps
        </button>
        <button
          type="button"
          onClick={() => setSection('pipeline')}
          className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
            section === 'pipeline'
              ? 'bg-slate-900 dark:bg-blue-600 text-white'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Docs
        </button>
      </div>

      <div className="flex-1">
        {section === 'analyzer' &&
          (activeRepoReport ? (
            <RepoWorkspace
              repoReport={activeRepoReport}
              repoHistory={repoHistory}
              activeView={activeView}
              onSelectView={setActiveView}
              onSelectRepoReport={(rep) => {
                setActiveReport(null);
                setActiveRepoReport(rep);
                setActiveView('map');
              }}
              onSendToUnified={(rep) => void handleSendRepoToUnified(rep)}
              onRefreshLive={() =>
                void handleAnalyzeRepo(activeRepoReport.normalizedUrl, {
                  usePreset: false,
                  forceRefresh: true,
                  stayInSingleView: true,
                })
              }
              isRefreshing={isLoading}
              isDark={isDark}
              onToggleTheme={handleToggleTheme}
              onApproveProposal={handleApproveProposal}
            />
          ) : activeReport ? (
            <IntelligenceWorkspace
              report={activeReport}
              history={history}
              activeView={activeView}
              onSelectView={setActiveView}
              onSelectReport={(rep) => {
                setActiveRepoReport(null);
                setActiveReport(rep);
                setActiveView('map');
              }}
              onOpenCompare={() => setSection('compare')}
              onSendToUnified={(rep) => void handleSendUrlToUnified(rep)}
              onApproveProposal={handleApproveProposal}
              onRefreshLive={() =>
                void handleAnalyze(activeReport.normalizedUrl, {
                  usePreset: false,
                  forceRefresh: true,
                  stayInSingleView: true,
                })
              }
              isRefreshing={isLoading}
              isDark={isDark}
              onToggleTheme={handleToggleTheme}
            />
          ) : (
            <UrlAnalyzerLanding
              onAnalyze={handleAnalyze}
              onAnalyzeRepo={handleAnalyzeRepo}
              onImportCsv={(report) => void attachUrlReportAndOpenBuild(report)}
              onLaunchSampleUnified={handleLaunchSampleUnified}
              isLoading={isLoading}
              pipelineStage={pipelineStage}
              errorMessage={errorMessage}
            />
          ))}

        {section === 'unified' && (
          <UnifiedGraphWorkspace
            project={unifiedProject}
            focusTab={unifiedFocus}
            onChangeFocusTab={setUnifiedFocus}
            onBackToConnect={() => handleSelectGuidedStep('connect')}
            urlHistory={history}
            repoHistory={repoHistory}
            onAttachUrl={handleAttachUrlToUnified}
            onAttachRepo={handleAttachRepoToUnified}
            onAttachConnector={handleAttachConnectorToUnified}
            onUpdateProject={handleUpdateUnifiedProject}
            onLaunchSampleUnified={handleLaunchSampleUnified}
            onAddBusinessBlock={(blockId) =>
              handleAddBusinessBlockToUnified(blockId, 'user')
            }
            onRemoveSource={handleRemoveSourceFromUnified}
            onInspectSource={(sourceId) => {
              const foundRepo =
                unifiedProject?.repoReports.find((r) => r.id === sourceId) ??
                repoHistory.find((r) => r.id === sourceId);
              if (foundRepo) {
                setActiveReport(null);
                setActiveRepoReport(foundRepo);
                setActiveView('map');
                setSection('analyzer');
                return;
              }
              const foundUrl =
                unifiedProject?.urlReports.find((u) => u.id === sourceId) ??
                history.find((u) => u.id === sourceId);
              if (foundUrl) {
                setActiveRepoReport(null);
                setActiveReport(foundUrl);
                setActiveView('map');
                setSection('analyzer');
              }
            }}
            onApproveProposal={handleApproveProposal}
            isDark={isDark}
            isBusy={unifiedBusy}
            errorMessage={unifiedError}
          />
        )}

        {section === 'compare' && (
          <CompareView history={history} activeReport={activeReport} />
        )}

        {section === 'saved' && (
          <SavedMapsView
            history={history}
            onOpenReport={(rep) => {
              setActiveRepoReport(null);
              setActiveReport(rep);
              setActiveView('map');
              setSection('analyzer');
            }}
            onOpenPreset={(presetUrl) => {
              void handleAnalyze(presetUrl, { usePreset: true });
            }}
            onDeleteReport={(id) => {
              const updated = history.filter((item) => item.id !== id);
              persistHistory(updated);
              if (activeReport?.id === id) {
                setActiveReport(null);
              }
            }}
            onStartNew={() => {
              setActiveReport(null);
              setActiveRepoReport(null);
              setSection('analyzer');
            }}
          />
        )}

        {section === 'pipeline' && (
          <PipelineView onGoToAnalyzer={() => setSection('analyzer')} />
        )}
      </div>
    </div>
  );
}

