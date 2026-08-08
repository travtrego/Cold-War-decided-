export default function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const keyConfigured = Boolean(process.env.OPENAI_API_KEY);
  const accessCodeConfigured = Boolean(process.env.LIVE_AI_ACCESS_CODE);
  const databaseConfigured = Boolean(process.env.DATABASE_URL);

  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  return response.status(200).json({
    ok: true,
    demo: true,
    liveAI: keyConfigured && accessCodeConfigured && databaseConfigured,
    database: databaseConfigured,
    accessProtected: true,
    model: process.env.OPENAI_MODEL || 'gpt-5-mini',
    promptVersion: 'cold-war-pipeline-v5-action-thresholds',
  });
}
