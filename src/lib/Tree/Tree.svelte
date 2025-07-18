<script lang="ts">
  import type { XiangqiMoveNode as Node } from "./types";

  export let root: Node;

  const spacingX = 30;
  const spacingY = 30;
  const padding = 40;

  function assignXY(root: Node): (Node | null)[][] {
    const matrix: (Node | null)[][] = [];

    // 生成器：获取从节点开始的单链序列
    function* getSequence(node: Node): Generator<Node> {
      yield node;
      while (node.children.length === 1) {
        node = node.children[0];
        yield node;
      }
    }

    function placeNode(node: Node, x: number, y: number): void {
      // 确保行存在
      matrix[y] = matrix[y] || [];
      matrix[y][x] = node;
      node.x = x;
      node.y = y;
    }

    function layout(node: Node, x: number, y: number): number {
      const sequence = Array.from(getSequence(node));

      // 垂直放置整个序列（共享同一x坐标）
      for (let dy = 0; dy < sequence.length; dy++) {
        placeNode(sequence[dy], x, y + dy);
      }

      const lastNode = sequence[sequence.length - 1];
      if (lastNode.children.length > 0) {
        // 分叉处理：子节点水平排列
        let childX = x;
        lastNode.children.forEach((child) => {
          childX = layout(child, childX, y + sequence.length);
        });
        return childX; // 返回下一个可用的x位置
      }
      return x + 1; // 无分叉时，右侧留空
    }

    layout(root, 0, 0);
    return matrix;
  }

  assignXY(root);

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
    <circle
      cx={node.x! * spacingX - viewBoxX}
      cy={node.y! * spacingY - viewBoxY}
      r="10"
      fill={node.side === "red" ? "red" : node.side === "black" ? "black" : "gray"}
    />
  {/each}
</svg>
