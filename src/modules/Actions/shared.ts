import type { IFileHost, IHost } from "../../types";

export function isFileHost(h: IHost): h is IFileHost {
  return "saveFile" in h && typeof (h as IFileHost).saveFile === "function";
}

// Re-emit the current node's stored eval (if any) so the board shows the
// engine arrow after every position change; otherwise clear it.
export function emitNodeEval(host: IHost) {
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
