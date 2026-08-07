import { accessCodeMatches } from './_auth.js';
import { getSql, id, safeJson } from './_db.js';

const ALLOWED_STAGES = new Set([
  'specialist_initial',
  'chief_feedback',
  'specialist_revision',
  'counterintelligence',
  'chief_final',
]);

const MAX_DOSSIER_CHARS = 40_000;
const MAX_CONTEXT_CHARS = 80_000;
const MAX_ACCESS_CODE_CHARS = 256;
const PROMPT_VERSION = 'cold-war-pipeline-v4-decisive-chief';
const PRICE_PER_MILLION = { input: 0.25, output: 2.0 };

const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'stage',
    'role',
    'conclusion',
    'confidence',
    'evidence_used',
    'uncertainties',
    'rationale',
    'recommended_action',
    'feedback_requests',
    'observations',
    'inferences',
    'assumptions',
    'alternative_hypotheses',
    'confidence_basis',
    'confidence_change',
  ],
  properties: {
    stage: { type: 'string' },
    role: { type: 'string' },
    conclusion: { type: 'string' },
    confidence: { type: 'integer', minimum: 0, maximum: 100 },
    evidence_used: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 12 },
    uncertainties: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    rationale: { type: 'array', items: { type: 'string' }, maxItems: 12 },
    recommended_action: { type: 'string' },
    feedback_requests: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    observations: { type: 'array', items: { type: 'string' }, maxItems: 10 },
    inferences: { type: 'array', items: { type: 'string' }, maxItems: 10 },
    assumptions: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    alternative_hypotheses: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5 },
    confidence_basis: { type: 'string' },
    confidence_change: { type: 'string' },
  },
};

function jsonResponse(response, status, body) {
  response.status(status);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.send(JSON.stringify(body));
}

function text(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.slice(0, maxLength);
}

function buildInstructions(stage, role) {
  const common = [
    'You are operating inside a fictional Cold War intelligence training simulator.',
    'Use only the evidence and structured context supplied in this request.',
    'Do not invent access to other agent silos, classified databases, or external facts.',
    'Place direct supplied facts only in observations; place interpretations only in inferences; place unsupported dependencies only in assumptions.',
    'Every evidence_used entry must begin with its supplied [p. N] page citation when available, otherwise a concise [source] label from the dossier.',
    'Provide at least two genuinely competing hypotheses, including the strongest innocent or non-hostile explanation.',
    'Explain what evidence sets the confidence level. Never treat confidence as a quality score.',
    'Return concise, auditable reasoning summaries rather than private chain-of-thought.',
    'Keep every string concise so the entire JSON response fits within the output limit.',
    'Use an empty string for recommended_action when the current stage should not recommend a player action.',
    `Prompt doctrine version: ${PROMPT_VERSION}.`,
  ];

  const roleDoctrines = {
    'Submarine Analyst': 'Checklist: track continuity; acoustic alternatives; geography; intent versus capability; missing distress indicators. Never treat lost contact alone as proof of attack.',
    'ELINT Analyst': 'Checklist: emitter identity; mode and timing; target-lock evidence; spoofing or calibration; historical baseline. Separate signal match from operational intent.',
    'Air Intelligence Analyst': 'Checklist: track geometry; intercept behavior; payload identification limits; imagery quality; live-versus-inert payload. Never infer nuclear status from silhouette alone.',
    'HUMINT Analyst': 'Checklist: access; reliability; corroboration; coercion; source independence; contamination; deception motive. Weight each source separately.',
    'Counterintelligence Agent': 'Checklist: deception hypotheses; circular reporting; shared-source dependency; groupthink; contradictions; innocent alternatives; confidence inflation.',
    'Chief Agent': 'Checklist: preserve dissent; compare independent streams; avoid double-counting; resolve contradictions explicitly; calibrate confidence; make a decision rather than substituting a collection wish list for one. Prefer a reversible action when uncertainty is high.',
  };

  const stageInstructions = {
    specialist_initial: 'Produce an independent initial report from your assigned evidence silo. Do not infer what other specialists may have seen. Set confidence_change to "Initial estimate; no prior estimate."',
    chief_feedback: 'Act as the Chief Agent. Review the supplied initial report. Challenge unsupported claims, missing citations, weak alternatives, hidden assumptions, and confidence calibration. Identify focused corrections for exactly one revision round.',
    specialist_revision: 'Revise the specialist report once in response to the Chief feedback. Preserve unresolved uncertainty rather than forcing agreement. In confidence_change, state the earlier and revised confidence and cite the exact evidence or correction that caused any change; if unchanged, explain why.',
    counterintelligence: 'Act as Counterintelligence. Red-team the revised reports for deception, source dependency, contamination, groupthink, contradictions, and innocent alternatives.',
    chief_final: 'Act as the Chief Agent. Read Counterintelligence before forming an independent final synthesis. Preserve meaningful dissent. The recommended_action field is mandatory and must use exactly this compact format: "PRIMARY ACTION: <one unmistakable action the player should take now>. WHY: <one-sentence reason>. AVOID: <the most important action not to take>. RECONSIDER IF: <specific observable trigger(s) that would justify changing course>." Put the decision first. Do not lead with requests for more collection, and do not provide a menu of equally weighted actions. Collection requests may support the decision but cannot replace it. In confidence_change, explain which revised-report or Counterintelligence evidence raised, lowered, or preserved confidence.',
  };

  return [...common, `Assigned role: ${role}.`, roleDoctrines[role] || roleDoctrines['Chief Agent'], stageInstructions[stage]].join('\n');
}

function extractOutputText(payload) {
  if (typeof payload.output_text === 'string') return payload.output_text;
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  throw new Error('The model response did not contain output text.');
}

async function requestReport({ stage, role, input, maxOutputTokens }) {
  const openAIResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      instructions: buildInstructions(stage, role),
      input,
      reasoning: { effort: 'low' },
      max_output_tokens: maxOutputTokens,
      text: {
        format: {
          type: 'json_schema',
          name: 'cold_war_agent_report',
          description: 'A concise structured report from one stage of the intelligence pipeline.',
          strict: true,
          schema: REPORT_SCHEMA,
        },
      },
    }),
  });

  const payload = await openAIResponse.json();
  if (!openAIResponse.ok) {
    console.error('OpenAI API error', openAIResponse.status, payload);
    const error = new Error('The model request failed.');
    error.upstreamStatus = openAIResponse.status;
    throw error;
  }

  return payload;
}

function parseReport(payload) {
  const outputText = extractOutputText(payload);
  try {
    return JSON.parse(outputText);
  } catch (error) {
    error.isTruncatedModelJson = payload.status === 'incomplete' || /unterminated|unexpected end/i.test(error.message);
    throw error;
  }
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return jsonResponse(response, 405, { error: 'Method not allowed.' });
  }

  if (!process.env.OPENAI_API_KEY || !process.env.LIVE_AI_ACCESS_CODE) {
    return jsonResponse(response, 503, { error: 'Live AI is not fully configured.', code: 'LIVE_AI_NOT_CONFIGURED' });
  }

  if (!accessCodeMatches(request)) {
    return jsonResponse(response, 401, { error: 'Live AI access denied.', code: 'ACCESS_DENIED' });
  }

  const body = request.body ?? {};
  const stage = text(body.stage, 40);
  const role = text(body.role, 100);

  if (!ALLOWED_STAGES.has(stage)) return jsonResponse(response, 400, { error: 'Invalid pipeline stage.' });
  if (!role) return jsonResponse(response, 400, { error: 'Role is required.' });

  const dossier = text(body.dossier, MAX_DOSSIER_CHARS);
  const context = text(body.context, MAX_CONTEXT_CHARS);
  const feedback = text(body.feedback, 20_000);
  const missionId = text(body.missionId, 80);
  const runId = text(body.runId, 80);
  const requestId = text(body.requestId, 80);
  const sequence = Number(body.sequence);

  if (!dossier && !context) {
    return jsonResponse(response, 400, { error: 'A dossier or structured context is required.' });
  }
  if (!missionId || !runId || !requestId || !Number.isInteger(sequence) || sequence < 1 || sequence > 14) {
    return jsonResponse(response, 400, { error: 'Valid mission, run, request, and sequence identifiers are required.' });
  }

  const input = [
    `PIPELINE STAGE: ${stage}`,
    `ROLE: ${role}`,
    dossier ? `\nASSIGNED DOSSIER:\n${dossier}` : '',
    context ? `\nSTRUCTURED CONTEXT:\n${context}` : '',
    feedback ? `\nCHIEF FEEDBACK:\n${feedback}` : '',
  ].join('\n');

  try {
    const started = Date.now();
    let retries = 0;
    let payload = await requestReport({ stage, role, input, maxOutputTokens: 3200 });
    let report;

    try {
      report = parseReport(payload);
    } catch (error) {
      if (!error.isTruncatedModelJson) throw error;
      retries = 1;
      console.warn('Retrying truncated structured response', { stage, role, responseId: payload.id });
      payload = await requestReport({ stage, role, input, maxOutputTokens: 4000 });
      report = parseReport(payload);
    }

    const latencyMs = Date.now() - started;
    const inputTokens = Number(payload.usage?.input_tokens || 0);
    const outputTokens = Number(payload.usage?.output_tokens || 0);
    const estimatedCostUsd = (inputTokens * PRICE_PER_MILLION.input + outputTokens * PRICE_PER_MILLION.output) / 1_000_000;
    const sql = getSql();
    const stored = await sql`SELECT run_id FROM missions WHERE id = ${missionId}`;
    if (!stored.length || stored[0].run_id !== runId) return jsonResponse(response, 409, { error: 'Mission/run identifier mismatch.' });
    await sql`INSERT INTO reports (id, mission_id, request_id, sequence, stage, role, prompt_version, model, response_id,
      report, latency_ms, input_tokens, output_tokens, retries, estimated_cost_usd)
      VALUES (${id('rpt')}, ${missionId}, ${requestId}, ${sequence}, ${stage}, ${role}, ${PROMPT_VERSION},
      ${payload.model || process.env.OPENAI_MODEL || 'gpt-5-mini'}, ${payload.id || null}, ${safeJson(report)}::jsonb,
      ${latencyMs}, ${inputTokens}, ${outputTokens}, ${retries}, ${estimatedCostUsd})
      ON CONFLICT (mission_id, request_id) DO NOTHING`;
    await sql`UPDATE missions SET total_latency_ms = total_latency_ms + ${latencyMs},
      total_input_tokens = total_input_tokens + ${inputTokens}, total_output_tokens = total_output_tokens + ${outputTokens},
      total_retries = total_retries + ${retries}, estimated_cost_usd = estimated_cost_usd + ${estimatedCostUsd}
      WHERE id = ${missionId}`;

    return jsonResponse(response, 200, {
      report,
      model: payload.model,
      responseId: payload.id,
      usage: payload.usage ?? null,
      missionId,
      runId,
      requestId,
      sequence,
      promptVersion: PROMPT_VERSION,
      metrics: { latencyMs, retries, estimatedCostUsd },
    });
  } catch (error) {
    console.error('Agent endpoint failure', error);
    if (error.upstreamStatus) {
      return jsonResponse(response, 502, { error: 'The model request failed.', upstreamStatus: error.upstreamStatus });
    }
    return jsonResponse(response, 500, { error: 'The agent endpoint could not complete the request.' });
  }
}
