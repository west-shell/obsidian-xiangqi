<script lang="ts">
  import type { XiangqiMoveNode } from "./types";

  export let root: XiangqiMoveNode;

  const spacingX = 60;
  const spacingY = 60;
  const padding = 40;

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

  assignXY(root);

  // 获取所有节点坐标
  const nodes: XiangqiMoveNode[] = [];
  function collect(node: XiangqiMoveNode) {
    nodes.push(node);
    for (const child of node.children) {
      collect(child);
    }
  }
  collect(root);

  // 计算边界
  const allX = nodes.map((n) => n.x!);
  const allY = nodes.map((n) => n.y!);
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);

  const width = (maxX - minX + 1) * spacingX + padding * 2;
  const height = (maxY - minY + 1) * spacingY + padding * 2;
</script>

<svg
  {width}
  {height}
  viewBox="{minX * spacingX - padding} {minY * spacingY - padding} {width} {height}"
  style="border: 1px solid #ccc;"
>
  {#each nodes as node}
    {#each node.children as child}
      <line
        x1={node.x! * spacingX}
        y1={node.y! * spacingY}
        x2={child.x! * spacingX}
        y2={child.y! * spacingY}
        stroke="black"
      />
    {/each}
  {/each}

  {#each nodes as node}
    <circle
      cx={node.x! * spacingX}
      cy={node.y! * spacingY}
      r="10"
      fill={node.side === "red" ? "red" : node.side === "black" ? "black" : "gray"}
    />
  {/each}
</svg>
