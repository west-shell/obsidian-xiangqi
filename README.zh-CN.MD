# Obsidian 中国象棋插件

![版本](https://img.shields.io/badge/版本-1.0.0-blue.svg)
[![许可证](https://img.shields.io/badge/许可证-MIT-green.svg)](./LICENSE)
[![英文](https://img.shields.io/badge/语言-英文-blue)](README.md)
[![中文](https://img.shields.io/badge/语言-简体中文-green)](README.zh-CN.md)

## 简介

`Obsidian 中国象棋插件` 是一款专为 Obsidian 设计的中国象棋渲染引擎插件，它允许您在 Obsidian 笔记中轻松渲染中国象棋的 FEN 格式和 PGN 格式棋局，并支持手动推演。插件支持主题设置、按钮位置调整、棋盘大小调节、重置棋局、悔棋/前进以及保存棋谱等功能。

## 演示示例

````markdown
```xiangqi
3akab2/1R1Pn4/c6C1/p3P3p/4p1b2/1R7/P3c3P/C3B4/1nr1A4/4KAB2
H7-E7 G5-E7
D8-D9 E9-D9
B8-D8 D9-D8
B4-D4 A7-D7
D4-D7 D8-D7
E6-D6 D7-D8
A2-D2 E3-D3
D6-D7 D8-D9
D7-D8 D9-E9
D8-D9
```
````

## 效果展示

![PGN展示](./IMAGE/pgnShow.png)
![棋盘展示](./IMAGE/Show.png)

## 功能特点

- **棋盘渲染**：在 Obsidian 笔记中渲染中国象棋并进行推演
- **自定义设置**：

    - 支持深色/浅色主题
    - 可调整按钮位置（右侧/底部）
    - 可调节棋盘大小
    - 设置更改后自动刷新，保持当前棋局不变

- **保存棋谱**：

    1. 将走棋历史保存为 PGN 格式
    2. 当没有 PGN 棋谱时，保存按钮显示为黄色
    3. 当存在 PGN 棋谱时，保存按钮显示为绿色
    4. 点击保存时会弹出确认提示
    5. 当走棋历史为空时保存将清除 PGN 记录

- **移动端适配**：支持横屏/竖屏显示模式
- **格式支持**：兼容 FEN 格式和 ICCS 格式的 PGN 棋谱

## 使用说明

1. 将棋谱信息放在标记为 `xiangqi` 的代码块中
2. 解析器会自动识别 FEN 和 PGN 走法（FEN 标签可选）
3. 操作导航：
    - 如果没有手动走棋，"下一步"会执行 PGN 中的走法
    - 使用"上一步"/"下一步"浏览走棋记录
    - 手动走棋后，"下一步"不再跟随 PGN 走法
    - 点击"重置"可恢复 PGN 走法显示
4. 点击"保存"会用当前走法覆盖原有 PGN 记录

## 安装指南

1. 下载插件文件
2. 在 Obsidian 中：
    - 进入设置 → 第三方插件
    - 关闭安全模式
    - 打开插件文件夹新建文件夹并添加文件
3. 启用插件

_注：即将登陆 Obsidian 官方插件市场（搜索"Chinese chess"）_
