import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
import { docsIndex, repoBlob, repoTree } from '../lib/repos.js'

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

test('repoBlob 返回 mtimeMs 与 editable：工作树可写、git 对象模式不可写', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-workbench-blob-'))
  try {
    await mkdir(join(root, 'src'), { recursive: true })
    await writeFile(join(root, 'src', 'a.js'), 'export const a = 1\n')
    await writeFile(join(root, 'icon.bin'), Buffer.from([0x00, 0x01, 0x02]))
    const worktree = { id: 'wt', name: 'WT', description: '', path: root, mode: 'worktree', ref: '', exclude: [] }
    const gitMode = { id: 'gm', name: 'GM', description: '', path: root, mode: 'git', ref: 'HEAD', exclude: [] }

    const blob = await repoBlob(worktree, 'src/a.js')
    const disk = await stat(join(root, 'src', 'a.js'))
    assert.equal(blob.editable, true)
    assert.equal(blob.mtimeMs, disk.mtimeMs)
    assert.equal(blob.text, 'export const a = 1\n')

    // 二进制文件可看但不可编辑。
    const binary = await repoBlob(worktree, 'icon.bin')
    assert.equal(binary.binary, true)
    assert.equal(binary.editable, false)
    assert.ok(binary.mtimeMs > 0)

    // git 对象模式：内容来自 git，不可原地写；mtimeMs 恒为 0（client 凭此判定不可写）。
    await run('git', ['-c', 'user.email=test@example.com', '-c', 'user.name=test', 'init', '-q'], { cwd: root })
    await run('git', ['-c', 'user.email=test@example.com', '-c', 'user.name=test', 'add', '-A'], { cwd: root })
    await run('git', ['-c', 'user.email=test@example.com', '-c', 'user.name=test', 'commit', '-qm', 'init'], { cwd: root })
    const fromGit = await repoBlob(gitMode, 'src/a.js')
    assert.equal(fromGit.editable, false)
    assert.equal(fromGit.mtimeMs, 0)
    assert.equal(fromGit.text, 'export const a = 1\n')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
