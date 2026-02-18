# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

n8n community node that validates JSON data against a JSON Schema using AJV. It runs as a transform node inside n8n workflows.

## Commands

Package manager is **pnpm** (enforced via preinstall hook — npm/yarn will fail).

| Task | Command |
|------|---------|
| Install | `pnpm install` |
| Build | `pnpm build` (tsc + gulp copies icons to dist/) |
| Dev watch | `pnpm dev` (tsc --watch) |
| Lint | `pnpm lint` |
| Lint fix | `pnpm lintfix` |
| Format | `pnpm format` |
| Test | `pnpm test` (Jest) |
| Test single | `pnpm test -- --testPathPattern=JsonValidatorV1` |
| Test by name | `pnpm test -- -t "should pass a single valid"` |

## Architecture

```
nodes/JsonValidator/
├── JsonValidator.node.ts   — VersionedNodeType wrapper (entry point registered in package.json)
├── ajv.svg                 — Node icon
└── v1/
    ├── JsonValidatorV1.node.ts      — v1 implementation (INodeType)
    └── JsonValidatorV1.node.test.ts — Jest tests
```

- **Versioned node pattern**: `JsonValidator.node.ts` extends `VersionedNodeType` and maps version numbers to implementation classes. The current (and only) version is v1. To add a new version, create a `v2/` directory with a new class and register it in the version map.
- **Dual outputs**: The node has two outputs — **Valid** (index 0) and **Invalid** (index 1). Each input item is validated and routed to the appropriate output. Invalid items include the original data under `item` and the error message under `error`.
- **Validation flow** (in `JsonValidatorV1.node.ts`): validates the schema itself, compiles it with AJV (with `ajv-formats` and `ajv-errors`), then validates each input item. Errors are surfaced via `ajv-errors` with `allErrors: true`. Invalid schemas produce an error item on the Invalid output.
- **continueOnFail**: Unexpected runtime errors (e.g. malformed JSON parameter) are caught. If `continueOnFail` is enabled, all input items are returned on the Invalid output with the error message. Otherwise the error is re-thrown and the workflow stops.
- **Build output** goes to `dist/`. The n8n entry point is `dist/nodes/JsonValidator/JsonValidator.node.js` (declared in `package.json` under `n8n.nodes`). Test files are excluded from the build via `tsconfig.json`.
- **Tests** use a lightweight mock of `IExecuteFunctions` (see `createMockExecuteFunctions` in the test file) rather than importing n8n's test infrastructure. The `execute` method is called with `.call(ctx)` to bind the mock context.

## Code Style

- Tabs for indentation, single quotes, semicolons, trailing commas, 100-char print width, LF line endings.
- ESLint uses `eslint-plugin-n8n-nodes-base` (community node rules). Several rules are explicitly disabled — check `.eslintrc.js` before re-enabling.
- TypeScript strict mode is on (`noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noImplicitReturns`).
