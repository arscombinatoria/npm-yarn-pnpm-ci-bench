# npm/yarn/pnpm install benchmark

This repository benchmarks install/ci-equivalent performance for npm, pnpm, and Yarn (node-modules and PnP). It focuses on reproducible, cache-aware install scenarios that mirror CI workflows while keeping the dependency set constant (see `package.json`).【F:package.json†L1-L19】

## What gets measured

Each tool is exercised across a matrix of settings:

- **Action:** `install` or `ci` (ci maps to each tool's immutable/locked equivalent).【F:bench/run.mjs†L8-L47】
- **Cache:** warmed vs cold (the relevant cache/store directories are cleared when disabled).【F:bench/run.mjs†L66-L122】
- **Lockfile:** present vs removed (where applicable).【F:bench/run.mjs†L124-L185】
- **node_modules / PnP state:** existing vs removed (PnP artifacts are cleared for Yarn PnP).【F:bench/run.mjs†L92-L185】
- **Execution controls (standardized):** all runs share a CI-like env (`CI=1`, progress minimization vars), and package-manager invocations are normalized to quiet/non-interactive forms where possible (npm: `--no-audit --no-fund --loglevel=error`, pnpm: `--reporter=silent` (`install` uses `--no-frozen-lockfile`, `ci` uses `--frozen-lockfile`), yarn: progress-bar suppression env + immutable/non-immutable mode flags).【F:bench/run.mjs†L35-L64】【F:bench/run.mjs†L93】

Results are summarized as **P90 latency in seconds** across multiple runs to reduce outlier noise.

## How the benchmark works

The entrypoint is `bench/run.mjs`, which:

1. Builds a test matrix (8 `install` cases + 4 `ci` cases).【F:bench/run.mjs†L16-L47】
2. Normalizes state by creating or removing lockfiles, caches, and install artifacts per scenario.【F:bench/run.mjs†L66-L185】
3. Executes the appropriate install command for npm, pnpm, Yarn (node-modules), and Yarn PnP.【F:bench/run.mjs†L27-L59】【F:bench/run.mjs†L216-L264】
4. Writes a JSON payload to `results/partial/<nodeMajor>-<scope>.json` with version metadata and per-case timings.【F:bench/run.mjs†L16-L26】【F:bench/run.mjs†L233-L269】

Sample control is configurable through environment variables:

- `RUNS_CACHED` (default: 11): baseline maximum runs for cache-warm scenarios.
- `RUNS_NOCACHE` (default: 3): baseline maximum runs for cache-cold scenarios.
- `MIN_RUNS` (default: 3): minimum runs always executed before any early-stop decision.
- `MAX_RUNS` (default: `0`): hard upper bound for adaptive sampling (`0` means use `RUNS_CACHED`/`RUNS_NOCACHE`).
- `TARGET_REL_HALF_WIDTH` (default: `0.05`): stop when median-based robust relative half-width falls below this value.


### Adaptive sampling

`runCases` now uses adaptive stopping to balance runtime and confidence:

1. Each case runs at least `MIN_RUNS`.
2. After each run, stability is recomputed from collected samples using:
   - **median**,
   - **IQR** (`P75 - P25`),
   - **robust median standard error** (`1.57 * IQR / sqrt(n)`), and
   - **relative half-width** (`robust median standard error / median`).
3. If relative half-width meets `TARGET_REL_HALF_WIDTH`, that case ends early.
4. Otherwise, sampling continues until `MAX_RUNS` (or the baseline run count when `MAX_RUNS=0`).

Every case in output JSON now includes:

- `actual_runs`: the real sample count used for that case.
- `stability`: computed diagnostics (`relative_half_width`, threshold, and supporting dispersion stats).

This reduces total benchmark time for stable cases while preserving traceable reliability metadata for noisier cases.

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

The merge step collects every JSON file in `results/partial` and writes a single `results/results.json` payload consumed by the README renderer.

## Results table

The benchmark table below is updated automatically by CI. The `\<!-- BENCH:START --\>` and `\<!-- BENCH:END --\>` markers are maintained by `bench/render-readme.mjs`, so edits inside the marker block will be overwritten during rendering.
Column order is deterministic: benchmark columns are sorted by Node major version ascending, then by tool order (`npm` → `pnpm` → `yarn` → `yarn-pnp`, then lexical for unknown tools).

<!-- BENCH:START -->
| action | cache | lockfile | node_modules | npm<br>20 | npm<br>22 | npm<br>24 | pnpm<br>24 | Yarn<br>24 | Yarn PnP<br>24 |
| --- | :---: | :---: | :---: | ---: | ---: | ---: | ---: | ---: | ---: |
| install | ✓ | ✓ | ✓ | 1.3s | 1.1s | 0.8s | 0.6s | 0.9s | 0.8s |
| install | ✓ | ✓ |  | 3.7s | 4.1s | 4.0s | 1.1s | 2.5s | 1.5s |
| install | ✓ |  | ✓ | 1.1s | 1.1s | 1.2s | 1.2s | 2.0s | 1.8s |
| install | ✓ |  |  | 6.6s | 6.2s | 6.4s | 2.7s | 3.5s | 2.4s |
| install |  | ✓ | ✓ | 1.4s | 1.3s | 0.8s | 0.6s | 0.9s | 0.8s |
| install |  | ✓ |  | 5.6s | 5.5s | 5.2s | 2.4s | 2.5s | 1.5s |
| install |  |  | ✓ | 0.9s | 0.8s | 3.3s | 2.4s | 1.8s | 1.8s |
| install |  |  |  | 13.9s | 14.4s | 14.5s | 3.5s | 3.4s | 2.5s |
| ci | ✓ | ✓ | ✓ | 4.1s | 4.4s | 4.0s | 0.6s | 3.4s | 3.5s |
| ci | ✓ | ✓ |  | 3.6s | 3.9s | 3.8s | 1.1s | 5.0s | 4.2s |
| ci |  | ✓ | ✓ | 5.7s | 5.5s | 5.4s | 0.5s | 3.5s | 3.4s |
| ci |  | ✓ |  | 5.5s | 5.3s | 5.1s | 2.4s | 5.3s | 4.2s |

Versions:
- npm 10.8.2 on Node 20
- npm 10.9.7 on Node 22
- npm 11.11.0 on Node 24
- pnpm 10.33.0 on Node 24
- Yarn 4.13.0 on Node 24
- Yarn PnP 4.13.0 on Node 24
<!-- BENCH:END -->

Results are populated automatically by GitHub Actions using P90 (seconds).
