# Push this to your GitHub repo — two commands

This zip contains everything: the full source tree **and** the complete git
history (11 commits) on the branch `feature/roadmap-phases`, on top of your
current `main` (`639aae5`).

The sandbox this work was done in has no GitHub credentials, so the push has
to come from you. It takes under a minute:

## Option A — from the included source folder (simplest)

```bash
cd chokepoint-source
git init
git remote add origin https://github.com/ehsannaeemirad-droid/Chokepoint.git
git fetch origin main
git reset --soft origin/main          # keep this exact tree, replay as one commit on main
git add -A
git commit -m "v0.3.0: six-phase plan + four improvements (full history in chokepoint.bundle)"
git push origin main
```

## Option B — keep the full 11-commit history (recommended)

```bash
# unpack the zip, then from the folder that holds chokepoint.bundle:
git clone chokepoint.bundle chokepoint-history
cd chokepoint-history
git checkout feature/roadmap-phases
git remote add origin https://github.com/ehsannaeemirad-droid/Chokepoint.git
git push origin feature/roadmap-phases
# then on GitHub: open the PR feature/roadmap-phases -> main and merge
```

`git clone chokepoint.bundle` recreates the repository with **every commit
and message** (phases 1–6, improvements 1/2/6/7, the baseline repair). If
you would rather push straight to `main` instead of a branch:

```bash
git push origin feature/roadmap-phases:main
```

## What you get (v0.3.0)

- Six-phase plan complete (four victory paths, US domestic constraints,
  logistics/initiative/Qatar talks, fog of war, mobile navigation, Persian
  templates) — commits `ea39e13`…`2e5edac`.
- Four owner-picked improvements (escalation ladder & red lines, logistics
  depth, ROE presets, graded multi-axis settlement) — commits `46a3bfa`…`3ab9369`.
- 141 tests, all passing (`corepack pnpm test`); `corepack pnpm build` clean.
- Initial bundle: 76.1 kB (app) + 357.0 kB (Phaser) + 5.5 kB (CSS) + 0.5 kB
  (HTML) gzip ≈ **439 kB** of the 500 kB budget.
- Save/replay format v3; v1 and v2 saves migrate on load.
- All interpretive choices recorded in `DESIGN.md` under *Decisions* (1–41).

## Verify before pushing (optional but wise)

```bash
cd chokepoint-source
corepack pnpm install
corepack pnpm test     # expect: 14 files, 141 tests, all green
corepack pnpm build    # expect: clean tsc + bundle sizes above
```
