import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';

const sqlite = new Database('database.db');
let db = drizzle(sqlite);

// Allow test database injection
export function setTestDb(testDb: ReturnType<typeof drizzle>) {
  db = testDb;
}

export { db };