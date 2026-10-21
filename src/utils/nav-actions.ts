/**
 * The 12 branch navigation actions of the PGN view, exposed as
 * commands (no default hotkeys — presetting hotkeys risks conflicts
 * with core and other plugins, per Obsidian community guidelines).
 * The `hotkeys` entries are the in-view Scope defaults: the PGN view
 * registers these modifier combos on its own Scope, so they only
 * apply while that view is active.
 *
 * The four plain arrow keys (move stepping) are deliberately NOT
 * commands: they only work inside the PGN view via its own Scope, and
 * global arrow-key bindings would break arrow navigation everywhere
 * else in the app.
 *
 * Pure data (no Obsidian imports) so it stays unit-testable.
 */
export interface NavHotkey {
  modifiers: ("Ctrl" | "Alt" | "Shift")[];
  key: string;
}

export interface NavAction {
  /** Command id (Settings → Hotkeys shows it as `chess-tree:<id>`). */
  id: string;
  /** The btn-click action name reused by the Scope bindings. */
  action: string;
  /** i18n key for the command name shown in the Command Palette. */
  labelKey: string;
  /** In-view Scope default(s) — the modifier-combo binding the PGN view registers. */
  hotkeys?: NavHotkey[];
}

export const NAV_ACTIONS: NavAction[] = [
  {
    id: "prev-fork",
    action: "navPrevFork",
    labelKey: "command.prevFork",
    hotkeys: [{ modifiers: ["Ctrl"], key: "ArrowUp" }],
  },
  {
    id: "next-fork",
    action: "navNextFork",
    labelKey: "command.nextFork",
    hotkeys: [{ modifiers: ["Ctrl"], key: "ArrowDown" }],
  },
  {
    id: "prev-path-branch",
    action: "prevPathBranch",
    labelKey: "command.prevPathBranch",
    hotkeys: [{ modifiers: ["Ctrl"], key: "ArrowLeft" }],
  },
  {
    id: "next-path-branch",
    action: "nextPathBranch",
    labelKey: "command.nextPathBranch",
    hotkeys: [{ modifiers: ["Ctrl"], key: "ArrowRight" }],
  },
  {
    id: "prev-variation",
    action: "prevAllBranches",
    labelKey: "command.prevAllBranches",
    hotkeys: [{ modifiers: ["Ctrl", "Alt", "Shift"], key: "ArrowLeft" }],
  },
  {
    id: "next-variation",
    action: "nextAllBranches",
    labelKey: "command.nextAllBranches",
    hotkeys: [{ modifiers: ["Ctrl", "Alt", "Shift"], key: "ArrowRight" }],
  },
  {
    id: "prev-same-ply",
    action: "prevSamePly",
    labelKey: "command.prevSamePly",
    hotkeys: [{ modifiers: ["Alt"], key: "ArrowLeft" }],
  },
  {
    id: "next-same-ply",
    action: "nextSamePly",
    labelKey: "command.nextSamePly",
    hotkeys: [{ modifiers: ["Alt"], key: "ArrowRight" }],
  },
  {
    id: "prev-branch-end",
    action: "prevBranchEnd",
    labelKey: "command.prevBranchEnd",
    hotkeys: [{ modifiers: ["Alt", "Shift"], key: "ArrowLeft" }],
  },
  {
    id: "next-branch-end",
    action: "nextBranchEnd",
    labelKey: "command.nextBranchEnd",
    hotkeys: [{ modifiers: ["Alt", "Shift"], key: "ArrowRight" }],
  },
  {
    id: "prev-branch-start",
    action: "prevBranchStart",
    labelKey: "command.prevBranchStart",
    hotkeys: [{ modifiers: ["Ctrl", "Shift"], key: "ArrowLeft" }],
  },
  {
    id: "next-branch-start",
    action: "nextBranchStart",
    labelKey: "command.nextBranchStart",
    hotkeys: [{ modifiers: ["Ctrl", "Shift"], key: "ArrowRight" }],
  },
];
