import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import test from 'node:test'

import { clearFileCache, listFiles, repoBlob } from '../lib/repos.js'
import { revertBlob, writeBlob } from '../lib/write.js'

/**
 * 路由层用例需要 import lib/index.js（间接依赖 schemastery），
 * 这里与 index.test.mjs 用同一套最小 stub，避免依赖已安装的 DSH 依赖。
 */
const SCHEMA_STUB = `
function field(type) {
  const schema = {
    type,
    defaultValue: undefined,
    default(value) {
      schema.defaultValue = value
      return schema
    },
    description() {
      return schema
    }
  }
  return schema
}
function string() { return field('string') }
function number() { return field('number') }
function boolean() { return field('boolean') }
function array() { return field('array') }
function union() { return field('union') }
function const_() { return field('const') }
function object(shape) {
  const schema = function validate(value = {}) {
    const result = {}
    for (const [key, spec] of Object.entries(shape)) {
      if (Object.hasOwn(value, key) && value[key] !== undefined) result[key] = value[key]
      else if (spec.defaultValue !== undefined) result[key] = spec.defaultValue
    }
    return result
  }
  schema.shape = shape
  return schema
}
export default { string, number, boolean, array, union, const: const_, object }
`

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@deepseek-ai/schemastery') {
      return { url: `data:text/javascript,${encodeURIComponent(SCHEMA_STUB)}`, shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
})

const { apply, Config } = await import('../index.js')

const run = promisify(execFile)
const WRITE_ON = { writeEnabled: true }
const WRITE_OFF = { writeEnabled: false }

/** 造一个临时工作树仓库对象；mode 可切换成 git 对象模式。 */
function repoOf(path, overrides = {}) {
  return { id: 'tmp', name: 'tmp', description: '', path, mode: 'worktree', ref: '', exclude: [], source: 'configured', ...overrides }
}

/** 断言操作抛出指定 status 的错误。 */
async function rejectsWith(promise, status, pattern) {
  await assert.rejects(promise, error => {
    assert.equal(error.status, status, `期望 status=${status}，实际 ${error.status}：${error.message}`)
    if (pattern) assert.match(error.message, pattern)
    return true
  })
}

let tempSeq = 0

/**
 * 建临时目录并在结束后清理。
 * 每个用例都拿到独立仓库根目录：`listFiles` 的磁盘清单缓存是模块级的，若复用同一
 * 路径会让上一个用例的文件残留进清单。
 */
async function withTemp(fn) {
  tempSeq += 1
  const root = await mkdtemp(join(tmpdir(), `dsh-workbench-write-${tempSeq}-`))
  // 先清一次该仓库 id 的磁盘清单缓存：同 id 的上一个仓库若已删除，旧清单会残留，
  // 导致本用例的 listFiles 返回上一轮的文件。真实 Host 里仓库路径稳定，不会遇到。
  clearFileCache(repoOf(root))
  try {
    return await fn(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

test('正常写入：内容一致、返回新的 mtimeMs/size、磁盘 mtime 变化', async () => {
  await withTemp(async root => {
    await writeFile(join(root, 'a.txt'), 'old\n')
    // 把 mtime 挪到过去，保证写入后 mtime 一定变化。
    const past = new Date(Date.now() - 60_000)
    await utimes(join(root, 'a.txt'), past, past)
    const repo = repoOf(root)
    const before = await stat(join(root, 'a.txt'))

    const result = await writeBlob(repo, { path: 'a.txt', text: 'new\n内容\n', expectMtimeMs: before.mtimeMs }, WRITE_ON)
    assert.equal(await readFile(join(root, 'a.txt'), 'utf8'), 'new\n内容\n')
    assert.equal(result.ok, true)
    assert.equal(result.path, 'a.txt')
    assert.equal(result.size, Buffer.byteLength('new\n内容\n'))
    const after = await stat(join(root, 'a.txt'))
    assert.equal(result.mtimeMs, after.mtimeMs)
    assert.ok(after.mtimeMs > before.mtimeMs)
    // 临时文件不残留。
    assert.deepEqual((await readdir(root)).filter(name => name.includes('.dsh-write-')), [])
  })
})

test('expectMtimeMs 过期返回 409，且磁盘内容不变', async () => {
  await withTemp(async root => {
    await writeFile(join(root, 'a.txt'), 'v1\n')
    const repo = repoOf(root)
    const seen = (await stat(join(root, 'a.txt'))).mtimeMs
    // 模拟外部改动：内容与 mtime 都变了。
    await writeFile(join(root, 'a.txt'), '外部改的\n')
    const later = new Date(Date.now() + 5_000)
    await utimes(join(root, 'a.txt'), later, later)

    await rejectsWith(writeBlob(repo, { path: 'a.txt', text: '我的改动\n', expectMtimeMs: seen }, WRITE_ON), 409, /mtime/)
    assert.equal(await readFile(join(root, 'a.txt'), 'utf8'), '外部改的\n')
  })
})

test('writeEnabled=false：write 与 revert 都 403', async () => {
  await withTemp(async root => {
    await writeFile(join(root, 'a.txt'), 'orig\n')
    const repo = repoOf(root)
    const mtime = (await stat(join(root, 'a.txt'))).mtimeMs
    await rejectsWith(writeBlob(repo, { path: 'a.txt', text: 'x\n', expectMtimeMs: mtime }, WRITE_OFF), 403, /writeEnabled/)
    await rejectsWith(revertBlob(repo, { path: 'a.txt' }, WRITE_OFF), 403, /writeEnabled/)
    assert.equal(await readFile(join(root, 'a.txt'), 'utf8'), 'orig\n')
  })
})

test("mode='git' 仓库写入 403", async () => {
  await withTemp(async root => {
    await writeFile(join(root, 'a.txt'), 'orig\n')
    await rejectsWith(writeBlob(repoOf(root, { mode: 'git', ref: 'HEAD' }), { path: 'a.txt', text: 'x\n' }, WRITE_ON), 403, /git 对象模式/)
    await rejectsWith(revertBlob(repoOf(root, { mode: 'git', ref: 'HEAD' }), { path: 'a.txt' }, WRITE_ON), 403, /git 对象模式/)
    assert.equal(await readFile(join(root, 'a.txt'), 'utf8'), 'orig\n')
  })
})

test('敏感文件拒绝写入且磁盘不变', async () => {
  await withTemp(async root => {
    await mkdir(join(root, '.ssh'), { recursive: true })
    const cases = [
      ['.env', 'SECRET=1\n'],
      ['a.pem', 'pem\n'],
      ['x.sqlite', 'db\n'],
      ['.ssh/id_rsa', 'key\n'],
      ['.git/config', '[core]\n'],
    ]
    for (const [path, text] of cases) {
      await mkdir(join(root, path, '..'), { recursive: true })
      await writeFile(join(root, path), text)
      await rejectsWith(writeBlob(repoOf(root), { path, text: 'hacked\n', expectMtimeMs: (await stat(join(root, path))).mtimeMs }, WRITE_ON), 403)
      assert.equal(await readFile(join(root, path), 'utf8'), text, `${path} 不应被改写`)
    }
  })
})

test('path 含 .. 或为绝对路径时 400', async () => {
  await withTemp(async root => {
    const repo = repoOf(root)
    await rejectsWith(writeBlob(repo, { path: '../escape.txt', text: 'x' }, WRITE_ON), 400, /非法路径/)
    await rejectsWith(writeBlob(repo, { path: 'sub/../../escape.txt', text: 'x' }, WRITE_ON), 400, /非法路径/)
    await rejectsWith(writeBlob(repo, { path: join(root, 'a.txt'), text: 'x' }, WRITE_ON), 400, /非法路径/)
    // 仓库根目录本身没有被写入任何文件。
    assert.deepEqual(await readdir(root), [])
  })
})

test('二进制内容（含 NUL）拒绝', async () => {
  await withTemp(async root => {
    await writeFile(join(root, 'a.txt'), 'orig\n')
    const mtime = (await stat(join(root, 'a.txt'))).mtimeMs
    await rejectsWith(writeBlob(repoOf(root), { path: 'a.txt', text: 'a\0b', expectMtimeMs: mtime }, WRITE_ON), 400, /二进制/)
    await rejectsWith(writeBlob(repoOf(root), { path: 'a.txt', text: Buffer.from('x'), expectMtimeMs: mtime }, WRITE_ON), 400, /字符串/)
    assert.equal(await readFile(join(root, 'a.txt'), 'utf8'), 'orig\n')
  })
})

test('超过 2MB 返回 413 且磁盘不变', async () => {
  await withTemp(async root => {
    await writeFile(join(root, 'a.txt'), 'orig\n')
    const mtime = (await stat(join(root, 'a.txt'))).mtimeMs
    const huge = 'x'.repeat(2 * 1024 * 1024 + 1)
    await rejectsWith(writeBlob(repoOf(root), { path: 'a.txt', text: huge, expectMtimeMs: mtime }, WRITE_ON), 413, /上限/)
    assert.equal(await readFile(join(root, 'a.txt'), 'utf8'), 'orig\n')
  })
})

test('新建文件保存后 listFiles 立即可见（缓存已失效）', async () => {
  await withTemp(async root => {
    await mkdir(join(root, 'src'), { recursive: true })
    await writeFile(join(root, 'src', 'a.js'), 'a\n')
    const repo = repoOf(root)
    // 先读一次，把清单灌进缓存。listFiles 按字符串排序（`/` 小于 `.`），
    // 子目录文件 src/a.js 排在根文件 a.txt 之前——这是既有顺序，这里照实断言。
    assert.deepEqual(await listFiles(repo), ['src/a.js'])

    const created = await writeBlob(repo, { path: 'src/b.js', text: 'b\n' }, WRITE_ON)
    assert.equal(created.ok, true)
    assert.deepEqual(await listFiles(repo), ['src/a.js', 'src/b.js'])

    // 根目录下新建也要立即可见（缓存项整条失效，不是只补一个文件）。
    await writeBlob(repo, { path: 'root.txt', text: 'r\n' }, WRITE_ON)
    assert.deepEqual(await listFiles(repo), ['root.txt', 'src/a.js', 'src/b.js'].sort())
    const blob = await repoBlob(repo, 'src/b.js')
    assert.equal(blob.text, 'b\n')
    assert.equal(blob.editable, true)

    // 父目录不存在 → 400。
    await rejectsWith(writeBlob(repo, { path: 'nope/c.js', text: 'c\n' }, WRITE_ON), 400, /父目录/)
    // 已存在文件不带 expectMtimeMs → 400。
    await rejectsWith(writeBlob(repo, { path: 'src/b.js', text: 'c\n' }, WRITE_ON), 400, /expectMtimeMs/)
    // 新建却带 expectMtimeMs → 409。
    await rejectsWith(writeBlob(repo, { path: 'src/d.js', text: 'd\n', expectMtimeMs: 123 }, WRITE_ON), 409)

    clearFileCache(repo)
  })
})

/** 与 index.test.mjs 同风格的 fakeContext：只关心路由注册与请求处理。 */
function fakeContext() {
  const routes = []
  const ctx = {
    logger: { info() {}, warn() {}, error() {} },
    effect: (factory) => factory(),
    get: () => undefined,
    webServer: { register: (route) => { routes.push(route); return () => {} } },
    connection: {},
  }
  return { ctx, routes }
}

function fakeResponse() {
  return {
    status: undefined,
    headers: undefined,
    body: '',
    writeHead(status, headers) { this.status = status; this.headers = headers },
    end(body = '') { this.body += String(body) },
  }
}

function request(url, method = 'GET', body = undefined) {
  return {
    method,
    url,
    headers: {},
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(JSON.stringify(body))
    },
  }
}

async function handle(route, req) {
  const res = fakeResponse()
  await route.handler(req, res)
  const isJson = String(res.headers && res.headers['content-type'] || '').includes('application/json')
  return { status: res.status, headers: res.headers, body: res.body && isJson ? JSON.parse(res.body) : res.body }
}

/** 起一个只注册本仓库的 Host 路由。 */
function routeFor(repoPath, options = {}) {
  const { ctx, routes } = fakeContext()
  apply(ctx, new Config({ repos: [{ id: 'tmp', path: repoPath, mode: 'worktree' }], ...options }))
  return routes[0]
}

test('路由层：POST /api/write 正常保存；未知 repo → 400；writeEnabled=false → 403', async () => {
  await withTemp(async root => {
    await writeFile(join(root, 'a.txt'), 'orig\n')
    const route = routeFor(root, { cacheSeconds: 0 })

    const blob = await handle(route, request('/dsh-workbench-panel/api?view=blob&repo=tmp&path=a.txt'))
    assert.equal(blob.status, 200)
    assert.equal(blob.body.editable, true)
    assert.ok(blob.body.mtimeMs > 0)

    const saved = await handle(route, request('/dsh-workbench-panel/api/write', 'POST', { repo: 'tmp', path: 'a.txt', text: 'new\n', expectMtimeMs: blob.body.mtimeMs }))
    assert.equal(saved.status, 200)
    assert.equal(saved.body.ok, true)
    assert.equal(saved.body.path, 'a.txt')
    assert.equal(saved.body.size, 4)
    assert.ok(saved.body.mtimeMs > 0)
    assert.equal(await readFile(join(root, 'a.txt'), 'utf8'), 'new\n')

    const unknown = await handle(route, request('/dsh-workbench-panel/api/write', 'POST', { repo: 'nope', path: 'a.txt', text: 'x' }))
    assert.equal(unknown.status, 400)
    assert.match(unknown.body.error, /找不到仓库/)

    const getWrite = await handle(route, request('/dsh-workbench-panel/api/write'))
    assert.equal(getWrite.status, 405)
    const missing = await handle(route, request('/dsh-workbench-panel/api/nothing', 'POST', {}))
    assert.equal(missing.status, 404)
  })
})

test('路由层：writeEnabled=false 时 /api/write 与 /api/revert 都 403', async () => {
  await withTemp(async root => {
    await writeFile(join(root, 'a.txt'), 'orig\n')
    const route = routeFor(root, { writeEnabled: false })
    const written = await handle(route, request('/dsh-workbench-panel/api/write', 'POST', { repo: 'tmp', path: 'a.txt', text: 'x\n', expectMtimeMs: 1 }))
    assert.equal(written.status, 403)
    assert.match(written.body.error, /writeEnabled/)
    const reverted = await handle(route, request('/dsh-workbench-panel/api/revert', 'POST', { repo: 'tmp', path: 'a.txt' }))
    assert.equal(reverted.status, 403)
    assert.equal(await readFile(join(root, 'a.txt'), 'utf8'), 'orig\n')
  })
})

test('revert：git 仓库改一行后恢复到 HEAD 内容', async () => {
  await withTemp(async root => {
    const git = (...args) => run('git', ['-c', 'user.email=test@example.com', '-c', 'user.name=test', ...args], { cwd: root })
    await writeFile(join(root, 'a.txt'), 'line1\nline2\n')
    await git('init', '-q')
    await git('add', 'a.txt')
    await git('commit', '-qm', 'init')
    const expected = (await run('git', ['show', 'HEAD:a.txt'], { cwd: root })).stdout

    const repo = repoOf(root)
    const mtime = (await stat(join(root, 'a.txt'))).mtimeMs
    await writeBlob(repo, { path: 'a.txt', text: 'line1\n改过了\n', expectMtimeMs: mtime }, WRITE_ON)
    assert.equal(await readFile(join(root, 'a.txt'), 'utf8'), 'line1\n改过了\n')

    const reverted = await revertBlob(repo, { path: 'a.txt' }, WRITE_ON)
    assert.equal(reverted.ok, true)
    assert.equal(reverted.path, 'a.txt')
    assert.equal(reverted.text, expected)
    assert.equal(await readFile(join(root, 'a.txt'), 'utf8'), expected)
    assert.ok(reverted.mtimeMs > 0)

    // 非 git 目录：无基线可撤销。
    const plain = await mkdtemp(join(tmpdir(), 'dsh-workbench-plain-'))
    try {
      await writeFile(join(plain, 'a.txt'), 'x\n')
      await rejectsWith(revertBlob(repoOf(plain), { path: 'a.txt' }, WRITE_ON), 400, /git/)
    } finally {
      await rm(plain, { recursive: true, force: true })
    }
  })
})
