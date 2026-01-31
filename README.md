# npm-yarn-pnpm-ci-bench

Comparing the installation/CI equivalent speeds of npm, yarn (stable, nodeLinker=node-modules/pnp), and pnpm.

<!-- BENCH:START -->
| action | cache | lockfile | node_modules | npm(Node20 n/a) | npm(Node22 n/a) | npm(Node24 n/a) | pnpm(n/a) | Yarn(n/a) | Yarn PnP(n/a) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| install |  |  |  |  |  |  |  |  |  |
| install |  |  | ✓ |  |  |  |  |  |  |
| install |  | ✓ |  |  |  |  |  |  |  |
| install |  | ✓ | ✓ |  |  |  |  |  |  |
| install | ✓ |  |  |  |  |  |  |  |  |
| install | ✓ |  | ✓ |  |  |  |  |  |  |
| install | ✓ | ✓ |  |  |  |  |  |  |  |
| install | ✓ | ✓ | ✓ |  |  |  |  |  |  |
| ci |  | ✓ |  |  |  |  |  |  |  |
| ci |  | ✓ | ✓ |  |  |  |  |  |  |
| ci | ✓ | ✓ |  |  |  |  |  |  |  |
| ci | ✓ | ✓ | ✓ |  |  |  |  |  |  |
<!-- BENCH:END -->
