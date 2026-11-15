import type {
  ConnectedConnectorArtifact,
  ConnectorSourceKind,
} from '../types';

export interface ConnectorCapability {
  id: string;
  kind: ConnectorSourceKind;
  name: string;
  description: string;
  readOnly: true;
  requiresAuth: boolean;
}

export interface ConnectorInput {
  kind: ConnectorSourceKind;
  label?: string;
  urlOrLocator?: string;
  rawContent?: string;
  usePreset?: boolean;
}

export interface SourceConnector<TInput = ConnectorInput> {
  capability: ConnectorCapability;
  validateInput(input: TInput): { valid: boolean; reason?: string };
  ingest(input: TInput): Promise<ConnectedConnectorArtifact>;
}
