import { generateMarkdownReport, generateMermaidDiagram } from '../graphLayout';
import type { UnifiedGraphProject } from '../types';
import { unifiedGraphToReportAdapter } from './unifier';

export interface UnifiedBlueprintPayload {
  schemaVersion: string;
  exportedAt: string;
  platform: 'SLASH — Repo Unifier';
  project: {
    id: string;
    title: string;
    summary: string;
    createdAt: string;
    crossLinksCount: number;
    sharedTech: string[];
    truncationWarnings: string[];
    limitationsNote: string;
  };
  sources: UnifiedGraphProject['sources'];
  nodes: UnifiedGraphProject['nodes'];
  edges: UnifiedGraphProject['edges'];
  auditLog: NonNullable<UnifiedGraphProject['auditLog']>;
}

export function generateUnifiedBlueprintJson(project: UnifiedGraphProject): string {
  const payload: UnifiedBlueprintPayload = {
    schemaVersion: project.schemaVersion || '1.0',
    exportedAt: new Date().toISOString(),
    platform: 'SLASH — Repo Unifier',
    project: {
      id: project.id,
      title: project.title,
      summary: project.summary,
      createdAt: project.createdAt,
      crossLinksCount: project.crossLinksCount,
      sharedTech: project.sharedTech,
      truncationWarnings: project.truncationWarnings || [],
      limitationsNote: project.limitationsNote,
    },
    sources: project.sources,
    nodes: project.nodes,
    edges: project.edges,
    auditLog: project.auditLog || [],
  };

  return JSON.stringify(payload, null, 2);
}

export function generateUnifiedMermaidDiagram(project: UnifiedGraphProject): string {
  return generateMermaidDiagram(unifiedGraphToReportAdapter(project));
}

export function generateUnifiedMarkdownBlueprint(
  project: UnifiedGraphProject,
): string {
  return generateMarkdownReport(unifiedGraphToReportAdapter(project));
}
