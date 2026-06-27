# CLAUDE.md — 项目上下文（供 AI agent 快速上手）

> 本文件是给 AI 编码助手的项目地图。**每次开新会话，先读本文件**，可省去重复探索项目结构的时间。
> 内容变更后请同步更新（尤其完成较大改动后）。

## 一句话简介

Obsidian 插件 **Chinese Chess (xiangqi)**：在笔记里渲染中国象棋棋局（代码块列表模式 / 演变树模式 / FEN 生成器），并提供 `.pgn` 文件的自定义视图。技术栈 TypeScript + Svelte 5 + Vite 7，构建产物是单文件 `main.js`（CJS）。

## 常用命令

```bash
npm run dev        # 构建到 test-vault/.obsidian/plugins/xiangqi/（含复制 manifest.json）
npm run build      # 生产构建 -> build/（含复制 manifest.json）
npm run build:min  # 压缩生产构建 -> build/（无 sourcemap）
npm run check      # svelte-check 类型检查（注意：speak 相关常有既有类型报错，与本任务无关）
npm run lint       # oxlint
npm run fmt        # oxfmt 格式化
npm run test       # vitest
```

## 架构地图

### 入口与生命周期

- `src/main.ts` — `ChessPlugin extends Plugin`。`onload()` 顺序：加载设置 → `initI18n` → `ensureBoardAssets`（写盘背景图）→ `applyThemes` → 注册图标/代码块/视图。`refresh()` 通知所有已渲染实例重绘。
- `src/types.ts` — 全局类型：`ISettings`、`ChessNode`（演变树节点）、各模式 Host（`IListHost`/`ITreeHost`/`IGenFENHost`/`IPGNViewHost`）、`PIECE_CHARS`、`DEFAULT_FEN`。
- `src/settings.ts` — `DEFAULT_SETTINGS` 与 `ChessSettingTab`（设置 UI）。默认主题 `wood`，代码块别名默认 `xiangqi`/`tree`/`xq`。

### 三种渲染模式

| 模式               | 代码块    | RenderChild                        | Svelte 组件    | 逻辑模块           |
| ------------------ | --------- | ---------------------------------- | -------------- | ------------------ |
| 列表（List）       | `xiangqi` | `renderChild/ListRenderChild.ts`   | `lib/List/*`   | `modules/List/*`   |
| 演变树（Tree）     | `tree`    | `renderChild/TreeRenderChild.ts`   | `lib/Tree/*`   | `modules/Tree/*`   |
| FEN 生成（GenFEN） | `xq`      | `renderChild/GenFENRenderChild.ts` | `lib/GenFEN/*` | `modules/GenFEN/*` |

- `.pgn` 文件视图：`src/view/PGNView.ts`（复用 Tree 渲染）。
- 棋盘核心：`src/lib/Board.svelte`（基于 xiangqiground 库渲染 `<div>`，背景由 CSS 变量驱动）。`src/chess.ts` 是 xiangqi.js 的封装。

### 主题系统（背景图相关重点）

- `src/themes.ts` — 主题表 + `applyThemes()` + `ensureBoardAssets()`。
- 七个主题：`auto / light / dark / parchment / green / wood / bamboo`。其中 **`wood`、`bamboo` 是图片背景**，其余是纯 CSS 颜色/渐变。
- 主题字段：`bg`（背景）、`bgImage?`（图片型背景的路径+内嵌 base64）、`texture`（纹理叠加）、`grid`（网格线 dark/light/none）、`red`/`black`（棋子色）。
- 渲染：`applyThemes` 把值写入 `<body>` 的 CSS 变量（`--xq-board-bg`、`--xq-board-texture`、`--xq-grid`、`--xq-piece-red/black` 等），由 `Board.svelte` 和 `src/style/board.css` 消费。
- 网格线（`--xq-grid-dark/light`）和棋子（`src/style/pieces.css`）都是 **内嵌 base64 SVG data URI**，无外部依赖。

### 棋盘背景图机制（重要）

两张图片背景 `assets/wood.jpg`、`assets/bamboo.jpg` 的处理流程（v3.8.4+）：

1. **构建期内嵌**：`vite.config.ts` 的 `base64Asset()` 插件拦截 `?base64` 后缀导入，把图片读成 base64 字符串编进 `main.js`。
2. **运行时写盘**：`onload` 调 `ensureBoardAssets()`，检查 `<vault>/.obsidian/plugins/xiangqi/assets/` 下是否已有同名文件；**不存在才用 base64 解码写盘**（幂等，保护已存在的文件/用户自定义）。
3. **解析路径**：`applyThemes` 仍用 `app.vault.adapter.getResourcePath(configDir + '/' + path)` 解析图片 URL。

- 更换源图后只需重新 `build`/`dev`，base64 自动刷新。但**磁盘已有旧图的老用户不会自动更新**（因 exists 检查）；要让老用户拿到新图，需删除其本地 assets 文件后重启，或加版本指纹机制。
- 图片格式约定：wood 用 jpg（质量 85，~129KB，800×889）。bamboo 是 jpg（~339KB）。

## 构建与目录约定

- `vite.config.ts`：
  - development → `test-vault/.obsidian/plugins/xiangqi/`
  - production/production-min → `build/`
  - `emptyOutDir: false`；产物 `main.js`（CJS）+ `styles.css` + sourcemap。
  - external：`obsidian`、`electron`、`@codemirror/*`、`@lezer/*`。
- 依赖本地包：`@west-shell/xiangqi.js`、`@west-shell/xiangqiground`（`file:../...`）。
- `manifest.json`：id=`xiangqi`，`minAppVersion: 1.5.0`。
- `.gitignore`：忽略 `build/`、`test-vault/`、`.claude/*`（注意：根目录的 `CLAUDE.md` 不被忽略）。
- `scripts/`：`gen-board.js`（生成网格 SVG→CSS）、`gen-pieces.js`（生成棋子 SVG→CSS）、`release.mjs`（发布流程）。

## 开发约定与陷阱

- **既有类型错误**：`src/modules/List/Speak.ts` 与 `src/modules/Tree/Speak.ts` 常有 `ChessNode` vs `Move` 的类型报错，源于本地包类型定义，与多数任务无关，勿误判为本任务引入。
- 主题相关改动要同步：`themes.ts`（定义）+ `settings.ts`（`THEME_KEYS` 自动驱动下拉）+ `src/i18n/{en,zh}.json`（`theme.<name>` 标签）。
- CSS 变量在 `document.body` 上设置，跨视图生效；改样式优先用 CSS 变量而非硬编码。
- 插件 id 硬编码为 `xiangqi`（见 themes.ts 的 `plugins/xiangqi/assets/...`）。

## 当前进度 / 近期完成

- v3.8.4：棋盘背景图改为「base64 内嵌 + 加载时写盘」方案，解决生产/BRAT 安装缺图问题。wood 由 png 转 jpg（929KB→129KB）。
- 待办可选：若需向老用户自动推送图片更新，可加版本指纹机制（写盘时存哈希，加载时比对）。
