# Vendored gamebones

This is gamebones v2, package version 0.1.0, from commit
`a5731a4a662b4bcce3ec33ddebf0ce52b8023c20` (2026-09-26).
The upstream `src` tree is `5b159b5cd9c73d444e903df4f957a6a35137357a`.

This revision immediately preceded the game's commit `8641ae6`. The sibling
gamebones repository was clean at `4a4fef8` when vendored; its source tree
is identical to the selected revision. Later commits only added documentation
and licensing. All source files here are copied unchanged from `a5731a4`.

The MIT license comes from upstream commit `c1d4018`, which licensed this
same source tree. The upstream README is included as the kernel manual;
its references to upstream games, tests and design documents refer to that
repository, rather than this source-only copy.

Packaging changes: omit upstream development scripts and dependencies,
include a publish file list and license metadata, and pin runtime dependencies
to the versions used by the sibling checkout: Zod 4.4.3 and fflate 0.8.3.
The game's previous lockfile listed Zod 4.6.5, but its TypeScript and Vite
aliases actually used the sibling's Zod 4.4.3. Both game and kernel now
resolve the same pinned Zod from this repository.

To build the game, run `bun install --frozen-lockfile` and `bun run build`
at the repository root. No sibling checkout is required.
