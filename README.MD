# Obsidian Xiangqi

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![en](https://img.shields.io/badge/lang-English-blue)](./README.MD)
[![zh-CN](https://img.shields.io/badge/lang-简体中文-green)](./README.zh-CN.MD)

## Introduction

`Obsidian Xiangqi` is a Chinese chess rendering engine plugin designed for Obsidian. It allows you to easily render Chinese chess games in FEN and PGN formats within your notes and manually play through the moves. The plugin supports themes, button positions, board size adjustments, and provides features like reset, undo, and redo.

## Demonstration

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

## Rendering

![pgnShow](./IMAGE/pgnShow.png)
![Show](./IMAGE/Show.png)

## Features

- **Chessboard Rendering**: Render Chinese chess games and play through moves directly in Obsidian notes.
- **Custom Settings**: Adjust themes, button positions, and board size through settings.
  1. Themes include dark and light modes.
  2. Button positions can be set to the right or bottom, suitable for both landscape and portrait modes.
  3. Board size can be continuously adjusted to fit screen size.
  4. Auto-refresh for setting changed without affecting the current step.
- **Mobile Support**: Adapt to mobile devices by manually adjusting button positions and board size.
- **Format Support**: Supports FEN format and ICCS-style PGN notation.

## Usage Instructions

Place chess game information in a code block with the language set to `xiangqi`.  
The format is flexible and can automatically recognize FEN and moves.  
You can use `fen:` to mark the FEN string, but it's optional.  
PGN games without FEN will default to the standard opening.  
If you haven't moved any pieces manually, clicking the "Next Step" button will execute moves from the PGN notation.  
During this process, you can use "Previous Step" and "Next Step" to display moves.  
After manually moving pieces, clicking "Next Step" will stop providing PGN moves.  
To re-display PGN moves, click the "Reset" button.

### Manual Installation (Not yet available in the plugin market)

1. Download the latest version of this plugin.
2. Open Obsidian and go to `Settings` -> `Community Plugins`.
3. Disable `Safe Mode`.
4. Click `Browse` -> `Open Plugins Folder`.
5. Create a new folder and place the downloaded files into it.
6. Return to the `Community Plugins` page in Obsidian, find `Obsidian Xiangqi`, and enable it.

The plugin is not yet available in the official Obsidian plugin market. Once supported, you can search for `Chinese chess` in the market to install it.
