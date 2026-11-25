/**
 * Host 端 shiki 高亮：复用 DSH 前端自带的 shiki（不新增依赖）。
 *
 * 这是本插件唯一加载 DSH 前端资源的文件。事实与做法（2026-11-25 实测 DSH 0.2.2-rc.1）：
 * - 语法块直接在浏览器端加载不可行（DSH 把 client 脚本当普通脚本拼接，不能 `import()`），
 *   因此高亮放在 Host 做，客户端只拿 `[[文本, 颜色CSS变量]]` 数组；
 * - 资源在 `<installDir>/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/`：
 *   `index-<hash>.js`（主 bundle，含 vendor 与语言映射）、`vendor-<hash>.js`、`langs/<lang>-<hash>.js`；
 *   文件名带哈希，必须从主 bundle 文本里解析，解析结果进进程内缓存；
 * - vendor 模块只导出 23 个单字母名（摇树后重命名），其中三个是 shiki 的工厂：
 *   `c` = css-variables 主题、`a` = HighlighterCore engine、`b` = highlighter 构造器
 *   （对应主 bundle 的 `ub`/`db`/`fb`，即 `_A`/`wA`）；
 * - vendor 顶层会 `document.createElement('i')`（markdown-it 的实体解码表），Node 里
 *   必须先装一个最小 DOM 桩再 `import()`，否则 `ReferenceError: document is not defined`；
 * - 语法必须**同步注册**：`codeToTokens*` 遇到未注册语法直接抛
 *   ``Language `x` not found``，所以先 `await import(langChunk)` 再 `highlighter.loadLanguageSync(mod.default)`；
 * - 主 bundle 预置了 `ts`/`shellscript`/`json`，以及完整 `html` 族（html/javascript/css/xml/sql/java）；
 * - 颜色返回 shiki 的 `var(--shiki-token-keyword)` 这类 CSS 变量：明暗主题切换由 DSH 前端样式自动跟随，
 *   无需 Host 重新渲染。字重/斜体（token 的 `fontStyle` 位）本版忽略，只返回 `{ color }`。
 *
 * 任一步失败都不抛错：返回 `{ tokens: null, reason }`，调用方（`view=blob`）让客户端走纯文本；
 * 原因只记录一次 warn，不打印堆栈。
 *
 * 语言覆盖的已知边界（**不是 bug**，勿当缺陷修）：
 * - `dockerfile`：DSH 的 langs 资源里没有 dockerfile 块 → 回退纯文本；
 * - `tsx`：没有独立 tsx 块 → 近似用 `typescript`（JSX 处理有限）；
 * - `sql`：`sql-*.js` 块的注册名是 `mysql`，按 `sql` 注册会抛错，故映射到 `mysql`。
 */

import { existsSync, readdirSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

/** vendor 里 shiki 三个工厂的单字母导出名（按方法特征确认，不只凭字母）。 */
const SHIKI_EXPORTS = { theme: 'c', engine: 'a', highlighter: 'b' }
/** 缓存上限（条）：按 `lang\0hash(text)` 计，超出后删最早写入的一条（近似 LRU）。 */
const CACHE_LIMIT = 200

/** 已解析的资源位置与 highlighter 实例（进程内唯一，随文件 mtime 失效）。 */
let assets = null
/** token 缓存：key → TokenLine[]。 */
const tokenCache = new Map()
/** 已知失败原因：`lang` → reason，避免同一种语言反复尝试与刷日志。 */
const failedLangs = new Map()
/** 是否已经打过一条 warn（验收要求「失败只打一条」）。 */
let warned = false
/** 已解析到的 DSH 安装目录（进程内缓存；`clearHighlightCache` 会清空）。 */
let resolvedInstallDir = ''

/** 最小 DOM 桩：只满足 vendor 顶层 `document.createElement('i')` 与实体解码读 `textContent`。 */
function installDomStub() {
  if (typeof globalThis.document !== 'undefined') return
  const element = {
    innerHTML: '',
    get textContent() {
      // 实体名原样返回即可：markdown-it 只比较 `&name;` 是否变化
      return String(this.innerHTML).replace(/^&([^;]*);$/, '$1')
    },
  }
  globalThis.document = {
    createElement: () => element,
    createTextNode: text => ({ textContent: text }),
    querySelector: () => null,
    // KaTeX 在 vendor 顶层会读 `document.compatMode`，留空会打印一条 quirks mode 警告；
    // 给标准文档模式即可静默（本桩不参与任何渲染）
    compatMode: 'CSS1Compat',
  }
  if (typeof globalThis.self === 'undefined') globalThis.self = globalThis
  if (typeof globalThis.window === 'undefined') globalThis.window = globalThis
}

/** 从主 bundle 文本解析 vendor 文件名与语法块映射。 */
function parseAssets(installDir, indexName, indexText) {
  const vendorMatch = indexText.match(/from"\.\/(vendor-[^"]+\.js)"/)
  const langs = new Map()
  for (const match of indexText.matchAll(/import\("\.\/langs\/([a-z0-9-]+)-([^"]+)"?\.js"\)/g)) {
    langs.set(match[1], `langs/${match[1]}-${match[2]}.js`)
  }
  return {
    installDir,
    assetsDir: join(installDir, 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'dist', 'assets'),
    indexName,
    vendorName: vendorMatch ? vendorMatch[1] : '',
    langs,
    highlighter: null,
    vendor: null,
  }
}

/**
 * 找出 vendor 里随包内置的语法对象。
 * 主 bundle 用 `langs: mA`（= vendor 的 `p`/`s`/`q`）初始化高亮器，这三个是
 * TypeScript / ShellScript / JSON 语法，且导出形态是**数组**（`[grammar]`，实测 keys 为 `["0"]`）；
 * 这里按「数组元素带 `scopeName` 与 `patterns`」识别，不依赖单字母名（摇树后的字母顺序不保证稳定）。
 */
function builtinGrammars(vendor) {
  const isGrammar = value => value && typeof value === 'object' && typeof value.scopeName === 'string' && Array.isArray(value.patterns)
  const found = []
  for (const value of Object.values(vendor)) {
    if (isGrammar(value)) found.push(value)
    else if (Array.isArray(value)) found.push(...value.filter(isGrammar))
  }
  return found
}

/** 加载（或复用）shiki：解析资源 → 装 DOM 桩 → 建 highlighter。失败返回 `{ error }`。 */
async function ensureHighlighter(installDir) {
  const indexDir = join(installDir, 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'dist', 'assets')
  let indexName
  try {
    indexName = (await readdir(indexDir)).filter(name => /^index-[^/]+\.js$/.test(name)).sort().pop()
  } catch (error) {
    return { error: `DSH 前端资源不可用：${indexDir}（${error && error.code ? error.code : 'readdir 失败'}）` }
  }
  if (!indexName) return { error: `DSH 前端资源不可用：${indexDir} 下没有 index-*.js` }
  if (assets && assets.installDir === installDir && assets.indexName === indexName && assets.highlighter) return { highlighter: assets.highlighter }
  try {
    const indexText = await readFile(join(indexDir, indexName), 'utf8')
    const next = parseAssets(installDir, indexName, indexText)
    if (!next.vendorName) return { error: `主 bundle 未找到 vendor 引用：${indexName}` }
    installDomStub()
    const vendor = await import(new URL(`file://${join(next.assetsDir, next.vendorName)}`).href)
    const theme = vendor[SHIKI_EXPORTS.theme]
    const engine = vendor[SHIKI_EXPORTS.engine]
    const create = vendor[SHIKI_EXPORTS.highlighter]
    if (typeof theme !== 'function' || typeof engine !== 'function' || typeof create !== 'function') {
      return { error: `vendor 的 shiki 工厂缺失（${Object.keys(vendor).join(',')}）` }
    }
    // 语法块导入与 css-variables 主题配置照 DSH 内置用法；langs 传 vendor 自带语法（ts/shell/json）
    const highlighter = create({
      themes: [theme({ name: 'css-variables', variablePrefix: '--shiki-', fontStyle: true })],
      langs: builtinGrammars(vendor),
      engine: engine({ forgiving: true, regexConstructor: pattern => vendor.o(pattern, { lazyCompileLength: Number.POSITIVE_INFINITY }) }),
    })
    next.vendor = vendor
    next.highlighter = highlighter
    assets = next
    return { highlighter }
  } catch (error) {
    return { error: `加载 DSH shiki 失败：${String(error && error.message ? error.message : error).slice(0, 160)}` }
  }
}

/**
 * 推断 DSH 安装目录：`options.installDir` 优先。
 * 未提供时依次试：
 * 1. `DSH_INSTALL` 环境变量；
 * 2. 本文件（`<install>/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/` 之外）按
 *    「向上找 `node_modules/@deepseek-ai/dsh`」——只在本插件被装进 DSH 目录内时命中；
 * 3. 解析 `@deepseek-ai/schemastery` 的第一个 `/node_modules/` 之前目录。
 * 都失败返回 `''`（调用方据此返回 `tokens: null`，不抛错）。
 */
export function resolveInstallDir(options = {}) {
  if (options.installDir) return String(options.installDir)
  if (process.env.DSH_INSTALL) return process.env.DSH_INSTALL
  // 解析成功后缓存：安装目录在进程生命周期内不变，且避免每条请求重复 resolve
  if (resolvedInstallDir) return resolvedInstallDir

  // 4. 全局 npm / pnpm 安装位置（`dsh` 是全局命令时最常见）：找到 dsh 自身的 package.json
  //    再读它的依赖解析路径。`dsh` 命令所在目录由 PATH 推断，取 `<prefix>/lib/node_modules/@deepseek-ai/dsh`。
  for (const candidate of globalInstallCandidates()) {
    if (highlightAssetsDir(candidate)) {
      resolvedInstallDir = candidate
      return resolvedInstallDir
    }
  }
  return ''
}

/** 全局安装候选：`npm root -g`（不跑子进程，按 PATH 里的 npm 自身位置推断）与常见前缀。 */
function globalInstallCandidates() {
  const out = []
  const bin = process.env.PATH ? process.env.PATH.split(':').filter(Boolean) : []
  for (const dir of bin) {
    // <prefix>/bin 下的全局 npm/pnpm/yarn → <prefix>；忽略用户目录下的临时 bin
    if (!/(^|\/)(bin|sbin)$/.test(dir)) continue
    const prefix = dir.replace(/\/(bin|sbin)$/, '')
    out.push(join(prefix, 'lib', 'node_modules', '@deepseek-ai', 'dsh'))
    out.push(join(prefix, 'node_modules', '@deepseek-ai', 'dsh'))
  }
  // pnpm 全局目录的常见布局
  const pnpmHome = process.env.PNPM_HOME
  if (pnpmHome) out.push(join(pnpmHome, 'global', '5', 'node_modules', '@deepseek-ai', 'dsh'))
  return [...new Set(out)]
}

/** 该安装目录下是否有可用的 shiki 资源（只看 assets 目录与 index-*.js 是否存在，同步判定）。 */
/** 该安装目录下 frontend assets 目录是否存在（同步、不抛错）。 */
function highlightAssetsDir(installDir) {
  try {
    const dir = join(installDir, 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'dist', 'assets')
    return existsSync(dir)
  } catch {
    return false
  }
}

/** 该安装目录下是否有可用的 shiki 资源（只看 assets 目录与 index-*.js 是否存在，同步判定）。 */
export function highlightAvailable(installDir) {
  if (!installDir) return false
  const dir = join(installDir, 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'dist', 'assets')
  try {
    // 先判目录存在再列目录；两步都可能因权限/不合规路径抛错
    if (!existsSync(dir)) return false
    return readdirSync(dir).some(name => /^index-.+\.js$/.test(name))
  } catch {
    return false
  }
}

/** 语法 id → 能否高亮的静态表（按实测结果；`null` 表示回退纯文本）。 */
export const HIGHLIGHT_LANGS = {
  python: 'python',
  go: 'go',
  javascript: 'javascript',
  typescript: 'typescript',
  // tsx：DSH 的 langs 资源里没有独立 tsx 块，回退近似语言 typescript（JSX 处理有限，但优于纯文本）
  tsx: 'typescript',
  vue: 'vue',
  php: 'php',
  bash: 'shellscript',
  // sql：DSH 的 sql-*.js 块注册名是 `mysql` 而非 `sql`，按 id 注册会抛
  // 「Language `sql` not found」；client 想显示 SQL 高亮可改传 'mysql'
  sql: 'mysql',
  json: 'json',
  yaml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  markdown: 'markdown',
  css: 'css',
  html: 'html',
  xml: 'xml',
  rust: 'rust',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  // dockerfile：DSH 的 langs 资源里没有 dockerfile 块，回退纯文本（不是 bug）
  dockerfile: null,
}

/** 内容哈希（FNV-1a 32 位）：缓存键用，不必抗碰撞。 */
function hashText(text) {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `${text.length.toString(36)}-${hash.toString(36)}`
}

function warnOnce(reason) {
  if (warned) return
  warned = true
  console.warn(`[dsh-workbench-panel] 语法高亮不可用，代码页回退纯文本：${reason}`)
}

/** 清空 token 缓存与失败缓存（测试与 DSH 升级后用）。 */
export function clearHighlightCache() {
  tokenCache.clear()
  failedLangs.clear()
  assets = null
  warned = false
  resolvedInstallDir = ''
}

/** 是否有可用于 `lang` 的语法（只看静态表，不看运行时是否加载成功）。 */
export function highlightSupported(lang) {
  return Boolean(lang && typeof lang === 'string' && HIGHLIGHT_LANGS[lang])
}

/**
 * 渲染整段文本。
 * @param {string} text 源码
 * @param {string} lang `lib/repos.js` 的 `langFor()` 结果
 * @param {{installDir?: string}} options `installDir` 为 DSH 安装目录（调用方传 `process.env.DSH_INSTALL`）
 * @returns {Promise<{tokens: Array<Array<[string, {color: string}]>> | null, reason?: string}>}
 *   `tokens` 每行一个数组，每项 `[文本, { color }]`；不可用时 `tokens: null` 并给 `reason`。
 */
export async function highlightLines(text, lang, options = {}) {
  const shikiLang = HIGHLIGHT_LANGS[lang]
  if (!shikiLang) return { tokens: null, reason: lang ? `不支持的语言：${lang}` : '未知语言' }
  if (typeof text !== 'string' || !text) return { tokens: [], reason: '空文件' }
  const cacheKey = `${shikiLang}\0${hashText(text)}`
  const cached = tokenCache.get(cacheKey)
  if (cached) return { tokens: cached }
  const failed = failedLangs.get(shikiLang)
  if (failed) return { tokens: null, reason: failed }
  // 安装目录三级推断（显式参数 → DSH_INSTALL → 全局安装位置）；都失败才算「本机没有 shiki」
  const installDir = resolveInstallDir(options)
  if (!installDir) return { tokens: null, reason: '找不到 DSH 安装目录（可设 DSH_INSTALL）' }

  const ready = await ensureHighlighter(installDir)
  if (ready.error) {
    failedLangs.set(shikiLang, ready.error)
    warnOnce(ready.error)
    return { tokens: null, reason: ready.error }
  }
  const highlighter = ready.highlighter
  try {
    if (!highlighter.getLoadedLanguages().includes(shikiLang)) {
      const chunk = assets.langs.get(shikiLang)
      if (!chunk) {
        const reason = `语法块缺失：${shikiLang}`
        failedLangs.set(shikiLang, reason)
        return { tokens: null, reason }
      }
      const module = await import(new URL(`file://${join(assets.assetsDir, chunk)}`).href)
      highlighter.loadLanguageSync(module.default)
    }
    const result = highlighter.codeToTokens(text, { lang: shikiLang, theme: 'css-variables' })
    const tokens = result.tokens.map(line => line.map(token => [token.content, { color: token.color || '' }]))
    if (tokenCache.size >= CACHE_LIMIT) tokenCache.delete(tokenCache.keys().next().value)
    tokenCache.set(cacheKey, tokens)
    return { tokens }
  } catch (error) {
    const reason = `渲染失败：${String(error && error.message ? error.message : error).slice(0, 160)}`
    failedLangs.set(shikiLang, reason)
    warnOnce(reason)
    return { tokens: null, reason }
  }
}

/** 仅供测试：当前缓存条数。 */
export function highlightCacheSize() {
  return tokenCache.size
}
