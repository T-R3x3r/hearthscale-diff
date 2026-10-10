# Developing Diff

`README.md` is the text the Marketplace shows under **About** on the listing of Diff, so it is written for the people who install it. This file is for the people who work on it.

Diff is an ordinary Hearthscale app. Nothing in the platform knows its
name; it installs from the Marketplace like any other app.

## Working on it

With a Hearthscale platform running on this machine:

```sh
hearthscale dev .
```

links this folder into the running platform, picks up every change, and
asks once in the window before any code runs.

## The view

Diff shows one view, `diff`, which fills its tab: the patch of a
repository in one of three scopes (the working tree, what is staged, or
the branch compared with another), with the files folded and unmodified
runs opened in place. Its source is React under `ui/src`, drawn with the
`hs-*` classes and `ri-*` icons of the kit that Hearthscale loads into
every view. Its build writes `views/diff.js`, the one file the package
carries for it, so the file is committed with every change to the source:

```sh
cd ui
pnpm install
pnpm build
```

The view reaches the platform only through `roots`, the one extension
`uses` names: the folders the person gave the app, the pick of another,
and what `git` says about the repositories in them
(`hearthscale/vcs/repo`, `refs`, `diff` and `file`). The platform reads a
repository only when its top lies inside a folder the person gave the
app, because `git` reads all of it.

The view `shows` changes: a file a turn changed in the working tree of a
git repository opens here, on the address `/?path=<absolute path>`,
which the view reads as `openai/deepLink`. It shows the working tree of
that repository with the file's change at the top; Hearthscale gives the
app the repository before it opens the view.

A run of rows the person comments on becomes a chip on the chats on
screen, through `ui/update-model-context`, and the next message sent
there carries it. A fresh read lets go of a comment whose rows moved.

`ui/pnpm-workspace.yaml` keeps the build its own project: without it,
pnpm joins any workspace in a folder above.

## Releasing

Install the Hearthscale registry's GitHub App on this repository once. Then
every release whose tag equals `version` in `app.json` is picked up by the
Marketplace.

```sh
hearthscale pack .
```

builds the package to attach to the release.

## Licence

MIT. See `LICENSE`.
