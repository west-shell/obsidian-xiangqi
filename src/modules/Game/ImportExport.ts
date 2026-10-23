import { DEFAULT_FEN, getSaveNotation } from "../../chess";
import type { ChessNode, IHost } from "../../types";
import { promptExport } from "../Export";
import {
  getFullmoveFromFen,
  serializeNodeMeta,
  stringifyPGN,
} from "./Actions/stringify-pgn";
import { ImportModal } from "./ImportModal";
import { isFileHost } from "./Actions/shared";

export const ImportExportModule = {
  init(host: IHost) {
    const eventBus = host.eventBus;

    host.stringifyPGN = (root: ChessNode, includeEval = true) =>
      stringifyPGN(
        root,
        includeEval,
        host.settings.annotationFormat ?? "suffix",
      );

    eventBus.on("import", () => {
      const modal = new ImportModal(host.plugin.app, host, !isFileHost(host));
      modal.open();
    });

    eventBus.on("export", () => {
      promptExport(host, (inclComments, inclEval) =>
        stringifyCurrentBranchPGN(host, inclComments, inclEval),
      );
    });
  },
};

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
    result = `[FEN "${host.root.fen}"]\n[SetUp "1"]\n\n`;
  }
  // Numbering follows the root FEN's fullmove so a mid-game branch copies
  // as "14. ..." / "14... " instead of restarting at 1.
  let stepNum = getFullmoveFromFen(host.root.fen);
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
    result += serializeNodeMeta(node, {
      includeComments,
      includeEval,
      annotationFormat: host.settings.annotationFormat ?? "suffix",
    });
    if (i < pathIds.length - 1) result += " ";
  }
  return result;
}
