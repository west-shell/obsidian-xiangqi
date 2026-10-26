import { type Api, renderResized, updateBounds } from "../chess";

/**
 * Board scale tracking for scaled hosts (Excalidraw embeds).
 *
 * chessground measures the board with getBoundingClientRect() — screen pixels —
 * and then writes those numbers back as CSS transform values, i.e. in the
 * board's own layout pixels. The two only agree while no ancestor is
 * transformed. Excalidraw paints every embeddable inside a
 * `transform: scale(s)` container (canvas zoom × embeddable scale), so the step
 * chessground writes is s× too small once it is painted: pieces and highlights
 * collapse towards the top-left corner while clicks keep landing correctly
 * (they compare clientX/clientY against the same rect, so both sides are in
 * screen pixels).
 *
 * The fix is to keep the chessground container at net scale 1: counter-scale it
 * by 1/s, because chessground already sizes it from the wrap's *on-screen*
 * width (see updateBounds). One container pixel is then one screen pixel again,
 * which is the assumption the library is written against — so both directions
 * agree again, and drag, draw, animation and hit tests all behave natively.
 *
 * The container is absolutely positioned, so the counter-scale never affects
 * the surrounding layout: only the pixels inside the board change.
 *
 * Hosts that are not scaled (everything except Excalidraw embeds) measure
 * s ≈ 1 and never activate the rules in style/layout/_board.scss.
 */

/** Marks the wrap while the counter-scale is active. */
const SCALE_ATTR = "data-cg-scaled";
/** 1 / ancestor scale, applied to cg-container by _board.scss. */
const INVERSE_VAR = "--cg-inverse-scale";
/**
 * Ancestor scale itself. Inside the counter-scaled container one local pixel is
 * one *screen* pixel, so any length that was designed for the board's layout
 * size (cqw-driven coordinate labels, turn rings) has to be multiplied by this
 * to stay proportional to the board.
 */
const SCALE_VAR = "--cg-host-scale";
/**
 * Outer centring offsets, as a fraction of the wrap box. chessground rounds the
 * container size down to a whole number of device pixels, so the counter-scaled
 * board can end up a couple of screen pixels narrower than the wrap; without
 * this the leftover would all sit on the right/bottom edge.
 */
const INSET_X_VAR = "--cg-inset-x";
const INSET_Y_VAR = "--cg-inset-y";

/** Small enough to be invisible, large enough to skip float noise. */
const EPSILON = 0.002;
const MIN_SCALE = 0.02;
const MAX_SCALE = 50;

export interface BoardScaleHandle {
  /** Measure again and re-apply. Cheap when nothing changed. */
  refresh: () => void;
  destroy: () => void;
}

/**
 * Keep a chessground instance in sync with the scale of its ancestors.
 * Call it once the instance exists; the returned handle must be destroyed
 * together with the instance.
 */
export function trackBoardScale(wrap: HTMLElement, api: Api): BoardScaleHandle {
  const doc = wrap.ownerDocument;
  const win = doc.defaultView ?? window;
  let applied = 1;
  let frame = 0;
  let destroyed = false;

  /** Split whatever the container lost to rounding between both sides. */
  const centerContainer = (): void => {
    const rect = wrap.getBoundingClientRect();
    const container = api.state.dom.elements.container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const gapX = Math.max(0, 1 - container.width / rect.width);
    const gapY = Math.max(0, 1 - container.height / rect.height);
    wrap.style.setProperty(INSET_X_VAR, String(gapX / 2));
    wrap.style.setProperty(INSET_Y_VAR, String(gapY / 2));
  };

  const apply = (scale: number): void => {
    applied = scale;
    const scaled = Math.abs(scale - 1) >= EPSILON;
    if (scaled) {
      wrap.setAttribute(SCALE_ATTR, "");
      wrap.style.setProperty(INVERSE_VAR, String(1 / scale));
      wrap.style.setProperty(SCALE_VAR, String(scale));
    } else {
      wrap.removeAttribute(SCALE_ATTR);
      wrap.style.removeProperty(INVERSE_VAR);
      wrap.style.removeProperty(SCALE_VAR);
      wrap.style.removeProperty(INSET_X_VAR);
      wrap.style.removeProperty(INSET_Y_VAR);
    }
    // The container size and every piece/square offset are derived from the
    // board's on-screen rect, so both have to be recomputed from scratch:
    // render() only touches the nodes that changed, it never re-translates.
    updateBounds(api.state);
    if (scaled) centerContainer();
    renderResized(api.state);
  };

  const refresh = (): void => {
    if (destroyed) return;
    const rect = wrap.getBoundingClientRect();
    const layoutWidth = wrap.offsetWidth;
    if (!layoutWidth || !wrap.offsetHeight || !rect.width || !rect.height) {
      return;
    }
    const scale = rect.width / layoutWidth;
    if (!Number.isFinite(scale) || scale < MIN_SCALE || scale > MAX_SCALE) {
      return;
    }
    if (Math.abs(scale - applied) >= EPSILON) apply(scale);
  };

  // chessground re-measures the container from its own ResizeObserver, which
  // can change how much the device-pixel rounding takes away. Re-centre then,
  // otherwise a later resize would end up with the whole gap on one edge.
  const observeContainer = (): (() => void) => {
    if (typeof win.ResizeObserver === "undefined") return () => {};
    const container = api.state.dom.elements.container;
    const ro = new win.ResizeObserver(() => {
      if (destroyed || !wrap.hasAttribute(SCALE_ATTR)) return;
      centerContainer();
    });
    ro.observe(container);
    return () => ro.disconnect();
  };
  const stopObserving = observeContainer();

  // Hosts apply their zoom transform across frames (React commits, resize
  // drags), so look twice: right away and one frame later.
  const schedule = (): void => {
    if (frame || destroyed) return;
    frame = win.requestAnimationFrame(() => {
      frame = win.requestAnimationFrame(() => {
        frame = 0;
        refresh();
      });
    });
  };

  // Synchronous, so a click that also changes the canvas zoom is hit-tested
  // against the fresh rect. `pointerdown` fires before chessground's mousedown.
  const onPress = (): void => refresh();

  // Wheel/trackpad zoom and canvas pans only change ancestor transforms, which
  // no ResizeObserver sees.
  const onZoom = (): void => schedule();
  const onMove = (e: Event): void => {
    if ((e as MouseEvent).buttons) schedule();
  };

  // Excalidraw also zooms from the keyboard (Ctrl+= / Ctrl+- / Ctrl+0), which
  // fires no wheel/scroll event. Modifier chords only, so typing never costs a
  // forced layout measurement.
  const onKey = (e: Event): void => {
    const ev = e as KeyboardEvent;
    if (ev.ctrlKey || ev.metaKey) schedule();
  };

  doc.addEventListener("wheel", onZoom, { capture: true, passive: true });
  doc.addEventListener("scroll", onZoom, { capture: true, passive: true });
  doc.addEventListener("pointerdown", onPress, true);
  doc.addEventListener("pointermove", onMove, { capture: true, passive: true });
  doc.addEventListener("keydown", onKey, true);
  win.addEventListener("resize", onZoom);

  refresh();
  schedule();

  return {
    refresh,
    destroy: () => {
      destroyed = true;
      stopObserving();
      if (frame) win.cancelAnimationFrame(frame);
      frame = 0;
      doc.removeEventListener("wheel", onZoom, { capture: true });
      doc.removeEventListener("scroll", onZoom, { capture: true });
      doc.removeEventListener("pointerdown", onPress, true);
      doc.removeEventListener("pointermove", onMove, { capture: true });
      doc.removeEventListener("keydown", onKey, true);
      win.removeEventListener("resize", onZoom);
    },
  };
}
