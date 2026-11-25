/**
 * 仓库内文本检索（只读）：文件名 + 文件内容，供代码页搜索框使用。
 *
 * 安全与上限（计划「A：高亮 + 搜索」）：
 * - 候选集只来自 `listFiles(repo)`（已过滤 `EXCLUDED_DIRS`、敏感名/后缀/目录、`exclude` 前缀，
 *   且带 30s 缓存）；每个命中后再跑一次 `isSensitive` + `excluded` + 候选集内 的二次过滤；
 * - 单次结果最多 500 条（文件名 + 内容合计），超出置 `truncated: true`；
 * - 内容检索限时 5s，超时返回已得结果并标注（`truncated` + `note`）。
 *
 * 引擎优先级：
 * - `mode: 'git'` 的仓库工作区与 ref 不一致，**不跑 rg**，改 `git -C <path> grep -n -F -I -e <q> <ref>`；
 * - 其它仓库优先本机 `rg`（固定参数、`--json` 解析），`rg` 不可用/非 0/1 退出码/超时则回退逐行扫描
 *   （每文件先 `stat` 判大小，≤2MB、≤2000 个文件、无 NUL，命中行截断到 300 字符）。
 *
 * 返回结构与客户端契约一致：
 * `{ q, mode, matches: [{ path, kind: 'name'|'content', line, column, text }], total, offset, limit, hasMore, truncated, engine, note }`
 * 其中 `total` = 本轮实际收集到的命中数（受 500 上限约束），`hasMore` = 是否还有下一页；
 * `engine` ∈ `'rg' | 'scan' | 'git'`。
 */

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { join, normalize, sep } from 'node:path'
import { promisify } from 'node:util'
import { excluded, isSensitive, listFiles, looksLikeGitRepo, resolveRef } from './repos.js'

const run = promisify(execFile)

/** 查询长度边界（与客户端输入框提示一致）。 */
export const QUERY_MIN = 2
export const QUERY_MAX = 200
/** 单次结果上限：文件名 + 内容合计。 */
export const MATCH_LIMIT = 500
/** 命中行文本截断长度（rg 的 `--max-columns` 与回退扫描共用）。 */
export const TEXT_LIMIT = 300
const DEFAULT_LIMIT = 50
const MAX_PAGE_LIMIT = 100
const CONTENT_TIMEOUT_MS = 5000
const SCAN_FILE_BYTES = 2 * 1024 * 1024
const SCAN_FILE_LIMIT = 2000
const RG_MAX_BUFFER = 64 * 1024 * 1024

/** 400 用错误：路由层按 `error.status` 映射响应码，lib 层可直接测。 */
function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 })
}

/** 校验并归一化查询：trim 后 2–200 字符，否则抛 400。 */
export function normalizeQuery(raw) {
  const q = String(raw == null ? '' : raw).trim()
  if (q.length < QUERY_MIN) throw badRequest(`搜索词至少 ${QUERY_MIN} 个字符`)
  if (q.length > QUERY_MAX) throw badRequest(`搜索词最多 ${QUERY_MAX} 个字符`)
  return q
}

/** `mode`：`name|content|both`，非法值回退 `both`。 */
export function normalizeMode(raw) {
  const value = String(raw || '').trim().toLowerCase()
  return value === 'name' || value === 'content' ? value : 'both'
}

function pageInt(raw, fallback, min, max) {
  const value = Math.floor(Number(raw))
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(value, max))
}

/** 命中行文本截断到 300 字符（超长行只保留开头）。 */
function clipText(text) {
  const clean = String(text || '').replace(/[\r\n]+$/, '')
  return clean.length > TEXT_LIMIT ? clean.slice(0, TEXT_LIMIT) : clean
}

/** 绝对路径 → 仓库内相对路径（rg 的 `data.path.text` 可能是绝对路径）。 */
function toRelative(repo, raw) {
  const target = String(raw || '').replace(/\\/g, '/')
  const root = normalize(repo.path).replace(/\\/g, '/').replace(/\/+$/, '')
  const relative = target.startsWith(`${root}/`) ? target.slice(root.length + 1) : target.replace(/^\.\//, '')
  return normalize(relative).split(sep).join('/')
}

/** 二次过滤：敏感名/后缀/目录、exclude 前缀、以及不在候选集内的路径。 */
function allowedPath(repo, allowed, path) {
  if (!path || isSensitive(path) || excluded(repo, path)) return false
  return allowed.has(path)
}

/** 文件名检索：大小写不敏感的子串匹配，结果按 path 排序。 */
function nameHits(repo, allowedSet, q) {
  const needle = q.toLowerCase()
  const hits = []
  for (const path of allowedSet) {
    if (path.toLowerCase().includes(needle)) hits.push({ path, kind: 'name', line: 0, column: 0, text: '' })
  }
  return hits.sort((left, right) => left.path.localeCompare(right.path))
}

/** 本机 rg 路径探测（进程内缓存一次）；找不到返回 `''`。 */
let rgPath
export function resolveRg() {
  if (rgPath !== undefined) return rgPath
  for (const dir of String(process.env.PATH || '').split(':')) {
    if (!dir) continue
    const candidate = join(dir, 'rg')
    try {
      // 只判断文件存在；它到底能不能跑仍以 spawn 结果为准（探测失败会自动回退扫描）
      if (existsSync(candidate)) {
        rgPath = candidate
        return rgPath
      }
    } catch { /* 继续找下一个目录 */ }
  }
  rgPath = ''
  return rgPath
}

/** 仅供测试：清空 rg 探测缓存（改 PATH 后用）。 */
export function clearRgCache() {
  rgPath = undefined
}

/** 测试注入点：显式指定 rg 路径（返回空串表示「本机没有 rg」）。 */
let rgResolver = null
/** 仅供测试：替换 rg 探测函数；传 `null` 复原。 */
export function setRgResolver(resolver) {
  rgResolver = typeof resolver === 'function' ? resolver : null
}

function currentRg() {
  try {
    return rgResolver ? rgResolver() : resolveRg()
  } catch {
    return ''
  }
}

/** 解析 `rg --json` 输出：只取 `type:'match'` 行，越权路径直接丢弃。 */
function parseRgJson(repo, allowedSet, stdout) {
  const hits = []
  for (const line of String(stdout || '').split('\n')) {
    if (!line.startsWith('{')) continue
    let event
    try {
      event = JSON.parse(line)
    } catch {
      continue
    }
    if (!event || event.type !== 'match' || !event.data) continue
    const path = toRelative(repo, event.data.path && event.data.path.text)
    if (!allowedPath(repo, allowedSet, path)) continue
    const sub = Array.isArray(event.data.submatches) && event.data.submatches[0] ? event.data.submatches[0] : null
    const text = event.data.lines && typeof event.data.lines.text === 'string' ? event.data.lines.text : ''
    const hit = {
      path,
      kind: 'content',
      line: Number(event.data.line_number) || 0,
      // rg 的 `start` 是 0 起字节偏移，这里转成 1 起列号
      column: (sub ? Number(sub.start) : 0) + 1,
      text: clipText(text),
    }
    // rg 的 `binary` 标记表示「文件含 NUL」：这种文件不当文本展示（与服务端其它读取口径一致）
    if (event.data.binary || hit.text.includes('\u0000')) continue
    hits.push(hit)
  }
  return hits
}

/**
 * rg 内容检索；失败原因交给调用方决定是否回退：
 * 退出码 0/1 正常（1 = 无匹配）；`ENOENT`/超时（被 SIGTERM 杀掉）/其它退出码返回 `fallback: true`。
 * 另返回 `binary: true` 表示 rg 报「binary file detected」（含 NUL 的文件）；
 * 候选集是显式文件列表时 rg 会直接放弃，此时整份检索一条都拿不到。
 */
async function rgContent(repo, allowedSet, files, q) {
  const rg = currentRg()
  if (!rg) return { hits: [], fallback: true, timeout: false }
  try {
    // 参数固定，不接受调用方拼接：
    // - `--no-config --no-ignore`：搜到被 .gitignore 忽略的本地文件（命中还要再过敏感过滤）；
    // - 默认不跟随隐藏文件（rg 对显式路径列表本身即只搜这些文件）；
    // - `--no-follow`：不跟随符号链接，避免被链接到仓库外的敏感文件；
    // - rg 15 不接受 `--hidden=false`，隐藏文件开关只能靠默认值（已实测 `rg: invalid CLI arguments`）。
    const { stdout } = await run(rg, [
      '--no-config', '--no-ignore', '--no-follow', '-F', `--max-columns=${TEXT_LIMIT}`, '--json', '--', q, ...files,
    ], { cwd: repo.path, maxBuffer: RG_MAX_BUFFER, timeout: CONTENT_TIMEOUT_MS, windowsHide: true })
    return { hits: parseRgJson(repo, allowedSet, stdout) }
  } catch (error) {
    if (error && error.code === 1) return { hits: [] }
    const stderr = String(error && error.stderr ? error.stderr : '')
    const binary = /binary file/i.test(stderr)
    // promisify(execFile) 在超时/被杀时 error.code 为 undefined、error.killed 为 true
    const timeout = Boolean(error && (error.killed || error.signal === 'SIGTERM'))
    return { hits: [], fallback: true, timeout, binary, note: binary ? stderr.split('\n')[0].slice(0, 160) : '' }
  }
}

/**
 * 仓库含 NUL 文件时 rg 会整体报错，改用系统 `grep -rI` 列出逐行命中（`-I` 跳过二进制）。
 * 参数同样固定：`-n` 行号、`-F` 固定串、`-I` 跳过二进制、`-i?` 不加（rg 分支也是大小写敏感）。
 * 输出形如 `<path>:<行号>:<内容>`；路径含冒号时自行失配，逐行扫描兜底，不会给出错误路径。
 */
async function grepContent(repo, allowedSet, files, q) {
  try {
    // `-H`：单文件时输出也带文件名，否则形如 `<行号>:<内容>` 无法还原路径
    const { stdout } = await run('grep', ['-r', '-n', '-H', '-F', '-I', '--no-color', '-e', q, '--', ...files], {
      cwd: repo.path, maxBuffer: RG_MAX_BUFFER, timeout: CONTENT_TIMEOUT_MS, windowsHide: true,
    })
    const hits = []
    for (const line of String(stdout || '').split('\n')) {
      if (!line) continue
      const first = line.indexOf(':')
      const second = first < 0 ? -1 : line.indexOf(':', first + 1)
      if (second < 0) continue
      const path = toRelative(repo, line.slice(0, first))
      if (!allowedPath(repo, allowedSet, path)) continue
      const number = Number(line.slice(first + 1, second))
      const text = clipText(line.slice(second + 1))
      const at = text.indexOf(q)
      hits.push({ path, kind: 'content', line: Number.isFinite(number) ? number : 0, column: at + 1, text })
    }
    return { hits }
  } catch (error) {
    if (error && error.code === 1) return { hits: [] }
    return { hits: [], failed: true }
  }
}

/** git 模式内容检索：`git grep` 读的是 ref 里的内容（工作区与 ref 不一致时不能用 rg）。 */
async function gitContent(repo, allowedSet, files, q) {
  let ref
  try {
    ref = await resolveRef(repo)
  } catch (error) {
    return { hits: [], note: String(error && error.message ? error.message : error).slice(0, 160) }
  }
  try {
    const { stdout } = await run('git', ['-C', repo.path, 'grep', '-n', '-F', '-I', '--no-color', '-e', q, ref, '--', ...files], {
      maxBuffer: RG_MAX_BUFFER, timeout: CONTENT_TIMEOUT_MS, windowsHide: true,
    })
    const hits = []
    for (const line of String(stdout || '').split('\n')) {
      if (!line) continue
      // 形如 `<ref>:<path>:<行号>:<内容>`
      const first = line.indexOf(':')
      const second = first < 0 ? -1 : line.indexOf(':', first + 1)
      const third = second < 0 ? -1 : line.indexOf(':', second + 1)
      if (third < 0) continue
      const path = line.slice(first + 1, second)
      if (!allowedPath(repo, allowedSet, path)) continue
      const number = Number(line.slice(second + 1, third))
      const text = clipText(line.slice(third + 1))
      const at = text.indexOf(q)
      hits.push({ path, kind: 'content', line: Number.isFinite(number) ? number : 0, column: at + 1, text })
    }
    return { hits }
  } catch (error) {
    if (error && error.code === 1) return { hits: [] }
    return { hits: [], note: 'git grep 失败，结果可能不完整' }
  }
}

/** 回退逐行扫描：每文件先 stat，≤2MB、无 NUL、最多 2000 个文件；命中行截断到 300 字符。 */
async function scanContent(repo, allowedSet, q, deadline) {
  const needle = q // 大小写敏感，与 rg 的 `-F`（无 `-i`）行为一致
  const hits = []
  let scanned = 0
  let incomplete = false
  for (const path of allowedSet) {
    if (hits.length >= MATCH_LIMIT) {
      incomplete = true
      break
    }
    if (scanned >= SCAN_FILE_LIMIT) {
      incomplete = true
      break
    }
    if (Date.now() > deadline) {
      incomplete = true
      break
    }
    scanned += 1
    let text
    try {
      const target = normalize(join(repo.path, path))
      const root = normalize(repo.path)
      // 防御性越界校验：符号链接解析前的字面路径必须仍在仓库内
      if (target !== root && !target.startsWith(`${root}${sep}`)) continue
      const info = await stat(target)
      if (!info.isFile() || info.size > SCAN_FILE_BYTES) continue
      const raw = await readFile(target)
      // 与 rg 一致：二进制（含 NUL）文件视为不可检索；文本中个别 NUL 只从行内剔除，不丢整文件
      if (raw.subarray(0, 1024).includes(0)) continue
      text = raw.toString('utf8')
    } catch {
      continue
    }
    const lines = text.split('\n')
    for (let index = 0; index < lines.length; index += 1) {
      const at = lines[index].indexOf(needle)
      if (at < 0) continue
      hits.push({ path, kind: 'content', line: index + 1, column: at + 1, text: clipText(lines[index]) })
      if (hits.length >= MATCH_LIMIT) break
    }
  }
  return { hits, incomplete }
}

/**
 * 仓库内检索。
 * @param {object} repo `loadRepos` 归一化后的仓库对象
 * @param {{q: string, mode?: string, offset?: number, limit?: number}} options
 * @returns {Promise<object>} 见文件头注释的返回结构
 */
export async function searchRepo(repo, options = {}) {
  const q = normalizeQuery(options.q)
  const mode = normalizeMode(options.mode)
  const offset = pageInt(options.offset, 0, 0, Number.MAX_SAFE_INTEGER)
  const limit = pageInt(options.limit, DEFAULT_LIMIT, 1, MAX_PAGE_LIMIT)

  const files = await listFiles(repo)
  const allowed = files.filter(path => !isSensitive(path) && !excluded(repo, path))
  const allowedSet = new Set(allowed)

  const names = mode === 'content' ? [] : nameHits(repo, allowedSet, q)
  const contents = []
  let engine = 'rg'
  let truncated = false
  let note = ''

  if (mode !== 'name' && allowed.length) {
    const deadline = Date.now() + CONTENT_TIMEOUT_MS
    if (repo.mode === 'git' && looksLikeGitRepo(repo)) {
      engine = 'git'
      const result = await gitContent(repo, allowedSet, allowed, q)
      contents.push(...result.hits)
      if (result.note) note = result.note
    } else {
      const result = await rgContent(repo, allowedSet, allowed, q)
      if (result.fallback) {
        // 含 NUL 的文件会让 rg 对整份文件列表报「binary file detected」：
        // 先用 `grep -rI`（跳过二进制）试一次，仍失败再逐行扫描
        let rescued = null
        if (result.binary) {
          const grep = await grepContent(repo, allowedSet, allowed, q)
          if (!grep.failed) rescued = grep
        }
        if (rescued) {
          // grep 只列出「含基线的行」，不会揭示二进制内容；路径仍受 allowedSet 二次过滤
          contents.push(...rescued.hits)
        } else {
          engine = 'scan'
          const scanned = await scanContent(repo, allowedSet, q, deadline)
          contents.push(...scanned.hits)
          if (result.timeout) {
            truncated = true
            note = '检索超时，结果可能不完整'
          } else if (scanned.incomplete) {
            truncated = true
            note = '结果超过上限，已截断'
          }
        }
      } else {
        contents.push(...result.hits)
      }
    }
  }

  // 排序：文件名命中在前（按 path），内容命中按 path 再 line
  contents.sort((left, right) => left.path.localeCompare(right.path) || left.line - right.line || left.column - right.column)
  const all = [...names, ...contents]
  if (all.length > MATCH_LIMIT) {
    all.length = MATCH_LIMIT
    truncated = true
    if (!note) note = '结果超过上限，已截断'
  }
  const page = all.slice(offset, offset + limit)
  return {
    q,
    mode,
    matches: page,
    total: all.length,
    offset,
    limit,
    hasMore: offset + page.length < all.length,
    truncated,
    engine,
    note,
  }
}
