# Team Coordination

Running a multi-week refactor on a team without blocking feature work.

## The Core Tension

- The refactor wants **long-lived branch** - stable base, audits comparing before/after, clear rollback.
- The team wants **short-lived branches** - merge to `main` daily, no rebase hell, feature velocity.

These are genuinely in conflict. Pick one of the strategies below based on team size and feature-work pressure.

## Strategy A - Solo / Small Team (1-2 devs, low feature pressure)

**Pattern:** long-lived `refactor/architecture` branch, merge to `main` at phase checkpoints.

- Phases 0-2 can take 2-6 weeks.
- Merge to `main` at each `checkpoint/phase-N-complete` tag.
- Feature work pauses or routes through the refactor branch.

**When to use:** pre-launch products, internal tools, side projects, solo work.

**Risk:** stale branch drifts from `main`. Rebase at every checkpoint.

## Strategy B - Active Team (3-6 devs, steady feature pressure)

**Pattern:** refactor branch PRs merge to `main` **as they're validated**, not as a single drop.

- `refactor/architecture` exists only as a tracking label, not a real branch.
- Each sub-task is a PR directly into `main`.
- Feature work continues on `main` normally.

**How to make it work:**

1. Use **re-exports religiously** (Phase 3). They're what make incremental merges safe - consumers don't need to change.
2. PR title prefix: `[refactor/phase-N]` - lets reviewers triage quickly.
3. **Require code-validator to pass** as a CI gate on refactor PRs.
4. One person per domain during Phase 4 migration - avoids merge conflicts when batches overlap.

**When to use:** growing SaaS products, B2B SaaS with contractual delivery dates.

**Risk:** "forgot the last 5%" - the strip-and-audit in Phase 5 stalls because people move on to other work. Assign an owner explicitly.

## Strategy C - Large Team (7+ devs, high feature pressure)

**Pattern:** dedicated refactor squad + "do not touch" rules on files being actively refactored.

- A small squad (1-3 devs) owns the refactor for 1-2 quarters.
- Post a **refactor schedule** to a team channel, listing which files are being touched this week.
- Feature teams coordinate: if a file is on the list, they pause feature work on it or hand the feature to the refactor squad.
- Weekly sync to resolve overlaps.

**Branching:** hybrid - short-lived PRs to `main` (as in Strategy B), but with explicit `do-not-merge` labels during sensitive windows (e.g., splitting the monolith in Phase 3 takes ~1 day of exclusive access).

**When to use:** 100k+ LOC codebases, production apps with paying customers, compliance constraints.

**Risk:** scheduling overhead eats velocity. The refactor squad needs authority to say "freeze this file this week."

## Merge Conflict Triage

Conflicts **will** happen. A triage protocol:

1. **Conflict on a file being moved / split (Phase 3):** the refactor PR wins. Feature PR rebases and re-applies on the new location.
2. **Conflict on an import path (Phase 4):** feature PR wins. Refactor PR rebases and re-runs the batch migration.
3. **Conflict on a function body (Phase 2 extraction):** manual merge - compare whether the extraction still applies after the feature change. Sometimes the extraction is invalidated; redo it.
4. **Conflict on a test:** both PRs likely added tests for the same surface. Merge both.

## PR Hygiene

Refactor PRs should be **easy to review**. Enforce:

- Small (< 400 lines diff). If it's larger, split.
- Descriptive title: `[refactor/phase-3] Extract ordersApi from lib/supabase`.
- Body includes: what moved, what the re-export looks like, grep command the reviewer can run to verify consumers aren't broken.
- code-validator output pasted in the description (or linked via CI).
- Rollback note: "revert this PR to restore previous state - no downstream changes."

## Pausing the Refactor

Acceptable reasons to pause mid-refactor:

- Production incident consuming the team.
- Hard external deadline (launch, compliance audit).
- Phase checkpoint discovered a design flaw requiring a rethink.

**How to pause cleanly:**

1. Finish the current PR or revert it.
2. Tag `checkpoint/phase-N-pause-YYYYMMDD`.
3. Post a resume plan: where you stopped, what's next, what bugs were deferred.
4. Resume later from that tag.

A paused refactor is recoverable. A forgotten refactor becomes tech debt the next person has to untangle.

## Signals the Refactor is Going Wrong

- Conflicts on every merge → branch has drifted; rebase or switch strategies.
- code-validator failing on main after a refactor merge → CI wasn't enforced; tighten the gate.
- A phase takes 2-3× the estimate → the scorecard underestimated complexity; recalibrate before continuing.
- Team morale drops → too many concurrent refactor PRs in review; reduce WIP.
- Sub-branches that never merge → bisect and kill them; the work is either done (land it) or stale (revert and redo).

If 2+ signals hit at once, **stop the refactor, tag the checkpoint, and regroup with the team** before burning more cycles.
