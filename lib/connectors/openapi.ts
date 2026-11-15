import { safeFetchPublic } from '../security/urlGuard';
import type {
  ConnectedConnectorArtifact,
  IntelligenceEdge,
  IntelligenceNode,
  TechItem,
} from '../types';
import type { ConnectorInput, SourceConnector } from './types';

export const SAMPLE_OPENAPI_SPEC = JSON.stringify(
  {
    openapi: '3.0.3',
    info: {
      title: 'Acme SaaS Billing & Webhook API',
      version: '2.1.0',
      license: { name: 'MIT' },
    },
    servers: [{ url: 'https://api.acme-saas.example/v1' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Subscription: { type: 'object' },
        InvoiceEvent: { type: 'object' },
      },
    },
    paths: {
      '/api/billing/checkout': {
        post: { summary: 'Create Stripe-backed checkout session' },
      },
      '/api/billing/subscription': {
        get: { summary: 'Retrieve active tenant subscription' },
      },
      '/api/webhooks/stripe': {
        post: { summary: 'Receive signed billing webhook events' },
      },
    },
    webhooks: {
      'invoice.paid': {
        post: { summary: 'Dispatched when subscription invoice settles' },
      },
    },
  },
  null,
  2,
);

interface ParsedOpenApiDoc {
  info?: { title?: string; version?: string; license?: { name?: string } };
  servers?: Array<{ url?: string }>;
  paths?: Record<string, Record<string, { summary?: string; description?: string }>>;
  webhooks?: Record<string, Record<string, { summary?: string }>>;
  components?: {
    securitySchemes?: Record<string, { type?: string; scheme?: string }>;
    schemas?: Record<string, unknown>;
  };
}

export function parseOpenApiSpecToArtifact(params: {
  rawJson: string;
  locator: string;
  label?: string;
}): ConnectedConnectorArtifact {
  let doc: ParsedOpenApiDoc;
  try {
    doc = JSON.parse(params.rawJson) as ParsedOpenApiDoc;
  } catch {
    throw new Error('OpenAPI connector requires valid JSON (OpenAPI 3.x / Swagger).');
  }

  if (!doc || (!doc.paths && !doc.webhooks)) {
    throw new Error('Parsed JSON does not contain OpenAPI "paths" or "webhooks".');
  }

  const title = doc.info?.title || params.label || 'OpenAPI Specification';
  const licenseSpdx = doc.info?.license?.name;
  const securityEntries = Object.entries(doc.components?.securitySchemes ?? {});
  const authScheme = securityEntries.length > 0
    ? securityEntries.map(([name, s]) => `${name} (${s.scheme || s.type || 'auth'})`).join(', ')
    : undefined;

  const endpoints: Array<{ method: string; path: string; summary?: string }> = [];
  for (const [routePath, methodsObj] of Object.entries(doc.paths ?? {})) {
    for (const [method, meta] of Object.entries(methodsObj ?? {})) {
      const upper = method.toUpperCase();
      if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(upper)) {
        endpoints.push({
          method: upper,
          path: routePath,
          summary: meta?.summary || meta?.description,
        });
      }
    }
  }

  const webhookNames = Object.keys(doc.webhooks ?? {});
  const schemaNames = Object.keys(doc.components?.schemas ?? {});

  const entryId = 'openapi-entry';
  const nodes: IntelligenceNode[] = [
    {
      id: entryId,
      label: title,
      category: 'OpenAPI Spec',
      layer: 'entry',
      description: `${endpoints.length} REST endpoint(s), ${webhookNames.length} webhook(s), and ${schemaNames.length} schema model(s).`,
      confidence: 'detected',
      evidence: `Parsed OpenAPI paths & components from ${params.locator}`,
      urlOrPath: params.locator,
      entityType: 'api',
      verificationStatus: 'verified',
      contract: {
        authScheme,
        license: licenseSpdx,
        envVarsRequired: authScheme ? ['API_BEARER_TOKEN'] : [],
      },
    },
  ];

  const edges: IntelligenceEdge[] = [];

  if (authScheme) {
    nodes.push({
      id: 'openapi-auth',
      label: `API Security: ${authScheme}`,
      category: 'Auth Scheme',
      layer: 'logic',
      description: `Declared OpenAPI securitySchemes requiring ${authScheme}.`,
      confidence: 'detected',
      evidence: `components.securitySchemes in ${params.locator}`,
      entityType: 'auth_flow',
      verificationStatus: 'verified',
      contract: { authScheme, envVarsRequired: ['API_BEARER_TOKEN'] },
    });
    edges.push({
      id: 'e-openapi-auth',
      source: entryId,
      target: 'openapi-auth',
      label: 'authenticates via',
      relationshipType: 'auth',
      semanticRelation: 'AUTHENTICATES_WITH',
      confidence: 'detected',
      verificationStatus: 'verified',
    });
  }

  endpoints.slice(0, 6).forEach((ep, idx) => {
    const id = `openapi-ep-${idx + 1}`;
    const isWebhook = ep.path.toLowerCase().includes('webhook');
    nodes.push({
      id,
      label: `${ep.method} ${ep.path}`,
      category: isWebhook ? 'Webhook Endpoint' : 'API Endpoint',
      layer: 'logic',
      description: ep.summary || `OpenAPI operation ${ep.method} ${ep.path}`,
      confidence: 'detected',
      evidence: `paths["${ep.path}"].${ep.method.toLowerCase()}`,
      urlOrPath: ep.path,
      entityType: isWebhook ? 'webhook' : 'api',
      verificationStatus: 'verified',
    });
    edges.push({
      id: `e-openapi-ep-${idx + 1}`,
      source: entryId,
      target: id,
      label: isWebhook ? 'triggers webhook' : 'exposes endpoint',
      relationshipType: 'dataflow',
      semanticRelation: isWebhook ? 'TRIGGERS' : 'CONTAINS',
      confidence: 'detected',
      verificationStatus: 'verified',
    });
  });

  webhookNames.slice(0, 3).forEach((hookName, idx) => {
    const id = `openapi-hook-${idx + 1}`;
    nodes.push({
      id,
      label: `Webhook: ${hookName}`,
      category: 'Webhook Event',
      layer: 'external',
      description: doc.webhooks?.[hookName]?.post?.summary || `Outbound webhook event ${hookName}`,
      confidence: 'detected',
      evidence: `webhooks["${hookName}"]`,
      urlOrPath: `/webhooks/${hookName}`,
      entityType: 'webhook',
      verificationStatus: 'verified',
    });
    edges.push({
      id: `e-openapi-hook-${idx + 1}`,
      source: entryId,
      target: id,
      label: 'emits event',
      relationshipType: 'dataflow',
      semanticRelation: 'TRIGGERS',
      confidence: 'detected',
      verificationStatus: 'verified',
    });
  });

  schemaNames.slice(0, 4).forEach((schemaName, idx) => {
    const id = `openapi-model-${idx + 1}`;
    nodes.push({
      id,
      label: `Model: ${schemaName}`,
      category: 'DTO Schema',
      layer: 'data',
      description: `OpenAPI component schema ${schemaName}`,
      confidence: 'detected',
      evidence: `components.schemas.${schemaName}`,
      entityType: 'data_model',
      verificationStatus: 'verified',
    });
    edges.push({
      id: `e-openapi-model-${idx + 1}`,
      source: endpoints.length > 0 ? 'openapi-ep-1' : entryId,
      target: id,
      label: 'returns / accepts',
      relationshipType: 'dependency',
      semanticRelation: 'REFERENCES',
      confidence: 'detected',
      verificationStatus: 'verified',
    });
  });

  const techStack: TechItem[] = [
    {
      name: 'OpenAPI 3',
      category: 'API / Protocol',
      confidence: 'detected',
      evidence: `Parsed OpenAPI spec (${endpoints.length} endpoints)`,
    },
  ];
  if (webhookNames.length > 0 || endpoints.some((e) => e.path.includes('webhook'))) {
    techStack.push({
      name: 'Webhooks',
      category: 'API / Protocol',
      confidence: 'detected',
      evidence: `Detected ${webhookNames.length} declared webhook event(s)`,
    });
  }

  return {
    id: `conn-openapi-${Date.now()}`,
    kind: endpoints.length > 0 ? 'openapi_spec' : 'webhook_endpoint',
    connectorId: 'openapi-webhook',
    label: title,
    locator: params.locator,
    summary: `OpenAPI specification "${title}" exposing ${endpoints.length} endpoints, ${webhookNames.length} webhooks, and ${schemaNames.length} component schemas.`,
    licenseSpdx,
    authScheme,
    envVarsRequired: authScheme ? ['API_BEARER_TOKEN'] : [],
    endpoints,
    nodes,
    edges,
    techStack,
    warnings: [],
    ingestedAt: new Date().toISOString(),
  };
}

export const openApiWebhookConnector: SourceConnector<ConnectorInput> = {
  capability: {
    id: 'openapi-webhook',
    kind: 'openapi_spec',
    name: 'OpenAPI & Webhook Spec Connector',
    description: 'Extracts REST endpoints, DTO schemas, webhook events, and auth schemes from OpenAPI JSON.',
    readOnly: true,
    requiresAuth: false,
  },
  validateInput(input) {
    if (input.usePreset) return { valid: true };
    if (input.rawContent?.trim()) return { valid: true };
    if (input.urlOrLocator?.trim()) return { valid: true };
    return { valid: false, reason: 'Provide an OpenAPI JSON URL or paste an OpenAPI specification.' };
  },
  async ingest(input) {
    if (input.usePreset) {
      return parseOpenApiSpecToArtifact({
        rawJson: SAMPLE_OPENAPI_SPEC,
        locator: 'preset://acme-saas-openapi.json',
        label: input.label || 'Acme Billing & Webhook OpenAPI',
      });
    }

    if (input.rawContent?.trim()) {
      return parseOpenApiSpecToArtifact({
        rawJson: input.rawContent,
        locator: input.urlOrLocator || 'inline://openapi.json',
        label: input.label,
      });
    }

    const res = await safeFetchPublic(
      input.urlOrLocator!.trim(),
      { headers: { Accept: 'application/json' } },
      { timeoutMs: 10000, maxRedirects: 4, maxBytes: 1024 * 1024 },
    );
    if (!res.ok) {
      throw new Error(`OpenAPI spec fetch failed with HTTP ${res.status}.`);
    }
    const text = await res.text();
    return parseOpenApiSpecToArtifact({
      rawJson: text,
      locator: input.urlOrLocator!.trim(),
      label: input.label,
    });
  },
};
