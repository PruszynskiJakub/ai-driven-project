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
- **Language**: TypeScript with ESNext target
- **Entry point**: `index.ts` - currently a minimal starter file
- **Configuration**: 
  - `tsconfig.json` - TypeScript configuration with strict mode enabled
  - `package.json` - minimal configuration with @types/bun dev dependency

## TypeScript Configuration

The project uses strict TypeScript settings with:
- ESNext lib and target
- Bundler module resolution
- JSX support (react-jsx)
- Strict type checking enabled
- Import extensions allowed for bundler mode

## Development Notes

Since this is a fresh Bun project with minimal setup, most development patterns will need to be established as the codebase grows. The current structure supports modern TypeScript/ESNext development with Bun's built-in capabilities for running, testing, and bundling.

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