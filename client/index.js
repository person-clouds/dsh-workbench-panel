/**
 * DSH 工作台（浏览器端）工厂入口。
 *
 * 分段职责：`tokens`（字典与常量）/`theme`（样式）/`highlight`（样式标签、通用小工具、
 * 只读与写接口调用）/`view-repos`（代码页：仓库、文件树、搜索、高亮只读层）/
 * `view-docs-workspaces`（工作区页、文档页，原样迁移）/`view-editor`（编辑态、标签条、
 * `☰ 文件` 面板）。
 *
 * 构建脚本 `scripts/build-client.mjs` 把本目录下的 `tokens.js`、`theme.js`、
 * `highlight.js`、`view-*.js` 与本文件按**固定顺序**拼成单文件 `client.js`。
 * 拼接结果是普通脚本（只调用 `window.__ModuleLoader__.load`），所以：
 *
 * - 各段之间不写 import / export，直接用普通函数与同作用域常量互相调用；
 * - 段的顺序由构建脚本决定（见 scripts/build-client.mjs 的 PARTS），本文件最后一段；
 * - 改完本目录必须重新构建（`npm run build:client`），否则页面看到的仍是旧 client.js。
 *
 * 顺序：tokens → theme → highlight → view-repos → view-docs-workspaces → view-editor → 本文件。
 *
 * 工厂内的代码不会泄漏成全局名（只有 `SAWB_*` 常量与入口这一个调用留在顶层，
 * 且常量名带前缀，避免和共用 bundle 里的其他插件重名）。
 *
 * **跨段共享**：`scripts/build-client.mjs` 会把前六个源码段按顺序拼成本文件里
 * `factory(require) { ... }` 的正文，因此在拼接后的结果里，段与段之间**确实共享同一个
 * 作用域**——`tokens` 段的 `SAWB_*` 常量、`highlight` 段的 `h` 与各渲染函数，都能被后续段
 * 直接使用。但直接编辑 `client/` 源码段本身时它们各自是独立文件，所以：
 *
 * - 段之间不写 import / export，直接按名字互相调用（靠拼接后的同作用域生效）；
 * - 段定义的顺序由构建脚本固定，`index.js` 永远最后拼；
 * - 改完本目录必须重新构建（`npm run build:client`），否则页面看到的仍是旧 client.js。
 */
window.__ModuleLoader__.load({
  id: 'dsh-workbench-panel',
  factory(require) {
    const React = require('react')
    // `h` 在 highlight 段里定义（与各 view 段同为工厂内函数），这里直接使用。

    /** 三个分区共用一个外壳：分区切换即整页切换，各分区按需加载。 */
    function Workbench({ t }) {
      const [section, setSection] = React.useState('workspaces')
      // 代码页由 B 段的 EditorShell 承载：它内部再切仓库卡片/目录树（CodeView）与文件页。
      if (section === 'repos') return h(Root, null, h(EditorShell, { t, section, onSection: setSection }))
      if (section === 'docs') return h(Root, null, h(DocsView, { t, section, onSection: setSection }))
      return h(Root, null, h(WorkspacesView, { t, section, onSection: setSection }))
    }

    // ---------------- 注册 ----------------

    const Icon = ({ size }) =>
      h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        h('rect', { x: 3, y: 4.5, width: 18, height: 15, rx: 2 }),
        h('path', { d: 'M7 9h6M7 12.5h10M7 16h7' }),
        h('circle', { cx: 17, cy: 8, r: 1.6, fill: 'currentColor', stroke: 'none' }))

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        // DSH 内置语言 id 是 zh / en；再保留 zh-CN 以兼容浏览器区域标签。
        ctx.effect(() => ctx.locale.register(SAWB_NS, { zh: SAWB_ZH, 'zh-CN': SAWB_ZH, en: SAWB_EN }), 'dsh-workbench-panel: dictionaries')
        const t = ctx.locale.bind(SAWB_NS)
        ctx.slots.inject('main', () => ctx.slots.register(
          { name: 'main', key: SAWB_PANEL_ID, locale: SAWB_NS },
          (props) => h(Workbench, { t: props.t || t }),
        ))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
          { name: 'sidebar.panellist', id: SAWB_PANEL_ID, order: 20, label: () => t('panel'), locale: SAWB_NS },
          Icon,
        ))
      },
    }
  },
})
