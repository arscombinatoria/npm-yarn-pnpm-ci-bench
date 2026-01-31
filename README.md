# npm/yarn/pnpm install benchmark

This repository benchmarks install/ci-equivalent performance for npm, pnpm, and Yarn (node-modules and PnP).

<!-- BENCH:START -->
| action | cache | lockfile | node_modules | npm(Node20 10.8.2) | npm(Node22 10.9.4) | npm(Node24 11.6.2) | pnpm(10.28.2) | Yarn(4.12.0) | Yarn PnP(4.12.0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| install | ✓ | ✓ | ✓ | 1.0s | 0.9s | 1.1s | 0.6s | 0.9s | 0.8s |
| install | ✓ | ✓ |  | 3.7s | 3.5s | 3.6s | 0.9s | 2.4s | 1.5s |
| install | ✓ |  | ✓ | 1.1s | 1.0s | 1.1s | 1.1s | 1.8s | 1.8s |
| install | ✓ |  |  | 6.3s | 5.6s | 6.1s | 2.6s | 3.2s | 2.5s |
| install |  | ✓ | ✓ | 1.8s | 1.6s | 1.5s | 0.5s | 0.9s | 0.9s |
| install |  | ✓ |  | 5.7s | 5.2s | 5.2s | 2.2s | 2.1s | 1.6s |
| install |  |  | ✓ | 1.3s | 1.3s | 2.9s | 2.5s | 1.9s | 1.9s |
| install |  |  |  | 13.4s | 14.3s | 13.0s | 3.5s | 3.1s | 2.8s |
| ci | ✓ | ✓ | ✓ | 3.8s | 3.7s | 3.6s | 0.6s | 3.4s | 3.4s |
| ci | ✓ | ✓ |  | 3.6s | 3.5s | 3.3s | 1.0s | 4.7s | 4.2s |
| ci |  | ✓ | ✓ | 5.8s | 5.2s | 5.3s | 0.5s | 3.4s | 3.6s |
| ci |  | ✓ |  | 11.8s | 5.0s | 5.4s | 2.0s | 4.7s | 3.9s |
<!-- BENCH:END -->

Results are populated automatically by GitHub Actions using P90 (seconds).
