import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const sparks = sqliteTable('sparks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  initialThoughts: text('initial_thoughts'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
  userId: text('user_id').notNull().default('default_user'),
});