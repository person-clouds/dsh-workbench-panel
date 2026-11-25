import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { archivedFilter, listParams, paginate } from '../lib/list.js'
import { repoTree } from '../lib/repos.js'
import { createTitleCache } from '../lib/title-cache.js'
import { workspacesOverview } from '../lib/workspaces.js'

function fakeContext(options = {}) {
  const now = Date.now()
  const workspace = {
    id: 'ws-1', title: 'Workspace', path: '/tmp/ws-1',
    createdAt: now - 10_000, updatedAt: now,
    sessionIds: ['s1', 's2', 's3', 's4'],
    status: async () => 'ok',
  }
  const records = [
    ['s1', now - 1_000, ''],
    ['s2', now - 2_000, ''],
    ['s3', now - 3_000, 'subagent'],
    ['s4', now - 4_000, ''],
  ].map(([id, createdAt, origin]) => ({ header: { id, createdAt, origin, cwd: '/tmp/ws-1' }, live: true, persisted: false }))
  const registry = {
    archivedSessionIds: ['s2'],
    pinnedSessionIds: ['s1'],
    list: () => [workspace],
  }
  const titleReads = []
  const sessionQuery = {
    listSessions: async () => records,
    readTitleSnapshots: async ids => {
      titleReads.push(ids)
      return ids.map(sessionId => ({
        status: 'fulfilled', sessionId, value: { title: { title: `Title ${sessionId}` } },
      }))
    },
  }
  const projected = options.projected || {}
  const sessionProjectionCache = {
    cachedSnapshot: header => projected[header.id] ? { values: { title: projected[header.id] } } : undefined,
  }
  return {
    ctx: { get: name => ({ workspaceRegistry: registry, sessionQuery, sessionProjectionCache })[name] },
    workspace,
    titleReads,
  }
}

test('列表参数默认值、上限与归档筛选', () => {
  const page = listParams(new URLSearchParams('offset=12&limit=500&sort=evil&dir=sideways'), {
    defaultLimit: 8, maxLimit: 20, defaultSort: 'updatedAt', allowedSorts: ['updatedAt', 'createdAt'], defaultDir: 'desc',
  })
  assert.deepEqual(page, { offset: 12, limit: 20, sort: 'updatedAt', dir: 'desc' })
  assert.equal(archivedFilter(undefined), 'active')
  assert.equal(archivedFilter('0'), 'active')
  assert.equal(archivedFilter('1'), 'archived')
  assert.equal(archivedFilter('all'), 'all')
  const result = paginate([1, 2, 3, 4, 5], { offset: 1, limit: 2 })
  assert.deepEqual(result.items, [2, 3])
  assert.equal(result.total, 5)
  assert.equal(result.hasMore, true)
})

test('工作区视图返回分页后的工作区卡片，不携带任何会话字段', async () => {
  const { ctx } = fakeContext()
  const overview = await workspacesOverview(ctx, { offset: 0, limit: 8, sort: 'updatedAt', dir: 'desc' })
  assert.equal(overview.total, 1)
  const card = overview.workspaces[0]
  assert.equal(card.id, 'ws-1')
  assert.equal(card.path, '/tmp/ws-1')
  assert.equal(card.exists, false)
  assert.equal(Object.hasOwn(card, 'sessions'), false)
  assert.equal(Object.hasOwn(card, 'sessionTotal'), false)
  assert.equal(Object.hasOwn(overview, 'ungrouped'), false)
  assert.equal(Object.hasOwn(overview, 'sessionError'), false)
  assert.deepEqual(overview.counts, { workspaces: 1 })
})

test('目录树返回该层全部子项，不受 offset/limit 影响', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-workbench-tree-'))
  try {
    await mkdir(join(root, 'a-dir'))
    await writeFile(join(root, 'a-dir', 'x.md'), '# x')
    await writeFile(join(root, 'b.md'), '# b')
    await writeFile(join(root, 'c.txt'), 'c')
    const repo = { id: 'tmp', name: 'tmp', path: root, mode: 'worktree', ref: '', exclude: [] }
    const all = await repoTree(repo, '')
    assert.equal(all.total, 3)
    assert.equal(Object.hasOwn(all, 'hasMore'), false)
    assert.deepEqual(all.entries.map(entry => entry.name), ['a-dir', 'b.md', 'c.txt'])
    const nested = await repoTree(repo, 'a-dir')
    assert.deepEqual(nested.entries.map(entry => [entry.name, entry.type, entry.path]), [['x.md', 'file', 'a-dir/x.md']])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
