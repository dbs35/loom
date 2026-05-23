-- Practice Commons MVP — initial schema (Design Spec v1.2 §4)

-- Enums
CREATE TYPE object_type AS ENUM ('program', 'paper', 'question', 'specialist');
CREATE TYPE contribution_source AS ENUM ('per_page', 'general', 'voice_interview');
CREATE TYPE voice_session_status AS ENUM (
  'in_progress',
  'transcript_pending',
  'completed',
  'failed',
  'abandoned'
);

-- Objects
CREATE TABLE objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  type object_type NOT NULL,
  canonical_name TEXT NOT NULL,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  frontmatter JSONB NOT NULL DEFAULT '{}'::jsonb,
  body TEXT NOT NULL DEFAULT '',
  last_synthesized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (type, slug)
);
CREATE INDEX idx_objects_type ON objects (type);
CREATE INDEX idx_objects_canonical_name_lower ON objects (LOWER(canonical_name));

-- Contributions
CREATE TABLE contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source contribution_source NOT NULL,
  raw_input TEXT NOT NULL,
  page_context_type object_type,
  page_context_slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contributions_created_at ON contributions (created_at DESC);

-- Mentions
CREATE TABLE mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id UUID NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  contribution_id UUID NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  text_fragment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mentions_object_id ON mentions (object_id);
CREATE INDEX idx_mentions_contribution_id ON mentions (contribution_id);

-- Prompt overrides
CREATE TABLE prompt_overrides (
  name TEXT PRIMARY KEY,
  override_text TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Queries log
CREATE TABLE queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  cited_object_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  was_refusal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_queries_created_at ON queries (created_at DESC);
CREATE INDEX idx_queries_was_refusal ON queries (was_refusal);

-- Voice sessions — tracks in-progress and pending-transcript ElevenLabs interviews
CREATE TABLE voice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  conversation_id TEXT,
  page_context_type object_type,
  page_context_slug TEXT,
  contributor_expertise TEXT,
  system_prompt TEXT NOT NULL,
  first_message TEXT,
  status voice_session_status NOT NULL DEFAULT 'in_progress',
  contribution_id UUID REFERENCES contributions(id) ON DELETE SET NULL,
  retry_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_voice_sessions_status ON voice_sessions (status);
CREATE INDEX idx_voice_sessions_conversation_id ON voice_sessions (conversation_id);
CREATE INDEX idx_voice_sessions_created_at ON voice_sessions (created_at DESC);
