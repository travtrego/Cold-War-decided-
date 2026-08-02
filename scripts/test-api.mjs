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
delete process.env.OPENAI_API_KEY;

try {
  {
    const response = createResponse();
    await healthHandler({ method: 'GET' }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.demo, true);
    assert.equal(response.body.liveAI, false);
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
        body: {
          stage: 'specialist_initial',
          role: 'Submarine Analyst',
          dossier: 'Test evidence',
        },
      },
      response,
    );
    assert.equal(response.statusCode, 503);
    assert.equal(response.body.code, 'OPENAI_API_KEY_MISSING');
  }

  console.log('API contract tests passed.');
} finally {
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
}
