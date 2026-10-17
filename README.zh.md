# Obsidian 中国象棋插件

![版本](https://img.shields.io/github/v/release/west-shell/obsidian-xiangqi)
[![许可证: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue)](./LICENSE)
[![Discord](https://img.shields.io/badge/Discord-服务器-5865F2?logo=discord&logoColor=white)](https://discord.gg/FQhgku2Cr)
[![PayPal](https://img.shields.io/badge/PayPal-Sponsor-blue?logo=paypal)](https://paypal.com/paypalme/weshell1988)
[![爱发电](https://img.shields.io/badge/爱发电-赞助-946CE6?logo=afdian)](https://afdian.com/a/weshell)

> 在 Obsidian 笔记中直接下棋、推演和分析象棋棋局——完整 PGN 支持、交互式棋盘、变着分支树和内置皮卡鱼 (WASM) 引擎。

![分支图](./IMAGE/Tree.png)

中文 | [English](./README.md)

## 快速上手

插件有三种用法，最终都落在同一个交互式棋盘上。

### 打开 PGN 文件

任何 `.pgn` 文件都会在专属的棋局视图中打开：浏览分支树、编辑着法和评论、运行引擎分析，一键保存回文件。通过棋局导航栏可管理单文件内的多局棋谱，工具栏按钮可快速新建 PGN 文件。

![PGN 文件](./IMAGE/PGN.png)

### 在笔记中嵌入棋局

在 `xiangqi` 代码块中写入着法，即可渲染为带完整分支树的交互式棋盘：

````markdown
```xiangqi
1. H2-E2 H9-G7
2. H0-G2 I9-H9
3. I0-H0 B9-C7
```
````

可选参数：`protected`/`p`（禁用保存按钮）、`rotated`/`r`（翻转棋盘，红方在下）。FEN 可省略，带不带引号都行：

````markdown
```xiangqi
r:true
[FEN "2bk1a3/5n3/3Pb4/R7p/2p6/C3p2N1/PR2c3P/1nr1B1C2/4A4/1rB1KA3 w"]
1. G2-G9 F9-E8
2. D7-D8 D9-E9
```
````

着法编号可以一起编、不编号、或逐一编写，均可。

### 摆一个局面

`fen` 代码块即可视化局面编辑器——拖拽或点击摆放棋子、设置行棋方，保存后生成可直接对弈的 `xiangqi` 代码块。

![FEN 编辑器](./IMAGE/FEN.png)

## 功能一览

### 分支树与键盘导航

每个分支都以树图展示——点击任意节点跳转到该位置，可在图标/文本标签模式间切换。快捷键让你手不离盘：

| 快捷键                            | 功能                                           |
| --------------------------------- | ---------------------------------------------- |
| `Ctrl+↑` / `Ctrl+↓`               | 跳转到沿线的上一个 / 下一个分叉点              |
| `Ctrl+←` / `Ctrl+→`               | 切换当前节点下方第一个分叉处的显示分支（循环） |
| `Ctrl+Alt+←` / `Ctrl+Alt+→`       | 循环切换当前节点以下（含）的所有变着组合       |
| `↑` / `↓` / `←` / `→`（PGN 视图） | 后退 / 前进一步；跳到棋局开头 / 结尾           |

分支导航在 PGN 文件视图和 `xiangqi` 代码块中均可用（代码块中需鼠标悬停在块上，且焦点不在文本编辑器内）。macOS 上 `Ctrl+↑`/`Ctrl+↓` 可能与系统调度中心冲突。

### 引擎分析

内置皮卡鱼 (WASM)，无需额外安装。

- **单步 / 批量 / 自动分析**：分析单个局面、所有节点，或对弈时自动分析
- **最佳走法与思考走法箭头**：绿色 = 最佳走法，黄色 = 思考走法
- **评估条**：棋盘旁实时评估（绿色 = 红方优势，红色 = 黑方优势）
- **评估趋势图与节点色条**：全局评估走势一目了然
- **评估持久化**：评估以 `%e:` 注释保存在 PGN 中
- **引擎对弈**：可调深度（1–30）与技能等级（0–20）

### 棋盘与棋子

- **7 种棋盘风格**：自动、浅色、深色、羊皮纸、绿绒布、木质、竹纹——棋盘菜单有色板选择器
- **大小可调**：棋盘和棋子显示尺寸（0–100%）
- **棋局标记**：在棋盘上绘制箭头和高亮
- **对局反馈**：当前着法高亮、后续走法提示、其他变着、行棋边框、行棋音效、朗读着法（桌面端）
- **局面编辑**：「编辑棋盘」把任意棋局切换为局面编辑器，保存后原着法将被丢弃

### 着法列表

网格对齐的着法分栏，支持中文（炮二平五）/坐标（h2e6）记谱、可调字号，着法旁的评估条、标注徽章、评注符号和评论下划线均可独立开关。

### 移动端

响应式布局自动在单栏（竖屏）和双栏（横屏/宽屏）间切换。建议配合全屏插件（如 [obsidian-full-screen-cross-platform-plugin](https://github.com/donkeypacific/obsidian-full-screen-cross-platform-plugin)）并在设置中调节上下边距，效果最佳。

![移动端](./IMAGE/Mobile.jpg)

## 设置总览

所有选项都在 **设置 → Xiangqi** 中，按以下分组：

| 分组         | 可配置项                                                     |
| ------------ | ------------------------------------------------------------ |
| 棋盘外观     | 棋盘风格、界面大小、坐标标签                                 |
| 对局提示     | 当前着法、后续走法、其他变着、行棋边框、音效、朗读、开局跳转 |
| 着法列表     | 显示开关、文字大小、记谱方式、着法标记                       |
| 棋盘边距     | 顶部/底部边距（0–100 px），适配全屏布局                      |
| 代码块名称   | `xiangqi`/`tree` 别名、FEN 保存目标                          |
| 引擎分析     | 深度、技能等级、箭头、引擎/棋盘标注                          |
| 保存         | 保存时包含评估、评估提示                                     |
| PGN 文件视图 | 视图开关、自定义文件扩展名                                   |

代码块名称、文件扩展名和自定义文件类型需重启插件或 Obsidian 后生效。

## 安装说明

本插件已在 Obsidian 官方插件市场上线：

1. 打开 **设置 → 第三方插件**（关闭安全模式）
2. 点击 **浏览**，搜索 **"Chinese chess"** 或 **"xiangqi"**
3. 点击 **安装**，再点击 **启用**

## 构建

```bash
git clone https://github.com/west-shell/obsidian-xiangqi.git
cd obsidian-xiangqi
npm install
npm run build        # 精简版本（压缩，适合发布）
npm run build:debug  # 开发版本（不压缩，带 sourcemap）
```

`xiangqi.js` 和 `xiangqiground` 从 npm 安装。

## 致谢与许可

- 棋规引擎：[xiangqi.js](https://github.com/west-shell/xiangqi.js)
- 棋盘渲染：[xiangqiground](https://github.com/west-shell/xiangqiground)
- 引擎：[皮卡鱼 Pikafish](https://github.com/official-pikafish/Pikafish) (WASM)
- 国际化：中文和英文界面

以 [GPL-3.0](./LICENSE) 许可发布。

## 支持项目

[![PayPal](https://img.shields.io/badge/PayPal-Sponsor-blue?logo=paypal)](https://paypal.com/paypalme/weshell1988)
[![爱发电](https://img.shields.io/badge/爱发电-赞助-946CE6?logo=afdian)](https://afdian.com/a/weshell)

如果你喜欢这个项目，欢迎到我的 [Bilibili](https://space.bilibili.com/156446344) 主页——点赞、投币、交流。

![打赏](./IMAGE/打赏.png)
