import type {
  GraphAuditEntry,
  GraphSourceRef,
  IntelligenceEdge,
  IntelligenceNode,
  RepoIntelligenceReport,
  SharedEntityType,
  SharedRelationVerb,
  UnifiedGraphProject,
  UnifiedSourceSummary,
  UrlIntelligenceReport,
  VerificationStatus,
} from '../types';

function makeNamespacePrefix(index: number, kind: 'url' | 'repo'): string {
  return `${kind === 'url' ? 'u' : 'r'}${index + 1}__`;
}

function normalizeRoutePath(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      return new URL(trimmed).pathname.replace(/\/+$/, '') || '/';
    }
  } catch {
    // Not a full URL
  }
  const cleaned = trimmed.replace(/^\/+/, '/').replace(/\/+$/, '');
  return cleaned || '/';
}

function canonicalTechKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+v\d+(\.\d+)*$/i, '')
    .trim();
}

function inferSharedEntityType(
  node: IntelligenceNode,
  kind: 'url' | 'repo',
  urlCategory?: string,
): SharedEntityType {
  if (node.entityType) return node.entityType;
  const cat = node.category.toLowerCase();
  if (kind === 'repo') {
    if (node.layer === 'entry') return 'repository';
    if (cat.includes('api') || cat.includes('route')) return 'api';
    if (cat.includes('package') || cat.includes('manifest')) return 'package';
    if (node.layer === 'external') return 'integration';
    return 'file';
  }
  if (urlCategory === 'social') return 'social_post';
  if (urlCategory === 'media') return 'video';
  if (urlCategory === 'github' && node.layer === 'entry') return 'repository';
  if (urlCategory === 'api' || cat.includes('api')) return 'api';
  if (urlCategory === 'docs' && node.layer === 'entry') return 'document';
  if (node.layer === 'entry') return 'website';
  if (node.layer === 'frontend') return 'webpage';
  if (node.layer === 'external') return 'integration';
  return 'service';
}

function inferVerificationStatus(
  confidence: 'detected' | 'inferred',
  restricted?: boolean,
): VerificationStatus {
  if (restricted && confidence === 'inferred') return 'restricted';
  return confidence === 'detected' ? 'verified' : 'unverified';
}

function mapSemanticRelation(edge: IntelligenceEdge): SharedRelationVerb {
  if (edge.semanticRelation) return edge.semanticRelation;
  switch (edge.relationshipType) {
    case 'navigation':
      return 'LINKS_TO';
    case 'dataflow':
      return 'CALLS';
    case 'auth':
      return 'CONNECTS_TO';
    case 'reference':
      return 'REFERENCES';
    default:
      return 'DEPENDS_ON';
  }
}

export function unifyIntelligenceSources(params: {
  urlReports?: UrlIntelligenceReport[];
  repoReports?: RepoIntelligenceReport[];
  title?: string;
  aiSynthesis?: string;
  auditLog?: GraphAuditEntry[];
}): UnifiedGraphProject {
  const urlReports = params.urlReports ?? [];
  const repoReports = params.repoReports ?? [];

  const sources: UnifiedSourceSummary[] = [];
  const unifiedNodes: IntelligenceNode[] = [];
  const unifiedEdges: IntelligenceEdge[] = [];
  const truncationWarnings: string[] = [];

  const urlNodeLookupByReport = new Map<string, Map<string, IntelligenceNode>>();
  const repoNodeLookupByReport = new Map<string, Map<string, IntelligenceNode>>();

  // 1. Ingest URLMIND Reports
  urlReports.forEach((report, idx) => {
    const prefix = makeNamespacePrefix(idx, 'url');
    const idMap = new Map<string, IntelligenceNode>();
    const isRestricted = Boolean(report.socialMetadata?.accessRestricted);
    const sourceRef: GraphSourceRef = {
      engine: 'urlmind',
      sourceId: report.id,
      sourceLabel: report.domain,
      urlOrPath: report.normalizedUrl,
    };

    sources.push({
      id: report.id,
      kind: 'url',
      label: report.domain,
      url: report.normalizedUrl,
      nodeCount: report.nodes.length,
      detectedCount: report.nodes.filter((n) => n.confidence === 'detected').length,
      categoryOrLanguage: report.category,
    });

    for (const node of report.nodes) {
      const namespaced: IntelligenceNode = {
        ...node,
        id: `${prefix}${node.id}`,
        sourceEngine: 'urlmind',
        sourceId: report.id,
        sourceLabel: report.domain,
        entityType: inferSharedEntityType(node, 'url', report.category),
        verificationStatus:
          node.verificationStatus ??
          inferVerificationStatus(node.confidence, isRestricted),
        sources: node.sources?.length ? node.sources : [sourceRef],
      };
      unifiedNodes.push(namespaced);
      idMap.set(node.id, namespaced);
    }

    for (const edge of report.edges) {
      if (idMap.has(edge.source) && idMap.has(edge.target)) {
        unifiedEdges.push({
          ...edge,
          id: `${prefix}${edge.id}`,
          source: `${prefix}${edge.source}`,
          target: `${prefix}${edge.target}`,
          sourceEngine: 'urlmind',
          semanticRelation: mapSemanticRelation(edge),
          verificationStatus:
            edge.verificationStatus ??
            inferVerificationStatus(edge.confidence, isRestricted),
          sources: edge.sources?.length ? edge.sources : [sourceRef],
        });
      }
    }

    urlNodeLookupByReport.set(report.id, idMap);
  });

  // 2. Ingest Repo Intelligence Reports
  repoReports.forEach((report, idx) => {
    const prefix = makeNamespacePrefix(idx, 'repo');
    const idMap = new Map<string, IntelligenceNode>();
    const sourceRef: GraphSourceRef = {
      engine: 'repo',
      sourceId: report.id,
      sourceLabel: report.fullName,
      urlOrPath: report.normalizedUrl,
    };

    if (report.metrics.truncated && report.metrics.truncationReason) {
      truncationWarnings.push(
        `${report.fullName}: ${report.metrics.truncationReason}`,
      );
    }

    sources.push({
      id: report.id,
      kind: 'repo',
      label: report.fullName,
      url: report.normalizedUrl,
      nodeCount: report.nodes.length,
      detectedCount: report.nodes.filter((n) => n.confidence === 'detected').length,
      categoryOrLanguage: report.primaryLanguage,
    });

    for (const node of report.nodes) {
      const namespaced: IntelligenceNode = {
        ...node,
        id: `${prefix}${node.id}`,
        sourceEngine: 'repo',
        sourceId: report.id,
        sourceLabel: report.fullName,
        entityType: inferSharedEntityType(node, 'repo'),
        verificationStatus:
          node.verificationStatus ?? inferVerificationStatus(node.confidence),
        sources: node.sources?.length ? node.sources : [sourceRef],
      };
      unifiedNodes.push(namespaced);
      idMap.set(node.id, namespaced);
    }

    for (const edge of report.edges) {
      if (idMap.has(edge.source) && idMap.has(edge.target)) {
        unifiedEdges.push({
          ...edge,
          id: `${prefix}${edge.id}`,
          source: `${prefix}${edge.source}`,
          target: `${prefix}${edge.target}`,
          sourceEngine: 'repo',
          semanticRelation: mapSemanticRelation(edge),
          verificationStatus:
            edge.verificationStatus ?? inferVerificationStatus(edge.confidence),
          sources: edge.sources?.length ? edge.sources : [sourceRef],
        });
      }
    }

    repoNodeLookupByReport.set(report.id, idMap);
  });

  // 3. Discover Evidence-Backed Cross-Engine Relationships
  const edgePairKeys = new Set<string>();
  let crossLinksCount = 0;

  const addUnifiedEdge = (edge: IntelligenceEdge) => {
    const pairKey = `${edge.source}-->${edge.target}::${edge.relationshipType}`;
    if (edgePairKeys.has(pairKey)) return;
    edgePairKeys.add(pairKey);
    unifiedEdges.push(edge);
    crossLinksCount += 1;
  };

  const sharedTechSet = new Set<string>();

  for (const urlRep of urlReports) {
    const urlNodes = Array.from(
      urlNodeLookupByReport.get(urlRep.id)?.values() ?? [],
    );
    const urlTechNames = new Map(
      urlRep.techStack.map((t) => [canonicalTechKey(t.name), t]),
    );
    const urlRef: GraphSourceRef = {
      engine: 'urlmind',
      sourceId: urlRep.id,
      sourceLabel: urlRep.domain,
      urlOrPath: urlRep.normalizedUrl,
    };

    for (const repoRep of repoReports) {
      const repoNodes = Array.from(
        repoNodeLookupByReport.get(repoRep.id)?.values() ?? [],
      );
      const repoRef: GraphSourceRef = {
        engine: 'repo',
        sourceId: repoRep.id,
        sourceLabel: repoRep.fullName,
        urlOrPath: repoRep.normalizedUrl,
      };
      const pairSources = [urlRef, repoRef];

      // 3a. GitHub URL match (if URLMIND analyzed a GitHub URL or references the repo)
      const normalizedWeb = urlRep.normalizedUrl.replace(/\/+$/, '').toLowerCase();
      const normalizedRepo = repoRep.normalizedUrl.replace(/\/+$/, '').toLowerCase();
      if (
        normalizedWeb === normalizedRepo ||
        normalizedWeb.includes(repoRep.fullName.toLowerCase())
      ) {
        const entryWeb = urlNodes.find((n) => n.layer === 'entry') || urlNodes[0];
        const entryRepo = repoNodes.find((n) => n.layer === 'entry') || repoNodes[0];
        if (entryWeb && entryRepo) {
          addUnifiedEdge({
            id: `unified-gh-${entryWeb.id}-${entryRepo.id}`,
            source: entryWeb.id,
            target: entryRepo.id,
            label: 'maps source repository',
            relationshipType: 'reference',
            semanticRelation: 'IMPLEMENTS',
            confidence: 'detected',
            verificationStatus: 'verified',
            evidence: `Both URLMIND (${urlRep.normalizedUrl}) and Repo Engine (${repoRep.fullName}) target the same repository.`,
            sourceEngine: 'unified',
            sources: pairSources,
          });
        }
      }

      // 3b. Shared Technology & Manifest Dependency Bridges
      const repoTechMap = new Map(
        repoRep.techStack.map((t) => [canonicalTechKey(t.name), t]),
      );
      const repoManifestDeps = new Set(
        repoRep.manifests.flatMap((m) => [
          ...m.dependencies.map((d) => d.toLowerCase()),
          ...m.devDependencies.map((d) => d.toLowerCase()),
        ]),
      );

      const matchedTechs: string[] = [];
      for (const [canonKey, webTech] of urlTechNames.entries()) {
        const repoTech = repoTechMap.get(canonKey);
        if (repoTech || repoManifestDeps.has(canonKey)) {
          const displayLabel = repoTech?.name || webTech.name;
          sharedTechSet.add(displayLabel);
          matchedTechs.push(displayLabel);
        }
      }

      if (matchedTechs.length > 0) {
        const webFrontend =
          urlNodes.find((n) => n.layer === 'frontend') || urlNodes[0];
        const repoCore =
          repoNodes.find((n) => n.layer === 'logic') ||
          repoNodes.find((n) => n.layer === 'data') ||
          repoNodes[0];

        if (webFrontend && repoCore) {
          addUnifiedEdge({
            id: `unified-tech-${webFrontend.id}-${repoCore.id}`,
            source: webFrontend.id,
            target: repoCore.id,
            label: `shared stack (${matchedTechs.slice(0, 2).join(', ')})`,
            relationshipType: 'dependency',
            semanticRelation: 'USES',
            confidence: 'detected',
            verificationStatus: 'verified',
            evidence: `Shared detected stack between ${urlRep.domain} and ${repoRep.fullName}: ${matchedTechs.join(', ')}`,
            sourceEngine: 'unified',
            sources: pairSources,
          });
        }
      }

      // 3c. Route / API Endpoint Alignment
      for (const webNode of urlNodes) {
        const webPath = normalizeRoutePath(webNode.urlOrPath);
        if (!webPath || webPath === '/') continue;

        for (const repoRoute of repoRep.discoveredRoutes) {
          const repoPath = normalizeRoutePath(repoRoute.routePattern);
          if (
            repoPath &&
            (webPath === repoPath ||
              (webPath.length > 4 && repoPath.includes(webPath)))
          ) {
            const targetRepoNode =
              repoNodes.find((rn) =>
                (rn.urlOrPath || '').includes(repoRoute.path),
              ) ||
              repoNodes.find((rn) => rn.layer === 'logic') ||
              repoNodes[0];

            if (targetRepoNode) {
              addUnifiedEdge({
                id: `unified-route-${webNode.id}-${targetRepoNode.id}`,
                source: webNode.id,
                target: targetRepoNode.id,
                label: `route ${repoPath}`,
                relationshipType: 'dataflow',
                semanticRelation: 'IMPLEMENTS',
                confidence: 'detected',
                verificationStatus: 'verified',
                evidence: `Web path ${webPath} aligns with repository handler ${repoRoute.path}`,
                sourceEngine: 'unified',
                sources: pairSources,
              });
            }
          }
        }
      }

      // 3d. Cross-system architectural link if no direct detected bridge exists yet
      if (crossLinksCount === 0) {
        const webLogic =
          urlNodes.find((n) => n.layer === 'logic') ||
          urlNodes.find((n) => n.layer === 'frontend') ||
          urlNodes[0];
        const repoEntry =
          repoNodes.find((n) => n.layer === 'entry') || repoNodes[0];
        if (webLogic && repoEntry) {
          addUnifiedEdge({
            id: `unified-inferred-${webLogic.id}-${repoEntry.id}`,
            source: webLogic.id,
            target: repoEntry.id,
            label: 'connected system boundary',
            relationshipType: 'reference',
            semanticRelation: 'CONNECTS_TO',
            confidence: 'inferred',
            verificationStatus: 'unverified',
            evidence: `Workspace association linking ${urlRep.domain} and ${repoRep.fullName}; direct runtime call path is inferred.`,
            sourceEngine: 'unified',
            sources: pairSources,
          });
        }
      }
    }
  }

  // 4. Shared tech across multiple URL reports or multiple Repo reports
  if (urlReports.length > 1) {
    for (let i = 0; i < urlReports.length; i++) {
      for (let j = i + 1; j < urlReports.length; j++) {
        const a = urlReports[i];
        const b = urlReports[j];
        const techB = new Set(b.techStack.map((t) => t.name.toLowerCase()));
        for (const t of a.techStack) {
          if (techB.has(t.name.toLowerCase())) {
            sharedTechSet.add(t.name);
          }
        }
      }
    }
  }

  const title =
    params.title?.trim() ||
    (sources.length > 0
      ? `Unified Intelligence: ${sources.map((s) => s.label).join(' + ')}`
      : 'SLASH Unified Graph');

  const summary = `Unified knowledge graph connecting ${urlReports.length} URL report(s) and ${repoReports.length} repository report(s) into ${unifiedNodes.length} nodes and ${unifiedEdges.length} edges (${crossLinksCount} cross-resource bridge${crossLinksCount === 1 ? '' : 's'}).`;

  const createdAt = new Date().toISOString();
  const auditLog: GraphAuditEntry[] = params.auditLog ?? [
    {
      id: `audit-unify-${Date.now()}`,
      timestamp: createdAt,
      actor: 'system',
      action: 'Unified graph synthesized',
      target: sources.map((s) => s.label).join(' + ') || 'empty-workspace',
      status: 'applied',
    },
  ];

  return {
    id: `unified-${Date.now()}`,
    schemaVersion: '1.0',
    title,
    summary,
    createdAt,
    sources,
    urlReports,
    repoReports,
    nodes: unifiedNodes,
    edges: unifiedEdges,
    sharedTech: Array.from(sharedTechSet).sort(),
    crossLinksCount,
    aiSynthesis: params.aiSynthesis,
    truncationWarnings:
      truncationWarnings.length > 0 ? truncationWarnings : undefined,
    auditLog,
    limitationsNote:
      'Cross-engine edges labeled Detected reflect matching repository paths, GitHub URLs, or shared package/fingerprint signatures. Edges labeled Inferred represent workspace-level system associations.',
    suggestedQuestions: [
      'Which technologies or routes bridge the analyzed URLs and repositories?',
      'Which nodes in this unified graph are directly detected vs. inferred?',
      'Propose an integration or architecture improvement based on these connected resources.',
    ],
  };
}

export function unifiedGraphToReportAdapter(
  project: UnifiedGraphProject,
): UrlIntelligenceReport {
  return {
    id: project.id,
    url: project.sources[0]?.url || 'https://slash.local/unified',
    normalizedUrl: project.sources[0]?.url || 'https://slash.local/unified',
    domain:
      project.sources.map((s) => s.label).join(' + ') || 'unified-workspace',
    title: project.title,
    category: 'webapp',
    summary: project.summary,
    executiveOverview: project.aiSynthesis || project.summary,
    analyzedAt: project.createdAt,
    sourceMethod: 'live-crawl',
    crawlMetrics: {
      internalLinksCount: project.sources.length,
      externalLinksCount: project.crossLinksCount,
      headingsCount: project.nodes.length,
      scriptsCount: project.edges.length,
      inspectedLabel: `${project.sources.length} unified resources`,
    },
    nodes: project.nodes,
    edges: project.edges,
    sitemap: [],
    workflows: [],
    techStack: Array.from(
      new Map(
        [
          ...project.urlReports.flatMap((r) => r.techStack),
          ...project.repoReports.flatMap((r) => r.techStack),
        ].map((t) => [t.name.toLowerCase(), t]),
      ).values(),
    ),
    explainerScript: [],
    limitationsNote: project.limitationsNote,
    suggestedQuestions: project.suggestedQuestions,
  };
}
