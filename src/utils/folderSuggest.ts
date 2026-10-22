import { type App, FuzzySuggestModal, type TFolder } from "obsidian";
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
    return item.path === "" ? t("export.rootFolder") : item.path;
  }

  onChooseItem(item: TFolder): void {
    this.onChooseFolder(item.path);
  }
}
