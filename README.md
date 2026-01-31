# npm/yarn/pnpm install benchmark

This repository benchmarks install/ci-equivalent performance for npm, pnpm, and Yarn (node-modules and PnP).

<!-- BENCH:START -->
| action | cache | lockfile | node_modules | npm(Node20 10.8.2) | npm(Node22 10.9.4) | npm(Node24 11.6.2) | pnpm(10.28.2) | Yarn(4.12.0) | Yarn PnP(4.12.0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| install | ✓ | ✓ | ✓ | 0.8s | 0.8s | 0.8s | 0.7s | 0.9s | 0.7s |
| install | ✓ | ✓ |  | 3.2s | 3.1s | 3.4s | 1.0s | 2.2s | 1.3s |
| install | ✓ |  | ✓ | 1.0s | 0.8s | 1.1s | 1.1s | 1.9s | 1.8s |
| install | ✓ |  |  | 5.9s | 5.2s | 5.5s | 2.8s | 3.3s | 2.4s |
| install |  | ✓ | ✓ | 1.3s | 1.2s | 1.1s | 0.6s | 0.9s | 0.8s |
| install |  | ✓ |  | 4.9s | 4.5s | 4.7s | 2.2s | 2.2s | 1.3s |
| install |  |  | ✓ | 0.9s | 0.8s | 2.7s | 2.4s | 1.8s | 1.7s |
| install |  |  |  | 14.7s | 14.4s | 13.4s | 3.7s | 3.2s | 2.3s |
| ci | ✓ | ✓ | ✓ | 3.3s | 3.2s | 3.5s | 0.6s | 3.3s | 3.3s |
| ci | ✓ | ✓ |  | 3.1s | 3.0s | 3.4s | 1.0s | 4.8s | 3.8s |
| ci |  | ✓ | ✓ | 5.0s | 4.5s | 4.9s | 0.5s | 3.3s | 3.2s |
| ci |  | ✓ |  | 4.9s | 4.4s | 4.8s | 2.2s | 4.7s | 3.8s |
<!-- BENCH:END -->

Results are populated automatically by GitHub Actions using P90 (seconds).
