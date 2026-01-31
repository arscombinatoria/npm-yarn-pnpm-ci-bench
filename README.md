# npm/yarn/pnpm install benchmark

This repository benchmarks install/ci-equivalent performance for npm, pnpm, and Yarn (node-modules and PnP).

<!-- BENCH:START -->
| action | cache | lockfile | node_modules | npm(Node20 10.8.2) | npm(Node22 10.9.4) | npm(Node24 11.6.2) | pnpm(10.28.2) | Yarn(4.12.0) | Yarn PnP(4.12.0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| install | ✓ | ✓ | ✓ | 1.0s | 0.9s | 0.9s | 0.6s | 0.9s | 0.8s |
| install | ✓ | ✓ |  | 3.6s | 3.5s | 3.7s | 1.0s | 2.2s | 1.4s |
| install | ✓ |  | ✓ | 1.1s | 0.9s | 1.1s | 1.1s | 1.9s | 1.8s |
| install | ✓ |  |  | 6.2s | 5.6s | 5.7s | 3.0s | 3.3s | 2.7s |
| install |  | ✓ | ✓ | 1.6s | 1.5s | 1.4s | 0.5s | 0.9s | 0.8s |
| install |  | ✓ |  | 5.4s | 5.1s | 5.2s | 2.2s | 2.3s | 1.4s |
| install |  |  | ✓ | 1.2s | 1.1s | 2.6s | 3.4s | 1.8s | 1.8s |
| install |  |  |  | 17.2s | 13.6s | 14.5s | 3.6s | 3.3s | 2.4s |
| ci | ✓ | ✓ | ✓ | 3.7s | 3.7s | 3.8s | 0.6s | 3.3s | 3.3s |
| ci | ✓ | ✓ |  | 3.5s | 3.4s | 3.6s | 1.0s | 4.8s | 3.9s |
| ci |  | ✓ | ✓ | 5.6s | 5.1s | 5.3s | 0.5s | 3.3s | 3.3s |
| ci |  | ✓ |  | 5.3s | 4.9s | 5.1s | 2.2s | 4.7s | 3.9s |
<!-- BENCH:END -->

Results are populated automatically by GitHub Actions using P90 (seconds).
