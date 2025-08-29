import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { sparks } from '../src/db/schema/sparks';
import { stories } from '../src/db/schema/stories';
import { artifacts, artifactVersions } from '../src/db/schema/artifacts';
import { eq } from 'drizzle-orm';

let testDb: Database;
let db: ReturnType<typeof drizzle>;

export function setupTestDatabase() {
  testDb = new Database(':memory:');
  
  // Enable foreign key constraints in SQLite
  testDb.exec('PRAGMA foreign_keys = ON');
  
  db = drizzle(testDb, { schema: { sparks, stories, artifacts, artifactVersions } });
  
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
  
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'draft',
      current_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      finalized_at TEXT,
      source_artifact_id TEXT REFERENCES artifacts(id) ON DELETE SET NULL
    )
  `);
  
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS artifact_versions (
      id TEXT PRIMARY KEY,
      artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      content TEXT NOT NULL,
      user_feedback TEXT,
      created_at TEXT NOT NULL,
      generation_type TEXT NOT NULL
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
    testDb.exec('DELETE FROM artifact_versions');
    testDb.exec('DELETE FROM artifacts');
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

export async function getArtifactFromDb(id: string) {
  const [artifact] = await db.select().from(artifacts).where(eq(artifacts.id, id));
  return artifact;
}

export async function getArtifactVersionFromDb(id: string) {
  const [version] = await db.select().from(artifactVersions).where(eq(artifactVersions.id, id));
  return version;
}

export async function getArtifactVersionsByArtifactIdFromDb(artifactId: string) {
  const versions = await db.select().from(artifactVersions).where(eq(artifactVersions.artifactId, artifactId));
  return versions;
}

export async function countArtifactsInDb() {
  const result = await db.select().from(artifacts);
  return result.length;
}

export async function countArtifactVersionsInDb() {
  const result = await db.select().from(artifactVersions);
  return result.length;
}