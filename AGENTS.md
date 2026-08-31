<!-- kb:context scopes/repository--cdb4ee2aea69 -->
# Contents

- `src/` and `test/` – the QMD CLI, local search runtime, storage, ranking, MCP surface, and cross-runtime tests.
- `bin/` and `scripts/` – the stable shell wrapper, build, package, test, and release commands.
- `finetune/` – separately managed Python and uv query-expansion finetuning tools.
- `skills/` – QMD-specific usage and release skills preserved from upstream.
- `kb/` – authored repository rationale, evidence, synthesis, and plans.
- `.agents/skills/` – reusable cross-repository KB and phased-execution workflows.
- `WRITING.md` and `STYLE.md` – internal and public prose contracts.
- `CLAUDE.md` – upstream operating rules, including commands that must not run automatically.

# Guidelines

- Keep this Hraness fork thin and upstream-rebase-friendly. Preserve the public `@tobilu/qmd` identity, upstream build wrapper, Node and Bun test paths, pnpm and Bun lockfiles, and Nix and Python boundaries.
- Follow every `CLAUDE.md` prohibition. Never run collection indexing, embedding, or update commands automatically, never modify the SQLite index directly, and never use `bun build --compile`.
- Follow `WRITING.md` for internal prose and `STYLE.md` for public prose. Keep mandatory rules in the closest `AGENTS.md`, current procedures in `docs/`, executable contracts in types and tests, and pull-based rationale and plans in `kb/`.
- Apply unreasonably robust programming when agent work is cheap. Model invalid states out of existence, parse foreign values from `unknown`, and pair readable regression examples with property tests for parser, path, ranking, encoding, and round-trip laws.
- Deliver changes to `main` through a current-head pull request. Keep the stable `Required` CI job green, resolve every review thread, and serialize merges. Human approval stays optional while one regular maintainer would otherwise self-review. Never force-push or bypass the gate.
- Pin Hraness dependencies to reviewed immutable releases or full commits. Never connect repositories with sibling paths, Git submodules, or coordinated `main` assumptions.
- Extract a shared package only after two concrete consumers need the same stable interface. Keep shared packages product-neutral and keep indexing, embeddings, ranking, and CLI behavior here.
- Freeze shared interfaces before parallel lanes begin. Give manifests, lockfiles, generated files, native compatibility pins, and other convergence surfaces one owner while lanes edit disjoint paths.
- Keep QMD-specific skills under `skills/`; `.agents/skills/` contains the portable repository baseline.
- Do not change package manifests or locks for KB tooling. Run `bunx --bun github:hraness/kb#v0.15.2 refresh --root kb`, `bunx --bun github:hraness/kb#v0.15.2 check --root kb`, and `bunx --bun github:hraness/kb#v0.15.2 agents check --root kb --repo .` directly.
- Run the documented Node and Bun test paths and package smoke before handing off source changes.

<!-- hra-local-efficiency:start -->
- Preserve useful agent fan-out. Give each expensive focused validation command and external wait one owner; the integration owner reviews that evidence and runs the repository-required aggregate or final gate once after convergence. Reuse evidence only for the exact Git tree, command, lockfiles, toolchain, relevant environment, and validity period, and never to skip a required final integration, merge, release, deployment, or production-verification gate. On Hraness development machines, use `$hra-local-efficiency` and the installed host scheduler for heavyweight top-level commands when available.
<!-- hra-local-efficiency:end -->
