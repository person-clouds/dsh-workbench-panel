---
audience: shared
status: current
---

[中文](README.md) | [English](README.en.md)

# DSH Read-write Workbench (dsh-workbench-panel)

A DSH Web workbench that can read and edit: one sidebar panel for workspaces, repository file trees and blobs, Markdown document indexes, repository-wide search, read-only highlighting and single-file editing, with explicit session archiving. The panel itself does not list sessions.

## What matters most

- Writes are gated: the Code tab can save a single text file (`writeEnabled`, default `true`; set `false` for read-only). No create/rename/delete, no git commit, no writes outside the repository.
- No heavyweight IDE: highlighting reuses the shiki build and theme tokens shipped with the DSH frontend; editing is a native `<textarea>` over a read-only highlight layer, with zero new dependencies.
- Three tabs: Workspaces for workspace cards, Docs for the Markdown index and editable content, Code for file trees (every level fully listed) and blobs.
- Works without configuration: with `repos` empty, only workspaces and repos auto-detected from `workspaceRegistry` are shown.
- Unrelated to the npm `dsh-workbench` package (`lee259/dsh-workbench`); this plugin has no SA tickets or control, injects no prompts, listens to no `session/event`, and never renames sessions.
- Requirements: DSH Web, Node ≥22.5 (`engines`).

## Quick start

```bash
dsh plugin --profile web add dsh-workbench-panel
```

After restarting `dsh web`, the “DSH 工作台” icon (id `dsh-workbench-panel`) appears in the sidebar with three tabs:

```text
[Workspaces] [Docs] [Code]
```

Uninstall it through the plugin manager; the checkout is kept. For local link installs and the release flow, see [`PUBLISHING.md`](/home/zh/www/dsh-workbench-panel/PUBLISHING.md).

## Features

1. **Workspaces**: reads only workspaces from `ctx.workspaceRegistry` (title, path, creation time, git marker); no session lists, no unarchived/archived filters and no ungrouped bucket.
2. **Docs**: pick a repo from `docRepos`, then load that repo's Markdown index on demand; folders start collapsed and expand level by level; a document opens as a blob. The `编辑源文` button switches to the overlay editor for the Markdown source (save is two-step confirmed and uses an `mtimeMs` optimistic lock); `预览` goes back to the rendered view.
3. **Code**: repos from the plugin's `repos` config plus repos auto-detected from `workspaceRegistry`; the file tree loads level by level with **every entry shown (no pagination)** and blobs are read-only, in `git` or `worktree` mode.
4. **Explicit archive**: `POST /api/archive` calls `workspaceRegistry.archiveSession()`; idempotent, and never deletes session logs or directories (the panel no longer renders session cards, so this is for scripts and external callers).
5. **Read API**: `GET /dsh-workbench-panel/api?view=...` exposes `workspaces`, `docRepos`, `docs`, `repos`, `tree`, `blob` (`sessions`/`repoSessions` are gone); workspace and repo lists use `offset`/`limit` (max 50) and return `total`/`hasMore`, while `tree` returns every entry of that level without pagination.
6. **Only write**: `POST /dsh-workbench-panel/api/archive` with body `{ "sessionId": "..." }`; authentication and origin checks reuse DSH Connection (401 unauthenticated, 403 untrusted origin).
7. **Cache**: in-process snapshot cache `cacheSeconds` (default 10 seconds), never persisted; session titles for the current page are hydrated and stored in `<dshHome>/state/workbench/session-titles.json`.

## Configuration

Edit it in DSH Settings → Plugins → DSH Workbench, or in the profile's `cordis.patch.yml`:

```yaml
- id: dsh-workbench-panel
  name: dsh-workbench-panel
  config:
    dshHome: /home/zh/.dsh        # defaults to $DSH_HOME or ~/.dsh
    cacheSeconds: 10              # in-process snapshot cache, seconds
    repos: []                     # empty: only repos auto-detected from workspaceRegistry
    # repos:
    #   - id: doc
    #     name: Docs
    #     path: /home/zh/www/doc
    #     mode: git               # git | worktree
    #     ref: origin/main         # ref read in git mode
    #     description: Workspace docs
    #     remote: https://github.com/person-clouds/doc.git
    #     exclude: [archive]       # relative path prefixes to hide
```

Each `repos` entry requires `id` and `path`; the rest are optional. Workspace paths from `workspaceRegistry` are added automatically, and each real path appears once.

## Boundaries and limits

- Only the `/dsh-workbench-panel/api` prefix is registered; the only write is explicit session archiving.
- Never writes user repository files and never runs git write commands; code browsing blocks `.env*`, `.git`, credential directories, `*.pem`/`*.key`/`*.sqlite`/`*.db`, etc.
- Reads no credentials; everything renders as React elements, never `innerHTML`.
- No SA database, no SA ticket/control views, and no background fetch or cleanup loops.
- The panel depends on DSH Web services such as `webServer`, `workspaceRegistry`, and `sessionQuery`; DSH upgrades may require adaptation.

## Where to look

- Status, capability list and verification commands: [STATUS.md](/home/zh/www/dsh-workbench-panel/STATUS.md)
- Publishing, releases and the marketplace PR: [PUBLISHING.md](/home/zh/www/dsh-workbench-panel/PUBLISHING.md)
- Market entry: [market/person-clouds__dsh-workbench-panel.yml](/home/zh/www/dsh-workbench-panel/market/person-clouds__dsh-workbench-panel.yml)
- License: [MIT](LICENSE)
