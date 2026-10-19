/**
 * Every scope-registered keyboard navigation action of the PGN view,
 * also exposed as a command (Command Palette entry + user-definable
 * hotkey in Settings → Hotkeys). Commands carry no default hotkey —
 * the view's built-in Scope bindings stay the defaults.
 *
 * Pure data (no Obsidian imports) so it stays unit-testable.
 */
export interface NavAction {
  /** Command id (Settings → Hotkeys shows it as `chess-tree:<id>`). */
  id: string;
  /** The btn-click action name reused by the Scope bindings. */
  action: string;
  /** i18n key for the command name shown in the Command Palette. */
  labelKey: string;
}

export const NAV_ACTIONS: NavAction[] = [
  { id: "back", action: "back", labelKey: "command.back" },
  { id: "next", action: "next", labelKey: "command.next" },
  { id: "to-start", action: "toStart", labelKey: "command.toStart" },
  { id: "to-end", action: "toEnd", labelKey: "command.toEnd" },
  { id: "prev-fork", action: "navPrevFork", labelKey: "command.prevFork" },
  { id: "next-fork", action: "navNextFork", labelKey: "command.nextFork" },
  {
    id: "prev-path-branch",
    action: "prevPathBranch",
    labelKey: "command.prevPathBranch",
  },
  {
    id: "next-path-branch",
    action: "nextPathBranch",
    labelKey: "command.nextPathBranch",
  },
  {
    id: "prev-variation",
    action: "prevAllBranches",
    labelKey: "command.prevAllBranches",
  },
  {
    id: "next-variation",
    action: "nextAllBranches",
    labelKey: "command.nextAllBranches",
  },
  {
    id: "prev-same-ply",
    action: "prevSamePly",
    labelKey: "command.prevSamePly",
  },
  {
    id: "next-same-ply",
    action: "nextSamePly",
    labelKey: "command.nextSamePly",
  },
  {
    id: "prev-branch-end",
    action: "prevBranchEnd",
    labelKey: "command.prevBranchEnd",
  },
  {
    id: "next-branch-end",
    action: "nextBranchEnd",
    labelKey: "command.nextBranchEnd",
  },
  {
    id: "prev-branch-start",
    action: "prevBranchStart",
    labelKey: "command.prevBranchStart",
  },
  {
    id: "next-branch-start",
    action: "nextBranchStart",
    labelKey: "command.nextBranchStart",
  },
];
