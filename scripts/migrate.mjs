import fs from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const sql = neon(process.env.DATABASE_URL);
const migration = await fs.readFile(new URL('../migrations/001_mission_ledger.sql', import.meta.url), 'utf8');
await sql.query(migration);
console.log('Mission ledger migration applied.');
