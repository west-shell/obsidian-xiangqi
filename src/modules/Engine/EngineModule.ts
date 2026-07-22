import type { IPGNViewHost, ITreeHost, NodeEval } from "../../types";
import {
  registerPGNViewModule,
  registerTreeModule,
} from "../../core/module-system";
import { engine } from "./Engine";

function initEngine(host: object) {
  const h = host as ITreeHost | IPGNViewHost;
  engine.setPlugin(h.plugin);
  const { eventBus, settings } = h;

  let analyzing = false;
  let pendingNodeId: string | null = null;
  let lastResult: {
    bestmove: string;
    ponder?: string;
    score?: number;
    depth?: number;
    scoreType?: "cp" | "mate";
  } | null = null;

  function applyOptions() {
    engine.postCommand(
      `setoption name Skill Level value ${settings.engineSkillLevel}`,
    );
    engine.postCommand(`setoption name Ponder value false`);
    engine.postCommand(`setoption name Hash value 16`);
  }

  function toWhiteView(
    score: number,
    scoreType: string | undefined,
    fen: string,
  ): number {
    let s = score;
    if (fen.split(" ")[1] === "b") {
      s = -s;
    }
    if (scoreType === "mate" && s === 0) {
      s = fen.split(" ")[1] === "w" ? -1 : 1;
    }
    return s;
  }

  eventBus.on<import("../../chess").Move>("runmove", (move) => {
    if (!move || !lastResult || lastResult.bestmove === "(none)") return;
    const moveUci = move.from + move.to;
    if (moveUci === lastResult.bestmove.slice(0, 4)) {
      if (lastResult.ponder) {
        const ponderMove = lastResult.ponder;
        lastResult = {
          bestmove: ponderMove,
          score: lastResult.score,
          depth: lastResult.depth,
          scoreType: lastResult.scoreType,
        };
        eventBus.emit("engine-result", lastResult);
      } else {
        lastResult = null;
        eventBus.emit("engine-result", null);
      }
    } else {
      lastResult = null;
      eventBus.emit("engine-result", null);
    }
  });

  eventBus.on("engine-analyze", async () => {
    const nodeId = h.currentNode.id;
    if (analyzing) {
      pendingNodeId = nodeId;
      engine.stop();
      return;
    }
    const node = h.nodeMap.get(nodeId);
    if (!node) return;
    if (node.eval && node.eval.depth >= settings.engineDepth) return;
    analyzing = true;
    eventBus.emit("engine-busy");
    try {
      await engine.ensureReady();
      applyOptions();
      const result = await engine.analyze(node.fen, settings.engineDepth);
      if (result && result.score != null) {
        const score = toWhiteView(result.score, result.scoreType, node.fen);
        const nodeEval: NodeEval = {
          score,
          scoreType: result.scoreType ?? "cp",
          depth: result.depth ?? 0,
          bestmove: result.bestmove !== "(none)" ? result.bestmove : undefined,
          ponder: result.ponder,
        };
        node.eval = nodeEval;
        if (h.currentNode.id === nodeId) {
          h.currentNode = node;
        }
        lastResult = result;
        eventBus.emit("engine-result", result);
        if (settings.saveEvalPrompt || settings.saveEvalByDefault) {
          h.eventBus.emit("modified", null);
        }
        h.eventBus.emit("updateUI");
        return;
      }
      eventBus.emit("engine-result", result);
    } catch (err) {
      console.error("[Engine] analysis failed:", err);
      if (pendingNodeId) {
        const next = pendingNodeId;
        pendingNodeId = null;
        analyzing = false;
        eventBus.emit("engine-analyze");
        return;
      }
      eventBus.emit("engine-result", null);
    } finally {
      analyzing = false;
      if (pendingNodeId) {
        const next = pendingNodeId;
        pendingNodeId = null;
        eventBus.emit("engine-analyze");
      }
    }
  });

  eventBus.on("engine-analyze-batch", async () => {
    if (analyzing) return;
    analyzing = true;
    eventBus.emit("engine-busy");
    try {
      await engine.ensureReady();
      applyOptions();
      const queue: string[] = [];
      const nodeMap = h.nodeMap;
      for (const [, node] of nodeMap) {
        if (!node.eval || node.eval.depth < settings.engineDepth) {
          queue.push(node.id);
        }
      }
      for (const nodeId of queue) {
        const node = nodeMap.get(nodeId);
        if (!node) continue;
        try {
          const result = await engine.analyze(node.fen, settings.engineDepth);
          if (result && result.score != null) {
            const score = toWhiteView(result.score, result.scoreType, node.fen);
            node.eval = {
              score,
              scoreType: result.scoreType ?? "cp",
              depth: result.depth ?? 0,
              bestmove:
                result.bestmove !== "(none)" ? result.bestmove : undefined,
              ponder: result.ponder,
            };
          }
        } catch {
          break;
        }
      }
      const currentNodeEval = h.currentNode?.eval;
      if (currentNodeEval?.bestmove) {
        h.eventBus.emit("engine-result", {
          bestmove: currentNodeEval.bestmove,
          ponder: currentNodeEval.ponder,
          score: currentNodeEval.score,
          depth: currentNodeEval.depth,
          scoreType: currentNodeEval.scoreType,
        });
      } else {
        h.eventBus.emit("clear-engine-bestmove");
      }
      if (settings.saveEvalPrompt || settings.saveEvalByDefault) {
        h.eventBus.emit("modified", null);
      }
      h.eventBus.emit("updateUI");
      h.eventBus.emit("engine-batch-done");
    } finally {
      analyzing = false;
    }
  });

  eventBus.on("engine-stop", () => {
    engine.stop();
    analyzing = false;
    pendingNodeId = null;
    lastResult = null;
  });

  eventBus.on("clear-engine-bestmove", () => {
    lastResult = null;
  });

  eventBus.on("unload", () => {
    engine.terminate();
  });

  return {
    destroy() {
      engine.terminate();
    },
  };
}

registerTreeModule("engine", { init: initEngine });
registerPGNViewModule("engine", { init: initEngine });
