# Exclude `.lovable/` from GitHub sync

## Current state
- `.gitignore` exists but does not list `.lovable/`.
- Git is actively tracking files under `.lovable/plan/` (20+ archived plan files).
- Lovable sync pushes the entire tracked tree to GitHub, so the folder appears in the repo.

## Goal
Stop the `.lovable` folder from being pushed to GitHub while keeping it in the project for Lovable’s internal plan workflow.

## Plan

1. **Update `.gitignore`**
   - Add `.lovable/` to the root `.gitignore` so future plan files are ignored by Git.

2. **Untrack existing `.lovable` files**
   - Run `git rm -r --cached .lovable` to remove the already-tracked `.lovable` files from Git’s index without deleting them locally.

3. **Commit the change**
   - Commit the updated `.gitignore` and the index removal as a single change so the next Lovable → GitHub sync no longer includes `.lovable/`.

4. **Verify**
   - Confirm `git ls-files .lovable` returns nothing before the next push.

## Notes
- This only affects Git tracking. The `.lovable` folder remains in the project and continues to work for Lovable plan mode.
- If you also proceed with the separate history-wipe plan, the `.gitignore` change can be folded into the fresh initial commit instead.
