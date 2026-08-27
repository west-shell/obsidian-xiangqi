import { type Move, type Piece } from "../../chess";
import {
  buildDefaultEditFen,
  DEFAULT_FEN,
  EMPTY_FEN,
  getSaveNotation,
  isMoveCheckmate,
  matchMove,
  PRIMARY_PLAYER_KEY,
} from "../../chess";
import {
  ANNOTATION_PREFIX,
  isAnnotationKey,
  SHAPES_PREFIX,
} from "../../utils/icon";
import {
  registerBlockModule,
  registerFileModule,
} from "../../core/module-system";
import { t } from "../../i18n";
import type {
  ChessNode,
  GameSlot,
  IBlockHost,
  IFileHost,
  IHost,
} from "../../types";
import {
  ConfirmModal,
  ExportModal,
  ImportModal,
} from "../../utils/confirmModal";
import { activateGame, extractHeaders } from "../../utils/parse";
import { Modal, Setting } from "obsidian";
import { mount, unmount } from "svelte";
import Chess from "../../lib/Tree/Chess.svelte";

const ActionsModule = {
  init(host: IHost) {
    const eventBus = host.eventBus;

    eventBus.on("modified", () => {
      host.modified = true;
    });
    eventBus.on("save", () => {
      host.modified = false;
    });
    eventBus.on("load", () => {
      host.modified = false;
    });
    eventBus.on("setViewData", () => {
      host.modified = false;
    });
    eventBus.on("reset", () => {
      host.modified = false;
    });

    function chessProps() {
      return {
        nodeMap: new Map(host.nodeMap),
        settings: { ...host.settings },
        fen: host.editing ? host.fen : (host.currentNode?.fen ?? ""),
        eventBus: host.eventBus,
        currentNode: host.currentNode,
        currentPath: host.currentPath,
        options: { ...host.options },
        editing: host.editing,
        isFenMode: host.isFenMode,
        selectedPiece: host.selectedPiece,
        plugin: host.plugin,
        games: host.games,
        currentGameIndex: host.currentGameIndex,
        isBlockMode: !isFileHost(host),
      };
    }

    function isFileHost(h: IHost): h is IFileHost {
      return "saveFile" in h && typeof (h as IFileHost).saveFile === "function";
    }

    eventBus.on("createUI", () => {
      if (host.Chess) {
        void unmount(host.Chess);
        host.Chess = null;
      }

      let container: HTMLElement;
      if (isFileHost(host)) {
        container = host.contentEl;
        container.classList.add("pgn-view");
      } else {
        container = (host as IBlockHost).containerEl.createDiv();
      }

      host.modified = false;
      host.Chess = mount(Chess, {
        target: container,
        props: chessProps(),
      });
    });

    eventBus.on("updateUI", () => {
      host.Chess?.$set?.(chessProps());
    });

    eventBus.on("unload", () => {
      if (host.Chess) void unmount(host.Chess);
    });

    eventBus.on("updateMainPath", () => {
      const { currentNode, nodeMap } = host;
      if (!currentNode) {
        host.currentPath = [];
        return;
      }

      const ancestors: string[] = [];
      let node: ChessNode | null = currentNode;
      while (node) {
        ancestors.push(node.id);
        if (node.parentID) {
          const parent = nodeMap.get(node.parentID);
          node = parent ?? null;
        } else {
          node = null;
        }
      }
      ancestors.reverse();

      const descendants: string[] = [];
      node = currentNode.children?.[0] || null;
      while (node) {
        descendants.push(node.id);
        node = node.children?.[0] || null;
      }

      host.currentPath = [...ancestors, ...descendants];
    });
    eventBus.on<Move>("runmove", (move) => {
      if (!move) return;
      const currentNode = host.currentNode;
      for (let node of currentNode.children) {
        if (node.move && matchMove(node.move, move)) {
          host.currentNode = node;
          host.fen = node.fen;
          emitNodeEval(host);
          eventBus.emit("updateMainPath");
          eventBus.emit("updateUI");
          return;
        }
      }
      const newNode: ChessNode = {
        id: `node-${host.parser.nodeId++}`,
        fen: move.after,
        move,
        step: host.currentStep,
        color: move.color === "w" ? "white" : "black",
        parentID: host.currentNode.id,
        children: [],
        comments: [],
        isCheckmate: isMoveCheckmate(move),
      };
      host.nodeMap.set(newNode.id, newNode);
      host.currentNode.children.push(newNode);
      host.currentNode = newNode;
      host.fen = move.after;
      host.currentStep++;
      emitNodeEval(host);
      eventBus.emit("updateMainPath");
      eventBus.emit("updateUI");
      eventBus.emit("modified", null);
    });

    eventBus.on<string>("node-click", (id) => {
      if (!id) return;
      host.markedPos = null;
      host.currentNode = host.nodeMap.get(id)!;
      host.fen = host.currentNode.fen;
      emitNodeEval(host);
      host.eventBus.emit("updateMainPath");
      host.eventBus.emit("updateUI");
    });

    eventBus.on<number>("clickstep", (step) => {
      if (step === undefined) return;
      const nodeId = step === 0 ? host.currentPath[0] : host.currentPath[step];
      if (nodeId) {
        eventBus.emit("node-click", nodeId);
      }
    });

    eventBus.on<string>("slider-navigate", (id) => {
      if (!id) return;
      const node = host.nodeMap.get(id);
      if (!node) return;
      host.markedPos = null;
      host.currentNode = node;
      host.fen = node.fen;
      emitNodeEval(host);
      host.eventBus.emit("updateUI");
    });

    eventBus.on<number>("switch-game", async (index) => {
      if (index === undefined || index < 0 || index >= host.games.length)
        return;
      if (host.modified) {
        const modal = new ConfirmModal(
          host.plugin.app,
          t("confirm.switchGameTitle"),
          t("confirm.switchGameMsg"),
          t("confirm.yes"),
          t("confirm.cancel"),
        );
        modal.open();
        if (!(await modal.promise)) return;
      }
      const prevSlot = host.games[host.currentGameIndex];
      if (prevSlot?.parsed) {
        prevSlot.parsed.tags = host.tags;
        prevSlot.parsed.root = host.root;
        prevSlot.parsed.nodeMap = host.nodeMap;
      }
      activateGame(host, index);
      host.eventBus.emit("clear-engine-bestmove");
    });

    eventBus.on("create-game", () => {
      if (!isFileHost(host)) return;
      const tags = '[Result "*"]';
      const newSlot: GameSlot = {
        raw: tags,
        headers: extractHeaders(tags),
      };
      host.games.push(newSlot);
      host.eventBus.emit("modified", null);
      activateGame(host, host.games.length - 1);
      host.eventBus.emit("clear-engine-bestmove");
    });

    eventBus.on("delete-game", async () => {
      if (!isFileHost(host)) return;
      if (host.games.length <= 1) return;
      const modal = new ConfirmModal(
        host.plugin.app,
        t("confirm.deleteGameTitle"),
        t("confirm.deleteGameMsg"),
        t("confirm.yes"),
        t("confirm.cancel"),
      );
      modal.open();
      if (!(await modal.promise)) return;
      const idx = host.currentGameIndex;
      host.games.splice(idx, 1);
      const newIdx = Math.min(idx, host.games.length - 1);
      host.eventBus.emit("modified", null);
      activateGame(host, newIdx);
      host.eventBus.emit("clear-engine-bestmove");
    });

    eventBus.on<number>("move-game", (direction) => {
      if (!isFileHost(host)) return;
      if (!direction) return;
      const idx = host.currentGameIndex;
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= host.games.length) return;
      const temp = host.games[idx];
      host.games[idx] = host.games[targetIdx];
      host.games[targetIdx] = temp;
      host.eventBus.emit("modified", null);
      activateGame(host, targetIdx);
      host.eventBus.emit("clear-engine-bestmove");
    });

    eventBus.on<{ name: string; payload: unknown }>(
      "btn-click",
      async (payload) => {
        if (!payload) return;
        host.markedPos = null;
        const { name } = payload;
        const data = payload.payload as string;
        switch (name) {
          case "annotation": {
            if (!host.currentNode) break;
            const node = host.currentNode;
            if (isAnnotationKey(data)) {
              if (node.annotation === data) {
                node.annotation = undefined;
              } else {
                node.annotation = data;
              }
            }
            eventBus.emit("modified", null);
            break;
          }
          case "remove": {
            if (host.currentNode.id === "node-root") {
              const modal = new ConfirmModal(
                host.plugin.app,
                t("confirm.deleteTitle"),
                t("confirm.deleteMsg"),
                t("confirm.yes"),
                t("confirm.cancel"),
              );
              modal.open();
              if (await modal.promise) {
                host.currentNode.children = [];
                host.nodeMap.clear();
                host.currentNode = { ...host.currentNode };
                host.nodeMap.set(host.currentNode.id, host.currentNode);
                eventBus.emit("node-click", host.currentNode.id);
                eventBus.emit("modified", null);
              }
              break;
            }
            const removeNode = host.currentNode;
            const parentNode = host.nodeMap.get(removeNode.parentID!);
            host.currentNode = parentNode!;
            if (parentNode) {
              const idx = parentNode.children.indexOf(removeNode);
              if (idx !== -1) parentNode.children.splice(idx, 1);
            }
            function deleteSubtree(node: ChessNode) {
              for (const child of node.children) deleteSubtree(child);
              host.nodeMap.delete(node.id);
            }
            deleteSubtree(removeNode);
            eventBus.emit("updateMainPath");
            eventBus.emit("node-click", host.currentNode.id);
            eventBus.emit("modified", null);
            break;
          }
          case "promote": {
            if (
              !host.currentNode.parentID ||
              host.currentNode.id === "node-root"
            )
              break;
            let nodeToPromote = host.currentNode;
            let parent = host.nodeMap.get(nodeToPromote.parentID!);
            if (!parent) break;
            while (
              parent.children.length > 0 &&
              parent.children[0].id === nodeToPromote.id
            ) {
              if (!parent.parentID) break;
              nodeToPromote = parent;
              parent = host.nodeMap.get(parent.parentID);
              if (!parent) break;
            }
            const idx = parent!.children.findIndex(
              (c: ChessNode) => c.id === nodeToPromote.id,
            );
            if (idx > 0) {
              const item = parent!.children[idx];
              parent!.children = [
                item,
                ...parent!.children.filter((c: ChessNode) => c.id !== item.id),
              ];
              eventBus.emit("modified", null);
            }
            eventBus.emit("updateMainPath");
            break;
          }
          case "toStart":
            host.currentNode = host.nodeMap.get(host.currentPath[0])!;
            host.fen = host.currentNode.fen;
            break;
          case "back":
            if (host.currentNode.parentID) {
              host.currentNode = host.nodeMap.get(host.currentNode.parentID)!;
              host.fen = host.currentNode.fen;
            }
            break;
          case "next": {
            const ci = host.currentPath.indexOf(host.currentNode.id);
            if (ci < host.currentPath.length - 1) {
              host.currentNode = host.nodeMap.get(host.currentPath[ci + 1])!;
              host.fen = host.currentNode.fen;
            }
            break;
          }
          case "toEnd": {
            host.currentNode = host.nodeMap.get(
              host.currentPath[host.currentPath.length - 1],
            )!;
            host.fen = host.currentNode.fen;
            break;
          }
          case "edit-board": {
            const modal = new ConfirmModal(
              host.plugin.app,
              t("confirm.editBoardTitle"),
              t("confirm.editBoardMsg"),
              t("confirm.yes"),
              t("confirm.cancel"),
            );
            modal.open();
            if (await modal.promise) {
              host.editing = true;
              host.selectedPiece = null;
              host.markedPos = null;
              eventBus.emit("updateUI");
            }
            break;
          }
          case "edit-tags": {
            const tagPairs: { key: string; value: string }[] = [];
            const tagRe = /\[(\w+)\s+"([^"]*)"\]/g;
            let m: RegExpExecArray | null;
            while ((m = tagRe.exec(host.tags ?? "")) !== null) {
              if (m[1] === "FEN") continue;
              tagPairs.push({ key: m[1], value: m[2] });
            }
            const standardKeys = [
              "Event",
              "Site",
              "Date",
              "Round",
              PRIMARY_PLAYER_KEY,
              "Black",
              "Result",
            ];
            for (const key of standardKeys) {
              if (!tagPairs.some((p) => p.key === key)) {
                tagPairs.push({ key, value: "" });
              }
            }
            const tagsModal = new Modal(host.plugin.app);
            let resolve: (value: boolean) => void;
            const tagsPromise = new Promise<boolean>((r) => {
              resolve = r;
            });
            tagsModal.onOpen = () => {
              const { contentEl } = tagsModal;
              new Setting(contentEl)
                .setName(t("confirm.editTagsTitle", 0))
                .setHeading();
              for (const pair of tagPairs) {
                const setting = new Setting(contentEl).setName(
                  t(`tag.${pair.key}`, 0) || pair.key,
                );
                if (pair.key === "Result") {
                  setting.addDropdown((dropdown) => {
                    dropdown.addOption("*", "*");
                    dropdown.addOption("1-0", "1-0");
                    dropdown.addOption("0-1", "0-1");
                    dropdown.addOption("1/2-1/2", "1/2-1/2");
                    dropdown.setValue(pair.value || "*");
                    dropdown.onChange((v) => {
                      pair.value = v;
                    });
                  });
                } else {
                  setting.addText((text) => {
                    text.setValue(pair.value).onChange((v) => {
                      pair.value = v;
                    });
                  });
                }
              }
              const btnContainer = contentEl.createDiv(
                "modal-button-container",
              );
              const okBtn = btnContainer.createEl("button", {
                text: t("confirm.yes"),
                cls: "mod-cta",
              });
              okBtn.addEventListener("click", () => {
                resolve(true);
                tagsModal.close();
              });
              const cancelBtn = btnContainer.createEl("button", {
                text: t("confirm.cancel"),
              });
              cancelBtn.addEventListener("click", () => {
                resolve(false);
                tagsModal.close();
              });
            };
            tagsModal.onClose = () => {
              (tagsModal as { contentEl: HTMLElement }).contentEl.empty();
            };
            tagsModal.open();
            if (await tagsPromise) {
              const fenTag = (host.tags ?? "").match(/\[FEN\s+"[^"]*"\]/)?.[0];
              const edited = tagPairs
                .filter((p) => p.value)
                .map((p) => `[${p.key} "${p.value}"]`)
                .join("\n");
              host.tags = fenTag ? `${edited}\n${fenTag}` : edited;
              const slot = host.games[host.currentGameIndex];
              if (slot) {
                slot.headers = extractHeaders(host.tags);
                if (slot.parsed) slot.parsed.tags = host.tags;
              }
              eventBus.emit("modified", null);
              eventBus.emit("updateUI");
            }
            break;
          }
          case "reset": {
            eventBus.emit("reset");
            break;
          }
          case "save": {
            if (host.editing) {
              const fen = data
                ? data
                : host.isFenMode
                  ? host.fen
                  : buildDefaultEditFen(host.fen.split(" ")[0]);
              host.root.children = [];
              host.root.comments = [];
              host.root.fen = fen;
              host.nodeMap.clear();
              host.nodeMap.set(host.root.id, host.root);
              host.currentNode = host.root;
              host.fen = fen;
              host.tags = updateFenTag(host.tags, fen);
              if (!host.isFenMode) {
                host.editing = false;
                eventBus.emit("updateMainPath");
              }
              host.selectedPiece = null;
              host.markedPos = null;
              eventBus.emit("updateUI");
              eventBus.emit("save");
              break;
            }
            eventBus.emit("save");
            break;
          }
          case "empty": {
            if (!host.editing) break;
            host.fen = EMPTY_FEN;
            host.selectedPiece = null;
            break;
          }
          case "full":
          case "start": {
            if (!host.editing) break;
            host.fen = DEFAULT_FEN;
            host.selectedPiece = null;
            break;
          }
          case "turn": {
            if (!host.editing) break;
            const parts = host.fen.split(" ");
            while (parts.length < 2) parts.push("w");
            parts[1] = parts[1] === "w" ? "b" : "w";
            host.fen = parts.join(" ");
            break;
          }
          case "flip": {
            eventBus.emit("rotate");
            break;
          }
        }
        emitNodeEval(host);
        eventBus.emit("updateUI");
      },
    );

    eventBus.on<Piece>("clickPieceBTN", (piece) => {
      if (!piece) return;
      if (!host.editing) return;
      if (
        host.selectedPiece &&
        host.selectedPiece.type === piece.type &&
        host.selectedPiece.color === piece.color
      ) {
        host.selectedPiece = null;
      } else {
        host.selectedPiece = piece;
      }
      eventBus.emit("updateUI");
    });

    eventBus.on("exit-edit", () => {
      if (host.isFenMode) return;
      host.editing = false;
      host.selectedPiece = null;
      host.markedPos = null;
      eventBus.emit("updateUI");
    });

    host.stringifyPGN = (root: ChessNode, includeEval = true) =>
      stringifyPGN(root, includeEval);

    eventBus.on("import", () => {
      const modal = new ImportModal(host.plugin.app, host, !isFileHost(host));
      modal.open();
    });

    eventBus.on("export", () => {
      const modal = new ExportModal(
        host.plugin.app,
        host,
        (inclComments, inclEval) =>
          stringifyCurrentBranchPGN(host, inclComments, inclEval),
      );
      modal.open();
    });

    eventBus.on("open-engine-settings", () => {
      const engineModal = new Modal(host.plugin.app);
      let depthValue = host.settings.engineDepth;
      let skillValue = host.settings.engineSkillLevel;
      let showBestMove = host.settings.showEngineBestMove;
      let showPonder = host.settings.showEnginePonder;
      let showEngineAnn = host.settings.showEngineAnnotations;
      let showBoardAnn = host.settings.showBoardAnnotations;

      engineModal.onOpen = () => {
        const { contentEl } = engineModal;
        contentEl.createEl("h3", { text: t("engine.title") });

        contentEl.createEl("label", { text: t("engine.depth") });
        const depthSlider = contentEl.createEl("input", { type: "range" });
        depthSlider.setAttribute("min", "1");
        depthSlider.setAttribute("max", "30");
        depthSlider.setAttribute("step", "1");
        depthSlider.value = String(depthValue);
        const depthLabel = contentEl.createDiv({
          text: String(depthValue),
          cls: "depth-slider-label",
        });
        depthSlider.addEventListener("input", () => {
          depthValue = Number.parseInt(depthSlider.value) || 18;
          depthLabel.textContent = String(depthValue);
        });

        contentEl.createEl("label", { text: t("engine.skillLevel") });
        const skillSlider = contentEl.createEl("input", { type: "range" });
        skillSlider.setAttribute("min", "0");
        skillSlider.setAttribute("max", "20");
        skillSlider.setAttribute("step", "1");
        skillSlider.value = String(skillValue);
        const skillLabel = contentEl.createDiv({
          text: String(skillValue),
          cls: "depth-slider-label",
        });
        skillSlider.addEventListener("input", () => {
          skillValue = Number.parseInt(skillSlider.value) || 20;
          skillLabel.textContent = String(skillValue);
        });

        const bmContainer = contentEl.createDiv("engine-setting-toggle");
        const bmToggle = bmContainer.createEl("input", { type: "checkbox" });
        bmToggle.checked = showBestMove;
        bmContainer.createEl("label", { text: t("engine.showBestMove") });
        bmToggle.addEventListener("change", () => {
          showBestMove = bmToggle.checked;
        });

        const ponderContainer = contentEl.createDiv("engine-setting-toggle");
        const ponderToggle = ponderContainer.createEl("input", {
          type: "checkbox",
        });
        ponderToggle.checked = showPonder;
        ponderContainer.createEl("label", { text: t("engine.showPonder") });
        ponderToggle.addEventListener("change", () => {
          showPonder = ponderToggle.checked;
        });

        const engineAnnContainer = contentEl.createDiv("engine-setting-toggle");
        const engineAnnToggle = engineAnnContainer.createEl("input", {
          type: "checkbox",
        });
        engineAnnToggle.checked = showEngineAnn;
        engineAnnContainer.createEl("label", {
          text: t("engine.showEngineAnnotations"),
        });
        engineAnnToggle.addEventListener("change", () => {
          showEngineAnn = engineAnnToggle.checked;
        });

        const boardAnnContainer = contentEl.createDiv("engine-setting-toggle");
        const boardAnnToggle = boardAnnContainer.createEl("input", {
          type: "checkbox",
        });
        boardAnnToggle.checked = showBoardAnn;
        boardAnnContainer.createEl("label", {
          text: t("engine.showBoardAnnotations"),
        });
        boardAnnToggle.addEventListener("change", () => {
          showBoardAnn = boardAnnToggle.checked;
        });

        const btnContainer = contentEl.createDiv("modal-button-container");
        const okBtn = btnContainer.createEl("button", {
          text: t("confirm.yes"),
          cls: "mod-cta",
        });
        okBtn.addEventListener("click", () => {
          if (depthValue >= 1 && depthValue <= 30) {
            host.settings.engineDepth = depthValue;
          }
          if (skillValue >= 0 && skillValue <= 20) {
            host.settings.engineSkillLevel = skillValue;
          }
          host.settings.showEngineBestMove = showBestMove;
          host.settings.showEnginePonder = showPonder;
          host.settings.showEngineAnnotations = showEngineAnn;
          host.settings.showBoardAnnotations = showBoardAnn;
          void host.plugin.saveSettings();
          host.plugin.refresh();
          engineModal.close();
        });
        const cancelBtn = btnContainer.createEl("button", {
          text: t("confirm.cancel"),
        });
        cancelBtn.addEventListener("click", () => engineModal.close());
      };
      engineModal.onClose = () => {
        (engineModal as { contentEl: HTMLElement }).contentEl.empty();
      };
      engineModal.open();
    });
  },
};

registerFileModule("actions", ActionsModule);
registerBlockModule("actions", ActionsModule);

function updateFenTag(tags: string, newFen: string): string {
  if (tags.includes('[FEN "')) {
    return tags.replace(/\[FEN "[^"]*"\]/, `[FEN "${newFen}"]`);
  }
  return `[FEN "${newFen}"]\n${tags}`;
}

function stringifyPGN(root: ChessNode, includeEval = true): string {
  const nodeBrothers = genNodeBrothers(root);

  function genNodeBrothers(root: ChessNode): Map<ChessNode, ChessNode[]> {
    const map = new Map<ChessNode, ChessNode[]>();
    function dfs(node: ChessNode) {
      if (node.children.length > 1) {
        const [main, ...siblings] = node.children;
        map.set(main, siblings);
      }
      for (const child of node.children) dfs(child);
    }
    dfs(root);
    return map;
  }

  function walk(node: ChessNode, stepNum: number): string {
    let result = "";
    if (node.move) {
      const notation = getSaveNotation(node.move);
      if (node.color === "white") {
        result += `${stepNum}. ${notation}`;
      } else if (node.color === "black") {
        result += `${notation}`;
      }
    }
    if (node.comments?.length) {
      for (const c of node.comments) result += `{${c}}`;
    }
    if (node.annotation) {
      result += `{${ANNOTATION_PREFIX}${node.annotation}}`;
    }
    if (node.shapes?.length) {
      const shapeStr = node.shapes
        .map((s) => s.orig + (s.dest ?? "") + ":" + s.brush)
        .join(",");
      result += `{${SHAPES_PREFIX}${shapeStr}}`;
    }
    if (includeEval && node.eval) {
      const absScore = Math.abs(node.eval.score);
      const evalStr =
        node.eval.scoreType === "mate"
          ? `m${node.eval.score >= 0 ? "+" : "-"}${absScore}`
          : `${node.eval.score >= 0 ? "+" : "-"}${(absScore / 100).toFixed(2)}`;
      let annotation = `%e:${evalStr}`;
      if (node.eval.bestmove) {
        annotation += `,${node.eval.bestmove}`;
        if (node.eval.ponder) annotation += `,${node.eval.ponder}`;
      }
      if (node.glyph) {
        annotation += `,${node.glyph.symbol}`;
      }
      result += `{${annotation}}`;
    }
    const brothers = nodeBrothers.get(node);
    if (brothers?.length) {
      for (const brother of brothers) {
        if (brother.color === "white") {
          result += ` (${walk(brother, stepNum)})`;
        } else if (brother.color === "black") {
          result += ` (${stepNum}. ... ${walk(brother, stepNum)})`;
        }
      }
    }
    if (node.children[0]) {
      const next = node.children[0];
      const nextStepNum = next.color === "white" ? stepNum + 1 : stepNum;
      result += ` ${walk(next, nextStepNum)}`;
    } else if (node.result) {
      result += ` ${node.result}`;
    } else {
      result += " *";
    }
    return result;
  }
  return walk(root, 0);
}

function emitNodeEval(host: IHost) {
  const ev = host.currentNode?.eval;
  if (ev?.bestmove) {
    host.eventBus.emit("engine-result", {
      bestmove: ev.bestmove,
      ponder: ev.ponder,
      score: ev.score,
      depth: ev.depth,
      scoreType: ev.scoreType,
    });
  } else {
    host.eventBus.emit("clear-engine-bestmove");
  }
}

function stringifyCurrentBranchPGN(
  host: IHost,
  includeComments = true,
  includeEval = true,
): string {
  const pathIds: string[] = [];
  let n: ChessNode | null = host.currentNode;
  while (n) {
    pathIds.push(n.id);
    n = n.parentID ? (host.nodeMap.get(n.parentID) ?? null) : null;
  }
  pathIds.reverse();

  let result = "";
  if (host.root.fen !== DEFAULT_FEN) {
    result = `[FEN "${host.root.fen}"]\n\n`;
  }
  let stepNum = 1;
  for (let i = 1; i < pathIds.length; i++) {
    const node = host.nodeMap.get(pathIds[i])!;
    const notation = getSaveNotation(node.move!);
    if (node.color === "white") {
      result += `${stepNum}. ${notation}`;
    } else if (node.color === "black") {
      if (i === 1) {
        result += `${stepNum}... ${notation}`;
      } else {
        result += ` ${notation}`;
      }
      stepNum++;
    }
    if (includeComments && node.comments?.length) {
      for (const c of node.comments) result += `{${c}}`;
    }
    if (node.annotation) {
      result += `{${ANNOTATION_PREFIX}${node.annotation}}`;
    }
    if (node.shapes?.length) {
      const shapeStr = node.shapes
        .map((s) => s.orig + (s.dest ?? "") + ":" + s.brush)
        .join(",");
      result += `{${SHAPES_PREFIX}${shapeStr}}`;
    }
    if (includeEval && node.eval) {
      const absScore = Math.abs(node.eval.score);
      const evalStr =
        node.eval.scoreType === "mate"
          ? `m${node.eval.score >= 0 ? "+" : "-"}${absScore}`
          : `${node.eval.score >= 0 ? "+" : "-"}${(absScore / 100).toFixed(2)}`;
      let annotation = `%e:${evalStr}`;
      if (node.eval.bestmove) {
        annotation += `,${node.eval.bestmove}`;
        if (node.eval.ponder) annotation += `,${node.eval.ponder}`;
      }
      if (node.glyph) {
        annotation += `,${node.glyph.symbol}`;
      }
      result += `{${annotation}}`;
    }
    if (i < pathIds.length - 1) result += " ";
  }
  return result;
}
