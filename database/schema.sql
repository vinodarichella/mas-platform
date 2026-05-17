-- MAS Platform Database Schema
-- PostgreSQL 16+

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- vector extension required for user_memory embeddings (install pgvector)
CREATE EXTENSION IF NOT EXISTS "vector";

-- ─── Users ────────────────────────────────────────────────────────────────────

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    preferences     JSONB DEFAULT '{}',
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── Sessions ─────────────────────────────────────────────────────────────────

CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL DEFAULT 'New Session',
    workflow_id     UUID,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    last_active_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── Messages (conversation history per session) ──────────────────────────────

CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    run_id          UUID,
    role            VARCHAR(20) NOT NULL CHECK (role IN ('user', 'agent', 'system')),
    content         TEXT NOT NULL,
    metadata        JSONB DEFAULT '{}',
    sequence_id     BIGINT NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_sequence   ON messages(session_id, sequence_id);

-- ─── User Memory (cross-session, Mem0 backed) ────────────────────────────────

CREATE TABLE user_memory (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key         VARCHAR(255) NOT NULL,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, key)
);

CREATE INDEX idx_user_memory_user ON user_memory(user_id);

-- ─── Agents ──────────────────────────────────────────────────────────────────

CREATE TABLE agents (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                        VARCHAR(255) NOT NULL,
    instructions                TEXT,
    provider                    VARCHAR(50) NOT NULL DEFAULT 'openai',
    model                       VARCHAR(100) NOT NULL DEFAULT 'gpt-4o',
    tools                       JSONB DEFAULT '[]',
    skills                      JSONB DEFAULT '[]',
    middleware                   JSONB DEFAULT '[]',
    memory_enabled              BOOLEAN NOT NULL DEFAULT true,
    run_mode                    VARCHAR(20) NOT NULL DEFAULT 'interactive'
                                    CHECK (run_mode IN ('interactive', 'background')),
    max_run_duration_minutes    INT NOT NULL DEFAULT 30,
    personalization_prompt      TEXT,
    metadata                    JSONB DEFAULT '{}',
    created_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agents_user_id ON agents(user_id);

-- ─── Workflows ────────────────────────────────────────────────────────────────

CREATE TABLE workflows (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    orchestration_type  VARCHAR(50) NOT NULL DEFAULT 'declarative'
                            CHECK (orchestration_type IN (
                                'sequential','concurrent','handoff',
                                'groupchat','magentic','declarative'
                            )),
    graph_json          JSONB DEFAULT '{"nodes":[],"edges":[]}',
    yaml_content        TEXT,
    is_template         BOOLEAN NOT NULL DEFAULT false,
    template_category   VARCHAR(100),
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflows_user_id    ON workflows(user_id);
CREATE INDEX idx_workflows_templates  ON workflows(is_template) WHERE is_template = true;

-- ─── Runs ─────────────────────────────────────────────────────────────────────

CREATE TABLE runs (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id                  UUID REFERENCES sessions(id) ON DELETE SET NULL,
    workflow_id                 UUID REFERENCES workflows(id) ON DELETE SET NULL,
    user_id                     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status                      VARCHAR(30) NOT NULL DEFAULT 'queued'
                                    CHECK (status IN (
                                        'queued','running','paused_hitl',
                                        'completed','failed','cancelled'
                                    )),
    job_type                    VARCHAR(20) NOT NULL DEFAULT 'interactive'
                                    CHECK (job_type IN ('interactive','background')),
    last_event_seq              BIGINT NOT NULL DEFAULT 0,
    checkpoint_data             JSONB,
    input_data                  JSONB DEFAULT '{}',
    output_data                 JSONB,
    error_message               TEXT,
    estimated_duration_minutes  INT,
    started_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at                TIMESTAMP
);

CREATE INDEX idx_runs_session_id   ON runs(session_id);
CREATE INDEX idx_runs_workflow_id  ON runs(workflow_id);
CREATE INDEX idx_runs_user_id      ON runs(user_id);
CREATE INDEX idx_runs_status       ON runs(status);

-- ─── Run Events (event journal for replay on reconnect) ──────────────────────

CREATE TABLE run_events (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id      UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    sequence_id BIGINT NOT NULL,
    event_type  VARCHAR(50) NOT NULL,
                -- thinking | tool_call | tool_result | step_start | step_end
                -- agent_message | hitl_request | progress | error | completed
    payload     JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(run_id, sequence_id)
);

CREATE INDEX idx_run_events_run_id   ON run_events(run_id);
CREATE INDEX idx_run_events_sequence ON run_events(run_id, sequence_id);

-- ─── Templates (seeded pre-built workflows) ──────────────────────────────────

CREATE TABLE templates (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    category            VARCHAR(100),
    orchestration_type  VARCHAR(50) NOT NULL,
    graph_json          JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
    yaml_content        TEXT,
    thumbnail_url       VARCHAR(500),
    is_builtin          BOOLEAN NOT NULL DEFAULT false,
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_templates_category ON templates(category);

-- ─── HITL requests (replaces Redis for HITL signalling) ──────────────────────

CREATE TABLE hitl_requests (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id      UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    prompt      TEXT NOT NULL,
    response    JSONB,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'responded')),
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMP
);

CREATE INDEX idx_hitl_run_id ON hitl_requests(run_id, status);

-- ─── Notify trigger: fires on run_events insert so Python SSE tail wakes up ──

CREATE OR REPLACE FUNCTION notify_run_event()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('run_event_' || NEW.run_id::text, NEW.sequence_id::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_run_event
    AFTER INSERT ON run_events
    FOR EACH ROW EXECUTE FUNCTION notify_run_event();

-- ─── Triggers: auto-update updated_at ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_workflows_updated_at
    BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
