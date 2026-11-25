/**
 * 入口：DSH 可看可改工作台插件。
 *
 * Host 逻辑全部在 `lib/index.js`（视图注册表 + POST 注册表 + 写/撤销）；
 * 本文件只做入口转发，保持包根 `./index.js` 的导出契约不变。
 */

export { name, inject, Config, apply } from './lib/index.js'
