import { FileHost } from "./host/FileHost";
import { t } from "./i18n";
import type ChessPlugin from "./main";
import { NAV_ACTIONS } from "./nav-actions";

/**
 * Register the PGN view navigation commands. Each one only applies
 * while a PGN view is the active view (checkCallback gates palette
 * visibility and any user-bound hotkey), and is unavailable while a
 * text field (tag editing, global search) has focus.
 */
export function registerNavCommands(plugin: ChessPlugin): void {
  for (const { id, action, labelKey, hotkeys } of NAV_ACTIONS) {
    plugin.addCommand({
      id,
      name: t(labelKey),
      // The defaults are the binding itself: the PGN view handles the
      // modifier combos through these command hotkeys (its Scope only
      // keeps the plain arrow keys, which must not become global
      // defaults), so Settings → Hotkeys can rebind or delete them.
      // See eslint.config.mjs for the rule exception.
      hotkeys,
      checkCallback: (checking: boolean) => {
        const view = plugin.app.workspace.getActiveViewOfType(FileHost);
        if (!view) return false;
        const el = activeDocument.activeElement;
        if (
          el instanceof HTMLTextAreaElement ||
          el instanceof HTMLInputElement
        ) {
          return false;
        }
        if (!checking) {
          view.eventBus.emit("btn-click", { name: action });
        }
        return true;
      },
    });
  }
}
