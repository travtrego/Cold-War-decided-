import { createHash } from 'node:crypto';
import { extractText } from 'unpdf';
import { accessCodeMatches } from './_auth.js';

const MAX_PDF_BYTES = 3_000_000;
const MAX_TEXT_CHARS = 80_000;

const SCENARIO_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'date', 'brief', 'objective', 'submarine', 'elint', 'air', 'humint'],
  properties: {
    title: { type: 'string' },
    date: { type: 'string' },
    brief: { type: 'string' },
    objective: { type: 'string' },
    submarine: { type: 'string' },
    elint: { type: 'string' },
    air: { type: 'string' },
    humint: { type: 'string' },
  },
};

function json(response, status, body) {
  response.status(status);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.send(JSON.stringify(body));
}

function readSection(text, heading, nextHeading) {
  const start = text.indexOf(heading);
  if (start < 0) return '';
  const contentStart = start + heading.length;
  const end = nextHeading ? text.indexOf(nextHeading, contentStart) : text.length;
  return text.slice(contentStart, end < 0 ? text.length : end).trim();
}

export function parseMarkedScenario(text) {
  const headings = ['[SUBMARINE DOSSIER]', '[ELINT DOSSIER]', '[AIR DOSSIER]', '[HUMINT DOSSIER]', '[END DOSSIER]'];
  if (!headings.every((heading) => text.includes(heading))) return null;
  const field = (label) => text.match(new RegExp(`${label}:\\s*(.+)`))?.[1]?.trim() || '';
  const scenario = {
    title: field('SCENARIO TITLE'),
    date: field('DATE'),
    brief: readSection(text, 'DIRECTOR BRIEF:', 'OBJECTIVE:'),
    objective: readSection(text, 'OBJECTIVE:', text.includes('HANDLING NOTE') ? 'HANDLING NOTE' : headings[0]),
    submarine: readSection(text, headings[0], headings[1]),
    elint: readSection(text, headings[1], headings[2]),
    air: readSection(text, headings[2], headings[3]),
    humint: readSection(text, headings[3], headings[4]),
  };
  return Object.values(scenario).every(Boolean) ? scenario : null;
}

function outputText(payload) {
  if (typeof payload.output_text === 'string') return payload.output_text;
  for (const item of payload.output || []) {
    for (const content of item.content || []) if (content.type === 'output_text') return content.text;
  }
  throw new Error('Scenario parser returned no output text.');
}

async function parseWithModel(text) {
  const upstream = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      instructions: [
        'Convert a fictional Cold War scenario document into four evidence-isolated game dossiers.',
        'Use only facts in the document. Never add historical facts.',
        'Preserve uncertainty, source reliability, contradictions, and page references such as [p. 2].',
        'Submarine receives undersea evidence; ELINT receives signals evidence; Air receives aviation evidence; HUMINT receives human-source evidence.',
        'Repeat a fact across silos only when the document itself makes it a shared command-level fact.',
        'Each dossier must explicitly say it cannot access the other evidence silos.',
      ].join('\n'),
      input: text.slice(0, MAX_TEXT_CHARS),
      reasoning: { effort: 'low' },
      max_output_tokens: 4000,
      text: { format: { type: 'json_schema', name: 'cold_war_pdf_scenario', strict: true, schema: SCENARIO_SCHEMA } },
    }),
  });
  const payload = await upstream.json();
  if (!upstream.ok) throw Object.assign(new Error('The scenario parser model failed.'), { upstreamStatus: upstream.status });
  return JSON.parse(outputText(payload));
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return json(response, 405, { error: 'Method not allowed.' });
  if (!process.env.OPENAI_API_KEY || !process.env.LIVE_AI_ACCESS_CODE) return json(response, 503, { error: 'Live AI is not configured.' });
  if (!accessCodeMatches(request)) return json(response, 401, { error: 'Live AI access denied.', code: 'ACCESS_DENIED' });
  try {
    const filename = String(request.body?.filename || 'scenario.pdf').slice(0, 180);
    const encoded = String(request.body?.pdfBase64 || '');
    const bytes = Buffer.from(encoded, 'base64');
    if (!bytes.length || bytes.length > MAX_PDF_BYTES) return json(response, 400, { error: 'PDF must be between 1 byte and 3 MB.' });
    if (bytes.subarray(0, 5).toString() !== '%PDF-') return json(response, 400, { error: 'The uploaded file is not a valid PDF.' });
    const extracted = await extractText(new Uint8Array(bytes), { mergePages: false });
    const pages = extracted.text.map((page, index) => `[PAGE ${index + 1}]\n${page.trim()}`);
    const merged = pages.join('\n\n').slice(0, MAX_TEXT_CHARS);
    if (merged.replace(/\[PAGE \d+\]/g, '').trim().length < 100) return json(response, 422, { error: 'The PDF contains too little extractable text. Scanned-image PDFs require OCR.' });
    const markedText = extracted.text.join('\n');
    const marked = parseMarkedScenario(markedText);
    const scenario = marked || await parseWithModel(merged);
    return json(response, 200, {
      scenario,
      document: {
        filename,
        pageCount: extracted.totalPages,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        parserMode: marked ? 'verified_template' : 'ai_routed',
        extractedCharacters: merged.length,
      },
    });
  } catch (error) {
    console.error('PDF scenario ingestion failed', error);
    return json(response, error.upstreamStatus ? 502 : 422, { error: error.message || 'The PDF could not be processed.' });
  }
}
