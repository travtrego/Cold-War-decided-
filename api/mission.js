import { requireAccess } from './_auth.js';
import { getSql } from './_db.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed.' });
  if (!requireAccess(request, response)) return;
  const missionId = String(request.query?.id || '').slice(0, 80);
  if (!missionId) return response.status(400).json({ error: 'Mission ID is required.' });
  try {
    const sql = getSql();
    const missions = await sql`SELECT * FROM missions WHERE id = ${missionId}`;
    if (!missions.length) return response.status(404).json({ error: 'Mission not found.' });
    const reports = await sql`SELECT * FROM reports WHERE mission_id = ${missionId} ORDER BY sequence`;
    const evaluations = await sql`SELECT * FROM evaluations WHERE mission_id = ${missionId}`;
    return response.status(200).json({ mission: missions[0], reports, evaluation: evaluations[0] || null });
  } catch (error) {
    console.error('Mission review failure', error);
    return response.status(500).json({ error: 'Mission review could not be loaded.' });
  }
}
