<script lang="ts">
  import type { Node as Node } from "./types";
  import {
    insertBySide,
    setIndexForChildren,
    findFirstMultiChildDescendant,
    assignY,
  } from "./utils";
  export let root: Node;

  const spacingX = 30;
  const spacingY = 30;
  const padding = 40;
  let nodeArr = [root];
  function calcArr(node: Node) {
    const parent = findFirstMultiChildDescendant(node);
    if (!parent) return;
    parent.children[0].main = true;
    insertBySide(nodeArr, parent.children, node);
    parent.children.forEach((n) => calcArr(n));
  }
  calcArr(root);
  nodeArr = nodeArr.filter((n) => !n.main);
  console.log(nodeArr);
  nodeArr.forEach((node, i) => {
    setIndexForChildren(node, i); // 从每个节点开始递归
  });

  assignY(root);

  // 收集所有节点
  const nodes: Node[] = [];
  function collect(node: Node) {
    nodes.push(node);
    for (const child of node.children) collect(child);
  }
  collect(root);

  // 计算范围和视口
  const allX = nodes.map((n) => n.x!);
  const allY = nodes.map((n) => n.y!);

  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);

  const width = (maxX - minX + 1) * spacingX + padding * 2;
  const height = (maxY - minY + 1) * spacingY + padding * 2;

  const viewBoxX = minX * spacingX - padding;
  const viewBoxY = minY * spacingY - padding;
</script>

<svg
  {width}
  {height}
  viewBox={`${viewBoxX} ${viewBoxY} ${width} ${height}`}
  style="border: 1px solid #ccc;"
>
  <!-- 绘制连接线 -->
  {#each nodes as node}
    {#each node.children as child}
      <line
        x1={node.x! * spacingX - viewBoxX}
        y1={node.y! * spacingY - viewBoxY}
        x2={child.x! * spacingX - viewBoxX}
        y2={child.y! * spacingY - viewBoxY}
        stroke="black"
      />
    {/each}
  {/each}

  <!-- 绘制节点 -->
  {#each nodes as node}
    <g transform="translate({node.x! * spacingX - viewBoxX} {node.y! * spacingY - viewBoxY})">
      <circle
        r="10"
        fill={node.side === "red" ? "red" : node.side === "black" ? "black" : "gray"}
      />
      <text
        dy="5"
        text-anchor="middle"
        fill={node.side === "red" ? "black" : node.side === "black" ? "red" : "gray"}
        font-size="12px"
      >
        {node.move}
      </text>
    </g>
  {/each}
</svg>
