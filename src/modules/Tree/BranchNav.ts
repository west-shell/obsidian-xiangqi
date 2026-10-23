import {
  registerBlockModule,
  registerFileModule,
} from "../../core/module-system";
import type { ChessNode, IHost } from "../../types";
import { NAV_ACTIONS } from "../../utils/nav-actions";
import {
  branchStepDirection,
  currentVariation,
  enumerateVariations,
  findForkAbove,
  findForkBelow,
  firstForkOnPath,
  nearestBranchStart,
  nodeDepth,
  orderedBranchStarts,
  orderedTips,
  renderedTip,
  samePlyNodes,
} from "./Actions/branch-nav";
import { emitNodeEval } from "./Actions/shared";

const BTN_NAMES = new Set(NAV_ACTIONS.map((a) => a.action));

const BranchNavModule = {
  init(host: IHost) {
    const eventBus = host.eventBus;

    eventBus.on<{ name: string; payload: unknown }>("btn-click", (payload) => {
      if (!payload || !BTN_NAMES.has(payload.name)) return;
      host.markedPos = null;
      const { name } = payload;
      switch (name) {
        // Ctrl+Up / Ctrl+Down: jump the current node to the previous /
        // next fork (a node with more than one child) along the line.
        // The downward walk follows the rendered path: it never enters
        // branches hidden by folding.
        case "navPrevFork": {
          const fork = findForkAbove(host.currentNode, host.nodeMap);
          if (fork) eventBus.emit("node-click", fork.id);
          break;
        }
        case "navNextFork": {
          const fork = findForkBelow(
            host.currentNode,
            host.pathChoices,
            host.foldedNodes ?? new Set<string>(),
          );
          if (fork) eventBus.emit("node-click", fork.id);
          break;
        }
        // Ctrl+Left / Ctrl+Right: keep the current node in place and
        // switch the displayed path's branch at the first unfolded fork
        // on the rendered path at or below the current node (folded
        // forks are skipped). The index step follows the fork's depth
        // parity: odd-layer forks stack branches to the right of the
        // trunk, even-layer forks to its left.
        case "prevPathBranch":
        case "nextPathBranch": {
          const hit = firstForkOnPath(
            host.currentNode,
            host.pathChoices,
            host.foldedNodes ?? new Set<string>(),
          );
          if (!hit) break;
          const step = branchStepDirection(
            hit.fork,
            host.nodeMap,
            name === "nextPathBranch",
          );
          const count = hit.fork.children.length;
          const target = (hit.branchIndex + step + count) % count;
          host.pathChoices.set(hit.fork.id, target);
          eventBus.emit("updateMainPath");
          break;
        }
        // Ctrl+Alt+Shift+Left / Ctrl+Alt+Shift+Right: cycle through every
        // rendered variation below the current node (the node itself
        // included), wrapping around at the ends. Branches hidden by
        // folding are skipped.
        case "prevAllBranches":
        case "nextAllBranches": {
          const variations = enumerateVariations(
            host.currentNode,
            host.foldedNodes ?? new Set<string>(),
          );
          if (variations.length < 2) break;
          const current = currentVariation(
            host.currentNode,
            host.pathChoices,
            host.foldedNodes ?? new Set<string>(),
          );
          const pos = Math.max(
            0,
            variations.findIndex(
              (v) =>
                v.length === current.length &&
                v.every((x, i) => x === current[i]),
            ),
          );
          const step = name === "nextAllBranches" ? 1 : -1;
          const target = (pos + step + variations.length) % variations.length;
          let cur: ChessNode = host.currentNode;
          for (const idx of variations[target]) {
            if (cur.children.length > 1) host.pathChoices.set(cur.id, idx);
            cur = cur.children[idx];
          }
          eventBus.emit("updateMainPath");
          break;
        }
        // Alt+Left / Alt+Right: cycle the current position through every
        // visible branch's node at the same ply depth (the current node
        // included, wrapping). Branches too short to reach the depth have
        // no node there; branches hidden by folding are skipped — neither
        // cycles.
        case "prevSamePly":
        case "nextSamePly": {
          const depth = nodeDepth(host.currentNode, host.nodeMap);
          const nodes = samePlyNodes(
            host.root,
            depth,
            host.foldedNodes ?? new Set<string>(),
          );
          const pos = nodes.findIndex((n) => n.id === host.currentNode.id);
          if (pos === -1 || nodes.length < 2) break;
          const step = name === "nextSamePly" ? 1 : -1;
          eventBus.emit(
            "node-click",
            nodes[(pos + step + nodes.length) % nodes.length].id,
          );
          break;
        }
        // Alt+Shift+Left / Alt+Shift+Right: jump between the ends of
        // every visible branch (rendered line tips), wrapping. The
        // anchor is the current line's own visible tip, so the
        // shortcut always lands on a different branch end; branch
        // ends hidden by folding are skipped.
        case "prevBranchEnd":
        case "nextBranchEnd": {
          const folded = host.foldedNodes ?? new Set<string>();
          const tips = orderedTips(host.root, folded);
          if (tips.length === 0) break;
          const anchor = renderedTip(
            host.currentNode,
            host.pathChoices,
            folded,
          );
          const pos = tips.findIndex((t) => t.id === anchor.id);
          if (tips.length < 2 && pos !== -1) break;
          const next = name === "nextBranchEnd";
          const target =
            pos === -1
              ? next
                ? tips[0]
                : tips[tips.length - 1]
              : tips[(pos + (next ? 1 : -1) + tips.length) % tips.length];
          eventBus.emit("node-click", target.id);
          break;
        }
        // Ctrl+Shift+Left / Ctrl+Shift+Right: cycle between the first
        // steps of every visible branch (the main line's first move
        // plus each unfolded fork's extra children), wrapping. The
        // anchor is the first step of the branch the current line
        // belongs to, so the shortcut always lands on a different
        // branch start; branch starts hidden by folding are skipped.
        case "prevBranchStart":
        case "nextBranchStart": {
          const folded = host.foldedNodes ?? new Set<string>();
          const starts = orderedBranchStarts(host.root, folded);
          if (starts.length === 0) break;
          const anchor = nearestBranchStart(
            host.currentNode,
            starts,
            host.nodeMap,
          );
          const pos = anchor ? starts.findIndex((s) => s.id === anchor.id) : -1;
          if (starts.length < 2 && pos !== -1) break;
          const next = name === "nextBranchStart";
          const target =
            pos === -1
              ? next
                ? starts[0]
                : starts[starts.length - 1]
              : starts[(pos + (next ? 1 : -1) + starts.length) % starts.length];
          eventBus.emit("node-click", target.id);
          break;
        }
      }
      emitNodeEval(host);
      eventBus.emit("updateUI");
    });
  },
};

registerFileModule("branchNav", BranchNavModule);
registerBlockModule("branchNav", BranchNavModule);
