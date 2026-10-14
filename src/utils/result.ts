import type { ChessNode } from "../types";

// The tip of a branch: the last node of the line starting at `node`
// (follow the first-child chain). Branch results only serialize from
// leaves, so every branch result lives on its tip — this is also the
// last id of currentPath.
export function branchTip(node: ChessNode): ChessNode {
  let tip = node;
  while (tip.children.length > 0) tip = tip.children[0];
  return tip;
}

// A branch result follows the branch, not the node: appending the tip's
// FIRST child extends the line and carries the result along to the new
// tip. Opening a new variation (a second child) never inherits the
// sibling line's result. Call after the child has been pushed.
export function migrateBranchResult(parent: ChessNode, child: ChessNode): void {
  if (parent.result && parent.children[0] === child) {
    child.result = parent.result;
    parent.result = undefined;
  }
}
