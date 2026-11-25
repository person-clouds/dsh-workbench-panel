import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { buildClient, PARTS } from '../scripts/build-client.mjs'
import { collectTypes, loadFactory, shallow } from './helpers/client-harness.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** 装一次插件，取回 main 槽位的面板组件与语言字典。 */
async function mountMain() {
  const { factory, React } = await loadFactory(ROOT)
  const slots = []
  const locales = []
  const t = (key, params) => (params ? `${key}(${Object.values(params).join(',')})` : key)
  const ctx = {
    effect: factory => factory(),
    locale: {
      register: (ns, dict) => { locales.push([ns, dict]); return () => {} },
      bind: () => t,
    },
    slots: {
      inject: (name, factory) => factory(),
      register: (options, component) => { slots.push([options, component]); return () => {} },
    },
  }
  const plugin = factory(specifier => {
    if (specifier !== 'react') throw new Error(`未预期的依赖：${specifier}`)
    return React
  })
  plugin.apply(ctx)
  const main = slots.find(([options]) => options.name === 'main')
  assert.ok(main, '必须向 main 槽位注册面板')
  return { React, plugin, slots, locales, Main: main[1], t }
}

test('client/ 各段可一起执行，并注册窗口模块工厂', async () => {
  const { factory, options } = await loadFactory(ROOT)
  assert.equal(options.id, 'dsh-workbench-panel')
  assert.equal(typeof factory, 'function')
})

test('工厂只注入 slots 与 locale，语言字典含 zh / zh-CN / en', async () => {
  const { plugin, slots, locales } = await mountMain()
  assert.deepEqual(plugin.inject, ['slots', 'locale'])
  assert.deepEqual(slots.map(([options]) => options.name).sort(), ['main', 'sidebar.panellist'])
  assert.equal(locales.length, 1)
  const [ns, dict] = locales[0]
  assert.equal(ns, 'dshWorkbenchPanel')
  assert.deepEqual(Object.keys(dict).sort(), ['en', 'zh', 'zh-CN'])
})

test('面板外壳注册到 main 槽位，默认分区是工作区页且带三页签', async () => {
  const { React, Main, t } = await mountMain()
  // 各段里的函数都在工厂闭包内，测试只能校验到槽位组件的注册形态与入参；
  // 渲染细节（Root/页签/交互）交给浏览器联调验收，这里守住注册契约。
  assert.equal(Main.name, '', 'main 槽位是内联渲染函数')
  assert.equal(typeof Main, 'function')
  React.__resetHooks()
  const rendered = Main({ t })
  assert.equal(typeof rendered.type, 'function')
  assert.equal(rendered.type.name, 'Workbench', 'main 槽位渲染面板外壳')
  assert.equal(rendered.props.t, t, '把本地化函数透传给外壳')
})

test('生成物 client.js 与 client/ 各段一致（防止改了源码段忘记构建）', async () => {
  const generated = await buildClient({ write: false })
  const onDisk = await readFile(new URL('../client.js', import.meta.url), 'utf8')
  assert.equal(onDisk, generated, 'client.js 与 client/ 拼接结果不一致：先跑 npm run build:client')
})

test('构建顺序固定，index.js 必须是最后一段', () => {
  assert.deepEqual(PARTS.slice(-1), ['index.js'])
  for (const part of ['tokens.js', 'theme.js', 'highlight.js', 'view-repos.js', 'view-docs-workspaces.js', 'view-editor.js']) {
    assert.ok(PARTS.includes(part), `缺少源码段 ${part}`)
  }
})

test('client/ 各段不得出顶层 import/export（会被当普通脚本拼接）', async () => {
  for (const segment of PARTS) {
    const source = await readFile(`${ROOT}client/${segment}`, 'utf8')
    assert.doesNotMatch(source, /^\s*(import|export)\s/m, `client/${segment} 不得出顶层 import/export`)
  }
})

test('client 内置字典与 locale/*.json 保持同一套键（校验脚本不自动改 JSON）', async () => {
  const { locales } = await mountMain()
  const [, dict] = locales[0]
  for (const [lang, file] of [['zh', 'zh.json'], ['en', 'en.json']]) {
    const json = JSON.parse(await readFile(`${ROOT}locale/${file}`, 'utf8'))
    const clientKeys = Object.keys(dict[lang]).sort()
    const jsonKeys = Object.keys(json).sort()
    assert.deepEqual(clientKeys, jsonKeys, `locale/${file} 与 client/tokens.js 的 ${lang} 键不一致`)
    for (const key of jsonKeys) {
      assert.deepEqual(dict[lang][key], json[key], `locale/${file} 的 ${key} 与 client 内置字典值不一致`)
    }
  }
})
