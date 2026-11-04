<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type { ChessNode, ISettings } from "../../../types";
  import { CLS_PREFIX, DEFAULT_FEN, type Square } from "../../../chess";
  import { onLangChange, t } from "../../../i18n";
  import { isGhostNode } from "../../../modules/Engine/ghost-lines";
  import PreviewBoard from "./PreviewBoard.svelte";

  interface Props {
    settings?: ISettings;
  }

  let { settings }: Props = $props();

  let _lv = $state(0);
  const unsubLang = onLangChange(() => _lv++);

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
  // Element the preview was opened from (tree node / comment block /
  // move-list item). The document-level mouseover safety net below uses
  // it to detect "the pointer is no longer over the source" even when
  // the source's own mouseleave never fired (SVG elements moving or
  // re-rendering under a stationary pointer don't trigger it).
  let previewAnchor: Element | null = null;
  let previewFen = $derived(previewNode?.fen ?? DEFAULT_FEN);
  let previewAnimateFrom = $derived(previewNode?.move?.before ?? null);
  let previewLastMove = $derived.by(() => {
    const m = previewNode?.move;
    return m ? ([m.from, m.to] as [Square, Square]) : null;
  });
  let previewOrientation: "white" | "black" = $derived(
    settings?.rotated ? "black" : "white",
  );

  // Ghost nodes (engine candidate lines) keep no native <title> tooltip —
  // it floats on a fixed spot near the cursor and covers this preview
  // board. The insert hint renders as a caption inside the preview instead.
  let previewIsGhost = $derived(
    previewNode !== null && isGhostNode(previewNode),
  );

  onDestroy(() => {
    unsubLang();
    activeDocument.removeEventListener("mouseover", onDocMouseOver);
  });

  function supportsHover(): boolean {
    return activeWindow.matchMedia?.("(hover: hover)").matches ?? true;
  }

  // Safety net for missed mouseleaves: mouseleave is the only thing that
  // hides the preview, but it never fires when the hovered element moves
  // away or unmounts under a stationary pointer (SVG re-layouts do this).
  // Any mouseover landing outside the anchor element hides the preview;
  // normal mouseleave handlers simply run first in the common case.
  function onDocMouseOver(e: MouseEvent): void {
    if (!previewNode || !previewAnchor) return;
    const target = e.target as Node | null;
    if (target && previewAnchor.contains(target)) return;
    previewNode = null;
  }

  onMount(() => {
    activeDocument.addEventListener("mouseover", onDocMouseOver);
  });

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

  // One shared switch covers all hover previews; the side only decides
  // the positioning origin ("left" = move list, "right" = tree nodes,
  // "block" = pinned comment block, anchored beside the block's rect so
  // the preview never covers it).
  export function showNode(
    node: ChessNode,
    evt: MouseEvent,
    side: "left" | "right" | "block" = "right",
  ) {
    if (settings?.showPreview === false) return;
    if (!supportsHover()) return;
    previewNode = node;
    previewAnchor = (evt.currentTarget as Element | null) ?? null;
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

  function updatePreviewPos(
    evt: MouseEvent,
    side: "left" | "right" | "block" = "right",
  ) {
    // Viewport (fixed-position) coordinates: the preview follows the cursor
    // anywhere in the window, dodging it on both axes — horizontally flip
    // right→left when the right side overflows, vertically fall back to
    // below→above the cursor when the centered position would not fit —
    // and only clamps against the viewport itself as a last resort.
    const view = evt.view ?? activeWindow;
    const maxX = Math.max(4, view.innerWidth - TREE_PREVIEW_SIZE - 8);
    const maxY = Math.max(4, view.innerHeight - TREE_PREVIEW_SIZE - 8);
    const half = TREE_PREVIEW_SIZE / 2;
    let x: number;
    if (side === "block") {
      // Comment-block hovers: anchor to the block's own bounding rect —
      // beside the WHOLE block (flip on overflow), vertically centered on
      // it — so the preview never covers the block and holds still while
      // the pointer moves within it.
      const rect = (
        evt.currentTarget as Element | null
      )?.getBoundingClientRect();
      const r = rect ?? new DOMRect(evt.clientX, evt.clientY, 0, 0);
      const rightX = r.right + 14;
      x = Math.min(
        rightX <= maxX ? rightX : Math.max(r.left - TREE_PREVIEW_SIZE - 14, 4),
        maxX,
      );
      const cy = r.top + r.height / 2;
      previewPos = {
        x,
        y: Math.min(Math.max(cy - half, 4), maxY),
      };
      return;
    }
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
    {#if previewIsGhost}
      <div class="{CLS_PREFIX}-tree-preview__hint">
        {t("tree.ghostHint", _lv)}
      </div>
    {/if}
  </div>
{/if}
