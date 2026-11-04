import type { IBlockHost } from "../types";
import { NAV_ACTIONS } from "../utils/nav-actions";

/** The keyboard state KeyboardNav reads from a keydown event. */
export interface NavKeyEvent {
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  key: string;
}

/** Plain arrows, mirroring the PGN view's Scope bindings. */
const PLAIN_ACTION_BY_KEY: Record<string, string> = {
  ArrowUp: "back",
  ArrowDown: "next",
  ArrowLeft: "toStart",
  ArrowRight: "toEnd",
};

/** Modifier-combo id ("Ctrl+Shift+ArrowLeft") → action, from NAV_ACTIONS. */
const ACTION_BY_COMBO = new Map<string, string>();
for (const { action, hotkeys } of NAV_ACTIONS) {
  for (const { modifiers, key } of hotkeys ?? []) {
    ACTION_BY_COMBO.set(comboId(modifiers, key), action);
  }
}

function comboId(modifiers: readonly string[], key: string): string {
  return `${[...modifiers].sort().join("+")}+${key}`;
}

/**
 * Resolve a keydown to a navigation action, or null when the key is
 * not a navigation shortcut. Plain arrows step moves (same mapping as
 * the PGN view's Scope); the modifier combos mirror NAV_ACTIONS.
 * `Cmd` (macOS), bare `Shift` and `Ctrl+Alt` (without Shift) have no
 * action.
 */
export function resolveKeyboardAction(e: NavKeyEvent): string | null {
  if (e.metaKey) return null;
  if (e.ctrlKey || e.altKey) {
    const modifiers: string[] = [];
    if (e.ctrlKey) modifiers.push("Ctrl");
    if (e.altKey) modifiers.push("Alt");
    if (e.shiftKey) modifiers.push("Shift");
    return ACTION_BY_COMBO.get(comboId(modifiers, e.key)) ?? null;
  }
  if (e.shiftKey) return null;
  return PLAIN_ACTION_BY_KEY[e.key] ?? null;
}

/**
 * Keyboard navigation for `chess`/`tree`/`fen` code blocks. Blocks
 * have no Obsidian Scope (unlike the PGN file view), so the block
 * container itself is the keyboard target: it gets `tabindex="-1"`
 * (focusable by click/script, no extra tab stops — notes can hold
 * many blocks), clicking the block focuses it, and keydown on the
 * focused block drives the same navigation actions as the PGN view.
 * Clicking back into the note text returns focus to the editor, so
 * typing is never disturbed.
 */
export const KeyboardNavModule = {
  init(host: IBlockHost) {
    const container = host.containerEl;
    container.tabIndex = -1;

    // Target-only editable check: the block container itself sits
    // inside the note's editing host in Live Preview, so ancestor
    // lookups (closest(".cm-editor"), isContentEditable) would match
    // the container too — the bug that made the old hover-gated
    // version dead in editing mode. The block's own editables (the
    // comment textarea, sliders) are caught on the target itself.
    const isEditable = (el: EventTarget | null): boolean => {
      return (
        el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement
      );
    };

    // Clicking the block focuses it so the shortcuts below have a
    // target — unless the click went to an editor or to an already
    // focusable child (buttons keep their own focus).
    const onClick = (e: MouseEvent): void => {
      if (isEditable(e.target)) return;
      const doc = container.ownerDocument;
      if (doc.activeElement && container.contains(doc.activeElement)) {
        return;
      }
      container.focus({ preventScroll: true });
    };
    container.addEventListener("click", onClick);

    const onKeyDown = (e: KeyboardEvent): void => {
      if (isEditable(e.target)) return;
      const action = resolveKeyboardAction(e);
      if (!action) return;
      e.preventDefault();
      host.eventBus.emit("btn-click", { name: action });
    };
    container.addEventListener("keydown", onKeyDown);

    host.eventBus.on("unload", () => {
      container.removeEventListener("click", onClick);
      container.removeEventListener("keydown", onKeyDown);
    });
  },
};
