import { requireAccess } from './_auth.js';
import { getSql, id, safeJson } from './_db.js';

const VERSION = 'rule-evaluator-v4-adjudicated-decisions';
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

const ACTIONS = {
  A: 'Keep monitoring',
  B: 'Quietly raise readiness',
  C: 'Issue a full NATO alert',
  D: 'Intercept the aircraft',
  E: 'Launch a covert operation',
  F: 'Launch the Ultimate NATO Naval Fleet of Doom',
};

const ADJUDICATIONS = {
  __default__: { actionId: 'B', rationale: 'Multiple concerning streams justify reversible readiness, but the evidence does not establish an imminent strategic attack.' },
  'operation-northern-glass.pdf': { actionId: 'A', rationale: 'Ambiguous exercise activity, shared-source risk, no sovereign-airspace violation, and no confirmed seabed interference remain below the readiness-escalation threshold.' },
  'operation-amber-circuit.pdf': { actionId: 'E', rationale: 'A specific possible rogue command network can be quietly tested and contained without degrading NATO warning coverage or publicly escalating.' },
  'operation-copper-lantern.pdf': { actionId: 'E', rationale: 'A bounded clandestine transfer or counterintelligence trap is best verified and contained through a targeted covert operation rather than broad military escalation.' },
};

function actionIdFromRecommendation(value = '') {
  const normalized = String(value).toLowerCase();
  const primaryAction = normalized.match(/primary action:\s*(.*?)(?:\.?\s*why:|$)/)?.[1] || normalized;
  return Object.entries(ACTIONS).find(([id, label]) => primaryAction.includes(label.toLowerCase()) || primaryAction.includes(`option ${id.toLowerCase()}`))?.[0] || null;
}

const BENCHMARKS = {
  'operation-northern-glass.pdf': [
    ['contact loss', 'lost contact', 'tracking error', 'terrain masking'],
    ['source dependency', 'same source', 'same briefing', 'contamination'],
    ['payload uncertain', 'pods', 'sensors or weapons', 'unidentified'],
    ['cable', 'seabed', 'acoustic array', 'sensor interference'],
    ['overreact', 'deception', 'visible exercise', 'non-hostile'],
  ],
  'operation-amber-circuit.pdf': [
    ['walk-in', 'unverified', 'requests money', 'source reliability'],
    ['backup circuit', 'exercise inject', 'operator error', 'spoofing'],
    ['no known ballistic', 'no ballistic missiles', 'signals-intelligence submarine'],
    ['inspection', 'communications failures', 'readiness drill'],
    ['cargo unknown', 'cannot identify', 'passengers or equipment'],
  ],
  'operation-copper-lantern.pdf': [
    ['controlled leak', 'double agent', 'deception', 'counterintelligence trap'],
    ['defective sonar', 'returning equipment', 'technology transfer'],
    ['radar gap', 'equipment cooling', 'scheduled handoff', 'concealment'],
    ['weight uncertainty', 'wind uncertainty', 'departed lighter'],
    ['no direct track', 'helicopter', 'unconnected'],
  ],
};

export function evaluate(reports, filename = '') {
  const parsed = reports.map((row) => row.report);
  const revisions = reports.filter((row) => row.stage === 'specialist_revision');
  const initials = reports.filter((row) => row.stage === 'specialist_initial');
  const ci = reports.find((row) => row.stage === 'counterintelligence')?.report;
  const final = reports.find((row) => row.stage === 'chief_final')?.report;
  const evidence = parsed.flatMap((r) => r.evidence_used || []);
  const uncertainty = parsed.flatMap((r) => r.uncertainties || []);
  const confidence = parsed.map((r) => Number(r.confidence)).filter(Number.isFinite);
  const citedEvidence = evidence.filter((item) => /^\[(?:p\.\s*\d+|source)/i.test(item));
  const citationRate = evidence.length ? citedEvidence.length / evidence.length : 0;
  const structured = parsed.filter((r) => Array.isArray(r.observations) && Array.isArray(r.inferences) && Array.isArray(r.assumptions));
  const alternatives = parsed.filter((r) => (r.alternative_hypotheses || []).length >= 2);
  const confidenceExplained = parsed.filter((r) => r.confidence_basis && r.confidence_change);
  const coverage = (count) => parsed.length ? count / parsed.length : 0;
  const benchmark = BENCHMARKS[String(filename).toLowerCase()];
  const benchmarkText = JSON.stringify({ counterintelligence: ci, final }).toLowerCase();
  const benchmarkHits = benchmark?.filter((alternatives) => alternatives.some((term) => benchmarkText.includes(term))) || [];
  const recommendation = String(final?.recommended_action || '');
  const clearDecision = /^PRIMARY ACTION:\s*\S/i.test(recommendation)
    && /\bWHY:\s*\S/i.test(recommendation)
    && /\bAVOID:\s*\S/i.test(recommendation)
    && /\bRECONSIDER IF:\s*\S/i.test(recommendation);
  const scenarioKey = String(filename || '').toLowerCase() || '__default__';
  const answer = ADJUDICATIONS[scenarioKey];
  const chiefActionId = actionIdFromRecommendation(recommendation);
  const scores = {
    evidence_use: clamp(30 + citationRate * 60 + Math.min(10, evidence.length)),
    specialization: clamp(40 + new Set(reports.slice(0, 12).map((r) => r.role)).size * 12),
    calibration: clamp(25 + uncertainty.length + coverage(confidenceExplained.length) * 55 - confidence.filter((n) => n > 90).length * 8),
    contradiction_detection: clamp(25 + (ci?.rationale?.length || 0) * 7 + (ci?.alternative_hypotheses?.length || 0) * 10),
    clarity: clamp(25 + coverage(structured.length) * 55 + parsed.filter((r) => r.conclusion && r.rationale?.length).length),
    revision_quality: clamp(25 + revisions.length * 10 + revisions.filter((r) => r.report.confidence_change && r.report.alternative_hypotheses?.length >= 2).length * 8),
    independence: clamp(30 + new Set(initials.map((r) => r.role)).size * 10 + coverage(alternatives.length) * 30),
    decision_quality: clearDecision ? 100 : 20,
  };
  if (answer) scores.decision_accuracy = chiefActionId === answer.actionId ? 100 : 0;
  if (benchmark) scores.benchmark_coverage = clamp(benchmarkHits.length / benchmark.length * 100);
  const overall = clamp(Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length);
  const findings = [
    `${reports.length}/14 expected pipeline reports were preserved.`,
    revisions.length === 4 ? 'All four controlled revisions are present.' : 'One or more controlled revisions are missing.',
    ci && final ? 'Counterintelligence precedes the final synthesis.' : 'Red-team or final synthesis evidence is incomplete.',
    `${Math.round(citationRate * 100)}% of evidence entries carry a page or source citation.`,
    `${structured.length}/${parsed.length || 14} reports separate observations, inferences, and assumptions.`,
    `${alternatives.length}/${parsed.length || 14} reports include at least two competing hypotheses.`,
    `${confidenceExplained.length}/${parsed.length || 14} reports explain confidence and any change.`,
    clearDecision
      ? 'The Chief gives one explicit primary action, rationale, avoided action, and reconsideration triggers.'
      : 'The Chief recommendation is not decision-ready; it must state one primary action, rationale, avoided action, and reconsideration triggers.',
  ];
  if (answer) findings.push(chiefActionId === answer.actionId
    ? `The Chief selected the scenario-adjudicated action (${answer.actionId}: ${ACTIONS[answer.actionId]}).`
    : `The Chief selected ${chiefActionId || 'no recognized action'}; the scenario-adjudicated action is ${answer.actionId}: ${ACTIONS[answer.actionId]}.`);
  if (benchmark) findings.push(`${benchmarkHits.length}/${benchmark.length} scenario-specific reasoning traps were addressed by Counterintelligence or the final Chief.`);
  return {
    scores,
    overall,
    findings,
    adjudication: answer ? {
      expectedActionId: answer.actionId,
      expectedActionLabel: ACTIONS[answer.actionId],
      rationale: answer.rationale,
      chiefActionId,
      chiefMatched: chiefActionId === answer.actionId,
    } : null,
  };
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  if (!requireAccess(request, response)) return;
  const missionId = String(request.body?.missionId || '').slice(0, 80);
  try {
    const sql = getSql();
    const reports = await sql`SELECT stage, role, sequence, report FROM reports WHERE mission_id = ${missionId} ORDER BY sequence`;
    const missions = await sql`SELECT dossier_manifest FROM missions WHERE id = ${missionId}`;
    const filename = missions[0]?.dossier_manifest?.[0]?.filename || '';
    const result = evaluate(reports, filename);
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
