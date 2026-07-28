# Repository Guide for Coding Agents

This file applies to the entire repository.

## Project

`airport-utils` is a synchronous TypeScript library for converting local airport or IANA timezone
timestamps to UTC and for reading bundled airport metadata.

- Runtime: Node.js 22 or newer
- Local default: Node.js 24 (`.nvmrc`)
- Compiler: TypeScript 7 only
- Build: Rolldown, producing ESM and CommonJS
- Lint and format: Oxlint and Oxfmt
- Tests: Vitest with V8 coverage

Do not reintroduce TypeScript 6, Jest, ESLint, Prettier, Rollup, `ts-node`, or equivalent legacy
compatibility layers without an explicit request.

## Commands

Use the repository Node version before installing or validating:

```bash
nvm use
npm ci
```

Primary checks:

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
```

`npm test` type-checks, builds both module formats, runs all tests, and enforces 100% statement,
branch, function, and line coverage.

`npm run typecheck` runs the TypeScript solution with `tsc --build --noEmit`. Keep shared compiler
options in `tsconfig.base.json`, project references in `tsconfig.json`, publishable-source settings
in `tsconfig.build.json`, and tests, scripts, and tooling in `tsconfig.test.json`. In particular,
keep `rootDir: "src"` build-only so editor and CI validation can include repository tooling.

For dependency or build-system changes, validate clean installs and tests on both supported CI
versions: Node.js 22 and Node.js 24.

## Source and API

- Keep public APIs synchronous and backward-compatible unless a breaking change is requested.
- Preserve strict timestamp validation and the existing behavior that rejects nonexistent and
  ambiguous DST wall-clock times.
- Years `0000` through `0099` are not a supported use case; retain the faster `Date.UTC` path.
- Export types with `export type`.
- Preserve the package root API and the lightweight `airport-utils/converter`,
  `airport-utils/info`, and `airport-utils/errors` subpath exports.
- Add or update tests whenever public behavior changes.

## Generated Mapping Data

Do not hand-edit files under `src/mapping/`.

Regenerate them with:

```bash
npm run update:mapping
```

The generator runs directly through Node's TypeScript support. Its generated-data imports use the
private `#mapping/geo` and `#mapping/timezones` aliases declared in `package.json`; preserve these
aliases. Relative extensionless ESM imports fail in native Node, while relative `.ts` specifiers
trigger TS5097 unless `allowImportingTsExtensions` is enabled. Do not add that compiler escape hatch
or a custom TypeScript loader for this script.

The generator enforces request timeouts, source hashing, coordinate validation, minimum entry
counts, maximum count drops, and required-airport checks. Do not weaken these gates merely to make
an upstream update pass; investigate the source change first.

The bundled mapping data is transformed from Open Travel Data and requires the attribution in
`NOTICE`. Preserve the generated source and SHA-256 comments and keep `NOTICE` in published
artifacts.

## Build and Package

Rolldown emits preserved ESM and CommonJS modules. `scripts/dedupeBuildMappings.mjs` then replaces
duplicated mapping modules with wrappers around shared JSON assets. Preserve this step so the
published package does not duplicate the large dataset.

After package-layout or export changes, run:

```bash
npm pack --dry-run
```

Verify that `LICENSE`, `NOTICE`, declarations, ESM, CommonJS, and shared mapping JSON are included.

## Workflows and Security

- Pin GitHub Actions to full commit SHAs and retain the readable version comments.
- Use least-privilege workflow permissions, timeouts, and concurrency controls.
- Publishing uses npm trusted publishing through GitHub OIDC; do not add a long-lived `NPM_TOKEN`.
- Keep dependency auditing read-only. Do not add automated `npm audit fix` workflows.
- Production dependencies must pass `npm audit --omit=dev --audit-level=high`.

## Releases

Semantic-release runs after successful CI on `main`. Follow Conventional Commits. Standard
`fix`, `perf`, `feat`, and breaking-change semantics determine releases; only
`chore(mapping)` has an explicit patch-release rule. Tooling, documentation, formatting, and test
changes should not publish package versions by themselves.

## Session Learnings and Guardrails

The current architecture reflects several findings from the TypeScript 7 and Rust-tooling
migration:

- Install TypeScript 7 directly as `typescript`. A scoped npm alias did not expose the expected
  `tsc` binary, while side-by-side TypeScript aliases caused binary collisions. TypeScript 6 is not
  part of the supported development or consumer contract.
- Keep `Date.UTC` in the conversion hot path. Constructing a `Date` and calling `setUTCFullYear`
  made timestamp construction approximately 3.34 times slower in a Node.js 24 microbenchmark.
  Supporting years `0000` through `0099` is not worth that runtime cost for this project.
- The ESM and CommonJS builds originally duplicated the full geographic and timezone datasets.
  Shared JSON assets reduced the packed artifact from roughly 624 KB to 312 KB and the unpacked
  artifact from roughly 3.49 MB to 1.61 MB. Treat those numbers as package-size regression
  baselines.
- Importing the package root necessarily exposes both conversion and airport-information APIs.
  Conversion-only consumers should use `airport-utils/converter`, which avoids loading the large
  geographic dataset. Preserve the built-package test that verifies this behavior.
- The current checked-in mappings contain about 8,400 airports. The generator's 8,000-entry floor,
  2% maximum drop, anchor-airport checks, coordinate validation, request timeout, and source hash
  protect against silently publishing truncated or corrupted upstream data.
- A full npm audit currently reports development-only findings through semantic-release's bundled
  npm dependencies. The production graph has zero known vulnerabilities. Do not downgrade current
  release tooling or run forceful audit fixes merely to make the development-only count disappear.
- OIDC permissions in `publish.yml` are only the repository half of trusted publishing. The npm
  package settings must trust owner `elipeF`, repository `airport-utils`, workflow `publish.yml`,
  and the `npm publish` action before tokenless releases can succeed.
- Dependabot version updates intentionally use one multi-ecosystem group for npm and GitHub
  Actions. Preserve the catch-all patterns so routine updates remain consolidated in one weekly
  pull request.
- TypeScript project boundaries must match editor ownership and CI validation. A shared
  `rootDir: "src"` caused TS6059 when tests imported `scripts/generateMapping.ts`; keeping it in the
  build project and validating the root solution prevents editor-only diagnostics.
- `Array.prototype.toSorted` requires the ES2023 library. The mapping generator sorts the fresh
  array returned by `Object.keys` in place instead, avoiding an extra copy and retaining the ES2022
  target. Keep the narrow Oxlint exception documenting why mutation is safe there.
- TypeScript 7 installs a platform-specific native compiler package. When switching between Node
  installations with different architectures, run a clean `npm ci` under each Node version rather
  than reusing `node_modules`; CI matrix jobs already install independently.

Do not commit, push, publish, or open pull requests unless explicitly requested.
