-- 001_initial_schema.sql
-- Initial database schema for Repository Metadata Dashboard
-- Creates all tables with constraints, indexes, and JSONB columns

-- Core repository record
CREATE TABLE repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('local', 'github', 'azure_devops')),
    source_identifier VARCHAR(1024) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ingestion tracking
CREATE TABLE ingestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID NOT NULL REFERENCES repositories(id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    error_details TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Detected languages with proportions
CREATE TABLE repository_languages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID NOT NULL REFERENCES repositories(id),
    language VARCHAR(100) NOT NULL,
    file_count INTEGER NOT NULL DEFAULT 0,
    proportion NUMERIC(5, 4) NOT NULL,
    UNIQUE (repository_id, language)
);

-- Detected frameworks
CREATE TABLE repository_frameworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID NOT NULL REFERENCES repositories(id),
    name VARCHAR(255) NOT NULL,
    version VARCHAR(100),
    UNIQUE (repository_id, name)
);

-- Dependencies grouped by ecosystem
CREATE TABLE repository_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID NOT NULL REFERENCES repositories(id),
    ecosystem VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    version_constraint VARCHAR(255),
    dependency_type VARCHAR(20) NOT NULL CHECK (dependency_type IN ('production', 'development')),
    UNIQUE (repository_id, ecosystem, name)
);

-- File tree stored as JSONB for flexible querying
CREATE TABLE repository_file_trees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID NOT NULL REFERENCES repositories(id) UNIQUE,
    tree JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Flexible metadata that varies by repo type (JSONB)
CREATE TABLE repository_metadata_extra (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID NOT NULL REFERENCES repositories(id) UNIQUE,
    metadata JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Access tokens for remote providers
CREATE TABLE access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(20) NOT NULL UNIQUE CHECK (provider IN ('github', 'azure_devops')),
    encrypted_token TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration records (placeholder for future migration agent phase)
CREATE TABLE migrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID NOT NULL REFERENCES repositories(id),
    migration_type VARCHAR(100) NOT NULL,
    parameters JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    result TEXT,
    error_details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
