import { Database } from 'bun:sqlite';

const sqlite = new Database('database.db');

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS sparks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    initial_thoughts TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    user_id TEXT NOT NULL DEFAULT 'default_user'
  )
`);

sqlite.exec(`
  CREATE INDEX IF NOT EXISTS idx_sparks_created_at ON sparks(created_at DESC)
`);

sqlite.exec(`
  CREATE INDEX IF NOT EXISTS idx_sparks_user_id ON sparks(user_id)
`);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS stories (
    id TEXT PRIMARY KEY,
    spark_id TEXT NOT NULL UNIQUE REFERENCES sparks(id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_auto_saved_at TEXT NOT NULL
  )
`);

sqlite.exec(`
  CREATE INDEX IF NOT EXISTS idx_stories_spark_id ON stories(spark_id)
`);

console.log('Database migration completed successfully');
sqlite.close();