# npm-yarn-pnpm-ci-bench

Compare the installation/CI-equivalent speeds of npm (Node 20/22/24 bundled npm), yarn (stable; nodeLinker=node-modules/pnp), and pnpm using GitHub Actions.

## Benchmarks

- Run count: 15 by default (override with `BENCH_RUNS`).
- Partial results are stored in `results/partial/<node>.json` per Node major.
- Merged results are stored in `results/results.json`.

### Latest Results

<!-- BENCH:START -->

No benchmark results yet.

<!-- BENCH:END -->

## Scripts

- `npm run bench:run`: run a single-node benchmark and emit a partial results file.
- `npm run bench:merge`: merge partial results into `results/results.json`.
- `npm run bench:render`: render the results table into this README.
