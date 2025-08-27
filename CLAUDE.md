# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Environment

This is a TypeScript project using Bun as the runtime, package manager, and bundler. The project follows modern TypeScript/ESNext standards with strict compiler options.

## Common Commands

**Installation:**
```bash
bun install
```

**Running the application:**
```bash
bun run index.ts
```

**Testing:**
```bash
bun test
```

**Type checking:**
```bash
bun run tsc --noEmit
```

## Project Architecture

- **Runtime**: Bun v1.1.34+ (JavaScript runtime, package manager, bundler, test runner)
- **Backend**: Hono web framework with TypeScript
- **Database**: SQLite using Bun's native `bun:sqlite` integration
- **ORM**: Drizzle ORM for type-safe queries and migrations
- **Validation**: Zod for runtime schema validation and type inference
- **Language**: TypeScript with ESNext target
- **Entry point**: `index.ts` - Hono server with API routes
- **Configuration**: 
  - `tsconfig.json` - TypeScript configuration with strict mode enabled
  - `drizzle.config.ts` - Database migration configuration
  - `package.json` - Dependencies for Hono, Drizzle, Zod

**Database Commands:**
```bash
bunx drizzle-kit generate  # Generate migrations from schema changes
bunx drizzle-kit migrate   # Apply pending migrations
```

## TypeScript Configuration

The project uses strict TypeScript settings with:
- ESNext lib and target
- Bundler module resolution
- JSX support (react-jsx)
- Strict type checking enabled
- Import extensions allowed for bundler mode

## Project Structure

```
/
├── index.ts                    # Hono server entry point
├── drizzle.config.ts          # Database migration configuration
├── data/                      # SQLite database files
│   └── content-platform.db    # Main database
├── src/
│   ├── models/
│   │   └── schemas.ts         # Zod schemas and TypeScript types
│   ├── database/
│   │   ├── schema.ts          # Drizzle database schema
│   │   ├── connection.ts      # Database connection setup
│   │   └── migrations/        # Generated migration files
│   ├── routes/
│   │   ├── index.ts           # Main API router
│   │   └── sparks.ts          # Sparks CRUD endpoints
│   └── services/              # Business logic (future)
└── _aidocs/                   # Project documentation
    ├── idea.md                # Platform concept & vision
    └── journey.md             # User workflow examples
```

**API Structure:**
- `GET /health` - Health check endpoint
- `GET /api` - API overview and available endpoints
- `POST /api/sparks` - Create new spark
- `GET /api/sparks` - List all sparks
- `GET /api/sparks/:id` - Get specific spark
- Additional routes for stories, artifacts, publications (to be implemented)

## Pitfalls & Gotchas

- Use `bun:sqlite` instead of `better-sqlite3` to avoid ABI version conflicts with Bun
- Drizzle config requires `dialect: 'sqlite'` not `driver: 'better-sqlite'`

## Domain Glossary

Core content model follows this hierarchy:
- **Spark**: User's initial idea capture
- **Story**: Elaborated backstory, motivation, and context from the Spark
- **Artifact**: Content result created from Story for specific medium/format
- **Publication**: Composition of multiple artifacts for platform-ready content

**Content Structure:**
```
Spark (1)
├── Story (1)
├── Artifacts (many)
│   ├── Draft (mutable)
│   └── Final (immutable when marked final)
└── Publications (many)
    └── Composed of multiple Final artifacts
```

**Artifact State Rules:**
- Draft: Freely modifiable until user marks as Final
- Final: Immutable once marked (requires non-empty Final + user confirmation)
- Final artifacts can only be duplicated to create new Drafts for modification
- Only Final artifacts can be used in Publications or as sources for new artifacts

**Versioning Rules:**
- Linear progression only (no branching)
- Manual snapshots capture complete Draft/Final states
- Failed drafts disappear (no clutter preservation)
- Artifacts can be reused as source material for new artifacts