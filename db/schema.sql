-- SLASH Universal Digital Integration & App Composer
-- Open-Source PostgreSQL 17 + pgvector + Apache AGE Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS age;

LOAD 'age';
SET search_path = ag_catalog, "$user", public;

SELECT create_graph('slash_universal_graph');

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  goal_prompt TEXT,
  target_stack_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS data_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (
    source_type IN (
      'github_public_repo',
      'github_private_repo',
      'website_url',
      'openapi_spec',
      'webhook_endpoint',
      'database_schema',
      'document_pdf',
      'tech_csv'
    )
  ),
  label TEXT NOT NULL,
  uri TEXT NOT NULL,
  license_spdx TEXT,
  auth_scheme TEXT,
  sync_status TEXT NOT NULL DEFAULT 'indexed',
  snapshot_hash TEXT,
  last_indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_artifacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL,
  raw_hash TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding_vector vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS composition_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_prompt TEXT NOT NULL,
  architecture_spec_json JSONB NOT NULL,
  conflict_report_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  approval_status TEXT NOT NULL DEFAULT 'draft' CHECK (
    approval_status IN ('draft', 'approved', 'rejected')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS generated_builds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES composition_plans(id) ON DELETE CASCADE,
  validation_mode TEXT NOT NULL DEFAULT 'static-contract',
  sandbox_job_id TEXT,
  test_results_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  artifact_manifest_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_sources_workspace ON data_sources(workspace_id);
CREATE INDEX IF NOT EXISTS idx_source_artifacts_source ON source_artifacts(source_id);
CREATE INDEX IF NOT EXISTS idx_composition_plans_workspace ON composition_plans(workspace_id);
