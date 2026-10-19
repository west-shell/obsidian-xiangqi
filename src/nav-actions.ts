/**
 * Every scope-registered keyboard navigation action of the PGN view,
 * also exposed as a command (Command Palette entry + user-definable
 * hotkey in Settings → Hotkeys).
 *
 * The 12 branch navigation commands carry a default hotkey mirroring
 * the view's built-in Scope binding, so Settings → Hotkeys lists them
 * as assigned. The four plain move-stepping commands deliberately
 * carry none: global arrow-key defaults would break arrow navigation
 * everywhere else in the app. Note the built-in Scope bindings keep
 * working regardless of what happens to the command bindings in
 * Settings.
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
  /** Default hotkey(s) mirroring the view's built-in Scope binding. */
  hotkeys?: NavHotkey[];
}

export const NAV_ACTIONS: NavAction[] = [
  { id: "back", action: "back", labelKey: "command.back" },
  { id: "next", action: "next", labelKey: "command.next" },
  { id: "to-start", action: "toStart", labelKey: "command.toStart" },
  { id: "to-end", action: "toEnd", labelKey: "command.toEnd" },
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
