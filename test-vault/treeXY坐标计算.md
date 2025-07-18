function assignXY(node: XiangqiMoveNode, depth = 0, nextX = { value: 0 }): number {
  node.y = depth;

  if (node.children.length === 0) {
    node.x = nextX.value++;
    return node.x;
  }

  const childXs = node.children.map((child) => assignXY(child, depth + 1, nextX));
  node.x = (Math.min(...childXs) + Math.max(...childXs)) / 2;

  return node.x;
}
