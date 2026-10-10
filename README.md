# Diff

Read the changes in a Git repository on your computer, and point an agent at the exact lines you mean.

## Get started

Open Diff from the rail, best beside a conversation, and choose **Choose a repository**: pick the repository's top folder. The menu beside the repository picks what to compare: **Working tree** for the changes you have not staged, **Staged**, or **Compared with** a branch. Click a file's name to fold it, and **unmodified lines** to see more of the file.

To comment on a change, click a line, **Shift-click** another line of the same file to select the lines between, and choose **Comment**. The lines wait above the composer as a chip with the file's name and line numbers; type what you want and send it.

When an agent changes a file in a Git repository, choose the file in the conversation and its change opens here, at the top.

## What Diff asks for

- **The repositories you choose.** Diff reads only the repositories inside the folders you give it, and changes nothing in them. Changes inside a folder that holds credentials are left out.
- **Git.** Diff reads with Git, which must be installed on your computer.
