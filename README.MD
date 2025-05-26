# Obsidian Xiangqi

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 简介
`Obsidian Xiangqi` 是一个为 Obsidian 设计的中国象棋渲染引擎插件，它允许你在 Obsidian 笔记中轻松渲染中国象棋fen格式棋局，并手动推演。支持设置主题、棋盘大小.并可以重置悔棋。
## 演示
![格式](./IMAGE/格式.png)
![暗色棋盘](./IMAGE/暗色棋盘.png)
## 功能特性
- **棋盘渲染**：在 Obsidian 笔记中渲染中国象棋棋盘并推演。
- **自定义设置**：支持通过设置项对棋盘样式大小进行调整。

### 自动安装
1. 下载本插件的最新版本压缩包。
2. 在 Obsidian 中打开 `设置` -> `第三方插件`。
3. 关闭 `安全模式`。
4. 点击 `浏览` -> `打开插件文件夹`。
5. 将下载的压缩包解压到该文件夹中。
6. 返回 Obsidian 的 `第三方插件` 页面，找到 `Obsidian Xiangqi` 并启用。
暂未上架 Obsidian 官方插件市场，后续支持后可直接在 Obsidian 插件市场中搜索 `Obsidian Xiangqi` 进行安装。

### 手动安装
1. 下载本插件的最新版本压缩包。
2. 在 Obsidian 中打开 `设置` -> `第三方插件`。
3. 关闭 `安全模式`。
4. 点击 `浏览` -> `手动安装插件`。
5. 选择下载的压缩包并安装。
6. 返回 Obsidian 的 `第三方插件` 页面，找到 `Obsidian Xiangqi` 并启用。


## 使用方法
在 Obsidian 笔记中使用 Markdown 代码块，指定语言为 `xiangqi`，并在代码块内输入相应的棋局信息，示例如下：
```xiangqi

## 开发调试
1. 克隆仓库
```bash
git clone URL_ADDRESSgit clone https://github.com/yourusername/obsidian-xiangqi.git
``` 
2. 安装依赖并构建
```bash
npm i
npm run build
```