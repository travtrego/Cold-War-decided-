import { neon } from '@neondatabase/serverless';

let client;
export function getSql() {
  if (process.env.NODE_ENV === 'test' && globalThis.__MISSION_SQL__) return globalThis.__MISSION_SQL__;
  if (!process.env.DATABASE_URL) throw Object.assign(new Error('Database is not configured.'), { code: 'DATABASE_NOT_CONFIGURED' });
  client ||= neon(process.env.DATABASE_URL);
  return client;
}

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function id(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function safeJson(value) {
  return JSON.stringify(value ?? null);
}
