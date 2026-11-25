#!/usr/bin/env node
/**
 * 把 `client/` 下按顺序排列的源码段拼成单文件 `client.js`。
 *
 * DSH 侧把插件 client.js 当**普通脚本**原样拼接执行，而且会与**其他所有插件**的
 * client.js 拼进同一个 bundle。所以顶层出现的任何 `const` / `function` 都相当于往
 * 全局词表里塞名字，一旦与别的插件重名就整条 entry 加载失败。实测过两种失败：
 *
 * - 通用名 `const API` 与其他插件撞名 → `Identifier 'API' has already been declared`；
 * - 通用名 `const h = React.createElement` 在顶层提前求值 → `React is not defined`。
 *
 * 因此拼接规则是：
 * - `CONST_PARTS`（tokens/theme）里只放带 `SAWB_` 前缀的跨段常量，留在**顶层**；
 * - 其余段（highlight 与 view-*）按顺序缩进后注入最后一段 `index.js` 的
 *   `factory(require) { ... }` 正文，成为工厂作用域内的语句，彼此共享同一个
 *   `const` / `function` 作用域，不泄漏到任何全局名；
 * - 每段前面插一条 `// ---- client/<段> ----` 标记，方便回查；
 * - 每段若误写顶层 `import` / `export` 直接报错退出（避免整条 entry 加载失败）。
 *
 * 生成物本身仍是**单条** `window.__ModuleLoader__.load({...})` 调用的普通脚本，
 * 没有 import / export，可以直接被 DSH Web 拼接执行。
 *
 * 用法：`npm run build:client`；`npm run check:client` 只校验不落盘。
 */

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
export const PARTS = ['tokens.js', 'theme.js', 'highlight.js', 'view-repos.js', 'view-docs-workspaces.js', 'view-editor.js', 'index.js']

/** 只定义 `SAWB_*` 跨段常量、留在顶层的段；其余段全部注入工厂正文。 */
export const CONST_PARTS = ['tokens.js', 'theme.js']

/** 入口段里工厂正文的起始行：注入点就在它后面那行之后。 */
const FACTORY_OPEN = 'factory(require) {'
/** 注入锚点：入口段必须在工厂开头解构 React，注入正文紧跟其后。 */
const INJECT_AFTER = "const React = require('react')"

/** 每段正文前加一条可回查的标记注释。 */
function segment(part, source) {
  return `// ---- client/${part} ----\n${source.trimEnd()}`
}

/** 把注入正文统一缩进到工厂内（非空行整体右移，空行保持为空）。 */
function indent(text, spaces) {
  const pad = ' '.repeat(spaces)
  return text.split('\n').map(line => (line.trim() ? pad + line : '')).join('\n')
}

export async function buildClient({ write = true } = {}) {
  const sources = new Map()
  for (const part of PARTS) {
    const source = await readFile(`${ROOT}client/${part}`, 'utf8')
    if (/^\s*(import|export)\s/m.test(source)) throw new Error(`client/${part} 不得出现顶层 import/export（会被当普通脚本拼接）`)
    sources.set(part, source)
  }

  const entry = PARTS[PARTS.length - 1]
  const entrySource = sources.get(entry)
  // 入口段自身也要守 import/export；上面循环已覆盖，这里只校验注入锚点存在。
  if (!entrySource.includes(FACTORY_OPEN)) throw new Error(`client/${entry} 必须包含 "${FACTORY_OPEN}"`)
  if (!entrySource.includes(INJECT_AFTER)) throw new Error(`client/${entry} 必须包含工厂开头的 "${INJECT_AFTER}"`)

  // 顶层只放常量段，保持它们在工厂之前定义（工厂正文要读这些常量）。
  const topLevel = CONST_PARTS.map(part => segment(part, sources.get(part))).join('\n\n')

  // 其余段按 PARTS 顺序注入工厂正文。
  const injected = PARTS
    .filter(part => part !== entry && !CONST_PARTS.includes(part))
    .map(part => segment(part, sources.get(part)))
    .join('\n\n')

  const anchorAt = entrySource.indexOf(INJECT_AFTER) + INJECT_AFTER.length
  const entryOut = `${entrySource.slice(0, anchorAt)}
    // ======== 以下正文由 scripts/build-client.mjs 从 client/ 各段注入（勿手改） ========
${indent(injected, 4)}
    // ======== 注入结束 ========${entrySource.slice(anchorAt)}`

  const banner = `/**\n * 由 \`npm run build:client\` 从 client/ 各段拼接生成，请勿直接编辑。\n * 源码段顺序：${PARTS.join(' → ')}\n * 顶层只保留 ${CONST_PARTS.join('、')} 的 SAWB_* 常量与入口调用，其余全部在工厂作用域内。\n */\n`
  const output = `${banner}${topLevel}\n\n${segment(entry, entryOut)}\n`
  if (write) await writeFile(`${ROOT}client.js`, output)
  return output
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const check = process.argv.includes('--check')
  buildClient({ write: !check })
    .then(output => console.log(check ? `client/ 拼接可生成 ${output.length} 字节` : `已生成 client.js（${output.length} 字节）`))
    .catch(error => {
      console.error(error.message)
      process.exitCode = 1
    })
}
