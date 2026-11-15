import type {
  ConnectedConnectorArtifact,
  IntelligenceEdge,
  IntelligenceNode,
} from '../types';
import type { ConnectorInput, SourceConnector } from './types';

export const SAMPLE_DOC_CONFIG = `# SLASH SaaS Platform Architecture & Environment Config
AUTH_PROVIDER=nextauth
NEXTAUTH_SECRET=replace_with_secret
STRIPE_SECRET_KEY=replace_with_stripe_key
DATABASE_URL=postgresql://user:pass@localhost:5432/slash`;

export function parseDocumentOrConfigText(params: {
  rawText: string;
  locator?: string;
  label?: string;
}): ConnectedConnectorArtifact {
  const text = params.rawText.trim();
  if (!text) {
    throw new Error('Provide configuration (.env.example, docker-compose.yml) or Markdown documentation text.');
  }

  // Extract env variable KEY names ONLY—never store or pass secret values
  const envKeys: string[] = [];
  let detectedAuth: string | undefined;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const envMatch = line.match(/^([A-Z][A-Z0-9_]{2,})\s*=/);
    if (envMatch) {
      const key = envMatch[1];
      if (!envKeys.includes(key)) {
        envKeys.push(key);
      }
      if (/NEXTAUTH/i.test(key)) detectedAuth = 'NextAuth';
      else if (/CLERK/i.test(key)) detectedAuth = 'Clerk';
      else if (/FIREBASE/i.test(key)) detectedAuth = 'Firebase Auth';
      else if (/JWT|OAUTH/i.test(key) && !detectedAuth) detectedAuth = 'OAuth2 / JWT';
    }
  }

  const headings = text
    .split('\n')
    .filter((l) => /^#{1,3}\s+/.test(l.trim()))
    .map((l) => l.replace(/^#{1,3}\s+/, '').trim())
    .slice(0, 6);

  const label =
    params.label ||
    headings[0] ||
    (envKeys.length > 0 ? `Config Spec (${envKeys.length} keys)` : 'Documentation Artifact');
  const locator = params.locator || 'inline://config-spec.md';

  const nodes: IntelligenceNode[] = [
    {
      id: 'doc-root',
      label,
      category: 'Docs & Config',
      layer: 'entry',
      description: `Extracted ${envKeys.length} environment key name(s) (values redacted) and ${headings.length} section heading(s).`,
      confidence: 'detected',
      evidence: `Parsed text document (${text.length} chars); secret values redacted`,
      urlOrPath: locator,
      entityType: 'document',
      verificationStatus: 'verified',
      contract: {
        authScheme: detectedAuth,
        envVarsRequired: envKeys,
      },
    },
  ];

  const edges: IntelligenceEdge[] = [];

  if (detectedAuth) {
    nodes.push({
      id: 'doc-auth-ref',
      label: `Config Auth: ${detectedAuth}`,
      category: 'Auth Config',
      layer: 'logic',
      description: `Environment configuration references ${detectedAuth}.`,
      confidence: 'detected',
      evidence: `Matched env key signature for ${detectedAuth}`,
      entityType: 'auth_flow',
      verificationStatus: 'verified',
      contract: { authScheme: detectedAuth, envVarsRequired: envKeys },
    });
    edges.push({
      id: 'e-doc-auth',
      source: 'doc-root',
      target: 'doc-auth-ref',
      label: 'configures auth',
      relationshipType: 'auth',
      semanticRelation: 'DOCUMENTS',
      confidence: 'detected',
      verificationStatus: 'verified',
    });
  }

  return {
    id: `conn-doc-${Date.now()}`,
    kind: 'document_pdf',
    connectorId: 'document-config',
    label,
    locator,
    summary: `Document & configuration spec declaring ${envKeys.length} required env var(s) with values redacted.`,
    authScheme: detectedAuth,
    envVarsRequired: envKeys,
    nodes,
    edges,
    techStack: detectedAuth
      ? [
          {
            name: detectedAuth,
            category: 'Auth / Security',
            confidence: 'detected',
            evidence: `Config key reference in ${locator}`,
          },
        ]
      : [],
    warnings: envKeys.length > 0 ? ['Secret values automatically redacted; only key names are retained.'] : [],
    ingestedAt: new Date().toISOString(),
  };
}

export const documentConfigConnector: SourceConnector<ConnectorInput> = {
  capability: {
    id: 'document-config',
    kind: 'document_pdf',
    name: 'Docs & Config Connector',
    description: 'Extracts architecture headings and required env key names (redacting secret values).',
    readOnly: true,
    requiresAuth: false,
  },
  validateInput(input) {
    if (input.usePreset) return { valid: true };
    if (input.rawContent?.trim()) return { valid: true };
    return { valid: false, reason: 'Paste Markdown, .env.example, or config content.' };
  },
  async ingest(input) {
    return parseDocumentOrConfigText({
      rawText: input.usePreset ? SAMPLE_DOC_CONFIG : input.rawContent || '',
      locator: input.urlOrLocator || 'inline://config.md',
      label: input.label,
    });
  },
};
