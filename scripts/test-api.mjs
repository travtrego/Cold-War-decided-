import assert from 'node:assert/strict';
import agentHandler from '../api/agent.js';
import healthHandler from '../api/health.js';

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    send(value) {
      this.body = typeof value === 'string' ? JSON.parse(value) : value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

const originalKey = process.env.OPENAI_API_KEY;
const originalAccessCode = process.env.LIVE_AI_ACCESS_CODE;
const originalFetch = globalThis.fetch;

delete process.env.OPENAI_API_KEY;
delete process.env.LIVE_AI_ACCESS_CODE;

try {
  {
    const response = createResponse();
    await healthHandler({ method: 'GET' }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.demo, true);
    assert.equal(response.body.liveAI, false);
    assert.equal(response.body.accessProtected, true);
    assert.equal(response.headers['cache-control'], 'no-store');
  }

  {
    const response = createResponse();
    await healthHandler({ method: 'POST' }, response);
    assert.equal(response.statusCode, 405);
  }

  {
    const response = createResponse();
    await agentHandler({ method: 'GET' }, response);
    assert.equal(response.statusCode, 405);
  }

  {
    const response = createResponse();
    await agentHandler(
      {
        method: 'POST',
        headers: {},
        body: {
          stage: 'specialist_initial',
          role: 'Submarine Analyst',
          dossier: 'Test evidence',
        },
      },
      response,
    );
    assert.equal(response.statusCode, 503);
    assert.equal(response.body.code, 'LIVE_AI_NOT_CONFIGURED');
  }

  process.env.OPENAI_API_KEY = 'test-key';
  process.env.LIVE_AI_ACCESS_CODE = 'correct-horse-battery-staple';

  {
    const response = createResponse();
    await healthHandler({ method: 'GET' }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.liveAI, true);
  }

  let upstreamCalls = 0;
  globalThis.fetch = async () => {
    upstreamCalls += 1;
    throw new Error('Unauthorized requests must never reach OpenAI.');
  };

  {
    const response = createResponse();
    await agentHandler(
      {
        method: 'POST',
        headers: { 'x-live-ai-access-code': 'wrong-code' },
        body: {
          stage: 'specialist_initial',
          role: 'Submarine Analyst',
          dossier: 'Test evidence',
        },
      },
      response,
    );
    assert.equal(response.statusCode, 401);
    assert.equal(response.body.code, 'ACCESS_DENIED');
    assert.equal(upstreamCalls, 0);
  }

  const modelReport = {
    stage: 'specialist_initial',
    role: 'Submarine Analyst',
    conclusion: 'The contact probably entered an ultra-quiet operating mode.',
    confidence: 68,
    evidence_used: ['The contact disappeared without distress indicators.'],
    uncertainties: ['Terrain masking cannot be excluded.'],
    rationale: ['The observed silence is deliberate but not uniquely diagnostic.'],
    recommended_action: '',
    feedback_requests: [],
  };

  globalThis.fetch = async (url, options) => {
    upstreamCalls += 1;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    const payload = JSON.parse(options.body);
    assert.equal(payload.text.format.type, 'json_schema');
    assert.equal(payload.text.format.strict, true);

    return {
      ok: true,
      status: 200,
      async json() {
        return {
          id: 'resp_test',
          model: 'gpt-5-mini',
          output_text: JSON.stringify(modelReport),
          usage: { input_tokens: 10, output_tokens: 20 },
        };
      },
    };
  };

  {
    const response = createResponse();
    await agentHandler(
      {
        method: 'POST',
        headers: {
          'x-live-ai-access-code': 'correct-horse-battery-staple',
        },
        body: {
          stage: 'specialist_initial',
          role: 'Submarine Analyst',
          dossier: 'Test evidence',
        },
      },
      response,
    );
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.report.confidence, 68);
    assert.equal(response.body.responseId, 'resp_test');
    assert.equal(upstreamCalls, 1);
  }

  console.log('API contract tests passed.');
} finally {
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;

  if (originalAccessCode === undefined) delete process.env.LIVE_AI_ACCESS_CODE;
  else process.env.LIVE_AI_ACCESS_CODE = originalAccessCode;

  globalThis.fetch = originalFetch;
}
