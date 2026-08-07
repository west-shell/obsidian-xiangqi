import { type Move, type Piece } from "../../chess";
import {
  registerPGNViewModule,
  registerTreeModule,
} from "../../core/module-system";
import { t } from "../../i18n";
import type { ChessNode, ITreeHost } from "../../types";
import { DEFAULT_FEN } from "../../types";
import { ConfirmModal } from "../../utils/confirmModal";

const ActionsModule = {
  init(host: ITreeHost) {
    const eventBus = host.eventBus;

    eventBus.on("updateMainPath", () => {
      const { currentNode, nodeMap } = host;
      if (!currentNode) {
        host.currentPath = [];
        return;
      }

      // 先向上遍历收集祖先节点（包括当前节点）
      const ancestors: string[] = [];
      let node: ChessNode | null = currentNode; // 明确允许 null
      while (node) {
        ancestors.push(node.id);
        if (node.parentID) {
          const parent = nodeMap.get(node.parentID);
          node = parent ?? null;
        } else {
          node = null;
        }
      }
      ancestors.reverse(); // 反转为根到当前节点顺序

      // 向下遍历主线子节点（跳过当前节点）
      const descendants: string[] = [];
      node = currentNode.children?.[0] || null;
      while (node) {
        descendants.push(node.id);
        node = node.children?.[0] || null;
      }

      // 合并路径
      host.currentPath = [...ancestors, ...descendants];
    });

    eventBus.on<Move>("runmove", (move) => {
      if (!move) return;
      const { from, to } = move;
      const currentNode = host.currentNode;
      for (let node of currentNode.children) {
        if (node.move && node.move.from === from && node.move.to === to) {
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
        side: move.color === "w" ? "white" : "black",
        parentID: host.currentNode.id,
        children: [],
        mainID: null,
        comments: [],
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
        eventBus.emit("slider-navigate", nodeId);
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

    eventBus.on<{ name: string; payload: string }>(
      "btn-click",
      async (payload) => {
        if (!payload) return;
        host.markedPos = null;
        const { name, payload: data } = payload;
        switch (name) {
          case "annotation": {
            if (!host.currentNode) break;
            const node = host.currentNode;
            node.comments ??= [];
            const ALL_ANNOTATIONS = [
              "W+",
              "B+",
              "=",
              "?",
              "!",
              "1-0",
              "0-1",
              "1/2-1/2",
            ];
            if (ALL_ANNOTATIONS.includes(data)) {
              const idx = node.comments.indexOf(data);
              if (idx !== -1) node.comments.splice(idx, 1);
              else {
                node.comments = node.comments.filter(
                  (c: string) => !ALL_ANNOTATIONS.includes(c),
                );
                node.comments.push(data);
              }
            }
            break;
          }
          case "remove": {
            if (host.currentNode.id === "node-root") {
              const modal = new ConfirmModal(
                host.plugin.app,
                t("confirm.deleteTitle"),
                t("confirm.deleteMsg"),
                t("confirm.saveBtn"),
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
            host.fen = host.currentNode.fen;
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
            for (const child of parent!.children) child.mainID = null;
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
          case "toEnd":
            host.currentNode = host.nodeMap.get(
              host.currentPath[host.currentPath.length - 1],
            )!;
            host.fen = host.currentNode.fen;
            break;
          case "openPikafish": {
            const fen = host.root.fen;
            const movesOnPath: string[] = [];
            for (let i = 1; i < host.currentPath.length; i++) {
              const node = host.nodeMap.get(host.currentPath[i]);
              if (node?.move?.iccs)
                movesOnPath.push(
                  node.move.iccs.replace(/-/g, "").toLowerCase(),
                );
            }
            window.open(
              `https://xiangqiai.com/#/${fen} moves ${movesOnPath.join("")}`,
            );
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
          case "reset": {
            eventBus.emit("reset");
            break;
          }
          case "save": {
            if (host.editing) {
              const fen = host.fen;
              host.currentNode.children = [];
              host.nodeMap.clear();
              host.currentNode = { ...host.currentNode, fen };
              host.nodeMap.set(host.currentNode.id, host.currentNode);
              host.fen = fen;
              host.editing = false;
              host.selectedPiece = null;
              host.markedPos = null;
              eventBus.emit("updateMainPath");
              eventBus.emit("modified", null);
              eventBus.emit("updateUI");
              break;
            }
            eventBus.emit("save");
            break;
          }
          case "empty": {
            if (!host.editing) break;
            host.fen = "4k4/9/9/9/9/9/9/9/9/4K4 w - - 0 1";
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
      host.editing = false;
      host.selectedPiece = null;
      host.markedPos = null;
      eventBus.emit("updateUI");
    });

    eventBus.on("saveFen", () => {
      if (!host.editing) return;
      const fen = host.fen;
      host.currentNode.children = [];
      host.nodeMap.clear();
      host.currentNode = { ...host.currentNode, fen };
      host.nodeMap.set(host.currentNode.id, host.currentNode);
      host.fen = fen;
      host.editing = false;
      host.selectedPiece = null;
      host.markedPos = null;
      eventBus.emit("updateMainPath");
      eventBus.emit("modified", null);
      eventBus.emit("updateUI");
    });

    host.stringifyPGN = (root: ChessNode, includeEval = true) =>
      stringifyPGN(root, includeEval);
  },
};

registerPGNViewModule("actions", ActionsModule);
registerTreeModule("actions", ActionsModule);

export function stringifyPGN(root: ChessNode, includeEval = true): string {
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
    if (node.side === "white") result += `${stepNum}. ${node.move!.iccs}`;
    else if (node.side === "black") result += `${node.move!.iccs}`;
    if (node.comments?.length) {
      for (const c of node.comments) result += `{${c}}`;
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
      result += `{${annotation}}`;
    }
    const brothers = nodeBrothers.get(node);
    if (brothers?.length) {
      for (const brother of brothers) {
        if (brother.side === "white") result += ` (${walk(brother, stepNum)})`;
        else result += ` (${stepNum}. ... ${walk(brother, stepNum)})`;
      }
    }
    if (node.children[0]) {
      const next = node.children[0];
      result += ` ${walk(next, next.side === "white" ? stepNum + 1 : stepNum)}`;
    }
    return result;
  }
  return walk(root, 0);
}

function emitNodeEval(host: ITreeHost) {
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
