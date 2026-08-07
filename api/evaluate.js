import { requireAccess } from './_auth.js';
import { getSql, id, safeJson } from './_db.js';

const VERSION = 'rule-evaluator-v1';
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

function evaluate(reports) {
  const parsed = reports.map((row) => row.report);
  const revisions = reports.filter((row) => row.stage === 'specialist_revision');
  const initials = reports.filter((row) => row.stage === 'specialist_initial');
  const ci = parsed.find((r) => r.stage === 'counterintelligence');
  const final = parsed.find((r) => r.stage === 'chief_final');
  const evidence = parsed.flatMap((r) => r.evidence_used || []);
  const uncertainty = parsed.flatMap((r) => r.uncertainties || []);
  const confidence = parsed.map((r) => Number(r.confidence)).filter(Number.isFinite);
  const scores = {
    evidence_use: clamp(45 + evidence.length * 2),
    specialization: clamp(40 + new Set(reports.slice(0, 12).map((r) => r.role)).size * 12),
    calibration: clamp(45 + uncertainty.length * 2 - confidence.filter((n) => n > 90).length * 8),
    contradiction_detection: clamp(35 + (ci?.rationale?.length || 0) * 8 + (ci?.uncertainties?.length || 0) * 5),
    clarity: clamp(55 + parsed.filter((r) => r.conclusion && r.rationale?.length).length * 3),
    revision_quality: clamp(30 + revisions.length * 12 + Math.min(initials.length, revisions.length) * 5),
    independence: clamp(45 + new Set(initials.map((r) => r.role)).size * 10 + (final ? 10 : 0)),
  };
  const overall = clamp(Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length);
  const findings = [
    `${reports.length}/14 expected pipeline reports were preserved.`,
    revisions.length === 4 ? 'All four controlled revisions are present.' : 'One or more controlled revisions are missing.',
    ci && final ? 'Counterintelligence precedes the final synthesis.' : 'Red-team or final synthesis evidence is incomplete.',
  ];
  return { scores, overall, findings };
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  if (!requireAccess(request, response)) return;
  const missionId = String(request.body?.missionId || '').slice(0, 80);
  try {
    const sql = getSql();
    const reports = await sql`SELECT stage, role, sequence, report FROM reports WHERE mission_id = ${missionId} ORDER BY sequence`;
    const result = evaluate(reports);
    await sql`INSERT INTO evaluations (id, mission_id, evaluator_version, scores, overall_score, findings)
      VALUES (${id('eval')}, ${missionId}, ${VERSION}, ${safeJson(result.scores)}::jsonb, ${result.overall}, ${safeJson(result.findings)}::jsonb)
      ON CONFLICT (mission_id) DO UPDATE SET evaluator_version = EXCLUDED.evaluator_version, scores = EXCLUDED.scores,
      overall_score = EXCLUDED.overall_score, findings = EXCLUDED.findings, created_at = now()`;
    await sql`UPDATE missions SET status = 'completed', completed_at = now() WHERE id = ${missionId}`;
    return response.status(200).json({ evaluatorVersion: VERSION, ...result });
  } catch (error) {
    console.error('Evaluation failure', error);
    return response.status(500).json({ error: 'Mission evaluation failed.' });
  }
}
