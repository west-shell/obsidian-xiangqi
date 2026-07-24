# Chinese chess

![Version](https://img.shields.io/github/v/release/west-shell/obsidian-xiangqi)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue)](./LICENSE)
[![PayPal](https://img.shields.io/badge/PayPal-Sponsor-blue?logo=paypal)](https://paypal.com/paypalme/weshell1988)

[English](./README.md) | [中文](./README.zh.md)

If you like this project, feel free to check out my page on  
[![Bilibili](https://img.shields.io/badge/Bilibili-Bilibili-ff69b4?logo=bilibili&logoColor=white)](https://space.bilibili.com/156446344)  
Likes, coins, and feedback are greatly appreciated.

## Overview

**Obsidian Chinese Chess Plugin** is a Chinese chess rendering engine built for Obsidian. It displays chess positions and games in FEN and PGN formats, supports move exploration and variation management. Features include built-in engine analysis powered by [Pikafish](https://github.com/official-pikafish/Pikafish) (WASM), voice narration, and more.

## PGN File Support

Open `.pgn` files directly in Obsidian — the plugin registers a dedicated `.pgn` file view with an interactive board interface.

- **Manual Save**: Any changes (moves, variations, comments, annotations) are saved back to the file when clicking Save button
- **Variation Tree**: Interactive tree graph showing all branches — click nodes to navigate
- **Comments & Annotations**: Supports branch diagram and board annotation symbols, comments
- **Mode Toggle**: Switch between icon mode and text mode in branch diagram
- **Jump to AI**: Package the current branch to Pikafish web version for analysis
- **Engine Analysis**: Built-in Pikafish WASM engine with single position analysis, batch analysis, and auto-analysis
- **Quick Create**: New PGN files from the ribbon button
- **Custom File Types**: Set specific file types as PGN files
- **Context Menu**: Right-click PGN files to switch between PGN view and Markdown view

> **Note**: `.pgn` files only support single games. For multi-game PGN files, use AI to add code block markers and convert to Markdown format:
>
> ````markdown
> ```xiangqi
> [Event "Game 1"]
> 1. H2-E2 H9-G7 2. H0-G2 I9-H9 1-0
> ```
>
> ```xiangqi
> [Event "Game 2"]
> 1. B0-E2 B9-C7 2. G0-F8 H9-G7 1/2-1/2
> ```
> ````

![PGN File](./IMAGE/PGN.png)

## Code Blocks

Three code block types — all code block names are customizable.

---

`xiangqi`: Display and explore Chinese chess games in Markdown

````markdown
```xiangqi
1. H2-E2 H9-G7
2. H0-G2 I9-H9
3. I0-H0 B9-C7
```
````

![Move List](./IMAGE/List.png)

---

`xq`: Visual board editor — generates a `xiangqi` block with FEN

````markdown
```xq

```
````

![FEN Editor](./IMAGE/FEN.png)

---

`tree`: Branch diagram — display game variations as a tree graph

````markdown
```tree
1. H2-E2 H9-G7
2. H0-G2 I9-H9
```
````

![Branch Diagram](./IMAGE/Tree.png)

---

## Mobile Usage

For the best experience on mobile devices, it's recommended to install the Full Screen Toggle plugin ([donkeypacific/obsidian-full-screen-cross-platform-plugin](https://github.com/donkeypacific/obsidian-full-screen-cross-platform-plugin)) or similar fullscreen plugins and adjust the top/bottom margins in **Settings > Chess > Board Margins** to optimize the board display area.

![Mobile](./IMAGE/Mobile.jpg)

## Settings

### Board Appearance

- **Theme**: Auto, Light, Dark, Parchment, Green, Wood, Bamboo
- **Cell Size**: Adjustable board cell size (15–100 px)
- **Layout**: Toolbar position — right / bottom
- **Coordinate Labels**: Show/hide board coordinates

### Game Hints

- **Last Move Highlight**: Highlight the last move on the board
- **Legal Moves**: Show legal move destinations
- **Turn Border**: Highlight the current player's turn
- **Move Narration**: Optional speech synthesis for moves (desktop only)

### Move List

- **Show Move List**: Toggle move list visibility
- **Show Move Text**: Toggle text notation in move list
- **Font Size**: Adjustable move text size (10–25 px)
- **Auto Jump**: Jump to latest position — never / always / auto

### Board Margins

- **Top Margin**: Adjustable top margin (0–100 px)
- **Bottom Margin**: Adjustable bottom margin (0–100 px)

### Code Block Names

Customize code block aliases in **Settings > Chess > Code Block Names**:

- **List mode** (xiangqi): Default `xiangqi`, add custom aliases separated by commas
- **FEN generation mode** (xq): Default `xq`, add custom aliases
- **Branch diagram mode** (tree): Default `tree`, add custom aliases
- **FEN save type**: Choose which code block type to save as (List mode / Branch diagram mode)

> **Note**: Changes require restarting the plugin or Obsidian to take effect.

### Engine Analysis

- **Engine Depth**: Search depth for Pikafish analysis (1–30, default 18)
- **Engine Skill Level**: Skill level for engine play (0–20, default 20)
- **Save Eval by Default**: Automatically include eval data when saving (default off)
- **Save Eval Prompt**: Show prompt when saving with eval data (default on)

### Save

- **Save Eval by Default**: Whether to include eval annotations when saving PGN (default off)
- **Save Eval Prompt**: Whether to show a prompt about eval when saving (default on)

### PGN File View

Enable/disable PGN file view and customize file extensions:

- **Enable PGN file view**: Toggle to register/unregister PGN view
- **PGN file extensions**: Default `pgn`, add custom extensions separated by commas

> **Note**: Changes require restarting the plugin or Obsidian to take effect.

## Features

- **Board Rendering**: High-quality chessboard via xiangqiground with drag-and-drop moves
- **Custom Opening**:
  - Visual editor
  - Clear/Fill board
  - Set first player
  - Save as FEN
- **PGN Saving**:
  - Save move history as PGN format
  - Button colors: **gray** (empty), **green** (saved), **orange** (modified)
  - Confirmation dialog before saving
- **i18n**: Supports English and Chinese UI
- **Board Markers**: Draw arrows and highlights on the board
- **Jump to AI**: Package move list to Pikafish web version for analysis
- **Engine Analysis**: Built-in Pikafish WASM engine with single position analysis, batch analysis, and auto-analysis
  - **Best Move Arrow**: Green arrow shows the engine's best move; yellow arrow shows the ponder move
  - **Eval Bar**: Left sidebar bar showing evaluation (green = red advantage, red = black advantage)
  - **Eval Trend Chart**: Vertical polyline in the slider background showing evaluation across moves
  - **Eval Color Bar**: Color bar on tree nodes indicating evaluation (green = red advantage, red = black advantage, gray = equal)
  - **Eval Persistence**: Engine evaluations saved as `%e:` comments in PGN
- **Mobile Friendly**: Adjust board size for small screens

## Usage

### `xq` Code Block

1. Add the `xq` code block tag to start the editor
2. Drag pieces or click piece buttons to set up the position
3. Use clear/fill/turn buttons as needed
4. Click Save to generate a `xiangqi` code block with the FEN

### `xiangqi` Code Block

1. Write your game inside a `xiangqi` code block (optionally with FEN and ICCS moves)
2. FEN is optional — defaults to the standard starting position. Supports parsing Pikafish web links.
3. Controls:
   - When no manual moves are made, the move list shows the original PGN
   - After making moves, the list shows your modified sequence
   - Click **Reset** to revert to before manual edits
   - Click **Reset** again to return to initial state
4. Click **Save** to overwrite the original PGN

### `tree` Code Block

1. Write your game inside a `tree` code block (same format as `xiangqi`)
2. The variation tree displays all branches graphically
3. Click any node to navigate to that position
4. Switch between icon mode and text mode for node labels
5. Click the fold button (triangle) on a node with multiple children to collapse/expand its variations
6. Use engine analysis:
   - Click **Analyze** for single position analysis, **Batch** to analyze all nodes, or enable auto-analysis
   - Green arrow = best move, yellow arrow = ponder move
   - Eval bar on the left shows position evaluation
   - Eval color bars on nodes and eval trend chart on the slider show evaluation across the game

### Optional Parameters

| Name              | Value        | Description                                       |
| ----------------- | ------------ | ------------------------------------------------- |
| `fen`             | valid FEN    | Custom starting position; empty = default         |
| `protected` / `p` | true / false | When true, Save button is disabled; default false |
| `rotated` / `r`   | true / false | When true, board is flipped (Red on bottom)       |

#### Example

````markdown
```xiangqi
r:true
p:true
2bk1a3/5n3/3Pb4/R7p/2p6/C3p2N1/PR2c3P/1nr1B1C2/4A4/1rB1KA3 w
1. G2-G9 F9-E8
2. D7-D8 D9-E9
3. D8-E8 E9-E8
4. A6-A8 E8-E9
```
````

- Colons can be Chinese or English; `r` and `p` are case-insensitive
- FEN value works with or without quotes
- PGN moves can be numbered together, not numbered, or written one by one

## Installation

This plugin is available on the official Obsidian plugin marketplace. Search for "Chinese chess" or "xiangqi" to install.

1. Open Obsidian
2. Go to **Settings**
3. Click **Community plugins**
4. Ensure **Restricted mode** is off
5. Click **Browse**
6. Search for "Chinese chess" or "xiangqi"
7. Find this plugin and click **Install**
8. Click **Enable**

## Build

1. Clone this repository and its dependencies [xiangqiground](https://github.com/west-shell/xiangqiground) and [xiangqi.js](https://github.com/west-shell/xiangqi.js) into the same parent directory:

   ```bash
   git clone https://github.com/west-shell/xiangqiground.git
   git clone https://github.com/west-shell/xiangqi.js.git
   git clone https://github.com/west-shell/obsidian-xiangqi.git
   ```

2. Build xiangqiground first:

   ```bash
   cd xiangqiground
   npm install
   npm run dist
   ```

3. Build xiangqi.js:

   ```bash
   cd ../xiangqi.js
   npm install
   npm run dist
   ```

4. Then build the plugin:

   ```bash
   cd ../obsidian-xiangqi
   npm install
   npm run build        # Dev build (unminified, with sourcemaps)
   npm run build:min    # Minified build (for release)
   ```

## Donation

If you like this plugin, feel free to support me!

[![PayPal](https://img.shields.io/badge/PayPal-Sponsor-blue?logo=paypal)](https://paypal.com/paypalme/weshell1988)

![Donation](./IMAGE/打赏.png)
