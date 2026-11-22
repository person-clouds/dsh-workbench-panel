import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { archivedFilter, listParams, paginate } from '../lib/list.js'
import { repoSessionPage, repoTree, reposOverview } from '../lib/repos.js'
import { createTitleCache } from '../lib/title-cache.js'
import { sessionsPage, workspacesOverview } from '../lib/workspaces.js'

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

test('工作区与会话默认只看未归档，且会话分页由服务端完成', async () => {
  const { ctx } = fakeContext()
  const overview = await workspacesOverview(ctx, { archived: 'active', offset: 0, limit: 8, sort: 'updatedAt', dir: 'desc', sessionLimit: 10 })
  assert.equal(overview.total, 1)
  assert.equal(overview.workspaces[0].sessionTotal, 2)
  assert.deepEqual(overview.workspaces[0].sessions.map(session => session.id), ['s1', 's4'])
  assert.equal(overview.counts.sessions, 2)

  const paged = await sessionsPage(ctx, { workspace: 'ws-1', archived: 'active', offset: 1, limit: 1, sort: 'createdAt', dir: 'desc' })
  assert.equal(paged.total, 2)
  assert.deepEqual(paged.sessions.map(session => session.id), ['s4'])
  assert.equal(paged.hasMore, false)

  const all = await sessionsPage(ctx, { workspace: 'ws-1', archived: 'all', offset: 0, limit: 10, sort: 'createdAt', dir: 'desc' })
  assert.deepEqual(all.sessions.map(session => session.id), ['s1', 's2', 's4'])
})

test('会话标题只补当前页，永久缓存命中后不再读日志', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-workbench-title-'))
  try {
    const cache = createTitleCache({ titleFile: join(root, 'session-titles.json') })
    const { ctx, titleReads } = fakeContext()
    const all = { workspace: 'ws-1', archived: 'all', sort: 'createdAt', dir: 'desc', cache }
    const last = await sessionsPage(ctx, { ...all, offset: 2, limit: 2 })
    assert.deepEqual(last.sessions.map(session => session.id), ['s4'])
    assert.deepEqual(titleReads.at(-1), ['s4'])

    const first = await sessionsPage(ctx, { ...all, offset: 0, limit: 2 })
    assert.deepEqual(first.sessions.map(session => session.id), ['s1', 's2'])
    assert.deepEqual(titleReads.at(-1), ['s1', 's2'])
    assert.equal(first.sessions[0].title, 'Title s1')

    const before = titleReads.length
    const again = await sessionsPage(ctx, { ...all, offset: 0, limit: 2 })
    assert.equal(titleReads.length, before)
    assert.deepEqual(again.sessions.map(session => session.title), ['Title s1', 'Title s2'])
    const file = JSON.parse(await readFile(join(root, 'session-titles.json'), 'utf8'))
    assert.equal(file.sessions.s4.title, 'Title s4')
    assert.equal(file.sessions.s2.title, 'Title s2')
    const restarted = createTitleCache({ titleFile: join(root, 'session-titles.json') })
    assert.equal((await restarted.getMany(['s2'])).get('s2').title, 'Title s2')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('DSH 投影缓存已有标题时当前页不再读该会话日志', async () => {
  const { ctx, titleReads } = fakeContext({ projected: { s1: 'Projected s1' } })
  const overview = await workspacesOverview(ctx, { archived: 'active', offset: 0, limit: 8, sort: 'updatedAt', dir: 'desc', sessionLimit: 10 })
  assert.equal(overview.workspaces[0].sessions[0].title, 'Projected s1')
  assert.deepEqual(titleReads.at(-1), ['s4'])
})

test('仓库会话按服务端分页且仓库列表不再携带会话', async () => {
  const { ctx, titleReads } = fakeContext()
  const repo = { id: 'repo-1', name: 'Workspace', description: '', path: '/tmp/ws-1', mode: 'worktree', ref: '', exclude: [] }
  const page = await repoSessionPage(ctx, repo, { archived: 'all', offset: 1, limit: 1, sort: 'createdAt', dir: 'desc' })
  assert.equal(page.total, 3)
  assert.deepEqual(page.sessions.map(session => session.id), ['s2'])
  assert.deepEqual(titleReads.at(-1), ['s2'])
  const active = await repoSessionPage(ctx, repo, { archived: 'active', offset: 0, limit: 10, sort: 'createdAt', dir: 'desc' })
  assert.deepEqual(active.sessions.map(session => session.id), ['s1', 's4'])
  const overview = await reposOverview([repo])
  assert.equal(overview.length, 1)
  assert.equal(Object.hasOwn(overview[0], 'sessions'), false)
  assert.equal(Object.hasOwn(overview[0], 'sessionTotal'), false)
})

test('目录树只返回当前页直接子项', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-workbench-tree-'))
  try {
    await mkdir(join(root, 'a-dir'))
    await writeFile(join(root, 'a-dir', 'x.md'), '# x')
    await writeFile(join(root, 'b.md'), '# b')
    await writeFile(join(root, 'c.txt'), 'c')
    const repo = { id: 'tmp', name: 'tmp', path: root, mode: 'worktree', ref: '', exclude: [] }
    const first = await repoTree(repo, '', { offset: 0, limit: 2 })
    assert.equal(first.total, 3)
    assert.equal(first.hasMore, true)
    assert.deepEqual(first.entries.map(entry => entry.name), ['a-dir', 'b.md'])
    const second = await repoTree(repo, '', { offset: 2, limit: 2 })
    assert.deepEqual(second.entries.map(entry => entry.name), ['c.txt'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
