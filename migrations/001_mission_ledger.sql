CREATE TABLE IF NOT EXISTS missions (
  id text PRIMARY KEY,
  run_id text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'running',
  prompt_version text NOT NULL,
  model_requested text NOT NULL,
  dossier_manifest jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  total_latency_ms integer NOT NULL DEFAULT 0,
  total_input_tokens integer NOT NULL DEFAULT 0,
  total_output_tokens integer NOT NULL DEFAULT 0,
  total_retries integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  error_message text
);

CREATE TABLE IF NOT EXISTS reports (
  id text PRIMARY KEY,
  mission_id text NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  request_id text NOT NULL,
  sequence integer NOT NULL,
  stage text NOT NULL,
  role text NOT NULL,
  prompt_version text NOT NULL,
  model text NOT NULL,
  response_id text,
  report jsonb NOT NULL,
  latency_ms integer NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  retries integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mission_id, sequence),
  UNIQUE (mission_id, request_id)
);

CREATE TABLE IF NOT EXISTS evaluations (
  id text PRIMARY KEY,
  mission_id text UNIQUE NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  evaluator_version text NOT NULL,
  scores jsonb NOT NULL,
  overall_score integer NOT NULL,
  findings jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS missions_started_at_idx ON missions(started_at DESC);
CREATE INDEX IF NOT EXISTS reports_mission_sequence_idx ON reports(mission_id, sequence);
