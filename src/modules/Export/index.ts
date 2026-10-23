import type { IHost } from "../../types";
import { ExportModal } from "./ExportModal";

/**
 * Single entry into the export flow: opens the export dialog (FEN / PGN
 * copy, PNG / GIF rendering with save-as) for the given host.
 * `getCurrentBranchPGN` supplies the current-branch PGN text shown in the
 * dialog's PGN section.
 */
export function promptExport(
  host: IHost,
  getCurrentBranchPGN: (
    includeComments: boolean,
    includeEval: boolean,
  ) => string,
): void {
  new ExportModal(host.plugin.app, host, getCurrentBranchPGN).open();
}
