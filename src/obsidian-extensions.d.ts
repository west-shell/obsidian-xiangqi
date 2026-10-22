import type { TAbstractFile } from "obsidian";

declare module "obsidian" {
  interface FileManager {
    /**
     * Opens Obsidian's native rename dialog for the given file.
     * Present in the Obsidian app but not yet in the public typings.
     */
    promptForFileRename(file: TAbstractFile): Promise<void>;
  }
}
