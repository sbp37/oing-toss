import { neon } from '@neondatabase/serverless';

let database = null;

export function getDatabase() {
  if (database) return database;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  database = neon(url);
  return database;
}

export function resetDatabaseForTest() {
  database = null;
}
