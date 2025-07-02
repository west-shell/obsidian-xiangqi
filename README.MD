# Obsidian Chinese Chess Plugin

![Version](https://img.shields.io/badge/Version-1.0.0-blue.svg)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![EN](https://img.shields.io/badge/Language-English-blue)](./README.MD)
[![ZH](https://img.shields.io/badge/Language-Chinese-green)](./README.zh-CN.MD)

## Plugin Overview

**Obsidian Chinese Chess Plugin** is a Chinese chess rendering engine tailor-made for Obsidian. It supports displaying chess games in FEN and PGN formats and allows move exploration. The plugin offers rich customization options, move navigation, saving functionality, and more.

## Demo

Two code block names are supported:

----

`xiangqi` is used to display a game. Leave it empty for the default opening.

````markdown
```xiangqi
1. H2-E2 H9-G7
2. H0-G2 I9-H9
3. I0-H0 B9-C7
....
30. B2-B9 D9-D8
31. B9-G9 C2-C7
32. G7-E7  *
`````

![PGN Display](./IMAGE/PGN测试.png)

----

`xq` is used to generate a `xiangqi` code block with a FEN string.

````markdown
```xq
```
`````

![FEN Generator](./IMAGE/FEN生成.png)

---

## Features

* **Board Rendering**: Display and replay Chinese chess games in notes

* **Opening Editor**: Visually edit custom openings

* **Custom Settings**:

  * Light/dark/system themes
  * Button position (right/bottom)
  * Board size
  * Toggle move list display
  * Toggle move notation display and font customization
  * Optional move narration (not supported on mobile)

* **Game Saving**:

  * Save move history in PGN format
  * Save button is **gray** when no PGN, **green** when PGN exists, **orange** after custom moves
  * Confirmation dialog before saving
  * If no moves are present, saving will clear previous PGN

* **Mobile Support**: Adaptable for small screens via board size and button position settings

* **Narration**: Optional speech for moves (can be toggled in settings)

* **Format Support**: Supports ICCS PGN format

## Usage

### `xq` Code Block

1. Add the `xq` code block tag
2. Manually edit the board; use the buttons to clear, fill, or switch first player
3. Click "Save" to generate a `xiangqi` block with the corresponding FEN

### `xiangqi` Code Block

1. Add PGN moves to a code block tagged with `xiangqi`

2. FEN is optional — defaults to the standard opening

3. Use `xq` to edit openings and generate a `xiangqi` block

4. Controls:

   - If no manual moves are made, the move list will display the original PGN.
   - After manual moves, the move list will show the updated sequence.
   - Clicking "Reset" will revert to the state before manual exploration.
   - Clicking "Reset" again will return to the initial setup.


5. "Save" will overwrite the original PGN with current moves

## Installation

1. Download the plugin files

2. In Obsidian:

   * Open **Settings → Community Plugins**
   * Turn off **Safe Mode**

3. Open the plugin folder:

   * On desktop, click the 📂 icon
   * On mobile, open `your-vault/.obsidian/plugins` manually
   * Create a new folder and place plugin files inside

4. Enable the plugin

*Note: Will be available soon on the Obsidian plugin marketplace (search "Chinese chess")*
