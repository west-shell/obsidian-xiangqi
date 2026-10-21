import { FileHost } from "./host/FileHost";
import { t } from "./i18n";
import type ChessPlugin from "./main";
import { NAV_ACTIONS } from "./utils/nav-actions";

/**
 * Register the PGN view navigation commands. Each one only applies
 * while a PGN view is the active view (checkCallback gates palette
 * visibility and any user-bound hotkey), and is unavailable while a
 * text field (tag editing, global search) has focus.
 */
export function registerNavCommands(plugin: ChessPlugin): void {
  for (const { id, action, labelKey } of NAV_ACTIONS) {
    plugin.addCommand({
      id,
      name: t(labelKey),
      // No default hotkeys: presetting them risks conflicts with core
      // and other plugins (Obsidian community guideline). The modifier
      // combos are in-view Scope defaults (see src/host/FileHost.ts);
      // users can assign global hotkeys here in Settings → Hotkeys.
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
