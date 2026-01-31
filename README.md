# npm-yarn-pnpm-ci-bench

Comparing the installation/CI equivalent speeds of npm (Node 20/22/24 bundled npm), pnpm, and yarn (stable, nodeLinker=node-modules/pnp) via GitHub Actions.

## How it works

- A workflow measures install/ci times across cache/lockfile/node_modules combinations.
- Each matrix entry writes `results/partial/<node>-<scope>.json`.
- A render job merges partials into `results/results.json` and updates the table below.

## Latest P90 (seconds)

@-- BENCH:START --

| action | cache | lockfile | node_modules | npm(Node20 unknown) | npm(Node22 unknown) | npm(Node24 unknown) | pnpm(unknown) | Yarn(unknown) | Yarn PnP(unknown) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| install | ✓ | ✓ | ✓ | — | — | — | — | — | — |
| install | ✓ | ✓ |  | — | — | — | — | — | — |
| install | ✓ |  | ✓ | — | — | — | — | — | — |
| install | ✓ |  |  | — | — | — | — | — | — |
| install |  | ✓ | ✓ | — | — | — | — | — | — |
| install |  | ✓ |  | — | — | — | — | — | — |
| install |  |  | ✓ | — | — | — | — | — | — |
| install |  |  |  | — | — | — | — | — | — |
| ci | ✓ | ✓ | ✓ | — | — | — | — | — | — |
| ci | ✓ | ✓ |  | — | — | — | — | — | — |
| ci |  | ✓ | ✓ | — | — | — | — | — | — |
| ci |  | ✓ |  | — | — | — | — | — | — |

@-- BENCH:END --

## Local usage

```bash
npm run bench:run
npm run bench:merge
npm run bench:render
```
