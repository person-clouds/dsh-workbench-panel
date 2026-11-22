/**
 * 归档会话标题永久缓存。
 *
 * 标题来自会话日志折叠，读一次日志成本很高；归档会话不会出现在 DSH
 * 实时投影里，因此这里把成功读到的标题落盘，后续列表/仓库页直接命中。
 * 文件为派生数据：损坏、写入失败或手动删除都只影响标题展示，不影响
 * 会话日志与归档状态。
 */

import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const VERSION = 1

function dshHomeOf(config = {}) {
  return config.dshHome || process.env.DSH_HOME || join(homedir(), '.dsh')
}

/** 标题缓存文件默认路径：`<dshHome>/state/workbench/session-titles.json`。 */
export function titleCacheFile(config = {}) {
  return config.titleFile || join(dshHomeOf(config), 'state', 'workbench', 'session-titles.json')
}

function nowIso() {
  return new Date().toISOString()
}

function isMissing(error) {
  return Boolean(error && error.code === 'ENOENT')
}

function warnOf(options) {
  if (typeof options.warn === 'function') return options.warn
  return message => console.warn(message)
}

function cleanRecord(id, record) {
  const source = record && typeof record === 'object' ? record : {}
  return {
    title: String(source.title || ''),
    createdAt: Number(source.createdAt || 0),
    kind: String(source.kind || 'session'),
    cwd: String(source.cwd || ''),
    archived: Boolean(source.archived),
    updatedAt: String(source.updatedAt || nowIso()),
  }
}

/**
 * 进程内 Map + 文件 mtime 校验的标题缓存。
 * 写入按调用顺序串行，先合并再原子替换，避免翻页并发时丢标题。
 */
export class SessionTitleCache {
  constructor(config = {}, options = {}) {
    this.file = titleCacheFile(config)
    this.warn = warnOf(options)
    this.sessions = new Map()
    this.mtimeMs = -1
    this.loaded = false
    this.writing = Promise.resolve()
  }

  async _read() {
    let raw
    try {
      raw = await readFile(this.file, 'utf8')
    } catch (error) {
      if (isMissing(error)) {
        this.sessions = new Map()
        this.loaded = true
        this.mtimeMs = -1
        return
      }
      this.warn(`dsh-workbench: 读取会话标题缓存失败 ${this.file}: ${error && error.message ? error.message : error}`)
      this.loaded = true
      return
    }
    const next = new Map()
    try {
      const data = JSON.parse(raw)
      const entries = data && data.sessions && typeof data.sessions === 'object' ? data.sessions : {}
      for (const [id, record] of Object.entries(entries)) {
        if (!id || !record || typeof record !== 'object') continue
        next.set(String(id), cleanRecord(id, record))
      }
    } catch (error) {
      this.warn(`dsh-workbench: 会话标题缓存格式无效，按空缓存处理 ${this.file}: ${error && error.message ? error.message : error}`)
    }
    this.sessions = next
    this.loaded = true
  }

  /** 文件变化时重新加载；进程内首次读取也只读一次磁盘。 */
  async _ensureLoaded() {
    if (!this.loaded) {
      try {
        const info = await stat(this.file)
        this.mtimeMs = info.mtimeMs
      } catch (error) {
        if (!isMissing(error)) this.warn(`dsh-workbench: 检查会话标题缓存失败 ${this.file}: ${error && error.message ? error.message : error}`)
        this.mtimeMs = -1
      }
      await this._read()
      return
    }
    try {
      const info = await stat(this.file)
      if (info.mtimeMs !== this.mtimeMs) {
        this.mtimeMs = info.mtimeMs
        await this._read()
      }
    } catch (error) {
      if (isMissing(error) && this.sessions.size > 0) {
        this.sessions = new Map()
        this.mtimeMs = -1
      }
    }
  }

  /** 读取多个标题；返回 id -> record 的 Map。 */
  async getMany(ids) {
    await this._ensureLoaded()
    const found = new Map()
    for (const raw of ids || []) {
      const id = String(raw || '')
      if (id && this.sessions.has(id)) found.set(id, this.sessions.get(id))
    }
    return found
  }

  async get(id) {
    return (await this.getMany([id])).get(String(id))
  }

  /** 合并标题并落盘；失败只告警，绝不让列表读取失败。 */
  async put(records) {
    await this._ensureLoaded()
    const at = nowIso()
    for (const item of records || []) {
      const id = String(item && item.id || '')
      if (!id) continue
      const record = cleanRecord(id, { ...item, updatedAt: at })
      if (!record.title) continue
      this.sessions.set(id, record)
    }
    const payload = JSON.stringify({
      version: VERSION,
      updatedAt: at,
      sessions: Object.fromEntries(this.sessions),
    }, null, 2)
    this.writing = this.writing.then(async () => {
      const temp = `${this.file}.${process.pid}.${Date.now()}.tmp`
      try {
        await mkdir(join(this.file, '..'), { recursive: true })
        await writeFile(temp, payload, 'utf8')
        await rename(temp, this.file)
        try { this.mtimeMs = (await stat(this.file)).mtimeMs } catch { /* 下一次读取再校验 */ }
      } catch (error) {
        this.warn(`dsh-workbench: 写入会话标题缓存失败 ${this.file}: ${error && error.message ? error.message : error}`)
        try { await unlink(temp) } catch { /* 临时文件可能未创建 */ }
      }
    }).catch(() => {})
    await this.writing
  }
}

/** 按配置创建一个标题缓存实例。 */
export function createTitleCache(config = {}, options = {}) {
  return new SessionTitleCache(config, options)
}
