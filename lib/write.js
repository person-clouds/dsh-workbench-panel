/**
 * 写路径：唯一允许落盘的文件（`writeFile` / `rename` / `rm` 只出现在这里）。
 *
 * 边界（与计划「写路径边界」一致）：
 * - 只写工作树模式仓库（`mode: 'worktree'`）；git 对象模式看到的是 git 提交内容，
 *   不能原地写，统一 403；
 * - 路径先经 `cleanRel`（拒绝 `..` 与空路径），再做一次物理校验：
 *   `resolve(repo.path, path)` 必须落在 `realpath(repo.path) + sep` 之内；
 * - 敏感目录/敏感名/敏感后缀（`.env`、`.ssh`、`*.pem`、`*.db`…）与仓库配置的
 *   `exclude` 前缀一律拒绝；
 * - 只写文本：无 NUL，`Buffer.byteLength(text) <= 2MB`；
 * - 必须在文件清单内，或者满足「新建白名单」：父目录已存在且不越界、
 *   文件名非敏感、路径不含 `EXCLUDED_DIRS`——计划验收要求「新建文件保存后立刻
 *   可在树中看到」，所以新建是允许的，但只允许在已有目录里新建普通文本文件；
 * - 期望 mtime 兜底冲突：文件已存在时必须带上 `expectMtimeMs` 且与磁盘一致，
 *   不一致 → 409 且不写盘；文件不存在时 `expectMtimeMs` 必须缺省、0、null；
 * - 写入方式：同目录临时文件 `.dsh-write-<随机>.tmp` → `rename` 原子替换，
 *   失败时清理临时文件（rename 在目标为目录、权限不足、跨设备等情况下会失败）。
 *
 * 错误统一是 `Object.assign(new Error(msg), { status })`，`status` 为
 * 400 / 403 / 409 / 413，路由层按 `error.status` 映射，缺省 500。
 */

import { readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { dirname, resolve, sep } from 'node:path'
import {
  MAX_FILE_BYTES, cleanRel, clearFileCache, excluded, isGitRepo, isSensitive, listFiles, repoRealRoot,
} from './repos.js'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
const GIT_TIMEOUT_MS = 30_000
/** 不允许作为新建文件落点、也不允许出现在路径中的目录（与 repos.js 的 EXCLUDED_DIRS 同源语义）。 */
const EXCLUDED_DIRS = new Set([
  '.git', '.hg', '.svn', 'node_modules', '.go-build-cache', '.npm-cache', '.cache',
  '__pycache__', '.pytest_cache', '.mypy_cache', '.venv', 'venv', '.toolchain', '.local',
  'dist', 'build', '.run', '.logs', '.xctl', '.go-tmp', '.gomodcache', '.gocache', '.npm',
  '.pnpm-store', '.yarn', 'vendor', 'backups',
])

function fail(status, message) {
  return Object.assign(new Error(message), { status })
}

function textOf(error) {
  return String(error && error.message ? error.message : error)
}

/**
 * 公共校验：开关、工作树模式、路径形状、敏感/排除、物理越界。
 * 返回规范化后的相对路径（`cleanRel` 之后再拼成物理路径比一次根目录）。
 */
async function guard(repo, rawPath, writeEnabled) {
  if (writeEnabled === false) throw fail(403, '写功能已关闭（writeEnabled=false）')
  if (!repo || repo.mode !== 'worktree') throw fail(403, '该仓库为 git 对象模式，不能原地写入')
  // `cleanRel` 会把前导 `/` 剥掉（读路径语义，服务端传参时好用），但写入必须拒绝
  // 绝对路径：先在这里判一次，Windows 盘符也按绝对路径处理。
  const raw = String(rawPath === undefined || rawPath === null ? '' : rawPath).trim()
  if (raw.startsWith('/') || raw.startsWith('\\') || /^[a-zA-Z]:[\\/]/.test(raw)) throw fail(400, `非法路径：${rawPath}`)
  let path
  try {
    path = cleanRel(rawPath)
  } catch (error) {
    throw fail(400, textOf(error))
  }
  if (!path) throw fail(400, '缺少 path 参数')
  if (path.split('/').some(part => EXCLUDED_DIRS.has(part))) throw fail(403, `该目录不可写：${path}`)
  if (isSensitive(path) || excluded(repo, path)) throw fail(403, `该文件不可写：${path}`)
  const realRoot = await repoRealRoot(repo)
  const target = resolve(repo.path, path)
  if (!target.startsWith(`${realRoot}${sep}`)) throw fail(400, `非法路径：${rawPath}`)
  return { path, target }
}

/** 磁盘现状：文件存在时返回 stat，不存在时返回 null（ENOENT），其他错误抛出。 */
async function diskStat(target) {
  try {
    return await stat(target)
  } catch (error) {
    if (error && error.code === 'ENOENT') return null
    throw error
  }
}

/** 新建白名单校验：父目录已存在、是目录、且在仓库根内；文件名本身非敏感。 */
async function guardCreate(repo, path, realRoot) {
  const parent = dirname(path)
  const parentTarget = parent === '.' ? resolve(repo.path) : resolve(repo.path, parent)
  if (!parentTarget.startsWith(`${realRoot}${sep}`) && parentTarget !== realRoot) throw fail(400, `非法路径：${path}`)
  const info = await diskStat(parentTarget)
  if (!info || !info.isDirectory()) throw fail(400, `父目录不存在：${parent === '.' ? '.' : parent}`)
}

/**
 * 写入一个文本文件。
 * body: `{ path, text, expectMtimeMs }`；返回 `{ ok: true, path, mtimeMs, size }`。
 */
export async function writeBlob(repo, body, options = {}) {
  const { path, target } = await guard(repo, body && body.path, options.writeEnabled)
  const text = body && body.text
  if (typeof text !== 'string') throw fail(400, 'text 必须是字符串')
  if (text.includes('\0')) throw fail(400, '不支持写入二进制内容（包含 NUL 字节）')
  const bytes = Buffer.byteLength(text)
  if (bytes > MAX_FILE_BYTES) throw fail(413, `文件超过 ${MAX_FILE_BYTES} 字节上限`)
  const realRoot = await repoRealRoot(repo)
  const expected = body.expectMtimeMs
  const expectGiven = expected !== undefined && expected !== null && expected !== 0

  const current = await diskStat(target)
  const files = await listFiles(repo)
  if (current) {
    if (!current.isFile()) throw fail(400, `不是普通文件：${path}`)
    // 命中清单（含 git 模式之外的所有可读文件）才允许覆盖。
    if (!files.includes(path)) throw fail(403, `该文件不在可写清单内：${path}`)
    if (!expectGiven) throw fail(400, '覆盖已有文件必须携带 expectMtimeMs')
    if (Number(expected) !== current.mtimeMs) throw fail(409, '文件已被外部修改（mtime 不一致），请重新打开后再保存')
  } else {
    // 新建：不在清单内时走白名单；路径若已在清单内（缓存滞后）同样按新建处理。
    if (!files.includes(path)) await guardCreate(repo, path, realRoot)
    if (expectGiven) throw fail(409, '文件不存在，不能携带 expectMtimeMs')
  }

  const dir = dirname(target)
  const temp = resolve(dir, `.dsh-write-${randomBytes(6).toString('hex')}.tmp`)
  try {
    await writeFile(temp, text, { encoding: 'utf8', flag: 'wx' })
    await rename(temp, target)
  } catch (error) {
    await rm(temp, { force: true }).catch(() => {})
    throw fail(500, `写入失败：${textOf(error)}`)
  }
  clearFileCache(repo)
  const info = await stat(target)
  return { ok: true, path, mtimeMs: info.mtimeMs, size: info.size }
}

/**
 * 撤销：`git checkout -- <path>` 让文件回到 HEAD 版本。
 * 只对工作树模式的 git 仓库可用；非 git 目录没有可撤销的基线，给 400。
 * git 用 `-C <repo.path>` 指定仓库目录（不依赖进程 cwd）。
 * 返回 `{ ok: true, path, text?, mtimeMs?, size? }`：删除或读不到内容时 text 缺省。
 */
export async function revertBlob(repo, body, options = {}) {
  const { path, target } = await guard(repo, body && body.path, options.writeEnabled)
  if (!isGitRepo(repo)) throw fail(400, `不是 git 仓库，无法撤销：${repo.id}`)
  const files = await listFiles(repo)
  if (!files.includes(path)) {
    // 新建但未提交的文件：git 也不认识它，检查后按「无基线」处理。
    throw fail(400, `文件不在版本库清单内，无法撤销：${path}`)
  }
  try {
    await run('git', ['-C', repo.path, 'checkout', '--', path], { maxBuffer: 8 * 1024 * 1024, timeout: GIT_TIMEOUT_MS, windowsHide: true })
  } catch (error) {
    throw fail(400, `撤销失败：${textOf(error)}`)
  }
  clearFileCache(repo)
  const info = await diskStat(target)
  if (!info || !info.isFile()) return { ok: true, path }
  const raw = await readFileSafe(target)
  const binary = raw ? raw.subarray(0, 8000).includes(0) : false
  return {
    ok: true,
    path,
    text: raw && !binary ? raw.toString('utf8') : undefined,
    mtimeMs: info.mtimeMs,
    size: info.size,
  }
}

async function readFileSafe(target) {
  try {
    return await readFile(target)
  } catch {
    return null
  }
}
