import { CLS_PREFIX } from "../chess";

/**
 * Lay a file view out as a real window the size of its visible frame.
 *
 * An embeddable host (Excalidraw) gives the leaf a "virtual" box
 * (`element.width / scale`) and paints it through `transform: scale(s)`, where
 * s is the embeddable scale times the canvas zoom. Layout inside the leaf then
 * describes a window that is not the one the user sees: media queries still
 * follow the Obsidian window, `100vh` is the app height, and text kept at 14px
 * is painted at 14·s px.
 *
 * Instead of chasing s, this measures the frame the leaf is actually painted
 * in (the parent's content box, in screen pixels) and freezes the view's layout
 * box to that size, then counter-scales by 1/s on each axis. The painted box is
 * unchanged (layout × 1/s × s = layout), but inside it:
 *
 *   - one layout pixel is one screen pixel again;
 *   - `cqw` / `cqh` and the container queries in _layout.scss describe the
 *     visible frame, not the virtual leaf or the app window;
 *   - text and controls keep their designed size.
 *
 * `data-cg-frame` (switched on together with the inline styles) tells the CSS
 * to use the frame-sized container instead of the window media queries. It is
 * removed again when the host is not scaled, so normal tabs are untouched.
 *
 * Only file views are tracked (the Svelte action checks for
 * `.{prefix}-file-view`); boards in Markdown code blocks keep the host scale.
 */

/** Marks the view while the frame-sized layout is active. */
const FRAME_ATTR = "data-cg-frame";
/** Small enough to be invisible, large enough to skip float noise. */
const EPSILON = 0.002;
const MIN_SCALE = 0.02;
const MAX_SCALE = 50;
/** Inline styles we take over and hand back on teardown. */
const STYLE_PROPERTIES = ["width", "height", "transform"] as const;

interface SavedStyle {
  value: string;
  priority: string;
}

interface FrameBox {
  sx: number;
  sy: number;
  width: number;
  height: number;
}

export interface ViewFrameHandle {
  /** Measure the host again and re-apply. Cheap when nothing changed. */
  refresh: () => void;
  destroy: () => void;
}

function saveStyles(el: HTMLElement): Map<string, SavedStyle> {
  const saved = new Map<string, SavedStyle>();
  for (const property of STYLE_PROPERTIES) {
    saved.set(property, {
      value: el.style.getPropertyValue(property),
      priority: el.style.getPropertyPriority(property),
    });
  }
  return saved;
}

function restoreStyles(el: HTMLElement, saved: Map<string, SavedStyle>): void {
  for (const [property, entry] of saved) {
    if (entry.value) {
      el.style.setProperty(property, entry.value, entry.priority);
    } else {
      el.style.removeProperty(property);
    }
  }
}

/**
 * Keep a file view laid out at its on-screen size while an ancestor scales it.
 * Call it once the element is in the DOM; destroy the handle with the view.
 */
export function trackViewFrame(view: HTMLElement): ViewFrameHandle {
  const doc = view.ownerDocument;
  const win = doc.defaultView ?? window;
  const parent = view.parentElement;
  const saved = saveStyles(view);
  let active = false;
  let last: FrameBox = { sx: 1, sy: 1, width: 0, height: 0 };
  let frame = 0;
  let destroyed = false;

  /**
   * The frame box, in screen pixels. The parent of the view is the leaf
   * content: it is not transformed by us, so `rect / offset` is the effective
   * ancestor scale, and its content box is the area the view normally fills.
   */
  const measure = (): FrameBox | null => {
    if (!parent) return null;
    const rect = parent.getBoundingClientRect();
    if (
      !parent.offsetWidth ||
      !parent.offsetHeight ||
      !rect.width ||
      !rect.height
    ) {
      return null;
    }
    const sx = rect.width / parent.offsetWidth;
    const sy = rect.height / parent.offsetHeight;
    if (
      !Number.isFinite(sx) ||
      !Number.isFinite(sy) ||
      sx < MIN_SCALE ||
      sy < MIN_SCALE ||
      sx > MAX_SCALE ||
      sy > MAX_SCALE
    ) {
      return null;
    }

    const style = win.getComputedStyle(parent);
    const length = (property: string): number =>
      Number.parseFloat(style.getPropertyValue(property)) || 0;
    const padLeft = length("padding-left");
    const padRight = length("padding-right");
    const padTop = length("padding-top");
    const padBottom = length("padding-bottom");

    // Top-left of the parent's content box, in screen pixels. `clientLeft` is
    // its border width, which `clientWidth` includes.
    const contentLeft = rect.left + (parent.clientLeft + padLeft) * sx;
    const contentTop = rect.top + (parent.clientTop + padTop) * sy;
    const availableWidth = (parent.clientWidth - padLeft - padRight) * sx;
    const availableHeight = (parent.clientHeight - padTop - padBottom) * sy;

    // The view may not start at the content origin (view header, host padding).
    // Its top-left is unaffected by our own transform, so this stays valid while
    // the counter-scale is active — and it self-corrects after a host resize.
    const viewRect = view.getBoundingClientRect();
    return {
      sx,
      sy,
      width: availableWidth - Math.max(0, viewRect.left - contentLeft),
      height: availableHeight - Math.max(0, viewRect.top - contentTop),
    };
  };

  const reset = (): void => {
    if (!active) return;
    active = false;
    view.removeAttribute(FRAME_ATTR);
    restoreStyles(view, saved);
    last = { sx: 1, sy: 1, width: 0, height: 0 };
  };

  const apply = (box: FrameBox): void => {
    active = true;
    // The static half of the frame layout (origin, flex item, pinning) lives
    // in _layout.scss under [data-cg-frame]; only the measurements are inline.
    view.setAttribute(FRAME_ATTR, "");
    view.style.width = `${box.width}px`;
    view.style.height = `${box.height}px`;
    view.style.transform = `scale(${1 / box.sx}, ${1 / box.sy})`;
  };

  const refresh = (): void => {
    if (destroyed) return;
    const box = measure();
    if (!box) return;
    if (Math.abs(box.sx - 1) < EPSILON && Math.abs(box.sy - 1) < EPSILON) {
      reset();
      return;
    }
    if (!(box.width > 0) || !(box.height > 0)) return;
    if (
      active &&
      Math.abs(box.sx - last.sx) < 1e-4 &&
      Math.abs(box.sy - last.sy) < 1e-4 &&
      Math.abs(box.width - last.width) < 0.1 &&
      Math.abs(box.height - last.height) < 0.1
    ) {
      return;
    }
    last = box;
    apply(box);
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

  // Synchronous, so a press that also changes the host scale is hit-tested
  // against the fresh layout.
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

  // The frame box itself can change without any of those events (pane layout,
  // embeddable resize committed by the host).
  let observer: ResizeObserver | null = null;
  if (parent && typeof win.ResizeObserver !== "undefined") {
    observer = new win.ResizeObserver(() => schedule());
    observer.observe(parent);
  }

  // Canvas pan/zoom is often a transform written to an ancestor's inline
  // style. ResizeObserver cannot see that (the layout box is unchanged), and
  // the pointer may be outside the view while the canvas moves, so watch the
  // ancestors' inline styles. A translation-only change measures the same box
  // and is cheap; a zoom re-applies the frame before the next click.
  let styleObserver: MutationObserver | null = null;
  if (parent && typeof win.MutationObserver !== "undefined") {
    styleObserver = new win.MutationObserver(() => schedule());
    for (
      let element: HTMLElement | null = parent;
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
      reset();
    },
  };
}

/**
 * Svelte action: track the file view this layout is mounted in. Code-block
 * layouts have a plain host container and are left alone.
 */
export function viewFrame(node: HTMLElement): { destroy: () => void } {
  const view = node.parentElement;
  if (!view || !view.classList.contains(`${CLS_PREFIX}-file-view`)) {
    // Code-block host: nothing to compensate.
    return { destroy: () => {} };
  }
  return trackViewFrame(view);
}
