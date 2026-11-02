/**
 * Forward mouse/pointer/touch activity from a foreign document to the main one.
 *
 * Canvas FileNotes (Excalidraw markdown embeds) render their note in the main
 * document and then transplant the nodes into an `iframe.embed-iframe`.
 * Element-level listeners move along with the nodes, so a board keeps reacting
 * to presses — but listeners registered on the main `document` stay behind,
 * and events dispatched inside an iframe never cross the document boundary.
 * chessground binds `mousemove`/`mouseup`/`touchmove`/`touchend` on the global
 * `document` for a board's whole life (events.js `bindDocument`), so once a
 * board lives in the iframe, drags never see a move or a release.
 *
 * The bridge listens for those events on the element's own document (capture)
 * and re-dispatches equivalents on the main `document`, where chessground has
 * been listening all along. Coordinates need no conversion: `clientX/clientY`
 * of an event inside an iframe and `getBoundingClientRect()` of an element
 * inside an iframe are both relative to the iframe's viewport, so copying them
 * verbatim keeps every chessground mapping exact.
 *
 * chessground refuses synthetic drags (`drag.start` requires `isTrusted`
 * unless `trustAllEvents` is set), so pair the bridge with that flag — see
 * Board.svelte, which enables it once a board is found in a foreign document
 * and then clears chessground's cached bounds so the next press re-measures
 * inside the iframe.
 *
 * `target` is the document the events are forwarded to (defaults to the
 * global `document`); it is exposed so tests can pass in a fake.
 */

const MOUSE_EVENTS = ["mousedown", "mousemove", "mouseup"] as const;
const TOUCH_EVENTS = ["touchstart", "touchmove", "touchend"] as const;

export function bridgeForeignEvents(
  el: HTMLElement,
  target: EventTarget = document,
): () => void {
  const doc = el.ownerDocument;
  // Same document: the native document-level listeners already receive these
  // events, and forwarding a duplicate would run each handler twice.
  if (!doc || doc === target) return () => {};

  const unbinds: Array<() => void> = [];
  const bind = (type: string, handler: EventListener): void => {
    doc.addEventListener(type, handler, { capture: true });
    unbinds.push(() =>
      doc.removeEventListener(type, handler, { capture: true }),
    );
  };

  for (const type of MOUSE_EVENTS) {
    bind(type, (e) => {
      const me = e as MouseEvent;
      target.dispatchEvent(
        new MouseEvent(type, {
          clientX: me.clientX,
          clientY: me.clientY,
          screenX: me.screenX,
          screenY: me.screenY,
          button: me.button,
          buttons: me.buttons,
          ctrlKey: me.ctrlKey,
          altKey: me.altKey,
          shiftKey: me.shiftKey,
          metaKey: me.metaKey,
          cancelable: true,
        }),
      );
    });
  }

  // `pointerdown` is not part of chessground's own bindings, but Board.svelte
  // clears chessground's cached bounds on every press from the main document.
  if (typeof PointerEvent !== "undefined") {
    bind("pointerdown", (e) => {
      const pe = e as PointerEvent;
      target.dispatchEvent(
        new PointerEvent("pointerdown", {
          clientX: pe.clientX,
          clientY: pe.clientY,
          screenX: pe.screenX,
          screenY: pe.screenY,
          button: pe.button,
          buttons: pe.buttons,
          pointerId: pe.pointerId,
          pointerType: pe.pointerType,
          ctrlKey: pe.ctrlKey,
          altKey: pe.altKey,
          shiftKey: pe.shiftKey,
          metaKey: pe.metaKey,
          cancelable: true,
        }),
      );
    });
  }

  // Touch events are forwarded as a best effort, rebuilding the touch lists so
  // chessground's position lookup keeps reading real coordinates. Touch
  // construction is unavailable in some environments (jsdom, hardened
  // settings); Chromium then still sends synthesized mouse events for the
  // same interaction, which the mouse forwarding handles.
  if (
    typeof Touch !== "undefined" &&
    typeof TouchEvent !== "undefined" &&
    document.body
  ) {
    for (const type of TOUCH_EVENTS) {
      bind(type, (e) => {
        try {
          const te = e as TouchEvent;
          const clone = (touch: Touch): Touch =>
            // `Touch.target` must live in the main document's tree, but
            // chessground only reads the coordinates and identifier.
            new Touch({
              identifier: touch.identifier,
              target: document.body,
              clientX: touch.clientX,
              clientY: touch.clientY,
              pageX: touch.pageX,
              pageY: touch.pageY,
              radiusX: touch.radiusX,
              radiusY: touch.radiusY,
              rotationAngle: touch.rotationAngle,
              force: touch.force,
            });
          target.dispatchEvent(
            new TouchEvent(type, {
              touches: Array.from(te.touches, clone),
              targetTouches: Array.from(te.targetTouches, clone),
              changedTouches: Array.from(te.changedTouches, clone),
              ctrlKey: te.ctrlKey,
              altKey: te.altKey,
              shiftKey: te.shiftKey,
              metaKey: te.metaKey,
              cancelable: true,
            }),
          );
        } catch {
          // Skip this event; the mouse-compat path covers it.
        }
      });
    }
  }

  return () => {
    for (const unbind of unbinds) unbind();
    unbinds.length = 0;
  };
}
