import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { docsIndex, repoTree } from '../lib/repos.js'

test('docsIndex 可只加载指定仓库，repoTree 只返回一层目录', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-workbench-repos-'))
  try {
    await mkdir(join(root, 'docs', 'nested'), { recursive: true })
    await writeFile(join(root, 'README.md'), '# 根文档\n')
    await writeFile(join(root, 'docs', 'guide.md'), '# 指南\n')
    await writeFile(join(root, 'docs', 'nested', 'deep.md'), '# 深层文档\n')
    await writeFile(join(root, 'notes.txt'), '不是文档\n')

    const repos = [
      { id: 'alpha', name: 'Alpha', description: '', path: root, mode: 'worktree', ref: '', exclude: [] },
      { id: 'beta', name: 'Beta', description: '', path: join(root, 'docs'), mode: 'worktree', ref: '', exclude: [] },
    ]

    const all = await docsIndex(repos)
    assert.deepEqual(all.map(group => group.repo.id), ['alpha', 'beta'])

    const alpha = await docsIndex(repos, 'alpha')
    assert.deepEqual(alpha.map(group => group.repo.id), ['alpha'])
    assert.deepEqual(alpha[0].docs.map(doc => doc.path), ['docs/guide.md', 'docs/nested/deep.md', 'README.md'])
    assert.deepEqual(alpha[0].docs.map(doc => doc.title), ['指南', '深层文档', '根文档'])

    const tree = await repoTree(repos[0], 'docs')
    assert.deepEqual(tree.entries.map(entry => [entry.name, entry.type]), [['nested', 'dir'], ['guide.md', 'file']])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
