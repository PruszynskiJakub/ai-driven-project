import { Database } from 'bun:sqlite';
import { v4 as uuidv4 } from 'uuid';

const sqlite = new Database('database.db');

const now = new Date().toISOString();

const testSparks = [
  {
    id: uuidv4(),
    title: 'My First Creative Idea',
    initial_thoughts: 'This is a great idea for a story about time travel',
    created_at: now,
    updated_at: now,
    user_id: 'default_user'
  },
  {
    id: uuidv4(),
    title: 'Another Spark',
    initial_thoughts: null,
    created_at: now,
    updated_at: now,
    user_id: 'default_user'
  }
];

for (const spark of testSparks) {
  sqlite.run(
    'INSERT INTO sparks (id, title, initial_thoughts, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?, ?)',
    [spark.id, spark.title, spark.initial_thoughts, spark.created_at, spark.updated_at, spark.user_id]
  );
}

console.log('Test data seeded successfully');
console.log('Spark IDs:', testSparks.map(s => s.id));
sqlite.close();