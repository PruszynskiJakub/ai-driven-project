# Issue #4: Artifacts Implementation Strategy

## Core Requirements (Preserved)
- Support only text type
- Artifact must support versioning
- Artifact might be in two states Draft or Final - final means that the version was marked as final
- Artifacts are in relation to Story (1 story to many artifacts)
- Artifacts are AI-generated based on the story and the spark, for each version user might add feedback having impact on the next AI-generated version
- Final artifact is immutable, yet might be duplicated
- To finalize artifact user must take a manual action


Refined Artifact Lifecycle

1. Create artifact (Draft v1) → AI generates initial content
2. User reviews generated content → provides feedback
3. AI generates new version based on feedback → repeat cycle
4. User manually edits if needed (creates new version)
5. User finalizes when satisfied


1. Cascade Delete: Spark deletion removes all artifacts - no orphaned data
2. No ContentHash: Simpler versioning without hash complexity
3. AI-Agnostic Artifacts: Artifact system doesn't track AI generation state
4. Sequential Operations: No concurrent feedback/editing during generation

Spark deletion → Story deletion → Artifacts deletion

## Extended Specification

### Artifact Data Model
Each Artifact must include:
- **ID**: Unique identifier
- **StoryID**: Reference to parent Story
- **Type**: Artifact type (e.g., "linkedin_post", "blog_article", "twitter_thread")
- **State**: "draft" or "final"
- **CurrentVersion**: Latest version number (incremental integer)
- **CreatedAt/UpdatedAt**: Timestamps
- **FinalizedAt**: Timestamp when marked as final (null for draft artifacts)
- **SourceArtifactID**: Reference to source artifact if duplicated from Final (null for original)

### Version Management
- **Version Numbering**: Sequential integers starting from 1
- **Version Storage**: Each version stores complete artifact content (no deltas)
- **Version Tracking**: Track creation timestamp, user feedback, and AI generation context for each version
- **Current Version**: Always points to the latest version in the artifact's current state
- **Version Persistence**: All versions preserved until artifact is deleted

### State Transition Rules
- **Draft Creation**: New artifacts always start in Draft state at version 1
- **Draft Iteration**: Draft artifacts can have unlimited versions through feedback loops
- **Finalization Process**:
  - Requires explicit user confirmation
  - Must have non-empty content in current version
  - Creates immutable Final state
  - Cannot be reversed
- **Final Duplication**: 
  - Creates new Draft artifact with version 1
  - Copies Final artifact's final version content as starting point
  - Establishes source relationship for traceability

### AI Generation Process
- **Input Sources**: Story content + Spark + artifact type specification
- **Feedback Integration**: User feedback text + current version content → new version
- **Generation Context**: Track AI model, prompts, and parameters used for each version
- **Iteration Limits**: No hard limits on version iterations for Draft artifacts
- **Generation Failures**: Handle gracefully, allow retry, don't increment version on failure

### User Feedback Mechanism
- **Feedback Types**: Text-based feedback for content improvement
- **Feedback Storage**: Store user feedback alongside each version for audit trail
- **Feedback Application**: Feedback + current version content used to generate next version
- **Feedback Validation**: Ensure feedback is non-empty and reasonably sized

### Manual Content Editing
- **Direct Edits**: Users can make small tweaks directly to Draft artifact content without AI regeneration
- **Manual Version Creation**: Saving manually edited content creates new version (increments version number)
- **Edit Tracking**: Mark versions as "user_edited" vs "ai_generated" for audit trail
- **Edit Preservation**: Manual edits preserved in version history alongside AI-generated versions
- **Hybrid Workflow**: Users can alternate between manual tweaks and AI feedback iterations

### Validation Rules
- **Finalization Requirements**:
  - Artifact content must be non-empty
  - User must explicitly confirm finalization intent
  - No pending AI generation operations
- **Content Validation**: Basic text validation (non-empty, reasonable length limits)
- **State Validation**: Enforce state transition rules strictly

### API Endpoints Required
- `POST /artifacts` - Create new artifact (always starts as Draft v1)
- `GET /artifacts/{id}` - Retrieve artifact with current version
- `GET /artifacts/{id}/versions` - List all versions with metadata
- `GET /artifacts/{id}/versions/{version}` - Retrieve specific version
- `POST /artifacts/{id}/iterate` - Add feedback and generate new version (Draft only)
- `PUT /artifacts/{id}/content` - Save manually edited content as new version (Draft only)
- `POST /artifacts/{id}/finalize` - Mark as Final (requires confirmation)
- `POST /artifacts/{id}/duplicate` - Create Draft copy from Final artifact
- `GET /stories/{storyId}/artifacts` - List all artifacts for a story

### Error Handling
- **AI Generation Failures**: Retry mechanism, preserve current version
- **Invalid State Transitions**: Clear error messages, maintain data integrity
- **Concurrent Modifications**: Handle race conditions during iteration
- **Validation Failures**: Detailed error messages for user feedback

### Performance Considerations
- **Version Cleanup**: No automatic cleanup (preserve all versions)
- **Content Storage**: Store as markdown text, consider compression for large versions
- **Query Optimization**: Index on story_id, state, and created_at for common queries
- **Caching**: Cache current version content for Draft artifacts under active iteration

### Integration Points
- **Story Integration**: Artifacts must reference valid, existing Stories
- **Publication Integration**: Only Final artifacts can be used in Publications
- **Source Material**: Final artifacts can serve as source for new artifact creation