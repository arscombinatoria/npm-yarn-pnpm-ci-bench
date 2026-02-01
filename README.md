# npm/yarn/pnpm install benchmark

This repository benchmarks install/ci-equivalent performance for npm, pnpm, and Yarn (node-modules and PnP). It focuses on reproducible, cache-aware install scenarios that mirror CI workflows while keeping the dependency set constant (see `package.json`).【F:package.json†L1-L19】

## What gets measured

Each tool is exercised across a matrix of settings:

- **Action:** `install` or `ci` (ci maps to each tool's immutable/locked equivalent).【F:bench/run.mjs†L8-L47】
- **Cache:** warmed vs cold (the relevant cache/store directories are cleared when disabled).【F:bench/run.mjs†L66-L122】
- **Lockfile:** present vs removed (where applicable).【F:bench/run.mjs†L124-L185】
- **node_modules / PnP state:** existing vs removed (PnP artifacts are cleared for Yarn PnP).【F:bench/run.mjs†L92-L185】

Results are summarized as **P90 latency in seconds** across multiple runs to reduce outlier noise.【F:bench/run.mjs†L16-L17】【F:bench/run.mjs†L61-L81】【F:bench/run.mjs†L187-L231】

## How the benchmark works

The entrypoint is `bench/run.mjs`, which:

1. Builds a test matrix (8 `install` cases + 4 `ci` cases).【F:bench/run.mjs†L16-L47】
2. Normalizes state by creating or removing lockfiles, caches, and install artifacts per scenario.【F:bench/run.mjs†L66-L185】
3. Executes the appropriate install command for npm, pnpm, Yarn (node-modules), and Yarn PnP.【F:bench/run.mjs†L27-L59】【F:bench/run.mjs†L216-L264】
4. Writes a JSON payload to `results/partial/<nodeMajor>-<scope>.json` with version metadata and per-case timings.【F:bench/run.mjs†L16-L26】【F:bench/run.mjs†L233-L269】

Two environment variables control sample size:

- `RUNS_CACHED` (default: 11) for cache-warm scenarios.
- `RUNS_NOCACHE` (default: 3) for cache-cold scenarios.【F:bench/run.mjs†L12-L17】【F:bench/run.mjs†L193-L205】

## Running the benchmarks locally

### Prerequisites

- Node.js (the script can target multiple Node majors via `--node`).
- npm, pnpm, and yarn available on PATH.

### Commands

Run all tools for a specific Node major:

```bash
npm run bench:run -- --node 24 --scope all
```

Limit to npm only:

```bash
npm run bench:run -- --node 24 --scope npm
```

Merge partial runs into a single results file:

```bash
npm run bench:merge
```

Update the README benchmark table from `results/results.json`:

```bash
npm run bench:render
```

The merge step collects every JSON file in `results/partial` and writes a single `results/results.json` payload consumed by the README renderer.【F:bench/merge-results.mjs†L1-L30】【F:bench/render-readme.mjs†L1-L118】

## Results table

The benchmark table below is updated automatically by CI. The `<!-- BENCH:START -->` and `<!-- BENCH:END -->` markers are maintained by `bench/render-readme.mjs`, so edits inside the marker block will be overwritten during rendering.【F:bench/render-readme.mjs†L108-L118】

<!-- BENCH:START -->
| action | cache | lockfile | node_modules | npm(Node20 10.8.2) | npm(Node22 10.9.4) | npm(Node24 11.6.2) | pnpm(10.28.2) | Yarn(4.12.0) | Yarn PnP(4.12.0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| install | ✓ | ✓ | ✓ | 1.0s | 0.8s | 0.9s | 0.7s | 0.9s | 0.8s |
| install | ✓ | ✓ |  | 3.5s | 3.5s | 4.1s | 1.1s | 2.5s | 1.5s |
| install | ✓ |  | ✓ | 1.0s | 1.0s | 1.3s | 1.3s | 2.0s | 1.8s |
| install | ✓ |  |  | 6.4s | 5.8s | 6.2s | 2.9s | 3.6s | 2.5s |
| install |  | ✓ | ✓ | 1.5s | 1.3s | 1.2s | 0.6s | 0.9s | 0.8s |
| install |  | ✓ |  | 5.6s | 5.0s | 5.6s | 2.5s | 2.5s | 1.5s |
| install |  |  | ✓ | 1.0s | 0.9s | 4.0s | 3.0s | 2.0s | 1.8s |
| install |  |  |  | 18.5s | 15.1s | 17.5s | 4.1s | 3.6s | 2.6s |
| ci | ✓ | ✓ | ✓ | 3.7s | 3.7s | 4.2s | 0.6s | 3.6s | 3.5s |
| ci | ✓ | ✓ |  | 3.5s | 3.4s | 4.0s | 1.1s | 5.2s | 4.2s |
| ci |  | ✓ | ✓ | 5.5s | 5.0s | 5.7s | 0.6s | 3.6s | 3.4s |
| ci |  | ✓ |  | 5.5s | 4.8s | 5.5s | 2.5s | 5.2s | 4.2s |
<!-- BENCH:END -->

Results are populated automatically by GitHub Actions using P90 (seconds).
