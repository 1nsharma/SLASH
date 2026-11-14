export type UrlCategory =
  | 'website'
  | 'webapp'
  | 'api'
  | 'docs'
  | 'github'
  | 'article'
  | 'social'
  | 'media';

export type SocialPlatform = 'youtube' | 'twitter' | 'instagram' | 'linkedin';

export interface SocialMetadata {
  platform: SocialPlatform;
  title: string;
  authorName?: string;
  authorUrl?: string;
  thumbnailUrl?: string;
  embedHtml?: string;
  description?: string;
  accessRestricted: boolean;
  accessNote?: string;
}

export type EvidenceConfidence = 'detected' | 'inferred';

export type VerificationStatus = 'verified' | 'unverified' | 'restricted';

export type SharedEntityType =
  | 'url'
  | 'website'
  | 'webpage'
  | 'repository'
  | 'file'
  | 'package'
  | 'api'
  | 'service'
  | 'technology'
  | 'social_post'
  | 'video'
  | 'document'
  | 'integration'
  | 'ai_model';

export type SharedRelationVerb =
  | 'CONTAINS'
  | 'LINKS_TO'
  | 'DEPENDS_ON'
  | 'IMPORTS'
  | 'CALLS'
  | 'IMPLEMENTS'
  | 'USES'
  | 'CONNECTS_TO'
  | 'DOCUMENTS'
  | 'REFERENCES'
  | 'DERIVED_FROM';

export interface GraphSourceRef {
  engine: IntelligenceEngineSource;
  sourceId: string;
  sourceLabel: string;
  urlOrPath?: string;
}

export interface GraphAuditEntry {
  id: string;
  timestamp: string;
  actor: 'user' | 'copilot-approved' | 'system';
  action: string;
  target: string;
  status: 'applied' | 'dismissed';
}

export type NodeLayer =
  | 'entry'
  | 'frontend'
  | 'logic'
  | 'data'
  | 'external';

export type RelationshipType =
  | 'navigation'
  | 'dependency'
  | 'dataflow'
  | 'auth'
  | 'reference';

export type IntelligenceEngineSource = 'urlmind' | 'repo' | 'unified';

export interface IntelligenceNode {
  id: string;
  label: string;
  category: string;
  layer: NodeLayer;
  description: string;
  confidence: EvidenceConfidence;
  evidence: string;
  urlOrPath?: string;
  sourceEngine?: IntelligenceEngineSource;
  sourceId?: string;
  sourceLabel?: string;
  entityType?: SharedEntityType;
  verificationStatus?: VerificationStatus;
  sources?: GraphSourceRef[];
}

export interface IntelligenceEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  relationshipType: RelationshipType;
  confidence: EvidenceConfidence;
  evidence?: string;
  sourceEngine?: IntelligenceEngineSource;
  semanticRelation?: SharedRelationVerb;
  verificationStatus?: VerificationStatus;
  sources?: GraphSourceRef[];
}

export interface SitemapItem {
  id: string;
  title: string;
  path: string;
  role: string;
  depth: number;
  confidence: EvidenceConfidence;
  children?: SitemapItem[];
}

export interface FlowStep {
  id: string;
  stepNumber: number;
  actor: string;
  action: string;
  targetNodeId: string;
  outcome: string;
  confidence: EvidenceConfidence;
}

export interface WorkflowSequence {
  id: string;
  title: string;
  summary: string;
  steps: FlowStep[];
}

export interface TechItem {
  name: string;
  category:
    | 'Framework'
    | 'Styling'
    | 'UI & Icons'
    | 'Bundler & Build'
    | 'Graphics / Visualization'
    | 'API / Protocol'
    | 'Infrastructure'
    | 'Analytics'
    | 'SEO / Metadata'
    | 'Performance'
    | 'Auth / Security'
    | 'Language / Runtime';
  confidence: EvidenceConfidence;
  evidence: string;
}

export interface ExplainerScene {
  id: string;
  sceneNumber: number;
  durationSeconds: number;
  title: string;
  narration: string;
  visualFocusNodeIds: string[];
  keyTakeaway: string;
}

export interface CrawlMetrics {
  httpStatus?: number;
  internalLinksCount: number;
  externalLinksCount: number;
  headingsCount: number;
  scriptsCount: number;
  inspectedLabel: string;
}

export interface UrlIntelligenceReport {
  id: string;
  url: string;
  normalizedUrl: string;
  domain: string;
  title: string;
  category: UrlCategory;
  summary: string;
  executiveOverview: string;
  analyzedAt: string;
  sourceMethod:
    | 'live-crawl'
    | 'preset-showcase'
    | 'url-context'
    | 'oembed-social'
    | 'csv-import';
  cacheStatus?: 'hit' | 'miss' | 'bypassed';
  cachedAt?: string;
  socialMetadata?: SocialMetadata;
  crawlMetrics: CrawlMetrics;
  nodes: IntelligenceNode[];
  edges: IntelligenceEdge[];
  sitemap: SitemapItem[];
  workflows: WorkflowSequence[];
  techStack: TechItem[];
  explainerScript: ExplainerScene[];
  limitationsNote: string;
  suggestedQuestions: string[];
}

export interface RepoManifestInfo {
  path: string;
  ecosystem: 'npm' | 'python' | 'go' | 'rust' | 'docker' | 'typescript';
  dependencies: string[];
  devDependencies: string[];
  scripts?: string[];
}

export interface RepoDiscoveredRoute {
  path: string;
  routePattern: string;
  framework: string;
  kind: 'api' | 'page' | 'middleware';
  confidence: EvidenceConfidence;
  evidence: string;
}

export interface RepoMetrics {
  filesCount: number;
  directoriesCount: number;
  manifestsCount: number;
  routesCount: number;
  dependenciesCount: number;
  stars: number;
  inspectedLabel: string;
  sizeKb?: number;
  truncated?: boolean;
  truncationReason?: string;
}

export interface RepoIntelligenceReport {
  id: string;
  repoUrl: string;
  normalizedUrl: string;
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch: string;
  primaryLanguage: string;
  topics: string[];
  title: string;
  summary: string;
  executiveOverview: string;
  analyzedAt: string;
  sourceMethod: 'github-api' | 'preset-repo';
  cacheStatus?: 'hit' | 'miss' | 'bypassed';
  cachedAt?: string;
  metrics: RepoMetrics;
  manifests: RepoManifestInfo[];
  discoveredRoutes: RepoDiscoveredRoute[];
  directoryTree: SitemapItem[];
  nodes: IntelligenceNode[];
  edges: IntelligenceEdge[];
  workflows: WorkflowSequence[];
  techStack: TechItem[];
  explainerScript: ExplainerScene[];
  limitationsNote: string;
  suggestedQuestions: string[];
}

export interface UnifiedSourceSummary {
  id: string;
  kind: 'url' | 'repo';
  label: string;
  url: string;
  nodeCount: number;
  detectedCount: number;
  categoryOrLanguage: string;
}

export interface UnifiedGraphProject {
  id: string;
  schemaVersion?: string;
  title: string;
  summary: string;
  createdAt: string;
  sources: UnifiedSourceSummary[];
  urlReports: UrlIntelligenceReport[];
  repoReports: RepoIntelligenceReport[];
  nodes: IntelligenceNode[];
  edges: IntelligenceEdge[];
  sharedTech: string[];
  crossLinksCount: number;
  aiSynthesis?: string;
  truncationWarnings?: string[];
  auditLog?: GraphAuditEntry[];
  limitationsNote: string;
  suggestedQuestions: string[];
}

export type CopilotActionType =
  | 'analyze_and_link_url'
  | 'analyze_and_link_repo'
  | 'add_verified_edge'
  | 'export_blueprint';

export interface CopilotActionProposal {
  id: string;
  type: CopilotActionType;
  title: string;
  description: string;
  target: string;
  rationale: string;
  confidence: EvidenceConfidence;
  evidence: string;
  status: 'pending' | 'approved' | 'dismissed';
  payload?: {
    sourceNodeId?: string;
    targetNodeId?: string;
    edgeLabel?: string;
    relationshipType?: RelationshipType;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  proposedActions?: CopilotActionProposal[];
}

export interface ComparisonDiff {
  sharedTech: string[];
  uniqueToA: string[];
  uniqueToB: string[];
  detectedRatioA: number;
  detectedRatioB: number;
  nodeCountA: number;
  nodeCountB: number;
  edgeCountA: number;
  edgeCountB: number;
  layerBreakdownA: Record<NodeLayer, number>;
  layerBreakdownB: Record<NodeLayer, number>;
}

export interface ComparisonResult {
  reportA: UrlIntelligenceReport;
  reportB: UrlIntelligenceReport;
  diff: ComparisonDiff;
  aiSynthesis: string;
  createdAt: string;
}

export interface AdapterDescriptor {
  id: string;
  name: string;
  kind: 'web' | 'repo' | 'api' | 'social' | 'data';
  description: string;
  authEnvVar?: string;
  status: 'active' | 'optional-auth';
}

export type WorkspaceView =
  | 'map'
  | 'sitemap'
  | 'flows'
  | 'tech'
  | 'explainer'
  | 'ask'
  | 'export';

