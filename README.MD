# Obsidian Xiangqi

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![en](https://img.shields.io/badge/lang-English-blue)](./README.MD)
[![zh-CN](https://img.shields.io/badge/lang-简体中文-green)](./README.zh-CN.MD)

## Introduction

`Obsidian Xiangqi` is a Chinese chess rendering engine plugin designed for Obsidian. It allows you to easily render Chinese chess positions in FEN or PGN format within Obsidian notes and manually play through moves. The plugin supports theme customization, button positioning, board resizing, resetting, undo/redo moves, and saving game records.

## Demo

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

- **Board Rendering**: Render and play through Chinese chess games in Obsidian notes.
- **Customization**:

    - Dark/light themes
    - Adjustable button positions (right/bottom)
    - Resizable board
    - Settings apply without resetting current game

- **Save Game Records**:

    1. Save move history as PGN format
    2. Save button turns yellow when no PGN record exists
    3. Save button turns green when PGN record exists
    4. Clicking save triggers confirmation prompt
    5. Saving with empty move history will clear PGN

- **Mobile Support**: Adapts to landscape/portrait modes
- **Format Support**: FEN and ICCS-style PGN notations

## Usage

1. Place game records in a `xiangqi` code block
2. Parser automatically detects FEN and PGN moves (FEN labels optional)
3. Navigation:
    - "Next" follows PGN moves if no manual moves made
    - Use "Previous"/"Next" to browse moves
    - After manual moves, "Next" won't follow PGN
    - Click "Reset" to return to PGN display
4. Click "Save" to overwrite existing PGN with current moves

## Installation

1. Download plugin files
2. In Obsidian:
    - Go to Settings → Community plugins
    - Disable Safe mode
    - Open plugins folder then create new folder and add files
3. Enable plugin

_Note: Coming soon to Obsidian's official marketplace (search "Chinese chess")_
