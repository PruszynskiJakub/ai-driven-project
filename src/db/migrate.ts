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

console.log('Database migration completed successfully');
sqlite.close();