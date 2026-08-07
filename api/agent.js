import { timingSafeEqual } from 'node:crypto';

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
  ],
  properties: {
    stage: { type: 'string' },
    role: { type: 'string' },
    conclusion: { type: 'string' },
    confidence: { type: 'integer', minimum: 0, maximum: 100 },
    evidence_used: { type: 'array', items: { type: 'string' }, maxItems: 12 },
    uncertainties: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    rationale: { type: 'array', items: { type: 'string' }, maxItems: 12 },
    recommended_action: { type: 'string' },
    feedback_requests: { type: 'array', items: { type: 'string' }, maxItems: 8 },
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

function headerValue(request, name) {
  const value = request.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function accessCodeMatches(request) {
  const expected = process.env.LIVE_AI_ACCESS_CODE || '';
  const provided = text(headerValue(request, 'x-live-ai-access-code'), MAX_ACCESS_CODE_CHARS);
  if (!expected || !provided) return false;

  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  if (expectedBytes.length !== providedBytes.length) return false;
  return timingSafeEqual(expectedBytes, providedBytes);
}

function buildInstructions(stage, role) {
  const common = [
    'You are operating inside a fictional Cold War intelligence training simulator.',
    'Use only the evidence and structured context supplied in this request.',
    'Do not invent access to other agent silos, classified databases, or external facts.',
    'Distinguish observations from inference and calibrate confidence honestly.',
    'Return concise, auditable reasoning summaries rather than private chain-of-thought.',
    'Keep every string concise so the entire JSON response fits within the output limit.',
    'Use an empty string for recommended_action when the current stage should not recommend a player action.',
  ];

  const stageInstructions = {
    specialist_initial: 'Produce an independent initial report from your assigned evidence silo. Do not infer what other specialists may have seen.',
    chief_feedback: 'Act as the Chief Agent. Review the supplied initial report and identify focused questions or corrections for exactly one revision round.',
    specialist_revision: 'Revise the specialist report once in response to the Chief feedback. Preserve unresolved uncertainty rather than forcing agreement.',
    counterintelligence: 'Act as Counterintelligence. Red-team the revised reports for deception, source dependency, contamination, groupthink, contradictions, and innocent alternatives.',
    chief_final: 'Act as the Chief Agent. Read the Counterintelligence review before forming an independent final synthesis, confidence score, and one recommended player action.',
  };

  return [...common, `Assigned role: ${role}.`, stageInstructions[stage]].join('\n');
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

  if (!dossier && !context) {
    return jsonResponse(response, 400, { error: 'A dossier or structured context is required.' });
  }

  const input = [
    `PIPELINE STAGE: ${stage}`,
    `ROLE: ${role}`,
    dossier ? `\nASSIGNED DOSSIER:\n${dossier}` : '',
    context ? `\nSTRUCTURED CONTEXT:\n${context}` : '',
    feedback ? `\nCHIEF FEEDBACK:\n${feedback}` : '',
  ].join('\n');

  try {
    let payload = await requestReport({ stage, role, input, maxOutputTokens: 2200 });
    let report;

    try {
      report = parseReport(payload);
    } catch (error) {
      if (!error.isTruncatedModelJson) throw error;
      console.warn('Retrying truncated structured response', { stage, role, responseId: payload.id });
      payload = await requestReport({ stage, role, input, maxOutputTokens: 4000 });
      report = parseReport(payload);
    }

    return jsonResponse(response, 200, {
      report,
      model: payload.model,
      responseId: payload.id,
      usage: payload.usage ?? null,
    });
  } catch (error) {
    console.error('Agent endpoint failure', error);
    if (error.upstreamStatus) {
      return jsonResponse(response, 502, { error: 'The model request failed.', upstreamStatus: error.upstreamStatus });
    }
    return jsonResponse(response, 500, { error: 'The agent endpoint could not complete the request.' });
  }
}
