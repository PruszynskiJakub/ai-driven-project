# Idea-to-Content Creation Platform

## Core Vision
An AI-powered creative workspace that transforms raw ideas into polished social media content through collaborative iteration between human creativity and AI assistance.

## Key Terms & Structure
- **Spark**: User captures their initial idea 
- **Story**: User elaborates with personal backstory
- **Artifact**: The result created from story for a particular medium and format (stored as markdown)
- **Publication**: Composed of multiple Final artifacts for a specific platform/format

### Content Hierarchy
```
Spark (1)
├── Story (1)
├── Artifacts (many)
│   ├── Draft (mutable)
│   └── Final (immutable when marked as final)
└── Publications (many)
    └── Composed of multiple Final Artifacts
```

### Artifact State Rules
- **Draft State**: Freely modifiable, can be edited iteratively
- **Final State**: Immutable once marked final (requires non-empty Draft version + user confirmation)
- **Modification**: Final artifacts can only be duplicated to create new Draft artifacts
- **Usage**: Only Final artifacts can be:
  - Used in Publications
  - Used as source material for creating new artifacts

## The Creative Journey

### 1. Foundation Creation
- **Spark**: User captures their initial idea 
- **Story**: User elaborates with personal backstory, motivation, and context
- **Foundation**: This rich context becomes the seed for all artifacts/

### 2. Artifact Development
- **Artifact Types**: From one Story, create multiple artifacts (social posts, blog articles, images, videos, etc.)
- **Draft Creation**: AI generates initial draft for each artifact type based on Story
- **Iterative Refinement**: User provides feedback, AI refines the Draft version
- **Finalization**: User marks artifact as Final when satisfied (creates immutable version)
- **Duplication**: Final artifacts can be duplicated to create new Draft artifacts for modification
- **Dependency Chain**: Final artifacts can serve as source material for creating new artifacts
- **Starting Focus**: LinkedIn Posts and Images as initial artifact types

### 3. Publication Assembly  
- **Composition**: Combine multiple Final artifacts into platform-ready publications
- **Stability**: Publications remain stable as Final artifacts cannot be modified
- **Examples**: LinkedIn Post + Image = "LinkedIn Post with Image" publication
- **Flexible Reuse**: Same Final artifacts can be used across different publication combinations

### 4. Version Management & Snapshots
- **Linear Versioning**: Simple progression without branching complexity
- **Manual Snapshots**: User-triggered saves of complete Draft or Final states
- **Snapshot Navigation**: Return to previous saved states when needed

## Value Proposition
Bridges the gap between having great ideas and creating compelling social content by:
- Preserving the human creative spark while leveraging AI capabilities
- Providing structure to the often chaotic creative process  
- Enabling experimentation without fear of losing good versions
- Creating a collaborative space where human intuition guides AI precision