import { t } from "../../i18n";
import type { ChessNode, IHost } from "../../types";
import { applyAnnotationToggle } from "../../utils/annotation-glyphs";
import { ConfirmModal } from "../../utils/confirmModal";
import { emitNodeEval } from "../Actions/shared";

const BTN_NAMES = new Set([
  "annotation",
  "remove",
  "removeOtherVariations",
  "promote",
  "moveUp",
  "moveDown",
]);

/** Whether `id` is `root` itself or lives anywhere in its subtree. */
function isInSubtree(root: ChessNode, id: string): boolean {
  if (root.id === id) return true;
  for (const child of root.children) {
    if (isInSubtree(child, id)) return true;
  }
  return false;
}

export const TreeEditModule = {
  init(host: IHost) {
    const eventBus = host.eventBus;

    eventBus.on<{ name: string; payload: unknown; nodeId?: string }>(
      "btn-click",
      async (payload) => {
        if (!payload || !BTN_NAMES.has(payload.name)) return;
        const { name } = payload;
        const data = payload.payload as string;
        // Menu entries may target a specific node (the tree's
        // right-click menu passes the clicked node's id); an absent id
        // falls back to the current node (toolbar menu, commands,
        // keyboard scope).
        const target = payload.nodeId
          ? host.nodeMap.get(payload.nodeId)
          : host.currentNode;
        if (!target) return;
        host.markedPos = null;
        switch (name) {
          case "annotation": {
            applyAnnotationToggle(target, data);
            eventBus.emit("modified", null);
            break;
          }
          case "remove": {
            if (target.id === "node-root") {
              const modal = new ConfirmModal(
                host.plugin.app,
                t("confirm.deleteTitle"),
                t("confirm.deleteMsg"),
                t("confirm.yes"),
                t("confirm.cancel"),
              );
              modal.open();
              if (await modal.promise) {
                target.children = [];
                host.nodeMap.clear();
                host.pathChoices.clear();
                const newRoot: ChessNode = { ...target };
                host.currentNode = newRoot;
                host.nodeMap.set(newRoot.id, newRoot);
                eventBus.emit("updateMainPath");
                eventBus.emit("node-click", newRoot.id);
                eventBus.emit("modified", null);
              }
              break;
            }
            const removeNode = target;
            const parentNode = host.nodeMap.get(removeNode.parentID!);
            // Deleting a subtree can take the current node with it
            // (the right-clicked node need not be current) — fall back
            // to the removed node's parent when the current node lived
            // inside the subtree.
            if (isInSubtree(removeNode, host.currentNode.id)) {
              host.currentNode = parentNode!;
            }
            if (parentNode) {
              const idx = parentNode.children.indexOf(removeNode);
              if (idx !== -1) parentNode.children.splice(idx, 1);
            }
            function deleteSubtree(node: ChessNode) {
              for (const child of node.children) deleteSubtree(child);
              host.nodeMap.delete(node.id);
            }
            deleteSubtree(removeNode);
            host.pathChoices.clear();
            eventBus.emit("updateMainPath");
            eventBus.emit("node-click", host.currentNode.id);
            eventBus.emit("modified", null);
            break;
          }
          case "removeOtherVariations": {
            if (target.id === "node-root" || !target.parentID) break;
            function pruneSubtree(n: ChessNode) {
              for (const child of n.children) pruneSubtree(child);
              host.nodeMap.delete(n.id);
            }
            let child: ChessNode = target;
            let parent: ChessNode | undefined = host.nodeMap.get(
              target.parentID,
            );
            while (parent) {
              const keepId = child.id;
              const removed = parent.children.filter(
                (c: ChessNode) => c.id !== keepId,
              );
              if (removed.length > 0) {
                parent.children = parent.children.filter(
                  (c: ChessNode) => c.id !== keepId,
                );
                for (const r of removed) pruneSubtree(r);
              }
              child = parent;
              parent = parent.parentID
                ? host.nodeMap.get(parent.parentID)
                : undefined;
            }
            // The current node may have lived in a pruned sibling
            // branch — fall back to the kept line's node.
            if (!host.nodeMap.has(host.currentNode.id)) {
              host.currentNode = target;
            }
            host.pathChoices.clear();
            eventBus.emit("updateMainPath");
            eventBus.emit("node-click", host.currentNode.id);
            eventBus.emit("modified", null);
            break;
          }
          case "promote": {
            if (!target.parentID || target.id === "node-root") break;
            let nodeToPromote = target;
            let parent = host.nodeMap.get(target.parentID);
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
              (c) => c.id === nodeToPromote.id,
            );
            if (idx > 0) {
              const item = parent!.children[idx];
              parent!.children = [
                item,
                ...parent!.children.filter((c) => c.id !== item.id),
              ];
              host.pathChoices.clear();
              eventBus.emit("modified", null);
            }
            eventBus.emit("updateMainPath");
            eventBus.emit("updateUI");
            break;
          }
          case "moveUp":
          case "moveDown": {
            const up = name === "moveUp";
            const node = target;
            if (!node.parentID || node.id === "node-root") break;
            let child: ChessNode = node;
            let parent: ChessNode | undefined = host.nodeMap.get(node.parentID);
            while (parent) {
              const idx = parent.children.findIndex((c) => c.id === child.id);
              if (idx === -1) break;
              const targetIdx = up ? idx - 1 : idx + 1;
              if (targetIdx >= 0 && targetIdx < parent.children.length) {
                const [item] = parent.children.splice(idx, 1);
                parent.children.splice(targetIdx, 0, item);
                host.pathChoices.clear();
                eventBus.emit("modified", null);
                break;
              }
              if (!parent.parentID) break;
              child = parent;
              parent = host.nodeMap.get(parent.parentID);
            }
            eventBus.emit("updateMainPath");
            eventBus.emit("updateUI");
            break;
          }
        }
        emitNodeEval(host);
        eventBus.emit("updateUI");
      },
    );
  },
};
