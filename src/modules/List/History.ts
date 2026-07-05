import type { Move } from "../../chess";
import { registerListModule } from "../../core/module-system";
import type { ChessNode, IListHost } from "../../types";

const HistoryModule = {
  init(host: IListHost) {
    const eventBus = host.eventBus;

    eventBus.on("load", () => {
      host.modified = false;
    });

    eventBus.on("edithistory", (payload?: unknown) => {
      if (!payload || typeof payload !== "object") return;
      editHistory(host, payload as Move);
    });
  },
};

function editHistory(host: IListHost, move: Move) {
  const { currentStep, nodeMap } = host;
  const parentNode =
    currentStep > 0 ? host.history[currentStep - 1] : host.root;

  // 检查父节点下是否已有相同招法
  for (const child of parentNode.children) {
    if (child.move?.from === move.from && child.move?.to === move.to) {
      host.history = [...host.history.slice(0, currentStep), child];
      return;
    }
  }

  // 创建新节点
  const id = `node-list-${nodeMap.size}`;
  const newNode: ChessNode = {
    id,
    fen: move.after,
    move,
    step: parentNode.step! + 1,
    side: move.color === "w" ? "white" : "black",
    parentID: parentNode.id,
    children: [],
    comments: [],
  };
  nodeMap.set(id, newNode);
  parentNode.children.unshift(newNode);

  // 更新 history（截断 + 追加）
  host.history = [...host.history.slice(0, currentStep), newNode];
}

registerListModule("history", HistoryModule);
