# Issue #3: Feature: Expand Spark into detailed Story

## Overview
As a User I want to be able to create a Story for the Spark.
I want to be able to autosave changes in a Story.
There is always a 1 to 1 relation with Spark.
Story will be written in markdown.
It's a long form for 5 A4 pages for instance.

## Requirements

### Functional Requirements
- **FR-2**: Story content is written in markdown format with full markdown support
- **FR-3**: Story supports long-form content (up to 5 A4 pages ≈ 2500-3000 words)
- **FR-4**: Story has 1:1 relationship with Spark - each Spark can have exactly one Story
- **FR-5**: Story content auto-saves every 30 seconds when editing
- **FR-6**: User can manually save Story content at any time
- **FR-7**: Story serves as foundation for artifact generation
- **FR-8**: Story includes rich context: personal backstory

### User Stories
- As a user, I want to expand my Spark into a detailed Story so I can provide rich context for artifact creation
- As a user, I want my Story changes to save automatically so I don't lose my work
- As a user, I want to write in markdown so I can format my Story with structure and emphasis
- As a user, I want to see my progress as I write so I understand the scope of my Story

## API Design

### Data Models

```typescript
interface Story {
  id: string;
  sparkId: string; // Foreign key to Spark (1:1 relationship)
  content: string; // Markdown content
  createdAt: Date;
  updatedAt: Date;
  lastAutoSavedAt: Date;
}

interface StoryCreateRequest {
  sparkId: string;
  content?: string; // Optional initial content
}

interface StoryUpdateRequest {
  content: string;
  isAutoSave?: boolean; // Indicates if this is an auto-save operation
}

interface StoryResponse {
  id: string;
  sparkId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  lastAutoSavedAt: string;
}
```

### API Endpoints

#### Create Story
```
POST /api/stories
Content-Type: application/json

Body: StoryCreateRequest
Response: 201 Created, StoryResponse
```

#### Get Story by Spark ID
```
GET /api/sparks/{sparkId}/story
Response: 200 OK, StoryResponse | 404 Not Found
```

#### Update Story
```
PUT /api/stories/{storyId}
Content-Type: application/json

Body: StoryUpdateRequest  
Response: 200 OK, StoryResponse
```

#### Auto-save Story
```
PATCH /api/stories/{storyId}/autosave
Content-Type: application/json

Body: { content: string }
Response: 200 OK, { lastAutoSavedAt: string }
```

### Database Schema

```sql
CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spark_id UUID NOT NULL UNIQUE REFERENCES sparks(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_auto_saved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stories_spark_id ON stories(spark_id);
```

## Implementation Notes

### Technical Considerations

#### Markdown Processing
- Server-side: Validate markdown syntax but store as plain text

#### Data Validation
- Maximum content length: 50,000 characters (approximately 5 A4 pages)
- Minimum content length: None (empty stories allowed)
- Markdown syntax validation on save
- Sanitize content to prevent XSS attacks

### Error Handling
- **Duplicate Story Creation**: Return 409 Conflict if Story already exists for Spark
- **Invalid Spark ID**: Return 404 Not Found if referenced Spark doesn't exist
- **Content Too Large**: Return 413 Payload Too Large if content exceeds limit
- **Concurrent Updates**: Use optimistic locking or last-write-wins strategy

### Security Considerations
- Validate user ownership of Spark before allowing Story creation/updates
- Sanitize markdown content to prevent XSS
- Rate limit auto-save operations to prevent abuse
- Implement CSRF protection for all write operations

### Testing Strategy
- Unit tests for markdown processing
- Integration tests for API endpoints
- Performance tests for large content handling

