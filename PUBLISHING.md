# 发布到 DSH 插件市场

> 状态：`0.1.0` 代码与文档就绪，**npm 尚未发布、市场条目尚未提交**。
> 包名：`dsh-workbench-panel`
> 公开仓库：<https://github.com/person-clouds/dsh-workbench-panel>
> 市场条目：`market/person-clouds__dsh-workbench-panel.yml`

## 一、发布前验证

```bash
cd /home/zh/www/dsh-workbench-panel
node --check index.js
node --check client.js
node -e "new (require('vm').Script)(require('fs').readFileSync('client.js','utf8'))"
npm test
npm_config_cache=/tmp/npm-cache npm pack --dry-run
```

预期：静态检查通过，`npm test` 全绿，打包清单包含 Host/Client 入口、`lib/`、`locale/`、`test/`、图标、`cordis.patch.yml`、README 与 LICENSE，不含 `market/`。

## 二、公开仓与 topic

市场要求：公开 GitHub 仓库、`package.json` 声明 `dsh.bundle`、仓库创建满 24 小时、带 topic `dsh-plugin`。

```bash
gh repo view person-clouds/dsh-workbench-panel --json createdAt,repositoryTopics
# 缺 topic 时：
gh repo edit person-clouds/dsh-workbench-panel --add-topic dsh-plugin
```

创建未满 24 小时不要提交市场 PR，CI 会拒绝。

## 三、发布 npm

```bash
cd /home/zh/www/dsh-workbench-panel
npm login --registry=https://registry.npmjs.org
npm publish --registry=https://registry.npmjs.org --access public
npm view dsh-workbench-panel version --registry=https://registry.npmjs.org
```

安装验证（发布后）：

```bash
dsh plugin --profile web add dsh-workbench-panel
# 重启 dsh web，侧栏出现「DSH 工作台」
```

npm 发布 72 小时内可 `npm unpublish dsh-workbench-panel@0.1.0`；超时用 `npm deprecate dsh-workbench-panel@0.1.0 "replace with a fixed version"` 并发布补丁版。

## 四、GitHub Release（按需）

市场条目当前只用 `icon`，不写 `tarball`（尚无 Release）。若之后需要 tarball，先发 npm 再建 Release：

```bash
npm_config_cache=/tmp/npm-cache npm pack --pack-destination release
mv release/dsh-workbench-panel-0.1.0.tgz release/dsh-workbench-panel.tgz
gh release create v0.1.0 release/dsh-workbench-panel.tgz
```

资源名保持无版本号，避免 `releases/latest/download/` 在下一版后 404。

## 五、提交市场 PR

1. 克隆 `awesome-dsh-plugin`（单独授权后进行），只复制本仓条目：

```bash
git clone <awesome-dsh-plugin 仓库地址>
cp /home/zh/www/dsh-workbench-panel/market/person-clouds__dsh-workbench-panel.yml \
  <clone>/data/plugins/person-clouds__dsh-workbench-panel.yml
```

2. PR **只提交一个文件** `data/plugins/person-clouds__dsh-workbench-panel.yml`，不改索引、README 或其他条目；
3. PR 描述正文写 `@zhyfor`，并说明插件为只读工作台、无 SA 依赖；
4. 提交前核对 `description` 与代码能力一致（三页签 + 显式归档），`icon` 指向仓库 `main` 分支的 180×180 PNG。

合并后由市场索引自动收录；被要求修改时只改该 yml 并保持单文件 diff。

## 六、回滚

- 插件：插件管理器移除或 `dsh plugin --profile web remove dsh-workbench-panel`，不删除本地目录；
- npm：优先 `npm deprecate` 并发布修复版；72 小时内确需撤包再 `npm unpublish`；
- 市场：PR 未合并直接关闭；已合并则向 `awesome-dsh-plugin` 提交删除该条目的回滚 PR。
