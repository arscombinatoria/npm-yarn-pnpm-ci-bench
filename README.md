# npm/yarn/pnpm install benchmark

This repository benchmarks install/ci-equivalent performance for npm, pnpm, and Yarn (node-modules and PnP).

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
