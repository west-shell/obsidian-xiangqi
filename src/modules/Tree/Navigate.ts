import {
  getAutoResult,
  isMoveCheckmate,
  matchMove,
  type Move,
} from "../../chess";
import type { ChessNode, IHost } from "../../types";
import { extractHeaders } from "../Source/parse";
import { pathChild } from "./Actions/branch-nav";
import { branchTip, migrateBranchResult } from "./Actions/result";
import { emitNodeEval } from "./Actions/shared";

const BTN_NAMES = new Set([
  "toStart",
  "back",
  "next",
  "toEnd",
  "open-analysis",
]);

export const NavigateModule = {
  init(host: IHost) {
    const eventBus = host.eventBus;

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
      node = pathChild(currentNode, host.pathChoices);
      while (node) {
        descendants.push(node.id);
        node = pathChild(node, host.pathChoices);
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
      // A branch result follows the branch tip: extending the line
      // carries the result along; a new variation (second child) never
      // inherits the sibling line's result.
      migrateBranchResult(host.currentNode, newNode);
      // A mating/stalemating move ends the game: store the position's
      // forced result on the new tip so the move list updates at once.
      const autoResult = getAutoResult(move.after);
      if (autoResult) {
        newNode.result = autoResult;
        if (branchTip(host.root) === newNode) {
          syncResultTag(host, autoResult);
        }
      }
      host.currentNode = newNode;
      host.fen = move.after;
      host.currentStep++;
      emitNodeEval(host);
      eventBus.emit("updateMainPath");
      eventBus.emit("updateUI");
      eventBus.emit("modified", null);
    });

    // Result toolbar: set or clear the current branch's result on its
    // tip node. Results live per branch (node.result on the line's tip)
    // and are never set through the [Result] header tag.
    eventBus.on<string>("set-result", (result) => {
      if (result === undefined) return;
      const tip = branchTip(host.currentNode);
      // A terminal position (checkmate/stalemate) locks the branch
      // result to the game-forced value.
      if (getAutoResult(tip.fen)) return;
      if (result === "") {
        if (!tip.result) return;
        tip.result = undefined;
      } else {
        if (tip.result === result) return;
        tip.result = result;
      }
      // Keep the [Result] header in step with the mainline terminator
      // (the parser re-derives the tag from it on load); variation
      // results never touch the header.
      if (tip === branchTip(host.root)) {
        syncResultTag(host, result);
      }
      eventBus.emit("modified", null);
      eventBus.emit("updateUI");
    });

    eventBus.on<string>("node-click", (id) => {
      if (!id) return;
      host.markedPos = null;
      host.currentNode = host.nodeMap.get(id)!;
      host.fen = host.currentNode.fen;
      emitNodeEval(host);
      if (!host.currentPath.includes(id)) {
        host.eventBus.emit("updateMainPath");
      }
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

    eventBus.on<{ name: string; payload: unknown }>("btn-click", (payload) => {
      if (!payload || !BTN_NAMES.has(payload.name)) return;
      host.markedPos = null;
      const { name } = payload;
      const data = payload.payload as string;
      switch (name) {
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
        case "open-analysis": {
          const buildUrl = data as unknown as (h: IHost) => string;
          if (!host.fen) break;
          activeWindow.open(buildUrl(host));
          break;
        }
      }
      emitNodeEval(host);
      eventBus.emit("updateUI");
    });
  },
};

// Rewrite the [Result] header tag to match the mainline's result. The
// tag is display/export metadata only — results are set per branch
// (node.result via the result toolbar), never through this tag.
function syncResultTag(host: IHost, result: string): void {
  const value = result || "*";
  const tags = host.tags ?? "";
  if (/\[Result\s+"[^"]*"\]/.test(tags)) {
    host.tags = tags.replace(/\[Result\s+"[^"]*"\]/, `[Result "${value}"]`);
  } else if (result) {
    host.tags = tags ? `${tags}\n[Result "${result}"]` : `[Result "${result}"]`;
  }
  const slot = host.games[host.currentGameIndex];
  if (slot) {
    slot.headers = extractHeaders(host.tags);
    if (slot.parsed) slot.parsed.tags = host.tags;
  }
}
