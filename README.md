# npm/yarn/pnpm install benchmark

This repository benchmarks install/ci-equivalent performance for npm, pnpm, and Yarn (node-modules and PnP).

<!-- BENCH:START -->
| action | cache | lockfile | node_modules | npm(Node20 10.8.2) | npm(Node22 10.9.4) | npm(Node24 11.6.2) | pnpm(10.28.2) | Yarn(4.12.0) | Yarn PnP(4.12.0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| install | ✓ | ✓ | ✓ | 0.5s | 0.5s | 0.5s | 0.4s | 0.3s | 0.3s |
| install | ✓ | ✓ |  | 1.1s | 1.0s | 1.2s | 0.6s | 0.8s | 0.4s |
| install | ✓ |  | ✓ | 0.6s | 0.5s | 0.5s | 0.6s | 0.7s | 0.6s |
| install | ✓ |  |  | 1.6s | 1.6s | 1.6s | 1.0s | 1.1s | 0.8s |
| install |  | ✓ | ✓ | 0.7s | 0.5s | 0.4s | 0.4s | 0.3s | 0.3s |
| install |  | ✓ |  | 1.5s | 1.4s | 1.5s | 0.9s | 0.8s | 0.4s |
| install |  |  | ✓ | 0.5s | 0.5s | 0.5s | 1.0s | 0.6s | 0.6s |
| install |  |  |  | 3.1s | 3.1s | 2.8s | 1.2s | 1.2s | 0.7s |
| ci | ✓ | ✓ | ✓ | 1.2s | 1.1s | 1.2s | 0.4s | 1.1s | 1.1s |
| ci | ✓ | ✓ |  | 1.1s | 1.0s | 1.2s | 0.6s | 1.5s | 1.1s |
| ci |  | ✓ | ✓ | 1.6s | 1.5s | 1.5s | 0.4s | 1.1s | 1.0s |
| ci |  | ✓ |  | 1.5s | 1.4s | 1.5s | 0.9s | 1.5s | 1.1s |
<!-- BENCH:END -->

Results are populated automatically by GitHub Actions using P90 (seconds).
