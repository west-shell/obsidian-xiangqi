import {
  registerBlockModule,
  registerFileModule,
} from "../../core/module-system";
import { t } from "../../i18n";
import type { ChessNode, IHost } from "../../types";
import { applyAnnotationToggle } from "../../utils/annotation-glyphs";
import { ConfirmModal } from "../../utils/confirmModal";
import { emitNodeEval } from "./Actions/shared";

const BTN_NAMES = new Set([
  "annotation",
  "remove",
  "removeOtherVariations",
  "promote",
  "moveUp",
  "moveDown",
]);

const TreeEditModule = {
  init(host: IHost) {
    const eventBus = host.eventBus;

    eventBus.on<{ name: string; payload: unknown }>(
      "btn-click",
      async (payload) => {
        if (!payload || !BTN_NAMES.has(payload.name)) return;
        host.markedPos = null;
        const { name } = payload;
        const data = payload.payload as string;
        switch (name) {
          case "annotation": {
            if (!host.currentNode) break;
            applyAnnotationToggle(host.currentNode, data);
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
                host.pathChoices.clear();
                host.currentNode = { ...host.currentNode };
                host.nodeMap.set(host.currentNode.id, host.currentNode);
                eventBus.emit("updateMainPath");
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
            host.pathChoices.clear();
            eventBus.emit("updateMainPath");
            eventBus.emit("node-click", host.currentNode.id);
            eventBus.emit("modified", null);
            break;
          }
          case "removeOtherVariations": {
            const node = host.currentNode;
            if (node.id === "node-root" || !node.parentID) break;
            function pruneSubtree(n: ChessNode) {
              for (const child of n.children) pruneSubtree(child);
              host.nodeMap.delete(n.id);
            }
            let child: ChessNode = node;
            let parent: ChessNode | undefined = host.nodeMap.get(node.parentID);
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
            host.pathChoices.clear();
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
            const node = host.currentNode;
            if (!node.parentID || node.id === "node-root") break;
            let child: ChessNode = node;
            let parent: ChessNode | undefined = host.nodeMap.get(node.parentID);
            while (parent) {
              const idx = parent.children.findIndex(
                (c: ChessNode) => c.id === child.id,
              );
              if (idx === -1) break;
              const target = up ? idx - 1 : idx + 1;
              if (target >= 0 && target < parent.children.length) {
                const [item] = parent.children.splice(idx, 1);
                parent.children.splice(target, 0, item);
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

registerFileModule("treeEdit", TreeEditModule);
registerBlockModule("treeEdit", TreeEditModule);
