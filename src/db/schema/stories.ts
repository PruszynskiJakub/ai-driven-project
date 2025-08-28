import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sparks } from './sparks';

export const stories = sqliteTable('stories', {
  id: text('id').primaryKey(),
  sparkId: text('spark_id').notNull().references(() => sparks.id, { onDelete: 'cascade' }),
  content: text('content').notNull().default(''),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
  lastAutoSavedAt: text('last_auto_saved_at').notNull().$defaultFn(() => new Date().toISOString()),
});