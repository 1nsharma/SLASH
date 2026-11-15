import type {
  BusinessGapSuggestion,
  BusinessZone,
  IntelligenceEngineSource,
  IntelligenceNode,
  UnifiedGraphProject,
  UnifiedSourceSummary,
} from '../types';

export const BUSINESS_ZONE_META: Record<
  BusinessZone,
  {
    id: BusinessZone;
    order: string;
    label: string;
    shortLabel: string;
    role: string;
  }
> = {
  frontend: {
    id: 'frontend',
    order: '01',
    label: 'Frontend & Experience',
    shortLabel: 'Frontend',
    role: 'Landing pages, web apps, UI portals, docs, and customer touchpoints',
  },
  brain: {
    id: 'brain',
    order: '02',
    label: 'Brain / AI & Core Logic',
    shortLabel: 'Brain / AI',
    role: 'AI agents, LLM routers, API handlers, and business logic backends',
  },
  data: {
    id: 'data',
    order: '03',
    label: 'Data & Shared Memory',
    shortLabel: 'Data',
    role: 'PostgreSQL tables, Prisma models, vector memory, and state stores',
  },
  operations: {
    id: 'operations',
    order: '04',
    label: 'Operations, Auth & Billing',
    shortLabel: 'Operations',
    role: 'Authentication, Stripe/Razorpay payments, webhooks, and n8n automation',
  },
};

export function classifyNodeBusinessZone(
  node: Pick<
    IntelligenceNode,
    | 'layer'
    | 'category'
    | 'label'
    | 'description'
    | 'entityType'
    | 'businessZone'
    | 'sourceEngine'
  >,
  sourceKind?: 'url' | 'repo' | 'connector',
): BusinessZone {
  if (node.businessZone) return node.businessZone;

  const text = `${node.category} ${node.label} ${node.description}`.toLowerCase();

  if (
    node.entityType === 'auth_flow' ||
    node.entityType === 'webhook' ||
    /\b(auth|clerk|nextauth|oauth|login|jwt|stripe|razorpay|billing|payment|checkout|webhook|n8n|zapier|crm|analytics|vercel|docker)\b/.test(
      text,
    )
  ) {
    return 'operations';
  }

  if (
    node.layer === 'data' ||
    node.entityType === 'database_schema' ||
    node.entityType === 'data_model' ||
    /\b(postgres|postgresql|prisma|supabase|database|sql|schema|table|redis|valkey|pgvector|vector|memory|storage)\b/.test(
      text,
    )
  ) {
    return 'data';
  }

  if (
    node.entityType === 'ai_model' ||
    node.layer === 'logic' ||
    /\b(ai|llm|agent|gemini|openai|anthropic|ollama|rag|model|fastapi|express|api|route|sdk|engine|streaming)\b/.test(
      text,
    )
  ) {
    return 'brain';
  }

  if (
    node.layer === 'frontend' ||
    node.entityType === 'website' ||
    node.entityType === 'webpage' ||
    node.entityType === 'component' ||
    sourceKind === 'url'
  ) {
    return 'frontend';
  }

  if (node.layer === 'external') {
    return 'operations';
  }

  return sourceKind === 'repo' ? 'brain' : 'frontend';
}

export function classifySourceBusinessZone(
  source: Pick<
    UnifiedSourceSummary,
    'kind' | 'connectorKind' | 'categoryOrLanguage' | 'label' | 'businessZone'
  >,
): BusinessZone {
  if (source.businessZone) return source.businessZone;

  const text = `${source.label} ${source.categoryOrLanguage}`.toLowerCase();
  if (source.connectorKind === 'database_schema') return 'data';
  if (
    source.connectorKind === 'webhook_endpoint' ||
    /\b(auth|clerk|stripe|razorpay|billing|n8n|webhook)\b/.test(text)
  ) {
    return 'operations';
  }
  if (source.connectorKind === 'openapi_spec') return 'brain';
  if (source.kind === 'url') {
    if (source.categoryOrLanguage === 'api') return 'brain';
    return 'frontend';
  }
  if (
    /\b(python|go|rust|ai|agent|fastapi|sdk|backend|api)\b/.test(text)
  ) {
    return 'brain';
  }
  return 'brain';
}

export function detectMissingBusinessGaps(
  project: Pick<
    UnifiedGraphProject,
    'sources' | 'nodes' | 'connectorArtifacts' | 'repoReports' | 'urlReports'
  >,
): BusinessGapSuggestion[] {
  if (project.sources.length === 0) return [];

  const allText = [
    ...project.sources.map((s) => `${s.label} ${s.categoryOrLanguage} ${s.authScheme ?? ''}`),
    ...project.nodes.map((n) => `${n.label} ${n.category} ${n.description} ${n.entityType ?? ''}`),
    ...(project.connectorArtifacts ?? []).map(
      (c) => `${c.label} ${c.connectorId} ${c.authScheme ?? ''} ${c.envVarsRequired.join(' ')}`,
    ),
    ...project.repoReports.flatMap((r) => [
      ...r.techStack.map((t) => t.name),
      ...r.manifests.flatMap((m) => m.dependencies),
    ]),
    ...project.urlReports.flatMap((u) => u.techStack.map((t) => t.name)),
  ]
    .join(' ')
    .toLowerCase();

  const hasAuth =
    /\b(clerk|next-auth|nextauth|supabase auth|firebase auth|auth0|oauth|bearerauth|jwt)\b/.test(
      allText,
    ) || project.nodes.some((n) => n.entityType === 'auth_flow');

  const hasPayments = /\b(stripe|razorpay|billing|checkout|subscription|invoice|paddle)\b/.test(
    allText,
  );

  const hasData =
    project.nodes.some(
      (n) =>
        n.entityType === 'database_schema' ||
        n.entityType === 'data_model',
    ) ||
    (project.connectorArtifacts ?? []).some(
      (c) => c.kind === 'database_schema' || (c.tables?.length ?? 0) > 0,
    ) ||
    /\b(postgres|postgresql|prisma|supabase|pgvector|drizzle|mongodb|mysql|sqlite)\b/.test(
      allText,
    );

  const hasAutomation =
    /\b(n8n|zapier|inngest|trigger\.dev|automation|crm)\b/.test(allText) ||
    (project.connectorArtifacts ?? []).some((c) =>
      c.connectorId.includes('n8n'),
    );

  const gaps: BusinessGapSuggestion[] = [];

  if (!hasAuth) {
    gaps.push({
      id: 'gap-auth',
      missingCapability: 'auth',
      zone: 'operations',
      title: 'Missing Authentication & Tenant Identity',
      description:
        'Connected prototypes lack a unified user sign-in and session layer. Add an Auth block to bridge Frontend users to Brain/AI APIs.',
      recommendedBlockIds: ['clerk-auth', 'supabase-core'],
      severity: 'high',
    });
  }

  if (!hasPayments) {
    gaps.push({
      id: 'gap-payments',
      missingCapability: 'payments',
      zone: 'operations',
      title: 'Missing Payments & Subscription Billing',
      description:
        'No Stripe or Razorpay checkout/webhook handler is attached to monetize your connected SaaS workflow.',
      recommendedBlockIds: ['stripe-payments', 'razorpay-payments'],
      severity: 'high',
    });
  }

  if (!hasData) {
    gaps.push({
      id: 'gap-data',
      missingCapability: 'database',
      zone: 'data',
      title: 'Missing Shared Database & Unified Memory',
      description:
        'Services have no shared PostgreSQL or pgvector memory store for cross-app user state and AI agent context.',
      recommendedBlockIds: ['shared-memory-pgvector', 'supabase-core'],
      severity: 'medium',
    });
  }

  if (!hasAutomation) {
    gaps.push({
      id: 'gap-automation',
      missingCapability: 'automation',
      zone: 'operations',
      title: 'Missing Post-Action Workflow Automation',
      description:
        'Connect n8n webhook automation to dispatch onboarding emails, CRM updates, and alerts when users convert.',
      recommendedBlockIds: ['n8n-automation'],
      severity: 'medium',
    });
  }

  return gaps;
}

export function groupNodesByBusinessZone(
  nodes: IntelligenceNode[],
  engineFilter?: IntelligenceEngineSource | 'all',
): Record<BusinessZone, IntelligenceNode[]> {
  const buckets: Record<BusinessZone, IntelligenceNode[]> = {
    frontend: [],
    brain: [],
    data: [],
    operations: [],
  };

  for (const node of nodes) {
    if (
      engineFilter &&
      engineFilter !== 'all' &&
      node.sourceEngine !== engineFilter
    ) {
      continue;
    }
    const zone = classifyNodeBusinessZone(node);
    buckets[zone].push(node);
  }

  return buckets;
}
