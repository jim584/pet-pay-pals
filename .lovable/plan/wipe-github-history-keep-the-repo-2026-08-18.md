# Wipe GitHub History, Keep the Repo

Goal: the GitHub repository stays, but all existing commits disappear and no further commits are pushed from Lovable.

Important: I cannot do this from here. Git operations, GitHub sync settings, and repository administration are outside what I can touch in this project — every step below is done by you.

## Step 1 — Stop the sync first

Lovable pushes automatically on every change. If sync stays on while you rewrite history, it will push again and re-create commits.

- In the editor, open the Plus (+) menu in the chat input → GitHub → disconnect the project from the repository.

Once disconnected, no new commits go to GitHub from Lovable.

## Step 2 — Wipe the history on GitHub

From a local clone of the repo:

```text
git clone <repo-url> hap && cd hap
rm -rf .git
git init
git add -A
git commit -m "Initial commit"
git branch -M main
git remote add origin <repo-url>
git push --force origin main
```

This leaves the repository in place with exactly one commit and no trace of the previous history.

## Step 3 — Clean up leftovers on GitHub

Force-push alone does not remove everything. On the repository page:

- Delete any other branches and tags that still hold old commits.
- Close/delete pull requests that reference old commits.
- Old commits can stay reachable by direct SHA for a while; GitHub Support can be asked to run garbage collection if that matters.

## Step 4 — Decide about re-connecting

- Leave GitHub disconnected: nothing is ever pushed again.
- Or re-connect later: sync resumes and pushes new commits on top of the single clean commit.

Tell me which you want and I can note it as a standing rule for this project.

## Notes

- Disconnecting GitHub does not affect this project, its backend, or the published site.
- Your Lovable version history stays intact and is independent of GitHub.
