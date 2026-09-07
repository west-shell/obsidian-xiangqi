# Chess Tree — DOM 架构与样式规范

> 本文档是 `refactor/dom-scss-architecture` 重构的规范说明。
> 所有 DOM 类名与 CSS 自定义属性的唯一权威来源。

## 1. 命名规范

- **BEM**：`块__元素--修饰符`，全局前缀 `ct-`（chess-tree）。
- **类名单一来源**：TS/Svelte 一律通过 `src/chess.ts` 的常量引用类名
  （`LAYOUT_CLASS`、`BLOCK_CLASS`、`FILE_VIEW_CLASS`…），不手写字符串。
- **chessground 库类不可改名**：`cg-wrap` / `cg-container` / `cg-board` /
  `coords` / `coord` / `piece` / `square` 属于 `@lichess-org/chessground`，
  覆盖样式只允许出现在 `scss/_board.scss`。
- **组件不写 `<style>`**：全部样式收口在 `src/style/`，Svelte 组件只挂类名。
- **CSS 自定义属性统一 `--ct-*`**：主题层（`themes.ts` /
  `applyThemeCSSVars`）写入 `<body>`，布局私有变量不再使用 `---` 三横线。

## 2. DOM 树

```
BlockHost  containerEl ─── .ct-block (+ Obsidian .block-language-*)
FileHost   contentEl  ─── .view-content.ct-file-view
  └─ Chess.svelte
      └─ .ct-layout [.ct-layout--edit]
          ├─ Board.svelte
          │    .ct-layout__board [--turn-white/--turn-black]
          │    ├─ .cg-wrap  (chessground: cg-container > cg-board)
          │    ├─ .ct-promotion > .ct-promotion__choices > .ct-promotion__btn
          │    └─ .ct-board-resize
          ├─ Toolbar.svelte ─── .ct-toolbar
          │    └─ button.ct-btn [--saved/--unsaved/--engine/--busy]
          ├─ Tree.svelte ─── .ct-layout__panel
          │    ├─ .ct-gamenav
          │    │    ├─ .ct-gamenav__info > .ct-gamenav__title + .ct-gamenav__index
          │    │    └─ .ct-gamenav__arrows > button.ct-btn.ct-gamenav__arrow
          │    ├─ .ct-panel__row
          │    │    ├─ .ct-panel__canvas
          │    │    │    ├─ .ct-eval > .ct-eval__bar > .ct-eval__fill
          │    │    │    │                    + .ct-eval__center + .ct-eval__label
          │    │    │    ├─ svg.ct-panel__svg > g.ct-panel__node
          │    │    │    ├─ .ct-panel__toolbar.ct-btn-group > button.ct-btn
          │    │    │    └─ .ct-slider [--eval/--dragging]
          │    │    │         ├─ button.ct-slider__btn [--start/--prev/--next/--end]
          │    │    │         └─ .ct-slider__track > svg.ct-slider__chart
          │    │    │                       + .ct-slider__thumb + .ct-slider__label
          │    │    └─ .ct-moves > li.ct-moves__row [--start]
          │    │              > span.ct-moves__num + span.ct-moves__move
          │    │                [--white/--black/--active/--start]
          │    └─ .ct-panel__comment
          │         ├─ textarea.ct-comment__input [--auto]
          │         └─ button.ct-btn.ct-comment__toggle
          └─ FEN 编辑模式 (.ct-layout--edit)
               ├─ .ct-layout__palette
               │    └─ button.ct-palette__btn [--white/--black/--active/--empty]
               └─ GenFEN/Toolbar.svelte ─── .ct-genfen
                    ├─ .ct-genfen__group
                    │    ├─ .ct-genfen__section[--row]
                    │    │    ├─ button.ct-genfen__turn [--white/--black]
                    │    │    ├─ .ct-genfen__rights > .ct-genfen__side
                    │    │    │        + label.ct-genfen__right [--on/--off]
                    │    │    └─ select.ct-genfen__select
                    └─ .ct-genfen__actions > button.ct-genfen__action
                                              [--save/--back]
```

宿主容器（`_base.scss`）：

| 宿主                        | 类名            | 说明                             |
| --------------------------- | --------------- | -------------------------------- |
| `chess`/`tree`/`fen` 代码块 | `.ct-block`     | `BlockHost` 构造器添加           |
| PGN 文件视图                | `.ct-file-view` | `Actions.ts` 加在 `contentEl` 上 |
| 拖拽棋盘时的 `<body>`       | `.ct-resizing`  | 抑制文本选中                     |

## 3. 文件结构

```
src/style/
  layout.scss          入口，@use 以下全部模块
  scss/
    _variant.scss      变体差异（变体专属选择器 + 数值；sync 排除，xiangqi 有自己的版本）
    _tokens.scss       断点 / 间距 / col2 尺寸代数
    _mixins.scss       col1/col2 媒体查询 mixin、宽度函数
    _base.scss         body 自定义属性默认值、宿主容器、拖拽状态
    _layout.scss       .ct-layout 主网格（col1/col2）+ .ct-file-view 上下文
    _board.scss        棋盘区 + 双变体共享的 chessground 覆盖（wrap/piece）
    _buttons.scss      .ct-btn 按钮体系（含 pill 组、状态修饰符）
    _toolbar.scss      .ct-toolbar 主工具栏组件
    _panel.scss        棋树面板（gamenav/canvas/eval/slider/moves/comment）
    _genfen.scss       FEN 编辑器（--edit 网格、palette、编辑工具）
    _settings.scss     设置页 + 引擎/导入导出模态控件
```

## 4. CSS 自定义属性

主题层写入 `<body>`（`themes.ts` / `chess.ts#applyThemeCSSVars`）。

主题色变量（棋盘底色/纹理/网格/棋子/高亮）各变体独立命名：chess 用
`--ct-*`，xiangqi 用 `--xq-*`（消费规则的 scss 也在各自 `_variant.scss`）。
下表为共享变量 + chess 侧命名：

| 变量                                                                  | 说明                             |
| --------------------------------------------------------------------- | -------------------------------- |
| `--ct-board-scale`                                                    | 棋盘缩放系数（zoom 换算）        |
| `--ct-font-size`                                                      | 走法列表字号                     |
| `--ct-board-bg` / `--ct-board-bg-image` / `--ct-board-texture`        | 棋盘底色 / 背景图 / 纹理         |
| `--ct-selected-color` / `--ct-lastmove-color` / `--ct-nextmove-color` | 选中 / 最后一着 / 可走目标高亮色 |
| `--ct-board-margin-top` / `--ct-board-margin-bottom`                  | 棋盘上下边距                     |
| `--ct-coords-display`                                                 | 坐标显隐（flex/none）            |
| `--ct-piece-primary` / `--ct-piece-secondary`                         | 双方棋子代表色                   |

组件/布局内部：

| 变量                                 | 作用域                 | 说明                                       |
| ------------------------------------ | ---------------------- | ------------------------------------------ |
| `--ct-header-h`                      | body / `.ct-file-view` | 视图头部高度（col2 高度代数用）            |
| `--ct-gap`                           | body                   | 全局间距                                   |
| `--ct-col2-size` / `--ct-col2-width` | body                   | col2 轨道主尺寸 / 宽度                     |
| `--ct-board-width`                   | `.ct-layout__board`    | 棋盘宽度覆盖点（PGN 视图用）               |
| `--ct-board-max`                     | 布局回退               | 棋盘最大尺寸回退值（默认 100vh）           |
| `--ct-board-ratio`                   | `.cg-wrap`             | 棋盘宽高比（由 `BOARD_ASPECT_RATIO` 内联） |
| `--ct-tree-bg` / `--ct-tree-line`    | `.ct-layout__panel`    | 画布底色 / 树线颜色                        |
| `--ct-eval-plus` / `--ct-eval-minus` | `.ct-layout__panel`    | 局势评估双色                               |
| `--ct-textarea-h`                    | `.ct-comment__input`   | 评论框测量高度                             |

## 5. 重命名对照表

| 旧                                                                                           | 新                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `chess-layout`                                                                               | `ct-layout`                                                                                                                                                        |
| `chess-layout--genfen`                                                                       | `ct-layout--edit`（常量 `LAYOUT_CLASS_EDIT`）                                                                                                                      |
| `board-wrapper` + `chess-layout__board`                                                      | `ct-layout__board`（合并双类名）                                                                                                                                   |
| `toolbar-container` + `chess-layout__toolbar`                                                | `ct-toolbar`                                                                                                                                                       |
| `tree-container` + `chess-layout__tools`                                                     | `ct-layout__panel`                                                                                                                                                 |
| `piece-btn-container` + `chess-layout__piecebtns`                                            | `ct-layout__palette`                                                                                                                                               |
| `toolbar-btn` / `toolbar-single`                                                             | `ct-btn`（尺寸由上下文决定）                                                                                                                                       |
| `toolbar-group` / `toolbar-sep`                                                              | `ct-btn-group` / `ct-btn-sep`                                                                                                                                      |
| `saved` / `unsaved` / `engine-active` / `engine-busy`                                        | `ct-btn--saved/--unsaved/--engine/--busy`                                                                                                                          |
| `tree-codeblock` / `pgn-view` / `body.resizing`                                              | `ct-block` / `ct-file-view` / `ct-resizing`                                                                                                                        |
| `turn-white` / `turn-black`                                                                  | `ct-layout__board--turn-white/--turn-black`                                                                                                                        |
| `promotion-*` / `board-resize`                                                               | `ct-promotion*` / `ct-board-resize`                                                                                                                                |
| `game-nav-*`                                                                                 | `ct-gamenav__*`                                                                                                                                                    |
| `tools-row` / `svg-wrapper` / `tree-svg` / `node-group`                                      | `ct-panel__row` / `ct-panel__canvas` / `ct-panel__svg` / `ct-panel__node`                                                                                          |
| `eval-*`                                                                                     | `ct-eval__*`（容器 `ct-eval`）                                                                                                                                     |
| `slider` / `slider-btn` / `slider-inner` / `slider-thumb` / `slider-label` / `eval-chart-bg` | `ct-slider[--eval/--dragging]` / `ct-slider__btn[--start/--prev/--next/--end]` / `ct-slider__track` / `ct-slider__thumb` / `ct-slider__label` / `ct-slider__chart` |
| `move-list` / `roundnum` / `move`                                                            | `ct-moves` / `ct-moves__num` / `ct-moves__move`                                                                                                                    |
| `comment-row` / `auto-height` / `toggle-list-btn`                                            | `ct-panel__comment` / `ct-comment__input--auto` / `ct-comment__toggle`                                                                                             |
| `piece-btn`                                                                                  | `ct-palette__btn`                                                                                                                                                  |
| `fen-editor-tools` / `tool-*` / `turn-toggle` / `castling-*` / `fen-btn` / `fen-select`      | `ct-genfen__*` 系列                                                                                                                                                |
| `ws-slider-value` / `ws-setting-tab`                                                         | `ct-setting-value` / `ct-settings`                                                                                                                                 |
| `engine-setting-toggle` / `depth-slider-label`                                               | `ct-engine-toggle` / `ct-range-value`                                                                                                                              |
| `import-textarea` / `export-textarea` / `import-fen-warning` / `import-separator`            | `ct-modal-textarea[--fixed]` / `ct-modal-warning` / `ct-modal-separator`                                                                                           |
| `--chess-*`、`---col2-uniboard-*`、`---display-columns`                                      | `--ct-*`（见第 4 节）                                                                                                                                              |

## 6. xiangqi 同步注意

`scripts/sync-to-xiangqi.mjs` 单向复制 `src/`。本目录中除
`scss/_variant.scss` 外全部共享，必须保持变体无关：

- 变体专属选择器（cg-board/xq-board 内部、坐标布局、主题色变量消费规则）
  与变体数值（宽高比、主维度、palette 列数…）只写在 `_variant.scss`；
- 主题色变量名各变体独立：chess 用 `--ct-*`，xiangqi 用 `--xq-*`
  （注意避开 xiangqiground 库已占用的 `--xq-selected-color` 等），
  由各自 `themes.ts` 写入；
- 同步后 xiangqi 侧需手工更新其 `chess.ts` 中的类名常量与
  `applyThemeCSSVars` 变量名。
