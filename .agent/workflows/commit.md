---
description: Adds relevant files and commits with a detailed AI-generated message
---
// turbo-all

1. Run `git status` to see which files were added, modified, or deleted.
2. Run `git diff` (and `git diff --cached` if there are staged files) to understand the exact changes made.
3. Formulate a descriptive, clear, and conventional commit message summarizing the changes.
4. Run `git add <files>` to stage the relevant files (or `git add .` if we should include everything).
5. Run `git commit -m "<your commit message>"` to commit the changes.
6. Let the user know the commit was successful and present the summary to them.
