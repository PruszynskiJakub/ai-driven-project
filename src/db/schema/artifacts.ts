import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { stories } from './stories';

export const artifacts = sqliteTable('artifacts', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // e.g., "linkedin_post", "blog_article", "twitter_thread"
  state: text('state').notNull().default('draft'), // "draft" or "final"
  currentVersion: integer('current_version').notNull().default(1),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
  finalizedAt: text('finalized_at'), // null for draft artifacts
  sourceArtifactId: text('source_artifact_id'), // Will add reference after table definition
});

export const artifactVersions = sqliteTable('artifact_versions', {
  id: text('id').primaryKey(),
  artifactId: text('artifact_id').notNull().references(() => artifacts.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  content: text('content').notNull(),
  userFeedback: text('user_feedback'), // feedback provided to generate this version
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  generationType: text('generation_type').notNull(), // "ai_generated" or "user_edited"
});