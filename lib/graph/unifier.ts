import {
  classifyNodeBusinessZone,
  classifySourceBusinessZone,
} from '../business/zones';
import type {
  ConnectedConnectorArtifact,
  GraphAuditEntry,
  GraphConflict,
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

export function detectGraphConflicts(params: {
  urlReports: UrlIntelligenceReport[];
  repoReports: RepoIntelligenceReport[];
  connectorArtifacts: ConnectedConnectorArtifact[];
}): GraphConflict[] {
  const conflicts: GraphConflict[] = [];

  // 1. SPDX License Compatibility Check
  const licenses = new Map<string, string[]>();
  const addLicense = (spdx: string | undefined, sourceId: string) => {
    if (!spdx) return;
    const norm = spdx.trim().toUpperCase();
    const list = licenses.get(norm) ?? [];
    list.push(sourceId);
    licenses.set(norm, list);
  };
  params.repoReports.forEach((r) => addLicense(r.licenseSpdx, r.id));
  params.connectorArtifacts.forEach((c) => addLicense(c.licenseSpdx, c.id));

  const copyleft = Array.from(licenses.keys()).filter((l) =>
    /GPL|AGPL|EUPL/.test(l),
  );
  const permissive = Array.from(licenses.keys()).filter((l) =>
    /MIT|APACHE|BSD|ISC/.test(l),
  );
  if (copyleft.length > 0 && permissive.length > 0) {
    conflicts.push({
      id: 'conflict-license-copyleft',
      severity: 'high',
      category: 'license',
      title: `License compatibility gate: ${copyleft.join('/')} mixed with ${permissive.join('/')}`,
      description:
        'Combining copyleft modules directly into a single bundle triggers viral license obligations across the unified build.',
      involvedSourceIds: [
        ...copyleft.flatMap((l) => licenses.get(l) ?? []),
        ...permissive.flatMap((l) => licenses.get(l) ?? []),
      ],
      resolutionOptions: [
        'Isolate copyleft module as an external microservice over HTTP',
        'Publish unified project under compatible copyleft license',
        'Exclude copyleft dependency from generated bundle',
      ],
      selectedResolution:
        'Isolate copyleft module as an external microservice over HTTP',
    });
  }

  // 2. Auth Provider Collision Check
  const authSignals = new Map<string, string[]>();
  const recordAuth = (name: string, id: string) => {
    const list = authSignals.get(name) ?? [];
    if (!list.includes(id)) list.push(id);
    authSignals.set(name, list);
  };

  for (const rep of params.repoReports) {
    for (const m of rep.manifests) {
      for (const dep of [...(m.dependencies ?? []), ...(m.devDependencies ?? [])]) {
        const lower = dep.toLowerCase();
        if (lower.includes('next-auth')) recordAuth('NextAuth', rep.id);
        if (lower.includes('clerk')) recordAuth('Clerk', rep.id);
        if (lower.includes('firebase')) recordAuth('Firebase Auth', rep.id);
      }
    }
  }
  for (const conn of params.connectorArtifacts) {
    if (conn.authScheme) recordAuth(conn.authScheme, conn.id);
  }

  if (authSignals.size > 1) {
    const names = Array.from(authSignals.keys());
    conflicts.push({
      id: 'conflict-auth-collision',
      severity: 'medium',
      category: 'auth',
      title: `Multiple authentication schemes detected (${names.join(' vs. ')})`,
      description:
        'Connected resources declare more than one authentication mechanism; a unified auth bridge adapter is required to share sessions.',
      involvedSourceIds: Array.from(
        new Set(Array.from(authSignals.values()).flat()),
      ),
      resolutionOptions: [
        `Standardize UI session on ${names[0]} and issue server-side service tokens for downstream APIs`,
        'Generate unified AuthBridge middleware normalizing user claims',
      ],
      selectedResolution:
        'Generate unified AuthBridge middleware normalizing user claims',
    });
  }

  // 3. Multi-Runtime Bridge Check
  const runtimes = new Set<string>();
  params.repoReports.forEach((r) => {
    const lang = r.primaryLanguage.toLowerCase();
    if (lang.includes('python')) runtimes.add('Python');
    if (lang.includes('typescript') || lang.includes('javascript'))
      runtimes.add('Node.js/TypeScript');
    if (lang === 'go') runtimes.add('Go');
    if (lang === 'rust') runtimes.add('Rust');
  });
  if (runtimes.size > 1) {
    const rtList = Array.from(runtimes);
    conflicts.push({
      id: 'conflict-multi-runtime',
      severity: 'info',
      category: 'runtime',
      title: `Cross-runtime composition required (${rtList.join(' + ')})`,
      description:
        'Sources span multiple execution runtimes. Compose via typed REST/OpenAPI HTTP adapter and containerized services.',
      involvedSourceIds: params.repoReports.map((r) => r.id),
      resolutionOptions: [
        'Generate typed TypeScript fetch adapter + Docker Compose multi-service topology',
      ],
      selectedResolution:
        'Generate typed TypeScript fetch adapter + Docker Compose multi-service topology',
    });
  }

  return conflicts;
}

export function unifyIntelligenceSources(params: {
  urlReports?: UrlIntelligenceReport[];
  repoReports?: RepoIntelligenceReport[];
  connectorArtifacts?: ConnectedConnectorArtifact[];
  title?: string;
  aiSynthesis?: string;
  auditLog?: GraphAuditEntry[];
}): UnifiedGraphProject {
  const urlReports = params.urlReports ?? [];
  const repoReports = params.repoReports ?? [];
  const connectorArtifacts = params.connectorArtifacts ?? [];

  const sources: UnifiedSourceSummary[] = [];
  const unifiedNodes: IntelligenceNode[] = [];
  const unifiedEdges: IntelligenceEdge[] = [];
  const truncationWarnings: string[] = [];

  const urlNodeLookupByReport = new Map<string, Map<string, IntelligenceNode>>();
  const repoNodeLookupByReport = new Map<string, Map<string, IntelligenceNode>>();
  const connNodeLookupByArtifact = new Map<string, Map<string, IntelligenceNode>>();

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

    const urlSummaryDraft = {
      id: report.id,
      kind: 'url' as const,
      label: report.domain,
      url: report.normalizedUrl,
      nodeCount: report.nodes.length,
      detectedCount: report.nodes.filter((n) => n.confidence === 'detected').length,
      categoryOrLanguage: report.category,
    };
    sources.push({
      ...urlSummaryDraft,
      businessZone: classifySourceBusinessZone(urlSummaryDraft),
    });

    for (const node of report.nodes) {
      const entityType = inferSharedEntityType(node, 'url', report.category);
      const namespaced: IntelligenceNode = {
        ...node,
        id: `${prefix}${node.id}`,
        sourceEngine: 'urlmind',
        sourceId: report.id,
        sourceLabel: report.domain,
        entityType,
        businessZone: classifyNodeBusinessZone({ ...node, entityType }, 'url'),
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

    const repoSummaryDraft = {
      id: report.id,
      kind: 'repo' as const,
      connectorKind: (report.isPrivate
        ? 'github_private_repo'
        : 'github_public_repo') as UnifiedSourceSummary['connectorKind'],
      label: report.fullName,
      url: report.normalizedUrl,
      nodeCount: report.nodes.length,
      detectedCount: report.nodes.filter((n) => n.confidence === 'detected').length,
      categoryOrLanguage: report.primaryLanguage,
      licenseSpdx: report.licenseSpdx,
    };
    sources.push({
      ...repoSummaryDraft,
      businessZone: classifySourceBusinessZone(repoSummaryDraft),
    });

    for (const node of report.nodes) {
      const entityType = inferSharedEntityType(node, 'repo');
      const namespaced: IntelligenceNode = {
        ...node,
        id: `${prefix}${node.id}`,
        sourceEngine: 'repo',
        sourceId: report.id,
        sourceLabel: report.fullName,
        entityType,
        businessZone: classifyNodeBusinessZone({ ...node, entityType }, 'repo'),
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

  // 2b. Ingest Multi-Source Connector Artifacts (OpenAPI, DB Schema, Docs/Config)
  connectorArtifacts.forEach((artifact, idx) => {
    const prefix = `c${idx + 1}__`;
    const idMap = new Map<string, IntelligenceNode>();
    const sourceRef: GraphSourceRef = {
      engine: 'connector',
      sourceId: artifact.id,
      sourceLabel: artifact.label,
      urlOrPath: artifact.locator,
    };

    const connSummaryDraft = {
      id: artifact.id,
      kind: 'connector' as const,
      connectorKind: artifact.kind,
      businessZone: artifact.businessZone,
      label: artifact.label,
      url: artifact.locator,
      nodeCount: artifact.nodes.length,
      detectedCount: artifact.nodes.filter((n) => n.confidence === 'detected').length,
      categoryOrLanguage:
        artifact.kind === 'openapi_spec' || artifact.kind === 'webhook_endpoint'
          ? 'OpenAPI'
          : artifact.kind === 'database_schema'
            ? artifact.runtime || 'Database'
            : 'Config',
      licenseSpdx: artifact.licenseSpdx,
      authScheme: artifact.authScheme,
    };
    sources.push({
      ...connSummaryDraft,
      businessZone: classifySourceBusinessZone(connSummaryDraft),
    });

    for (const node of artifact.nodes) {
      const entityType = node.entityType || 'integration';
      const namespaced: IntelligenceNode = {
        ...node,
        id: `${prefix}${node.id}`,
        sourceEngine: 'connector',
        sourceId: artifact.id,
        sourceLabel: artifact.label,
        entityType,
        businessZone:
          node.businessZone ??
          artifact.businessZone ??
          classifyNodeBusinessZone({ ...node, entityType }, 'connector'),
        verificationStatus:
          node.verificationStatus ?? inferVerificationStatus(node.confidence),
        sources: node.sources?.length ? node.sources : [sourceRef],
      };
      unifiedNodes.push(namespaced);
      idMap.set(node.id, namespaced);
    }

    for (const edge of artifact.edges) {
      if (idMap.has(edge.source) && idMap.has(edge.target)) {
        unifiedEdges.push({
          ...edge,
          id: `${prefix}${edge.id}`,
          source: `${prefix}${edge.source}`,
          target: `${prefix}${edge.target}`,
          sourceEngine: 'connector',
          semanticRelation: mapSemanticRelation(edge),
          verificationStatus:
            edge.verificationStatus ?? inferVerificationStatus(edge.confidence),
          sources: edge.sources?.length ? edge.sources : [sourceRef],
        });
      }
    }

    connNodeLookupByArtifact.set(artifact.id, idMap);
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
          ...(m.dependencies ?? []).map((d) => d.toLowerCase()),
          ...(m.devDependencies ?? []).map((d) => d.toLowerCase()),
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

  // 4b. Cross-link Connector Artifacts (OpenAPI endpoints, DB schemas) with Repos & URLs
  for (const artifact of connectorArtifacts) {
    const connNodes = Array.from(
      connNodeLookupByArtifact.get(artifact.id)?.values() ?? [],
    );
    const connEntry = connNodes[0];
    if (!connEntry) continue;
    const connRef: GraphSourceRef = {
      engine: 'connector',
      sourceId: artifact.id,
      sourceLabel: artifact.label,
      urlOrPath: artifact.locator,
    };

    for (const repoRep of repoReports) {
      const repoNodes = Array.from(
        repoNodeLookupByReport.get(repoRep.id)?.values() ?? [],
      );
      const repoEntry = repoNodes.find((n) => n.layer === 'entry') || repoNodes[0];
      if (!repoEntry) continue;
      const repoRef: GraphSourceRef = {
        engine: 'repo',
        sourceId: repoRep.id,
        sourceLabel: repoRep.fullName,
        urlOrPath: repoRep.normalizedUrl,
      };

      if (
        artifact.kind === 'openapi_spec' ||
        artifact.kind === 'webhook_endpoint'
      ) {
        const repoApiNode =
          repoNodes.find((n) => n.entityType === 'api' || n.layer === 'logic') ||
          repoEntry;
        addUnifiedEdge({
          id: `unified-conn-api-${repoApiNode.id}-${connEntry.id}`,
          source: repoApiNode.id,
          target: connEntry.id,
          label: 'consumes / implements API contract',
          relationshipType: 'dataflow',
          semanticRelation: 'CALLS',
          confidence: 'inferred',
          verificationStatus: 'unverified',
          evidence: `Cross-source link connecting ${repoRep.fullName} with ${artifact.label}`,
          sourceEngine: 'unified',
          sources: [repoRef, connRef],
        });
      } else if (artifact.kind === 'database_schema') {
        const repoLogic =
          repoNodes.find((n) => n.layer === 'logic') || repoEntry;
        addUnifiedEdge({
          id: `unified-conn-db-${repoLogic.id}-${connEntry.id}`,
          source: repoLogic.id,
          target: connEntry.id,
          label: 'persists to schema',
          relationshipType: 'dataflow',
          semanticRelation: 'READS_FROM',
          confidence: 'inferred',
          verificationStatus: 'unverified',
          evidence: `Backend module ${repoRep.fullName} connects to ${artifact.label}`,
          sourceEngine: 'unified',
          sources: [repoRef, connRef],
        });
      } else {
        addUnifiedEdge({
          id: `unified-conn-doc-${connEntry.id}-${repoEntry.id}`,
          source: connEntry.id,
          target: repoEntry.id,
          label: 'configures environment',
          relationshipType: 'reference',
          semanticRelation: 'DOCUMENTS',
          confidence: 'detected',
          verificationStatus: 'verified',
          evidence: `Configuration spec ${artifact.label} references variables for ${repoRep.fullName}`,
          sourceEngine: 'unified',
          sources: [connRef, repoRef],
        });
      }
    }
  }

  const conflicts = detectGraphConflicts({
    urlReports,
    repoReports,
    connectorArtifacts,
  });

  // 4c. Materialize high/medium conflict edges directly in the shared graph
  for (const conflict of conflicts) {
    if (conflict.severity === 'info') continue;
    const involvedEntryNodes: IntelligenceNode[] = [];
    for (const srcId of conflict.involvedSourceIds) {
      const map =
        repoNodeLookupByReport.get(srcId) ||
        connNodeLookupByArtifact.get(srcId) ||
        urlNodeLookupByReport.get(srcId);
      const list = Array.from(map?.values() ?? []);
      const entry = list.find((n) => n.layer === 'entry') || list[0];
      if (entry && !involvedEntryNodes.some((n) => n.id === entry.id)) {
        involvedEntryNodes.push(entry);
      }
    }
    if (involvedEntryNodes.length >= 2) {
      addUnifiedEdge({
        id: `unified-${conflict.id}-${involvedEntryNodes[0].id}-${involvedEntryNodes[1].id}`,
        source: involvedEntryNodes[0].id,
        target: involvedEntryNodes[1].id,
        label:
          conflict.category === 'license'
            ? 'SPDX license conflict'
            : conflict.category === 'auth'
              ? 'auth scheme collision'
              : 'compatibility conflict',
        relationshipType: 'dependency',
        semanticRelation: 'CONFLICTS_WITH',
        confidence: 'detected',
        verificationStatus: 'conflict',
        evidence: conflict.title,
        sourceEngine: 'unified',
        sources: [
          ...(involvedEntryNodes[0].sources ?? []),
          ...(involvedEntryNodes[1].sources ?? []),
        ],
      });
    }
  }

  const title =
    params.title?.trim() ||
    (sources.length > 0
      ? `Unified Intelligence: ${sources.map((s) => s.label).join(' + ')}`
      : 'SLASH Unified Graph');

  const summary = `Unified knowledge graph connecting ${urlReports.length} URL(s), ${repoReports.length} repo(s), and ${connectorArtifacts.length} connector(s) into ${unifiedNodes.length} nodes and ${unifiedEdges.length} edges (${crossLinksCount} cross-resource bridge${crossLinksCount === 1 ? '' : 's'}).`;

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
    schemaVersion: '2.0',
    title,
    summary,
    createdAt,
    sources,
    urlReports,
    repoReports,
    connectorArtifacts,
    nodes: unifiedNodes,
    edges: unifiedEdges,
    sharedTech: Array.from(sharedTechSet).sort(),
    crossLinksCount,
    conflicts,
    aiSynthesis: params.aiSynthesis,
    truncationWarnings:
      truncationWarnings.length > 0 ? truncationWarnings : undefined,
    auditLog,
    limitationsNote:
      'Cross-engine edges labeled Detected reflect matching repository paths, GitHub URLs, or shared package/fingerprint signatures. Edges labeled Inferred represent workspace-level system associations.',
    suggestedQuestions: [
      'Which technologies, schemas, or routes bridge the connected resources?',
      'Are there any auth, runtime, or SPDX license conflicts across these sources?',
      'Propose an integration adapter architecture based on these connected resources.',
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
          ...(project.connectorArtifacts ?? []).flatMap((c) => c.techStack),
        ].map((t) => [t.name.toLowerCase(), t]),
      ).values(),
    ),
    explainerScript: [],
    limitationsNote: project.limitationsNote,
    suggestedQuestions: project.suggestedQuestions,
  };
}
