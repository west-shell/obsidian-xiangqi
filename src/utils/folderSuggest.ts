import {
  type App,
  FuzzySuggestModal,
  normalizePath,
  type TFolder,
} from "obsidian";
import { t } from "../i18n";

/**
 * Fuzzy folder picker over all vault folders — the same interaction as
 * Obsidian's native folder pickers. Resolves with the chosen vault-relative
 * folder path ("" for the vault root).
 */
export class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
  constructor(
    app: App,
    private readonly onChooseFolder: (folder: string) => void,
  ) {
    super(app);
    this.setPlaceholder(t("export.chooseFolder"));
  }

  getItems(): TFolder[] {
    return this.app.vault.getAllFolders(true);
  }

  getItemText(item: TFolder): string {
    return item.path === "" ? "/" : item.path;
  }

  onChooseItem(item: TFolder): void {
    this.onChooseFolder(item.path);
  }
}

/** Normalizes a user-typed vault folder path ("" on empty, no leading "/"). */
export function normalizeFolderPath(value: string): string {
  let folder = normalizePath(value.trim());
  if (folder.startsWith("/")) folder = folder.slice(1);
  return folder;
}

/** Creates each missing folder along a vault-relative directory path. */
export async function ensureFolders(app: App, dir: string): Promise<void> {
  if (!dir || app.vault.getFolderByPath(dir)) return;
  let current = "";
  for (const part of dir.split("/")) {
    current = current ? `${current}/${part}` : part;
    if (!app.vault.getFolderByPath(current)) {
      await app.vault.createFolder(current);
    }
  }
}
