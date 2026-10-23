<script lang="ts">
  import type { ChessNode, ISettings } from "../../../types";
  import { CLS_PREFIX, DEFAULT_FEN, type Square } from "../../../chess";
  import PreviewBoard from "./PreviewBoard.svelte";

  interface Props {
    settings?: ISettings;
  }

  let { settings }: Props = $props();

  // ---- Tree node hover preview ----
  // lila-style pv-board: hovering a node in the tree graph shows a mini
  // board with the position after that node's move. The board mounts on
  // first hover and stays mounted afterwards (visibility instead of
  // display) so chessground keeps valid bounds. The animation plays the
  // hovered move itself: PreviewBoard jumps to the move's `before` fen
  // and animates to `after` (chessground slides the moved piece), instead
  // of morphing from whatever position the board last showed.
  const TREE_PREVIEW_SIZE = 150;
  let previewEverShown = $state(false);
  let previewNode = $state<ChessNode | null>(null);
  let previewPos = $state({ x: 8, y: 8 });
  let previewFen = $derived(previewNode?.fen ?? DEFAULT_FEN);
  let previewAnimateFrom = $derived(previewNode?.move?.before ?? null);
  let previewLastMove = $derived.by(() => {
    const m = previewNode?.move;
    return m ? ([m.from, m.to] as [Square, Square]) : null;
  });
  let previewOrientation: "white" | "black" = $derived(
    settings?.rotated ? "black" : "white",
  );

  function supportsHover(): boolean {
    return activeWindow.matchMedia?.("(hover: hover)").matches ?? true;
  }

  // Portals the preview overlay out of the panel into <body> so it floats
  // above the whole window instead of being clipped by the tree canvas.
  // ownerDocument keeps it inside the same document (popout-safe).
  function portalToBody(node: HTMLElement): { destroy: () => void } {
    node.ownerDocument.body.appendChild(node);
    return {
      destroy: () => {
        node.remove();
      },
    };
  }

  // One shared switch covers both hover previews; the side only
  // decides the positioning origin ("left" = move list, "right" = tree).
  export function showNode(
    node: ChessNode,
    evt: MouseEvent,
    side: "left" | "right" = "right",
  ) {
    if (settings?.showPreview === false) return;
    if (!supportsHover()) return;
    previewNode = node;
    previewEverShown = true;
    updatePreviewPos(evt, side);
  }

  // Leaving a node hides the preview right away; the cached position
  // stays, so hovering the next node still animates from it. The guard
  // keeps the preview visible when the pointer moves straight onto
  // another node (its enter may fire before the old node's leave).
  export function hideNode(node: ChessNode) {
    if (previewNode === node) previewNode = null;
  }

  // Container-level safety net: leaving the whole hover area (tree SVG,
  // move list) hides the preview even if a node's mouseleave was missed.
  export function hideAll() {
    previewNode = null;
  }

  function updatePreviewPos(evt: MouseEvent, side: "left" | "right" = "right") {
    // Viewport (fixed-position) coordinates: the preview follows the cursor
    // anywhere in the window, dodging it on both axes — horizontally flip
    // right→left when the right side overflows, vertically fall back to
    // below→above the cursor when the centered position would not fit —
    // and only clamps against the viewport itself as a last resort.
    const view = evt.view ?? activeWindow;
    const maxX = Math.max(4, view.innerWidth - TREE_PREVIEW_SIZE - 8);
    const maxY = Math.max(4, view.innerHeight - TREE_PREVIEW_SIZE - 8);
    let x: number;
    if (side === "left") {
      // Move-list hovers: anchor to the hovered element's left edge so
      // the preview clears the whole list column instead of covering
      // the hovered move.
      const anchor =
        (evt.currentTarget as HTMLElement | null)?.getBoundingClientRect()
          .left ?? evt.clientX;
      x = Math.min(Math.max(anchor - TREE_PREVIEW_SIZE - 8, 4), maxX);
    } else {
      // Tree-graph hovers: prefer the right of the cursor; flip to the
      // left when the right side would be clamped over the cursor.
      const rightX = evt.clientX + 14;
      x = Math.min(
        rightX <= maxX
          ? rightX
          : Math.max(evt.clientX - TREE_PREVIEW_SIZE - 14, 4),
        maxX,
      );
    }
    const cy = evt.clientY;
    const half = TREE_PREVIEW_SIZE / 2;
    const y =
      cy - half >= 4 && cy + half <= view.innerHeight - 8
        ? cy - half
        : cy + 14 + TREE_PREVIEW_SIZE <= view.innerHeight - 8
          ? cy + 14
          : Math.min(Math.max(cy - TREE_PREVIEW_SIZE - 14, 4), maxY);
    previewPos = { x, y };
  }
</script>

{#if previewEverShown}
  <div
    class="{CLS_PREFIX}-tree-preview{previewNode
      ? ''
      : ` ${CLS_PREFIX}-tree-preview--hidden`}"
    style="--tree-preview-x: {previewPos.x}px; --tree-preview-y: {previewPos.y}px"
    use:portalToBody
  >
    <PreviewBoard
      fen={previewFen}
      animateFrom={previewAnimateFrom}
      lastMove={previewLastMove}
      orientation={previewOrientation}
    />
  </div>
{/if}
