# npm/yarn/pnpm install benchmark

This repository benchmarks install/ci-equivalent performance for npm, pnpm, and Yarn (node-modules and PnP).

@-- BENCH:START --
| action | cache | lockfile | node_modules | npm(Node20 -) | npm(Node22 -) | npm(Node24 -) | pnpm(-) | Yarn(-) | Yarn PnP(-) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
@-- BENCH:END --

Results are populated automatically by GitHub Actions using P90 (seconds).
