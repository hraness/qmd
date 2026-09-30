# Update dependencies

Node CI uses pnpm 10.34.6 with `pnpm-lock.yaml`. Bun CI uses Bun 1.3.14 with
`bun.lock`. Both installs require a matching lockfile and fail if the manifest
needs dependency resolution. The Node job restores the matching pnpm store;
only main pushes save it.

When changing a dependency, set its reviewed version in `package.json`, then
update both lockfiles with the pinned package managers:

```sh
pnpm install --lockfile-only
bun install --lockfile-only
```

After syncing upstream, first resolve the manifest and lockfile changes while
retaining the fork's reviewed dependency pins. Run the same two lockfile commands
even when upstream supplies only one updated lock. Include both resulting locks
in the sync change, then perform the frozen installs and checks below. Do not
remove frozen mode to make a stale lock pass CI.

Review the manifest and both lockfile diffs before committing. Verify the frozen
installs and run both runtime test paths plus the package smoke:

```sh
pnpm install --frozen-lockfile
pnpm run test:node
pnpm run test:package
bun install --frozen-lockfile
bun run test:bun
```

Use a development checkout for these commands. Keep generated package output and
local search indexes out of the dependency change.
