# npm-yarn-pnpm-ci-bench

Comparing the installation/CI-equivalent speeds of npm (bundled with Node 20/22/24), yarn (stable, nodeLinker=node-modules/pnp), and pnpm.

## What this does

- Runs `npm install`/`npm ci`, `yarn install`/`yarn install --immutable` with both nodeLinker modes, and `pnpm install`/`pnpm install --frozen-lockfile`.
- Captures cache, lockfile, and node_modules/artifacts state combinations.
- Aggregates p50/p90/mean/min/max statistics and updates the README table on PRs.

## Running locally

```bash
npm run bench:run
npm run bench:merge
npm run bench:render
```

Environment variables:

- `BENCH_RUNS` (default: 15)

## Results

<!-- BENCH:START -->

| pm | pm_mode | node | command | cache | lockfile | node_modules | artifacts | runs | p50_ms | p90_ms | mean_ms | min_ms | max_ms | status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

<!-- BENCH:END -->
