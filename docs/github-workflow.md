# GitHub Workflow For This Project

## Short Version

Use Git for small checkpoints.
Use GitHub for shared backup and milestone progress.

## Recommended Rhythm

### Commit

Create a commit when one small unit of work is complete and still makes sense on its own.

Good commit moments:

- schema updated and reviewed
- import script added and tested
- one new page or feature works
- one bug is fixed
- one refactor is complete

Do not wait all day for one giant commit.
Do not commit every two minutes either.

For this project, a good default is:

- commit after each phase step
- commit after each working feature
- commit before any risky refactor

### Push

Push when you want the work safely backed up on GitHub or ready to continue from another machine.

Good push moments:

- after 1 to 3 good commits
- at the end of a work session
- before trying a risky change
- when you want to share progress

## Practical Rule

Ask two questions:

1. If I lost my computer right now, would I regret not saving this to GitHub?
2. If I came back tomorrow, would this commit help me understand where I stopped?

If yes, commit and probably push.

## Suggested Commit Style

Use simple commit messages like:

- `Define initial Tanach schema`
- `Add CSV normalization script`
- `Import normalized Tanach data into staging tables`
- `Add song submission model`
- `Build verse picker UI`

## Suggested Branch Strategy

If you work alone, this is enough:

- `main` for stable progress
- short feature branches when a change is larger or experimental

Example feature branches:

- `codex/import-workflow`
- `codex/song-submission-ui`
- `codex/verse-range-support`

For very small safe changes, committing directly to `main` is fine.
For bigger features, use a branch and merge it back once it works.

## Safe Day-To-Day Flow

For a normal work session:

1. `git pull` if the repo already exists on GitHub and you have worked elsewhere
2. make one focused change
3. test it
4. `git status`
5. `git add <files>`
6. `git commit -m "Your message"`
7. `git push`

## What To Avoid

- do not mix unrelated changes in one commit
- do not wait too long before committing
- do not push broken code on purpose unless it is on an experimental branch
- do not use force push on `main`

## First Remote Setup

If you create the GitHub repository manually in the browser, then connect it like this:

```bash
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

After that, normal pushes are just:

```bash
git push
```

## My Recommendation For You

At your stage, keep it simple:

- one commit for each meaningful step
- push at least at the end of every session
- use feature branches only when a change is large or uncertain
