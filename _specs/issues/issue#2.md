# Issue #2: Feature - Capture a Spark (Initial Idea)

## Overview

This specification defines the implementation of the foundational "Spark" capture feature - the entry point for the content creation hierarchy (Spark → Story → Artifacts → Publications). This is a critical foundation feature that enables users to quickly capture and persist their initial creative ideas.

## Requirements Analysis

### Functional Requirements
- **FR1**: User can create a new Spark with required title
- **FR2**: User can add optional initial thoughts to enhance the Spark
- **FR3**: Spark data is persisted securely in the database
- **FR4**: User receives clear confirmation of successful Spark creation
- **FR5**: Spark creation supports validation and error handling

### Non-Functional Requirements
- **NFR1**: Response time < 200ms for Spark creation
- **NFR2**: Input validation prevents malformed data persistence
- **NFR3**: API follows RESTful conventions
- **NFR4**: Frontend provides intuitive UX for rapid idea capture
- **NFR5**: System handles concurrent Spark creation gracefully

## Architecture & Design Decisions

### Technology Stack Alignment
- **Backend**: Hono framework with Bun runtime
- **Database**: SQLite with Drizzle ORM (inferred from project structure)
- **Validation**: Zod for runtime type validation
- **Testing**: Bun's built-in test runner

### Design Principles
1. **Simplicity First**: Minimal friction for idea capture
2. **Data Integrity**: Strong validation at API boundaries
3. **Extensibility**: Schema designed for future Story expansion
4. **Performance**: Efficient database operations with proper indexing

## Data Model

### Spark Entity
```typescript
interface Spark {
  id: string;           // UUID primary key
  title: string;        // Required, 1-255 characters
  initialThoughts?: string; // Optional, max 500 characters
  createdAt: Date;      // Auto-generated timestamp
  updatedAt: Date;      // Auto-updated timestamp
  userId: string;       // Future-proofing for multi-user support
}
```

### Business Rules
- **Title**: Required, trimmed, 1-255 characters
- **Initial Thoughts**: Optional, max 500 characters
- **ID Generation**: UUIDv4 for uniqueness and security
- **Timestamps**: Automatic creation and update tracking

## Database Schema

### Migration: Create Sparks Table
```sql
CREATE TABLE sparks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK(length(trim(title)) > 0 AND length(title) <= 255),
  initial_thoughts TEXT CHECK(initial_thoughts IS NULL OR length(initial_thoughts) <= 500),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id TEXT NOT NULL DEFAULT 'default_user'
);

-- Indexes for performance
CREATE INDEX idx_sparks_created_at ON sparks(created_at DESC);
CREATE INDEX idx_sparks_user_id ON sparks(user_id);
```

### Drizzle Schema Definition
```typescript
// src/db/schema/sparks.ts
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const sparks = sqliteTable('sparks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  initialThoughts: text('initial_thoughts'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
  userId: text('user_id').notNull().default('default_user'),
});
```

## API Implementation

### Endpoint: POST /api/sparks

#### Request Schema
```typescript
// src/models/spark.ts
import { z } from 'zod';

export const CreateSparkSchema = z.object({
  title: z.string()
    .trim()
    .min(1, 'Title is required')
    .max(255, 'Title must be 255 characters or less'),
  initialThoughts: z.string()
    .max(500, 'Initial thoughts must be 500 characters or less')
    .optional(),
});

export type CreateSparkRequest = z.infer<typeof CreateSparkSchema>;
```

#### Response Schema
```typescript
export const SparkResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  initialThoughts: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type SparkResponse = z.infer<typeof SparkResponseSchema>;
```

#### Route Handler Implementation
```typescript
// src/routes/sparks.ts
import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { CreateSparkSchema } from '../models/spark';
import { createSpark } from '../services/sparkService';

const sparks = new Hono();

sparks.post('/', 
  validator('json', (value, c) => {
    const parsed = CreateSparkSchema.safeParse(value);
    if (!parsed.success) {
      return c.json({ error: 'Invalid input', details: parsed.error.issues }, 400);
    }
    return parsed.data;
  }),
  async (c) => {
    try {
      const sparkData = c.req.valid('json');
      const spark = await createSpark(sparkData);
      
      return c.json({
        success: true,
        data: spark,
        message: 'Spark created successfully'
      }, 201);
    } catch (error) {
      console.error('Error creating spark:', error);
      return c.json({ 
        error: 'Failed to create spark',
        message: 'An unexpected error occurred. Please try again.'
      }, 500);
    }
  }
);

export default sparks;
```

## Service Layer

### Spark Service Implementation
```typescript
// src/services/sparkService.ts
import { eq } from 'drizzle-orm';
import { db } from '../db/database';
import { sparks } from '../db/schema/sparks';
import { CreateSparkRequest, SparkResponse } from '../models/spark';
import { v4 as uuidv4 } from 'uuid';

export async function createSpark(data: CreateSparkRequest): Promise<SparkResponse> {
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const sparkData = {
    id,
    title: data.title,
    initialThoughts: data.initialThoughts || null,
    createdAt: now,
    updatedAt: now,
    userId: 'default_user', // Future: get from auth context
  };
  
  await db.insert(sparks).values(sparkData);
  
  // Return created spark (excluding internal fields)
  return {
    id: sparkData.id,
    title: sparkData.title,
    initialThoughts: sparkData.initialThoughts || undefined,
    createdAt: sparkData.createdAt,
    updatedAt: sparkData.updatedAt,
  };
}

export async function getSparkById(id: string): Promise<SparkResponse | null> {
  const [spark] = await db.select().from(sparks).where(eq(sparks.id, id));
  
  if (!spark) return null;
  
  return {
    id: spark.id,
    title: spark.title,
    initialThoughts: spark.initialThoughts || undefined,
    createdAt: spark.createdAt,
    updatedAt: spark.updatedAt,
  };
}
```
## Conclusion

This implementation provides a robust foundation for capturing Sparks with proper validation, error handling, and extensibility. The architecture supports the content hierarchy while maintaining simplicity for rapid idea capture. The specification ensures production-ready code with comprehensive testing and performance considerations.