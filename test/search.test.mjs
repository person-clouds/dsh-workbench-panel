/**
 * 搜索（`lib/code.js`）与高亮（`lib/highlight.js`）的单元测试。
 *
 * 全部用 `mkdtemp` 临时目录造仓库，不读写真实工作区；rg 存在性由测试注入控制，
 * 因此「本机有没有 rg」不影响测试结果。
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MATCH_LIMIT, QUERY_MAX, QUERY_MIN, clearRgCache, searchRepo, setRgResolver } from '../lib/code.js'
import { HIGHLIGHT_LANGS, clearHighlightCache, highlightCacheSize, highlightLines } from '../lib/highlight.js'
import { listFiles } from '../lib/repos.js'

/** 本机 DSH 安装目录：高亮测试用；不存在时相关断言跳过（不伪造通过）。 */
const INSTALL_DIR = process.env.DSH_INSTALL || '/home/zh/.npm-global/lib/node_modules/@deepseek-ai/dsh'
const ASSETS_DIR = join(INSTALL_DIR, 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'dist', 'assets')
const SHIKI_READY = existsSync(ASSETS_DIR)

/**
 * 造一个临时仓库目录 + 归一化后的 repo 对象。
 * 注意 `listFiles` 在 `lib/repos.js` 里是模块级 30s 缓存（键为 `id:mode:ref`）：
 * - 同一测试内多次 `searchRepo` 复用同一 repo 时，候选集是首次调用时的快照，
 *   所以**需要在候选集变化后再搜的场景**（如新增文件）应先用 `listFiles` 预热或另建 repo；
 * - id 用目录基名（mkdtemp 唯一），避免不同测试目录串缓存。
 */
async function makeRepo(files, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-workbench-search-'))
  for (const [path, content] of Object.entries(files)) {
    const target = join(root, path)
    await mkdir(join(target, '..'), { recursive: true })
    await writeFile(target, content)
  }
  return {
    root,
    repo: {
      id: `tmp-${root.split('/').pop()}`,
      name: 'tmp',
      description: '',
      path: root,
      mode: options.mode === 'git' ? 'git' : 'worktree',
      ref: '',
      exclude: options.exclude || [],
      source: 'configured',
    },
  }
}

const TREE = {
  'src/Main.go': 'package main\n\n// todo 修复这里\nfunc main() {}\n',
  'src/util.ts': 'export const todo = 1\n',
  'README.md': '待办 todo 列表\n',
  'notes.txt': '没有关键词\n',
}

test('q 少于 2 字符或超过 200 字符抛 400', async () => {
  const { root, repo } = await makeRepo(TREE)
  try {
    await assert.rejects(() => searchRepo(repo, { q: '' }), error => error.status === 400)
    await assert.rejects(() => searchRepo(repo, { q: ' a ' }), error => error.status === 400 && /至少/.test(error.message))
    await assert.rejects(() => searchRepo(repo, { q: 'x'.repeat(QUERY_MAX + 1) }), error => error.status === 400 && /最多/.test(error.message))
    // 边界值不抛
    const min = await searchRepo(repo, { q: 'ab' })
    assert.equal(min.q, 'ab')
    const max = await searchRepo(repo, { q: 'x'.repeat(QUERY_MAX) })
    assert.equal(max.matches.length, 0)
    assert.equal(QUERY_MIN, 2)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('文件名检索大小写不敏感，内容检索带 line/column/text', async () => {
  const { root, repo } = await makeRepo(TREE)
  try {
    const names = await searchRepo(repo, { q: 'MAIN', mode: 'name' })
    assert.equal(names.mode, 'name')
    assert.deepEqual(names.matches.map(match => match.path), ['src/Main.go'])
    assert.deepEqual(names.matches[0], { path: 'src/Main.go', kind: 'name', line: 0, column: 0, text: '' })
    assert.equal(names.total, 1)
    assert.equal(names.hasMore, false)

    const content = await searchRepo(repo, { q: 'todo', mode: 'content' })
    // 命中行：Main.go 第 3 行（含中文注释）、util.ts 第 1 行、README.md 第 1 行
    assert.deepEqual(content.matches.map(match => [match.path, match.kind, match.line]), [
      ['README.md', 'content', 1],
      ['src/Main.go', 'content', 3],
      ['src/util.ts', 'content', 1],
    ])
    for (const match of content.matches) {
      assert.equal(typeof match.column, 'number')
      assert.ok(match.column >= 1, `column 应 ≥1：${match.path}`)
      assert.equal(match.text.toLowerCase().includes('todo'), true)
    }
    const goHit = content.matches.find(match => match.path === 'src/Main.go')
    assert.equal(goHit.column, 4) // `// todo 修复这里` 中 todo 的 1 起列号
    assert.ok(goHit.text.startsWith('// todo'))

    const both = await searchRepo(repo, { q: 'main' })
    // 文件名命中在前
    assert.equal(both.matches[0].kind, 'name')
    assert.equal(both.matches[0].path, 'src/Main.go')
    // 非法 mode 回退 both
    const fallback = await searchRepo(repo, { q: 'main', mode: 'weird' })
    assert.equal(fallback.mode, 'both')
    assert.deepEqual(fallback.matches, both.matches)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('敏感文件与 exclude 目录不出现（rg 与回退扫描两条路径）', async () => {
  const files = {
    ...TREE,
    '.env': 'TOKEN=todo\n',
    'a.pem': 'todo in pem\n',
    'secret/x.sqlite': 'todo in sqlite\n',
    '.ssh/id_rsa': 'todo in ssh\n',
    'skip/note.txt': 'todo in excluded dir\n',
    'ok/nested.md': 'todo in nested\n',
  }
  const { root, repo } = await makeRepo(files, { exclude: ['skip'] })
  const forbidden = ['.env', 'a.pem', 'secret/x.sqlite', '.ssh/id_rsa', 'skip/note.txt']
  try {
    for (const resolver of [null, () => '']) {
      setRgResolver(resolver)
      const result = await searchRepo(repo, { q: 'todo' })
      for (const path of forbidden) {
        assert.equal(result.matches.some(match => match.path === path), false, `不应出现 ${path}（engine=${result.engine}）`)
      }
      assert.ok(result.matches.some(match => match.path === 'ok/nested.md'), `正常文件应命中（engine=${result.engine}）`)
    }
  } finally {
    setRgResolver(null)
    clearRgCache()
    await rm(root, { recursive: true, force: true })
  }
})

test('600 行匹配时 total/matches 不超过 500 且 truncated 为 true', async () => {
  const lines = Array.from({ length: 600 }, (_, index) => `命中行 todo ${index}`).join('\n')
  const { root, repo } = await makeRepo({ 'many.txt': lines, 'other.txt': 'todo once\n' })
  try {
    for (const resolver of [null, () => '']) {
      setRgResolver(resolver)
      const result = await searchRepo(repo, { q: 'todo', mode: 'content', limit: 100 })
      assert.equal(result.total, MATCH_LIMIT)
      assert.ok(result.matches.length <= MATCH_LIMIT)
      assert.equal(result.matches.length, 100)
      assert.equal(result.truncated, true)
      assert.equal(result.hasMore, true)
      assert.equal(result.limit, 100)
    }
  } finally {
    setRgResolver(null)
    clearRgCache()
    await rm(root, { recursive: true, force: true })
  }
})

test('rg 缺失时回退逐行扫描，结果结构与正常路径一致', async () => {
  // 不含 NUL 文件：rg 与逐行扫描应给出同一批命中
  const { root, repo } = await makeRepo(TREE)
  try {
    setRgResolver(null)
    const viaRg = await searchRepo(repo, { q: 'todo' })
    setRgResolver(() => '')
    const viaScan = await searchRepo(repo, { q: 'todo' })
    assert.equal(viaRg.engine, 'rg')
    assert.equal(viaScan.engine, 'scan')
    // 文件名命中完全一致
    assert.deepEqual(
      viaScan.matches.filter(match => match.kind === 'name'),
      viaRg.matches.filter(match => match.kind === 'name'),
    )
    // 内容命中：扫描能扫到与 rg 相同的内容行（按 path:line 比较）
    const keyOf = match => `${match.path}:${match.line}`
    assert.deepEqual(viaScan.matches.map(keyOf).sort(), viaRg.matches.map(keyOf).sort())
    // 结构字段齐全
    for (const field of ['q', 'mode', 'matches', 'total', 'offset', 'limit', 'hasMore', 'truncated', 'engine', 'note']) {
      assert.ok(field in viaScan, `缺少字段 ${field}`)
    }
  } finally {
    setRgResolver(null)
    clearRgCache()
    await rm(root, { recursive: true, force: true })
  }
})

test('仓库含 NUL 文件时 rg 报错，回退后仍能搜到文本文件', async () => {
  const { root, repo } = await makeRepo({ ...TREE, 'bin/data.bin': Buffer.from([0x74, 0x6f, 0x64, 0x6f, 0x00, 0x74]) })
  try {
    setRgResolver(null)
    clearRgCache()
    const result = await searchRepo(repo, { q: 'todo', mode: 'content' })
    // rg 对显式文件列表遇 NUL 会报 «binary file detected» 并丢弃整批结果；
    // 回退（grep -rI 或逐行扫描）必须仍给出文本文件的命中
    const paths = result.matches.map(match => match.path).sort()
    assert.deepEqual(paths, ['README.md', 'src/Main.go', 'src/util.ts'])
    // 二进制文件不当文本返回
    assert.equal(result.matches.some(match => match.path === 'bin/data.bin'), false)
    for (const match of result.matches) {
      assert.equal(match.kind, 'content')
      assert.ok(match.line >= 1 && match.column >= 1)
    }
  } finally {
    setRgResolver(null)
    clearRgCache()
    await rm(root, { recursive: true, force: true })
  }
})

test('分页 offset/limit 与 hasMore', async () => {
  const files = {}
  for (let index = 0; index < 5; index += 1) files[`f${index}.txt`] = 'keyword 行\n'
  const { root, repo } = await makeRepo(files)
  try {
    const first = await searchRepo(repo, { q: 'keyword', mode: 'content', offset: 0, limit: 2 })
    assert.equal(first.total, 5)
    assert.equal(first.matches.length, 2)
    assert.equal(first.hasMore, true)
    assert.equal(first.offset, 0)
    const next = await searchRepo(repo, { q: 'keyword', mode: 'content', offset: 2, limit: 2 })
    assert.deepEqual(next.matches.map(match => match.path), ['f2.txt', 'f3.txt'])
    assert.equal(next.hasMore, true)
    const last = await searchRepo(repo, { q: 'keyword', mode: 'content', offset: 4, limit: 2 })
    assert.deepEqual(last.matches.map(match => match.path), ['f4.txt'])
    assert.equal(last.hasMore, false)
    // limit 上限 100、非法值回退默认 50
    const huge = await searchRepo(repo, { q: 'keyword', mode: 'content', limit: 9999 })
    assert.equal(huge.limit, 100)
    const junk = await searchRepo(repo, { q: 'keyword', mode: 'content', limit: 'NaN' })
    assert.equal(junk.limit, 50)
    const negative = await searchRepo(repo, { q: 'keyword', mode: 'content', offset: -5 })
    assert.equal(negative.offset, 0)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('超长命中行截断到 300 字符', async () => {
  const long = `prefix todo ${'x'.repeat(400)}`
  const { root, repo } = await makeRepo({ 'long.txt': long })
  try {
    for (const resolver of [null, () => '']) {
      setRgResolver(resolver)
      const result = await searchRepo(repo, { q: 'todo', mode: 'content' })
      assert.equal(result.matches.length, 1)
      assert.ok(result.matches[0].text.length <= 300, `截断后长度 ${result.matches[0].text.length}`)
      assert.ok(result.matches[0].text.startsWith('prefix todo'))
    }
  } finally {
    setRgResolver(null)
    clearRgCache()
    await rm(root, { recursive: true, force: true })
  }
})

test('高亮：语法 id 映射表覆盖 langFor 的全部取值', () => {
  // 与 lib/repos.js 的 LANG_BY_EXT 取值对齐；null 表示回退纯文本
  const expected = ['go', 'typescript', 'tsx', 'yaml', 'json', 'css', 'html', 'vue', 'markdown', 'python',
    'bash', 'toml', 'ini', 'xml', 'rust', 'java', 'c', 'cpp', 'php', 'sql', 'javascript', 'dockerfile']
  for (const lang of expected) assert.ok(lang in HIGHLIGHT_LANGS, `缺少映射：${lang}`)
  assert.equal(HIGHLIGHT_LANGS.dockerfile, null, 'dockerfile：DSH langs 资源无独立块，回退纯文本')
  assert.equal(HIGHLIGHT_LANGS.sql, 'mysql', 'sql：DSH 的 sql 块注册名是 mysql')
  assert.equal(HIGHLIGHT_LANGS.tsx, 'typescript', 'tsx：无独立块，近似 typescript')
  assert.equal(HIGHLIGHT_LANGS.bash, 'shellscript', 'bash：由 vendor 内置的 shellscript 语法承担')
})

test('高亮不可用返回 tokens:null 而不是抛错', async () => {
  // 未提供安装目录：resolveInstallDir 会按 DSH_INSTALL → 全局安装位置推断；
  // 两者都拿不到时才回退，且这一步不写失败缓存（便于之后补参数重试）。
  const savedInstall = process.env.DSH_INSTALL
  const savedPath = process.env.PATH
  process.env.DSH_INSTALL = ''
  process.env.PATH = '/nonexistent-bin'
  try {
    const noInstall = await highlightLines('x', 'go')
    assert.equal(noInstall.tokens, null)
    assert.match(noInstall.reason, /找不到 DSH 安装目录/)
  } finally {
    if (savedInstall === undefined) delete process.env.DSH_INSTALL
    else process.env.DSH_INSTALL = savedInstall
    process.env.PATH = savedPath
  }

  const unknown = await highlightLines('x', 'dockerfile', { installDir: INSTALL_DIR })
  assert.equal(unknown.tokens, null)

  // 安装目录不可用：必须返回 null + reason，且第二次调用命中「已失败」缓存而不是重复尝试
  clearHighlightCache()
  const missing = await highlightLines('x', 'go', { installDir: '/nonexistent-dsh-install' })
  assert.equal(missing.tokens, null)
  assert.equal(typeof missing.reason, 'string')
  assert.match(missing.reason, /DSH 前端资源不可用/)
  const again = await highlightLines('y', 'go', { installDir: '/nonexistent-dsh-install' })
  assert.equal(again.tokens, null)
  assert.equal(again.reason, missing.reason, '同语言的失败原因应被缓存复用')
  clearHighlightCache()
})

test('高亮：同一文本二次调用命中缓存', async t => {
  clearHighlightCache()
  const code = 'package main\n\nfunc main() {\n\tprintln("hi")\n}\n'
  // 先确认 DSH 资源存在，才断言真实渲染；否则明确跳过，不伪造通过
  const probe = await highlightLines(code, 'go', { installDir: INSTALL_DIR })
  if (!probe.tokens) {
    t.skip(`本机 DSH 安装目录不可用或 shiki 加载失败：${probe.reason}`)
    return
  }
  assert.equal(highlightCacheSize(), 1)
  const again = await highlightLines(code, 'go', { installDir: INSTALL_DIR })
  assert.deepEqual(again.tokens, probe.tokens)
  assert.equal(highlightCacheSize(), 1, '二次调用不应新增缓存条目')
  // 不同文本才新增
  await highlightLines('package other\n', 'go', { installDir: INSTALL_DIR })
  assert.equal(highlightCacheSize(), 2)
  clearHighlightCache()
  assert.equal(highlightCacheSize(), 0)
})

test('高亮：Go 的 package 关键字行带颜色（DSH 资源不可用时跳过）', async t => {
  if (!SHIKI_READY) {
    t.skip(`本机 DSH 安装目录不可用：${ASSETS_DIR}`)
    return
  }
  clearHighlightCache()
  const result = await highlightLines('package main\n\nfunc main() {}\n', 'go', { installDir: INSTALL_DIR })
  if (!result.tokens) {
    t.skip(`shiki 加载失败：${result.reason}`)
    return
  }
  const first = result.tokens[0]
  const keyword = first.find(token => token[0] === 'package')
  assert.ok(keyword, '第一行应包含 package 关键字 token')
  assert.match(keyword[1].color, /^var\(--shiki-token-keyword\)$/)
  clearHighlightCache()
})
