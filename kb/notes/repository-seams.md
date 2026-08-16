---
title: Repository seams
type: concept
tags:
  - architecture
  - dependencies
  - repositories
repository_scopes:
  - AGENTS.md
  - package.json
---

# Repository seams

QMD is an upstream-derived CLI with Node and Bun test paths, pnpm and Bun lockfiles, native SQLite and llama dependencies, Python finetuning tools, and Nix support. Its package identity, build wrapper, package-manager conventions, and `CLAUDE.md` safety rules are upstream compatibility seams. Keep Hraness governance additive and easy to rebase.

QMD declares no outbound Hraness package dependency. If a shared Hraness seam becomes necessary, use an immutable release or full commit. Do not use sibling paths, Git submodules, or coordinated `main` workflows. Never turn a governance rollout into a native build or index migration.

Indexing, embeddings, ranking, and CLI behavior remain owned here. Extract a package only after two concrete consumers need a stable, product-neutral interface. Preserve readable regressions and add property coverage when parsers, paths, ranking laws, encodings, or round trips support broad generated inputs.

## Related

The normative rules remain in the root `AGENTS.md`. [[documentation-ownership|Documentation ownership]] explains how those rules relate to executable contracts and this pull-based context.

