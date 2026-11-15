import { databaseSchemaConnector } from './database';
import { documentConfigConnector } from './document';
import { openApiWebhookConnector } from './openapi';
import type { ConnectorCapability, ConnectorInput } from './types';
import type { ConnectedConnectorArtifact } from '../types';

export const CONNECTOR_CAPABILITIES: ConnectorCapability[] = [
  openApiWebhookConnector.capability,
  databaseSchemaConnector.capability,
  documentConfigConnector.capability,
];

export async function ingestConnectorSource(
  input: ConnectorInput,
): Promise<ConnectedConnectorArtifact> {
  if (input.kind === 'openapi_spec' || input.kind === 'webhook_endpoint') {
    const check = openApiWebhookConnector.validateInput(input);
    if (!check.valid) throw new Error(check.reason || 'Invalid OpenAPI input.');
    return openApiWebhookConnector.ingest(input);
  }

  if (input.kind === 'database_schema') {
    const check = databaseSchemaConnector.validateInput(input);
    if (!check.valid) throw new Error(check.reason || 'Invalid database schema input.');
    return databaseSchemaConnector.ingest(input);
  }

  if (input.kind === 'document_pdf') {
    const check = documentConfigConnector.validateInput(input);
    if (!check.valid) throw new Error(check.reason || 'Invalid document/config input.');
    return documentConfigConnector.ingest(input);
  }

  throw new Error(`Unsupported connector kind: ${input.kind}`);
}

export {
  databaseSchemaConnector,
  documentConfigConnector,
  openApiWebhookConnector,
};
