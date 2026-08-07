import { timingSafeEqual } from 'node:crypto';

export function accessCodeMatches(request) {
  const expected = process.env.LIVE_AI_ACCESS_CODE || '';
  const raw = request.headers?.['x-live-ai-access-code'];
  const provided = (Array.isArray(raw) ? raw[0] : raw || '').slice(0, 256);
  if (!expected || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function requireAccess(request, response) {
  if (!process.env.LIVE_AI_ACCESS_CODE) {
    response.status(503).json({ error: 'Live AI is not fully configured.', code: 'LIVE_AI_NOT_CONFIGURED' });
    return false;
  }
  if (!accessCodeMatches(request)) {
    response.status(401).json({ error: 'Live AI access denied.', code: 'ACCESS_DENIED' });
    return false;
  }
  return true;
}
