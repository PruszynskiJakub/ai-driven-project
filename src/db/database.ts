import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from './schema';

const sqlite = new Database('database.db');
let db = drizzle(sqlite, { schema });

// Allow test database injection
export function setTestDb(testDb: ReturnType<typeof drizzle<typeof schema>>) {
  db = testDb;
}

export { db };