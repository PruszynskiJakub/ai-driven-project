import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { sparks } from '../src/db/schema/sparks';
import { stories } from '../src/db/schema/stories';
import { eq } from 'drizzle-orm';

let testDb: Database;
let db: ReturnType<typeof drizzle>;

export function setupTestDatabase() {
  testDb = new Database(':memory:');
  db = drizzle(testDb);
  
  // Create tables manually since we might not have migrations yet
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS sparks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      initial_thoughts TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      user_id TEXT NOT NULL DEFAULT 'default_user'
    )
  `);
  
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      spark_id TEXT NOT NULL REFERENCES sparks(id) ON DELETE CASCADE,
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_auto_saved_at TEXT NOT NULL
    )
  `);
  
  return db;
}

export function cleanupTestDatabase() {
  if (testDb) {
    testDb.close();
  }
}

export function getTestDb() {
  return db;
}

export function clearTestData() {
  if (testDb) {
    testDb.exec('DELETE FROM stories');
    testDb.exec('DELETE FROM sparks');
  }
}

// Database assertion helpers
export async function getSparkFromDb(id: string) {
  const [spark] = await db.select().from(sparks).where(eq(sparks.id, id));
  return spark;
}

export async function getStoryFromDb(id: string) {
  const [story] = await db.select().from(stories).where(eq(stories.id, id));
  return story;
}

export async function getStoryBySparkIdFromDb(sparkId: string) {
  const [story] = await db.select().from(stories).where(eq(stories.sparkId, sparkId));
  return story;
}

export async function countSparksInDb() {
  const result = await db.select().from(sparks);
  return result.length;
}

export async function countStoriesInDb() {
  const result = await db.select().from(stories);
  return result.length;
}