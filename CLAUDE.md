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