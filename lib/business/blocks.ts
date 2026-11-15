import type {
  BusinessBlockTemplate,
  ConnectedConnectorArtifact,
  IntelligenceEdge,
  IntelligenceNode,
} from '../types';

export const VERIFIED_BUSINESS_BLOCKS: BusinessBlockTemplate[] = [
  {
    id: 'clerk-auth',
    name: 'Clerk Authentication',
    vendor: 'Clerk',
    zone: 'operations',
    capability: 'auth',
    summary:
      'Drop-in user sign-in, session JWT verification, and multi-tenant organization RBAC.',
    licenseSpdx: 'MIT',
    authScheme: 'Clerk',
    envVarsRequired: [
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
      'CLERK_SECRET_KEY',
    ],
    endpoints: [
      {
        method: 'POST',
        path: '/api/auth/session',
        summary: 'Verify Clerk session token and resolve tenant principal',
      },
      {
        method: 'POST',
        path: '/api/webhooks/clerk',
        summary: 'Sync user.created and organizationMembership events',
      },
    ],
  },
  {
    id: 'supabase-core',
    name: 'Supabase Auth & Postgres',
    vendor: 'Supabase',
    zone: 'data',
    capability: 'database',
    summary:
      'Unified PostgreSQL storage, Row-Level Security, and built-in auth session bridge.',
    licenseSpdx: 'Apache-2.0',
    authScheme: 'Supabase Auth',
    envVarsRequired: [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'DATABASE_URL',
    ],
    tables: [
      {
        name: 'tenants',
        columns: ['id: uuid', 'slug: text', 'plan: text'],
        relations: [],
      },
      {
        name: 'users',
        columns: ['id: uuid', 'tenant_id: uuid', 'email: text', 'role: text'],
        relations: ['tenants'],
      },
    ],
  },
  {
    id: 'stripe-payments',
    name: 'Stripe Checkout & Webhooks',
    vendor: 'Stripe',
    zone: 'operations',
    capability: 'payments',
    summary:
      'Global SaaS subscription checkout, customer portal, and signed webhook billing sync.',
    licenseSpdx: 'MIT',
    envVarsRequired: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    endpoints: [
      {
        method: 'POST',
        path: '/api/billing/checkout',
        summary: 'Create Stripe Checkout session for active tenant',
      },
      {
        method: 'POST',
        path: '/api/webhooks/stripe',
        summary: 'Handle checkout.session.completed and invoice.paid events',
      },
    ],
  },
  {
    id: 'razorpay-payments',
    name: 'Razorpay India & Global Payments',
    vendor: 'Razorpay',
    zone: 'operations',
    capability: 'payments',
    summary:
      'UPI, cards, and recurring SaaS subscription checkout adapter with webhook verification.',
    licenseSpdx: 'MIT',
    envVarsRequired: [
      'RAZORPAY_KEY_ID',
      'RAZORPAY_KEY_SECRET',
      'RAZORPAY_WEBHOOK_SECRET',
    ],
    endpoints: [
      {
        method: 'POST',
        path: '/api/billing/razorpay/order',
        summary: 'Create Razorpay subscription or payment order',
      },
      {
        method: 'POST',
        path: '/api/webhooks/razorpay',
        summary: 'Verify X-Razorpay-Signature and activate tenant plan',
      },
    ],
  },
  {
    id: 'shared-memory-pgvector',
    name: 'Shared Unified Memory (pgvector)',
    vendor: 'SLASH Open-Core',
    zone: 'data',
    capability: 'memory',
    summary:
      'Shared cross-agent knowledge memory & pgvector retrieval layer uniting all connected apps.',
    licenseSpdx: 'Apache-2.0',
    envVarsRequired: ['DATABASE_URL'],
    tables: [
      {
        name: 'memory_items',
        columns: [
          'id: uuid',
          'workspace_id: uuid',
          'source_key: text',
          'content: text',
          'embedding: vector(768)',
        ],
        relations: [],
      },
    ],
  },
  {
    id: 'n8n-automation',
    name: 'n8n Workflow Automation',
    vendor: 'n8n',
    zone: 'operations',
    capability: 'automation',
    summary:
      'Event-driven CRM sync, transactional email triggers, and background webhook orchestration.',
    licenseSpdx: 'Apache-2.0',
    envVarsRequired: ['N8N_WEBHOOK_URL', 'N8N_API_KEY'],
    endpoints: [
      {
        method: 'POST',
        path: '/api/automation/dispatch',
        summary: 'Trigger n8n workflow webhook on signup or billing event',
      },
    ],
  },
];

export function findVerifiedBusinessBlock(
  blockId: string,
): BusinessBlockTemplate | undefined {
  const normalized = blockId.trim().toLowerCase();
  return VERIFIED_BUSINESS_BLOCKS.find(
    (b) =>
      b.id === normalized ||
      b.name.toLowerCase().includes(normalized) ||
      b.vendor.toLowerCase() === normalized,
  );
}

export function buildBusinessBlockArtifact(
  blockId: string,
): ConnectedConnectorArtifact {
  const template = findVerifiedBusinessBlock(blockId);
  if (!template) {
    throw new Error(`Unknown Business Block template: "${blockId}"`);
  }

  const rootId = `block-${template.id}`;
  const nodes: IntelligenceNode[] = [
    {
      id: rootId,
      label: template.name,
      category: `Business Block · ${template.vendor}`,
      layer:
        template.zone === 'data'
          ? 'data'
          : template.capability === 'auth'
            ? 'logic'
            : 'external',
      businessZone: template.zone,
      description: template.summary,
      confidence: 'detected',
      evidence: `Verified SLASH Auto-Bridge Adapter (${template.id})`,
      urlOrPath: `block://${template.id}`,
      entityType:
        template.capability === 'auth'
          ? 'auth_flow'
          : template.capability === 'database' || template.capability === 'memory'
            ? 'database_schema'
            : 'integration',
      verificationStatus: 'verified',
      contract: {
        authScheme: template.authScheme,
        license: template.licenseSpdx,
        envVarsRequired: template.envVarsRequired,
      },
    },
  ];

  const edges: IntelligenceEdge[] = [];

  (template.endpoints ?? []).forEach((ep, idx) => {
    const epId = `${rootId}-ep-${idx + 1}`;
    const isWebhook = ep.path.includes('webhook');
    nodes.push({
      id: epId,
      label: `${ep.method} ${ep.path}`,
      category: isWebhook ? 'Webhook Handler' : 'Gateway Endpoint',
      layer: isWebhook ? 'external' : 'logic',
      businessZone: template.zone,
      description: ep.summary || ep.path,
      confidence: 'detected',
      evidence: `Auto-bridge adapter endpoint (${template.id})`,
      urlOrPath: ep.path,
      entityType: isWebhook ? 'webhook' : 'api',
      verificationStatus: 'verified',
    });
    edges.push({
      id: `e-${rootId}-ep-${idx + 1}`,
      source: rootId,
      target: epId,
      label: isWebhook ? 'handles webhook' : 'exposes endpoint',
      relationshipType: isWebhook ? 'dataflow' : 'dependency',
      semanticRelation: isWebhook ? 'TRIGGERS' : 'CONTAINS',
      confidence: 'detected',
      verificationStatus: 'verified',
    });
  });

  (template.tables ?? []).forEach((tbl, idx) => {
    const tblId = `${rootId}-tbl-${idx + 1}`;
    nodes.push({
      id: tblId,
      label: `Table: ${tbl.name}`,
      category: 'Database Model',
      layer: 'data',
      businessZone: 'data',
      description: `Columns: ${tbl.columns.join(', ')}`,
      confidence: 'detected',
      evidence: `Verified block schema (${template.id})`,
      entityType: 'data_model',
      verificationStatus: 'verified',
    });
    edges.push({
      id: `e-${rootId}-tbl-${idx + 1}`,
      source: rootId,
      target: tblId,
      label: 'provisions table',
      relationshipType: 'dataflow',
      semanticRelation: 'CONTAINS',
      confidence: 'detected',
      verificationStatus: 'verified',
    });
  });

  const kind = template.tables?.length
    ? 'database_schema'
    : template.endpoints?.length
      ? 'openapi_spec'
      : 'document_pdf';

  return {
    id: `conn-block-${template.id}-${Date.now()}`,
    kind,
    connectorId: `block:${template.id}`,
    label: template.name,
    locator: `block://${template.id}`,
    summary: template.summary,
    licenseSpdx: template.licenseSpdx,
    authScheme: template.authScheme,
    businessZone: template.zone,
    envVarsRequired: template.envVarsRequired,
    endpoints: template.endpoints,
    tables: template.tables,
    nodes,
    edges,
    techStack: [
      {
        name: template.name,
        category:
          template.capability === 'auth'
            ? 'Auth / Security'
            : template.capability === 'database' || template.capability === 'memory'
              ? 'Infrastructure'
              : 'API / Protocol',
        confidence: 'detected',
        evidence: `Verified SLASH Business Block (${template.vendor})`,
      },
    ],
    warnings: [],
    ingestedAt: new Date().toISOString(),
  };
}
