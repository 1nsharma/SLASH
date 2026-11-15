import type {
  ConnectedConnectorArtifact,
  IntelligenceEdge,
  IntelligenceNode,
} from '../types';
import type { ConnectorInput, SourceConnector } from './types';

export const SAMPLE_DATABASE_SCHEMA = `// Prisma + PostgreSQL Multi-Tenant SaaS Schema
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String        @id @default(cuid())
  email        String        @unique
  role         String        @default("member")
  subscriptions Subscription[]
  apiKeys      ApiKey[]
}

model Subscription {
  id         String   @id @default(cuid())
  userId     String
  planTier   String
  status     String
  user       User     @relation(fields: [userId], references: [id])
}

model ApiKey {
  id        String   @id @default(cuid())
  userId    String
  hashedKey String   @unique
  user      User     @relation(fields: [userId], references: [id])
}`;

interface ParsedTable {
  name: string;
  columns: string[];
  relations: string[];
}

export function parseDatabaseSchemaText(params: {
  schemaText: string;
  locator?: string;
  label?: string;
}): ConnectedConnectorArtifact {
  const text = params.schemaText.trim();
  if (!text) {
    throw new Error('Provide SQL DDL (CREATE TABLE) or Prisma schema definitions.');
  }

  const tables: ParsedTable[] = [];
  const envVarsRequired: string[] = [];

  // Extract env("...") references safely (names only)
  const envRegex = /env\(["']([A-Z0-9_]+)["']\)/g;
  let envMatch: RegExpExecArray | null;
  while ((envMatch = envRegex.exec(text)) !== null) {
    if (!envVarsRequired.includes(envMatch[1])) {
      envVarsRequired.push(envMatch[1]);
    }
  }
  if (envVarsRequired.length === 0) {
    envVarsRequired.push('DATABASE_URL');
  }

  // 1. Parse Prisma models
  const prismaModelRegex = /model\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([\s\S]*?)\}/g;
  let m: RegExpExecArray | null;
  while ((m = prismaModelRegex.exec(text)) !== null) {
    const tableName = m[1];
    const body = m[2];
    const columns: string[] = [];
    const relations: string[] = [];

    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('//') || line.startsWith('@@')) continue;
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        columns.push(`${parts[0]}: ${parts[1]}`);
      }
      const relMatch = line.match(/@relation\([^)]*fields:\s*\[([^\]]+)\]/);
      const typeName = parts[1]?.replace(/[?[\]]/g, '');
      if (relMatch && typeName) {
        relations.push(typeName);
      }
    }
    tables.push({ name: tableName, columns, relations });
  }

  // 2. Parse SQL CREATE TABLE statements
  if (tables.length === 0) {
    const sqlRegex = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+["`]?([A-Za-z0-9_.]+)["`]?\s*\(([\s\S]*?)\)\s*;/gi;
    while ((m = sqlRegex.exec(text)) !== null) {
      const tableName = m[1].replace(/^public\./i, '');
      const body = m[2];
      const columns: string[] = [];
      const relations: string[] = [];

      for (const rawLine of body.split(',')) {
        const line = rawLine.trim();
        if (!line) continue;
        const refMatch = line.match(/REFERENCES\s+["`]?([A-Za-z0-9_.]+)["`]?/i);
        if (refMatch) {
          relations.push(refMatch[1].replace(/^public\./i, ''));
        }
        if (/^(PRIMARY|FOREIGN|UNIQUE|CONSTRAINT|CHECK)\b/i.test(line)) continue;
        const colMatch = line.match(/^["`]?([A-Za-z_][A-Za-z0-9_]*)["`]?\s+([A-Za-z0-9_()]+)/);
        if (colMatch) {
          columns.push(`${colMatch[1]}: ${colMatch[2]}`);
        }
      }
      tables.push({ name: tableName, columns, relations });
    }
  }

  if (tables.length === 0) {
    throw new Error(
      'No Prisma models or SQL CREATE TABLE statements were detected in the provided schema.',
    );
  }

  const dialect = /provider\s*=\s*["']postgresql["']|SERIAL|TIMESTAMPTZ|JSONB/i.test(text)
    ? 'PostgreSQL'
    : /sqlite/i.test(text)
      ? 'SQLite'
      : 'SQL Schema';

  const entryId = 'db-schema-root';
  const label = params.label || `${dialect} Schema (${tables.length} tables)`;
  const locator = params.locator || 'inline://schema.prisma';

  const nodes: IntelligenceNode[] = [
    {
      id: entryId,
      label,
      category: 'Database Schema',
      layer: 'data',
      description: `${dialect} schema defining ${tables.length} table(s): ${tables.map((t) => t.name).join(', ')}.`,
      confidence: 'detected',
      evidence: `Parsed ${tables.length} model/table definition(s) from ${locator}`,
      urlOrPath: locator,
      entityType: 'database_schema',
      verificationStatus: 'verified',
      contract: {
        runtime: dialect,
        envVarsRequired,
      },
    },
  ];

  const edges: IntelligenceEdge[] = [];
  const tableIdMap = new Map<string, string>();

  tables.slice(0, 10).forEach((t, idx) => {
    const id = `db-table-${idx + 1}`;
    tableIdMap.set(t.name.toLowerCase(), id);
    nodes.push({
      id,
      label: `Table: ${t.name}`,
      category: 'Data Model',
      layer: 'data',
      description: `Columns (${t.columns.length}): ${t.columns.slice(0, 5).join(', ')}`,
      confidence: 'detected',
      evidence: `Schema definition for ${t.name}`,
      urlOrPath: `/db/${t.name.toLowerCase()}`,
      entityType: 'data_model',
      verificationStatus: 'verified',
    });
    edges.push({
      id: `e-db-contains-${idx + 1}`,
      source: entryId,
      target: id,
      label: 'defines model',
      relationshipType: 'dependency',
      semanticRelation: 'CONTAINS',
      confidence: 'detected',
      verificationStatus: 'verified',
    });
  });

  tables.slice(0, 10).forEach((t) => {
    const fromId = tableIdMap.get(t.name.toLowerCase());
    if (!fromId) return;
    t.relations.forEach((targetName, rIdx) => {
      const toId = tableIdMap.get(targetName.toLowerCase());
      if (toId && toId !== fromId) {
        edges.push({
          id: `e-db-rel-${fromId}-${toId}-${rIdx}`,
          source: fromId,
          target: toId,
          label: 'foreign key',
          relationshipType: 'dataflow',
          semanticRelation: 'REFERENCES',
          confidence: 'detected',
          verificationStatus: 'verified',
        });
      }
    });
  });

  return {
    id: `conn-db-${Date.now()}`,
    kind: 'database_schema',
    connectorId: 'database-schema',
    label,
    locator,
    summary: `${dialect} data model with ${tables.length} tables (${tables.map((t) => t.name).join(', ')}).`,
    runtime: dialect,
    envVarsRequired,
    tables,
    nodes,
    edges,
    techStack: [
      {
        name: dialect,
        category: 'Infrastructure',
        confidence: 'detected',
        evidence: `Parsed schema definition (${tables.length} tables)`,
      },
      ...(text.includes('model ')
        ? [
            {
              name: 'Prisma ORM',
              category: 'API / Protocol' as const,
              confidence: 'detected' as const,
              evidence: 'Detected Prisma model blocks in schema',
            },
          ]
        : []),
    ],
    warnings: [],
    ingestedAt: new Date().toISOString(),
  };
}

export const databaseSchemaConnector: SourceConnector<ConnectorInput> = {
  capability: {
    id: 'database-schema',
    kind: 'database_schema',
    name: 'Database Schema Connector (SQL / Prisma)',
    description: 'Offline-first parser for SQL DDL and Prisma schemas with foreign-key relationship mapping.',
    readOnly: true,
    requiresAuth: false,
  },
  validateInput(input) {
    if (input.usePreset) return { valid: true };
    if (input.rawContent?.trim()) return { valid: true };
    return { valid: false, reason: 'Paste SQL CREATE TABLE DDL or Prisma schema text.' };
  },
  async ingest(input) {
    return parseDatabaseSchemaText({
      schemaText: input.usePreset ? SAMPLE_DATABASE_SCHEMA : input.rawContent || '',
      locator: input.urlOrLocator || (input.usePreset ? 'preset://saas-schema.prisma' : 'inline://schema.sql'),
      label: input.label,
    });
  },
};
