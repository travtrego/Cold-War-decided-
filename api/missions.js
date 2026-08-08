import { requireAccess } from './_auth.js';
import { databaseConfigured, getSql, id, safeJson } from './_db.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (!requireAccess(request, response)) return;
  if (!databaseConfigured()) return response.status(503).json({ error: 'Mission database is not configured.', code: 'DATABASE_NOT_CONFIGURED' });
  const sql = getSql();
  try {
    if (request.method === 'POST') {
      const missionId = id('msn');
      const runId = id('run');
      const promptVersion = String(request.body?.promptVersion || 'cold-war-pipeline-v5-action-thresholds').slice(0, 80);
      const model = String(process.env.OPENAI_MODEL || 'gpt-5-mini').slice(0, 100);
      const manifest = Array.isArray(request.body?.dossierManifest) ? request.body.dossierManifest.slice(0, 20) : [];
      await sql`INSERT INTO missions (id, run_id, prompt_version, model_requested, dossier_manifest)
        VALUES (${missionId}, ${runId}, ${promptVersion}, ${model}, ${safeJson(manifest)}::jsonb)`;
      return response.status(201).json({ missionId, runId, promptVersion });
    }
    if (request.method === 'GET') {
      const rows = await sql`SELECT id, run_id, status, prompt_version, model_requested, started_at, completed_at,
        total_latency_ms, total_input_tokens, total_output_tokens, total_retries, estimated_cost_usd
        FROM missions ORDER BY started_at DESC LIMIT 50`;
      return response.status(200).json({ missions: rows });
    }
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error('Mission API failure', error);
    return response.status(500).json({ error: 'Mission storage operation failed.' });
  }
}
