import { type App, Modal, Notice, Setting } from "obsidian";
import { CLS_PREFIX, DEFAULT_FEN, PGN_PLACEHOLDER } from "../../chess";
import { t } from "../../i18n";
import type { ChessNode, GameSlot, IHost } from "../../types";
import { validateFen } from "../../utils/chessEngine";
import { activateGame } from "../Source/parse";
import { PGNParser } from "../Source/parser";

export class ImportModal extends Modal {
  private fenValue = "";
  private pgnValue = "";

  constructor(
    app: App,
    private readonly host: IHost,
    private readonly isBlockMode = false,
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;

    new Setting(contentEl).setName(t("import.title")).setHeading();

    new Setting(contentEl).setName(t("import.fen"));
    const fenArea = contentEl.createEl("textarea", {
      cls: `${CLS_PREFIX}-modal-textarea`,
      attr: {
        rows: "3",
        placeholder: DEFAULT_FEN,
      },
    });
    fenArea.addEventListener("input", () => {
      this.fenValue = fenArea.value;
    });

    contentEl.createDiv({
      cls: `${CLS_PREFIX}-modal-warning`,
      text: t("import.fenWarning"),
    });

    const fenBtnContainer = contentEl.createDiv("modal-button-container");
    const importFenBtn = fenBtnContainer.createEl("button", {
      text: t("import.importFen"),
      cls: "mod-cta",
    });
    importFenBtn.addEventListener("click", () => this.handleImportFen());

    contentEl.createDiv({ cls: `${CLS_PREFIX}-modal-separator` });

    new Setting(contentEl).setName(t("import.pgn"));
    const pgnArea = contentEl.createEl("textarea", {
      cls: `${CLS_PREFIX}-modal-textarea`,
      attr: { rows: "6", placeholder: PGN_PLACEHOLDER },
    });
    pgnArea.addEventListener("input", () => {
      this.pgnValue = pgnArea.value;
    });

    const pgnBtnContainer = contentEl.createDiv("modal-button-container");
    const overwriteBtn = pgnBtnContainer.createEl("button", {
      text: t("import.overwrite"),
      cls: "mod-cta",
    });
    overwriteBtn.addEventListener("click", () =>
      this.handleImportPgn("overwrite"),
    );
    const addBranchBtn = pgnBtnContainer.createEl("button", {
      text: t("import.addBranch"),
    });
    addBranchBtn.addEventListener("click", () =>
      this.handleImportPgn("branch"),
    );
    if (!this.isBlockMode) {
      const addGameBtn = pgnBtnContainer.createEl("button", {
        text: t("import.addGame"),
      });
      addGameBtn.addEventListener("click", () => this.handleImportPgn("game"));
    }

    const cancelContainer = contentEl.createDiv("modal-button-container");
    const cancelBtn = cancelContainer.createEl("button", {
      text: t("confirm.cancel"),
    });
    cancelBtn.addEventListener("click", () => this.close());
  }

  private handleImportFen() {
    const fen = this.fenValue.trim();
    if (!fen) {
      new Notice(t("import.emptyFen"));
      return;
    }
    const validation = validateFen(fen);
    if (!validation.ok) {
      new Notice(t("import.invalidFen"));
      return;
    }

    const host = this.host;
    const eventBus = host.eventBus;

    host.root.children = [];
    host.root.comments = [];
    host.root.fen = fen;
    host.nodeMap.clear();
    host.nodeMap.set(host.root.id, host.root);
    host.currentNode = host.root;
    host.fen = fen;
    host.tags = updateFenTag(host.tags, fen);
    host.selectedPiece = null;
    host.markedPos = null;

    eventBus.emit("updateMainPath");
    eventBus.emit("updateUI");
    eventBus.emit("modified", null);

    this.close();
    new Notice(t("notice.fenImported"));
  }

  private handleImportPgn(mode: "overwrite" | "branch" | "game") {
    const pgn = this.pgnValue.trim();
    if (!pgn) {
      new Notice(t("import.emptyPgn"));
      return;
    }

    let parser: PGNParser;
    try {
      parser = new PGNParser(pgn, true);
    } catch {
      new Notice(t("import.invalidPgn"));
      return;
    }

    const host = this.host;
    const eventBus = host.eventBus;

    if (mode === "game") {
      const newSlot: GameSlot = {
        raw: pgn,
        headers: new Map(),
        parsed: {
          root: parser.getRoot(),
          nodeMap: parser.getMap(),
          tags: parser.getTags(),
          parser,
        },
      };
      host.games.push(newSlot);
      activateGame(host, host.games.length - 1);
      host.currentTurn =
        host.currentNode.move?.color === "b" ? "white" : "black";
      eventBus.emit("updateMainPath");
      eventBus.emit("updateUI");
      eventBus.emit("modified", null);
      this.close();
      new Notice(t("notice.pgnImportedAsGame"));
      return;
    }

    const newRoot = parser.getRoot();
    const newMap = parser.getMap();
    const newTags = parser.getTags();

    if (mode === "overwrite") {
      host.parser = parser;
      host.root = newRoot;
      host.nodeMap = newMap;
      host.tags = newTags;
    } else {
      if (newRoot.fen !== host.root.fen) {
        new Notice(t("import.fenMismatch"));
        return;
      }
      function reassignIds(node: ChessNode, parentId: string | null) {
        const newId = `node-${host.parser.nodeId++}`;
        node.parentID = parentId;
        node.id = newId;
        host.nodeMap.set(newId, node);
        for (const child of node.children) {
          reassignIds(child, newId);
        }
      }
      for (const child of newRoot.children) {
        reassignIds(child, host.root.id);
        host.root.children.push(child);
      }
    }

    host.currentNode = host.nodeMap.get("node-root")!;
    host.fen = host.currentNode.fen;
    host.currentTurn = host.currentNode.move?.color === "b" ? "white" : "black";

    eventBus.emit("updateMainPath");
    eventBus.emit("updateUI");
    eventBus.emit("modified", null);

    this.close();
    new Notice(
      mode === "overwrite"
        ? t("notice.pgnImported")
        : t("notice.pgnImportedAsBranch"),
    );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

function updateFenTag(tags: string, newFen: string): string {
  if (tags.includes('[FEN "')) {
    return tags.replace(/\[FEN "[^"]*"\]/, `[FEN "${newFen}"]`);
  }
  return `[FEN "${newFen}"]\n[SetUp "1"]\n${tags}`;
}
