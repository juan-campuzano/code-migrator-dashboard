-- 002_freshness_scores.sql
-- Adds tables for dependency freshness scoring
-- Stores repository-level grades and per-dependency score breakdowns

-- Repository-level freshness summary
CREATE TABLE repository_freshness (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID NOT NULL REFERENCES repositories(id),
    ingestion_id UUID REFERENCES ingestions(id),
    grade VARCHAR(1) NOT NULL CHECK (grade IN ('A', 'B', 'C', 'D', 'E')),
    weighted_average NUMERIC(5, 2) NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id)
);

-- Per-dependency freshness scores
CREATE TABLE dependency_freshness_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    freshness_id UUID NOT NULL REFERENCES repository_freshness(id) ON DELETE CASCADE,
    dependency_name VARCHAR(255) NOT NULL,
    ecosystem VARCHAR(50) NOT NULL,
    resolved_version VARCHAR(100),
    latest_version VARCHAR(100),
    score INTEGER CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
    dependency_type VARCHAR(20) NOT NULL CHECK (dependency_type IN ('production', 'development')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('scored', 'unresolved', 'unpinned', 'error')),
    error_details TEXT
);

CREATE INDEX idx_dep_freshness_freshness_id ON dependency_freshness_scores(freshness_id);
CREATE INDEX idx_repo_freshness_repo_id ON repository_freshness(repository_id);
