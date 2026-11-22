---
audience: shared
status: current
---

[中文](README.md) | [English](README.en.md)

# DSH Read-only Workbench (dsh-workbench-panel)

A DSH Web sidebar panel for workspaces and sessions, repository file trees and blobs, Markdown document indexes, and explicit session archiving. Nothing else is written.

> Unrelated to `lee259/dsh-workbench`: the npm name `dsh-workbench` belongs to another project. This plugin is published as `dsh-workbench-panel`, with its own code and config — not a fork or upgrade of that project.
>
> Compared with the archived repo `person-clouds/dsh-workbench`, this plugin has no SA tickets, no SA control, no `systemPrompt` injection, no `session/event` listener, and never renames sessions. TODO titles and `/ok` moved to `dsh-workflow-shortcuts` 0.3.0.

## Panel layout

Sidebar icon (id `dsh-workbench-panel`, label “DSH 工作台”) → `main` slot:

```text
[Workspaces] [Docs] [Code]
```

| Tab | Content |
|---|---|
| Workspaces | Reads workspaces and sessions from `ctx.workspaceRegistry`; sessions default to **unarchived**, with an unarchived/archived/all switch; paged workspace cards; archiving is the only write |
| Docs | Picks a repo from `docRepos`, then loads that repo's Markdown index on demand; folders start collapsed and expand level by level; a document opens as a blob |
| Code | Repos from the plugin's `repos` config plus repos auto-detected from `workspaceRegistry`; one-level file tree, read-only blobs; `git` and `worktree` modes |

## Data sources

| Data | Source | Notes |
|---|---|---|
| Workspaces, session ownership | `ctx.workspaceRegistry` | Same source as the DSH Web UI; ungrouped is computed on the Host |
| Session titles | DSH projection cache + `ctx.sessionQuery` + permanent title cache | Only current-page misses are hydrated; cached at `<dshHome>/state/workbench/session-titles.json` |
| Document index | `docRepos` (derived from `repos` + workspaces) | Read-only Markdown files, grouped by repo |
| Repos and code | Plugin `repos` + `workspaceRegistry` workspaces | Deduplicated by real path; `mode=git` reads git objects, `mode=worktree` reads workspace files |
| Explicit archive | `workspaceRegistry.archiveSession()` | Called only when the user archives; never deletes session logs or directories |

No SA database (`orchestrator.sqlite`), no SA ticket/control views, and no background fetch or cleanup loops.

## Host API

- `GET /dsh-workbench-panel/api?view=...`, where `view` is one of `workspaces`, `sessions`, `docRepos`, `docs`, `repos`, `repoSessions`, `tree`, `blob`;
- Lists use `offset`/`limit` (max 50) and return `total`/`hasMore`; sessions default to `archived=active`;
- `tree`/`blob` take `repo=<id>&path=`; `docs` accepts `repo=<id>` to read a single repo;
- The only write: `POST /dsh-workbench-panel/api/archive` with body `{ "sessionId": "..." }`; archiving is idempotent;
- In-process snapshot cache `cacheSeconds` (default 10 seconds), never persisted;
- Authentication and origin checks reuse DSH Connection: 401 unauthenticated, 403 untrusted origin.

## Install

```bash
# Local development: install a link in the web profile
# (equivalent to running pnpm add link:... inside that profile)
dsh plugin --profile web add link:/home/zh/www/dsh-workbench-panel
```

Published npm package:

```bash
dsh plugin --profile web add dsh-workbench-panel
```

Restart `dsh web` after installing; the “DSH 工作台” icon appears in the sidebar. Uninstall through the plugin manager; the checkout is kept.

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

## Verify

```bash
node --check index.js
node --check client.js
node -e "new (require('vm').Script)(require('fs').readFileSync('client.js','utf8'))"
npm test
npm_config_cache=/tmp/npm-cache npm pack --dry-run
```

`npm pack --dry-run` should list `index.js`, `client.js`, `lib/`, `locale/`, `icon.svg`, `icon.png`, `cordis.patch.yml`, the READMEs and LICENSE — not `test/` or the market draft.

## Security boundary

- Only the `/dsh-workbench-panel/api` prefix is registered; the only write is explicit session archiving;
- Never writes user repository files and never runs git write commands; code browsing blocks `.env*`, `.git`, credential directories, `*.pem`/`*.key`/`*.sqlite`/`*.db`, etc.;
- Reads no credentials; everything renders as React elements, never `innerHTML`.

## Publish

See [`PUBLISHING.md`](/home/zh/www/dsh-workbench-panel/PUBLISHING.md) for npm, GitHub Release and the DSH plugin marketplace PR; the market entry is [`market/person-clouds__dsh-workbench-panel.yml`](/home/zh/www/dsh-workbench-panel/market/person-clouds__dsh-workbench-panel.yml).
