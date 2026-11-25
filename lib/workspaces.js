/**
 * DSH 工作区与仓库来源。
 *
 * 工作区注册只读 `ctx.workspaceRegistry`；面板不展示会话，也不读会话目录。
 */

import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { paginate, sortBy } from './list.js'

function workspaceValue(workspace, field) {
  if (field === 'updatedAt' || field === 'createdAt') return Number(workspace[field] || 0)
  if (field === 'title') return workspace.title || ''
  return String(workspace.id || '')
}

/** 工作区快照：分页后的工作区卡片（不含会话）。 */
export async function workspacesOverview(ctx, options = {}) {
  const registry = ctx.get('workspaceRegistry')
  if (!registry) return { error: '当前 DSH Host 没有 workspaceRegistry，无法读取工作区。', workspaces: [] }
  const workspaces = await Promise.all(registry.list().map(async workspace => {
    let status = 'ok'
    try { status = await workspace.status() } catch { status = 'unknown' }
    return {
      id: String(workspace.id),
      title: workspace.title,
      path: workspace.path,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      status,
      exists: existsSync(workspace.path),
      git: existsSync(join(workspace.path, '.git')),
    }
  }))
  const sorted = sortBy(workspaces, options.sort || 'updatedAt', options.dir || 'desc', workspaceValue)
  const page = paginate(sorted, { offset: options.offset || 0, limit: options.limit || 8 })
  return {
    workspaces: page.items,
    counts: { workspaces: workspaces.length },
    total: page.total,
    offset: page.offset,
    limit: page.limit,
    hasMore: page.hasMore,
    sort: options.sort || 'updatedAt',
    dir: options.dir || 'desc',
  }
}

/** 把工作区路径转成代码浏览器的仓库条目；同一路径只出现一次。 */
export function workspaceRepos(ctx, limit = 80) {
  const registry = ctx.get('workspaceRegistry')
  if (!registry) return []
  const repos = []
  const seen = new Set()
  for (const workspace of registry.list()) {
    const path = workspace.path
    if (!path || seen.has(path) || !existsSync(path)) continue
    seen.add(path)
    repos.push({
      id: `workspace-${String(workspace.id).slice(0, 8)}`,
      name: workspace.title || basename(path),
      path,
      mode: 'worktree',
      ref: '',
      description: 'DSH 工作区',
      remote: '',
      exclude: [],
      source: 'workspace',
    })
    if (repos.length >= limit) break
  }
  return repos
}
