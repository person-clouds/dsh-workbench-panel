/**
 * client/ 源码段的轻量冒烟测试夹具。
 *
 * 不引入 React 与 DOM：用一个「记录调用」的假 React，把各段源码段按构建顺序
 * 拼起来执行，导出工厂返回的面板组件，再用假 Hook 渲染一次，确认：
 * - 各段能一起执行（没有重复声明、没有互相缺失的函数）；
 * - 面板外壳能渲染出三个页签，且注入的依赖只有 slots / locale。
 *
 * 真正的像素与交互验证在浏览器里做，这里只守住「构建产物能跑起来」这条底线。
 */

import { readFile } from 'node:fs/promises'

export const SEGMENTS = ['tokens.js', 'theme.js', 'highlight.js', 'view-repos.js', 'view-docs-workspaces.js', 'view-editor.js', 'index.js']

/** 记录调用并用 `type` 标识元素的假 React。 */
export function fakeReact() {
  let hookIndex = 0
  const states = []
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    Fragment: Symbol('Fragment'),
    useState(initial) {
      const index = hookIndex++
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
      return [states[index], value => { states[index] = value }]
    },
    useEffect() {},
    useRef(value) { return { current: value === undefined ? null : value } },
    useCallback(fn) { return fn },
    useMemo(fn) { return fn() },
    useLayoutEffect() {},
    __resetHooks() { hookIndex = 0 },
  }
  return React
}

/** 执行构建后的 `client.js`，返回插件模块对象（`factory` 即窗口注册的工厂）。 */
export async function loadFactory(root) {
  const React = fakeReact()
  const registered = []
  // 直接执行拼接产物本身（不再逐段拼），保证测试与浏览器走同一条代码路径：
  // 各段已被构建脚本注入 `factory(require){...}` 正文，顶层只剩 SAWB_* 常量与入口调用。
  // 这里用 `new Function` 只是提供 `window` / `console` 两个宿主全局；`React` 额外传一份
  // 便于调试不会参与求值——真正的 React 由工厂内的 `require('react')` 取得。
  const source = await readFile(`${root}client.js`, 'utf8')
  const run = new Function('window', 'React', 'console', `${source}\nreturn window.__ModuleLoader__.__last.factory;`)
  const window = {
    __ModuleLoader__: {
      load(options) {
        this.__last = options
      },
    },
  }
  const factory = run(window, React, console)
  const module = factory(specifier => {
    if (specifier !== 'react') throw new Error(`未预期的依赖：${specifier}`)
    return React
  })
  // `module` 是工厂执行结果（inject/apply），`factory` 是窗口注册的工厂本身。
  return { module, factory, React, registered, options: window.__ModuleLoader__.__last }
}

/** 取面板组件的元素树并用假 Hook 渲染一次（只渲染到元素结构，不执行副作用）。 */
export function shallow(React, Component, props) {
  React.__resetHooks()
  return typeof Component === 'function' ? Component(props) : Component
}

/** 深度遍历假元素树，收集所有 `type` 名（字符串标签与函数组件都会有）。 */
export function collectTypes(node, out = []) {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    node.forEach(child => collectTypes(child, out))
    return out
  }
  if (node.type !== undefined) out.push(node.type)
  if (node.children) node.children.forEach(child => collectTypes(child, out))
  if (node.props && node.props.children !== undefined) collectTypes(node.props.children, out)
  return out
}
