import { CLS_PREFIX } from "../chess";

/**
 * Column decision for code-block layouts, driven by the block's own box.
 *
 * The stacked (col1) vs side-by-side (col2) grid for code blocks is chosen by
 * window media queries in style/layout/_layout.scss — which follow the
 * Obsidian window, not the block. Inside a scaled host (an Excalidraw
 * embeddable) that is wrong twice over:
 *
 *   - the host paints the block through `transform: scale(s)`, so resizing
 *     the embeddable never changes the viewport the media queries see — the
 *     layout sticks to whatever the un-scaled box was;
 *   - the host hands the same block different viewports in preview and
 *     interaction mode, so the layout flips the moment the user clicks into
 *     the embed.
 *
 * This tracker measures the block instead: while an ancestor scales it, the
 * on-screen width (getBoundingClientRect) decides; otherwise the layout width
 * (offsetWidth) does — the block's real column, never the window. Both see
 * the same box in every host mode, so the decision no longer depends on
 * whether the user has entered interaction.
 *
 * The result is written as `data-cg-vis="col1"/"col2"` on the layout root;
 * _layout.scss opts col1 layouts out of the window-wide col2 grid. The
 * measured layout width is published as `--cg-block-width` so the stacked
 * tree panel can be bounded to the board height without a size container
 * (layout containment would re-anchor the fixed-position hover preview).
 *
 * File views are not tracked: they pick their layout from the frame
 * container query (utils/viewFrame.ts).
 */

/** Column decision, read by style/layout/_layout.scss. */
const VIS_ATTR = "data-cg-vis";
/** The block's layout width, read by the stacked tree cap in _layout.scss. */
const WIDTH_VAR = "--cg-block-width";
/**
 * Keep in sync with $breakpoint in style/layout/_tokens.scss. The block must
 * stay wide enough that the side-by-side grid still fits a usable board:
 * width − col2 chrome (panel min + toolbar + gaps ≈ 296px) ≥ ~380px.
 */
const BREAKPOINT = 680;
/** Small enough to be invisible, large enough to skip float noise. */
const EPSILON = 0.002;
const MIN_SCALE = 0.02;
const MAX_SCALE = 50;

export interface BlockLayoutHandle {
  /** Measure again and re-apply. Cheap when nothing changed. */
  refresh: () => void;
  destroy: () => void;
}

/**
 * Keep a code-block layout's column decision in sync with the box the user
 * actually sees. Call it once the layout is in the DOM; destroy the handle
 * together with the layout.
 */
export function trackBlockLayout(layout: HTMLElement): BlockLayoutHandle {
  const doc = layout.ownerDocument;
  const win = doc.defaultView ?? window;
  let applied = "";
  let appliedWidth = -1;
  let frame = 0;
  let destroyed = false;

  const refresh = (): void => {
    if (destroyed) return;
    const rect = layout.getBoundingClientRect();
    const layoutWidth = layout.offsetWidth;
    if (!layoutWidth || !rect.width) return;
    const scale = rect.width / layoutWidth;
    if (!Number.isFinite(scale) || scale < MIN_SCALE || scale > MAX_SCALE) {
      return;
    }
    // Scaled host: one layout pixel is not one screen pixel, so decide from
    // the on-screen width — the box the user sees and resizes. Normal host:
    // the layout width is the block's real column (the window media queries
    // would follow the window instead).
    const width = Math.abs(scale - 1) >= EPSILON ? rect.width : layoutWidth;
    const vis = width >= BREAKPOINT ? "col2" : "col1";
    if (vis !== applied) {
      applied = vis;
      layout.setAttribute(VIS_ATTR, vis);
    }
    // The stacked tree cap mirrors the board box, which lives in layout
    // pixels — so publish the layout width, not the on-screen one.
    if (Math.abs(layoutWidth - appliedWidth) >= 0.5) {
      appliedWidth = layoutWidth;
      layout.style.setProperty(WIDTH_VAR, `${layoutWidth}px`);
    }
  };

  // Hosts apply scale across frames (React commits, resize drags), so look
  // twice: right away and one frame later.
  const schedule = (): void => {
    if (frame || destroyed) return;
    frame = win.requestAnimationFrame(() => {
      frame = win.requestAnimationFrame(() => {
        frame = 0;
        refresh();
      });
    });
  };

  // Synchronous, so a press that also changes the host scale is laid out
  // before the click lands. `pointerdown` fires before content handlers.
  const onPress = (): void => refresh();
  const onZoom = (): void => schedule();
  const onMove = (e: Event): void => {
    if ((e as MouseEvent).buttons) schedule();
  };
  const onKey = (e: Event): void => {
    const ev = e as KeyboardEvent;
    if (ev.ctrlKey || ev.metaKey) schedule();
  };

  doc.addEventListener("wheel", onZoom, { capture: true, passive: true });
  doc.addEventListener("scroll", onZoom, { capture: true, passive: true });
  doc.addEventListener("pointerdown", onPress, true);
  doc.addEventListener("pointermove", onMove, { capture: true, passive: true });
  // Zoom buttons and menus change the host scale after the press, so measure
  // again once the click has been handled.
  doc.addEventListener("click", onZoom, true);
  doc.addEventListener("keydown", onKey, true);
  win.addEventListener("resize", onZoom);

  // Entering or leaving the host's interaction mode can resize the block
  // without any pointer event landing inside it.
  let observer: ResizeObserver | null = null;
  if (typeof win.ResizeObserver !== "undefined") {
    observer = new win.ResizeObserver(() => schedule());
    observer.observe(layout);
  }

  // Canvas pan/zoom is a transform written to an ancestor's inline style.
  // ResizeObserver cannot see that (the layout box is unchanged).
  let styleObserver: MutationObserver | null = null;
  if (typeof win.MutationObserver !== "undefined") {
    styleObserver = new win.MutationObserver(() => schedule());
    for (
      let element: HTMLElement | null = layout.parentElement;
      element;
      element = element.parentElement
    ) {
      styleObserver.observe(element, {
        attributes: true,
        attributeFilter: ["style"],
      });
    }
  }

  refresh();
  schedule();

  return {
    refresh,
    destroy: () => {
      destroyed = true;
      observer?.disconnect();
      observer = null;
      styleObserver?.disconnect();
      styleObserver = null;
      if (frame) win.cancelAnimationFrame(frame);
      frame = 0;
      doc.removeEventListener("wheel", onZoom, { capture: true });
      doc.removeEventListener("scroll", onZoom, { capture: true });
      doc.removeEventListener("pointerdown", onPress, true);
      doc.removeEventListener("pointermove", onMove, { capture: true });
      doc.removeEventListener("click", onZoom, true);
      doc.removeEventListener("keydown", onKey, true);
      win.removeEventListener("resize", onZoom);
    },
  };
}

/**
 * Svelte action: pin a code-block layout's stacked/side-by-side decision to
 * the block's own (visible) box. File-view layouts are left alone — they
 * follow the frame container query instead (utils/viewFrame.ts).
 */
export function blockLayout(node: HTMLElement): { destroy: () => void } {
  const parent = node.parentElement;
  if (parent?.classList.contains(`${CLS_PREFIX}-file-view`)) {
    return { destroy: () => {} };
  }
  return trackBlockLayout(node);
}
