import { afterEach, describe, expect, test, vi } from "vitest";

import { bridgeForeignEvents } from "../src/utils/boardEventBridge";

/**
 * The bridge runs in an Obsidian Electron window where the full DOM stack
 * exists; in the test environment only node's EventTarget/Event are available,
 * so a minimal MouseEvent and two plain EventTargets stand in for the foreign
 * (embed-iframe) document and the main document. Pointer/touch constructors
 * stay undefined, which exercises the guard around them as a side effect.
 */
class MouseEventStub extends Event {
  clientX: number;
  clientY: number;
  buttons: number;
  button: number;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  constructor(type: string, init: MouseEventInit = {}) {
    super(type);
    this.clientX = init.clientX ?? 0;
    this.clientY = init.clientY ?? 0;
    this.buttons = init.buttons ?? 0;
    this.button = init.button ?? 0;
    this.ctrlKey = init.ctrlKey ?? false;
    this.altKey = init.altKey ?? false;
    this.shiftKey = init.shiftKey ?? false;
    this.metaKey = init.metaKey ?? false;
  }
}

const fakeEl = (doc: EventTarget): HTMLElement =>
  ({ ownerDocument: doc }) as unknown as HTMLElement;

describe("board event bridge", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("forwards mouse events with their coordinates across documents", () => {
    vi.stubGlobal("MouseEvent", MouseEventStub);
    const foreignDoc = new EventTarget();
    const mainDoc = new EventTarget();
    const received: MouseEvent[] = [];
    for (const type of ["mousedown", "mousemove", "mouseup"]) {
      mainDoc.addEventListener(type, (e) => received.push(e as MouseEvent));
    }

    const bridge = bridgeForeignEvents(fakeEl(foreignDoc), mainDoc);
    foreignDoc.dispatchEvent(
      new MouseEventStub("mousedown", { clientX: 10, clientY: 20, buttons: 1 }),
    );
    foreignDoc.dispatchEvent(
      new MouseEventStub("mousemove", {
        clientX: 33,
        clientY: -4,
        buttons: 1,
        shiftKey: true,
      }),
    );
    foreignDoc.dispatchEvent(
      new MouseEventStub("mouseup", { clientX: 40, buttons: 0 }),
    );

    expect(received.map((e) => e.type)).toEqual([
      "mousedown",
      "mousemove",
      "mouseup",
    ]);
    expect(received.map((e) => e.clientX)).toEqual([10, 33, 40]);
    expect(received.map((e) => e.clientY)).toEqual([20, -4, 0]);
    expect(received.map((e) => e.buttons)).toEqual([1, 1, 0]);
    expect(received[1].shiftKey).toBe(true);

    bridge();
    foreignDoc.dispatchEvent(
      new MouseEventStub("mousemove", { clientX: 99, buttons: 1 }),
    );
    expect(received).toHaveLength(3);
  });

  test("does not bind any forwarding when the element shares the document", () => {
    vi.stubGlobal("MouseEvent", MouseEventStub);
    const doc = new EventTarget();
    const addSpy = vi.spyOn(doc, "addEventListener");
    const el = fakeEl(doc);

    const bridge = bridgeForeignEvents(
      el,
      doc, // same document — the noop branch
    );
    expect(typeof bridge).toBe("function");
    expect(addSpy).not.toHaveBeenCalled();

    bridge();
    expect(addSpy).not.toHaveBeenCalled();
  });

  test("skips pointer and touch forwarding when those constructors are missing", () => {
    vi.stubGlobal("MouseEvent", MouseEventStub);
    const foreignDoc = new EventTarget();
    const mainDoc = new EventTarget();
    const mousedowns: MouseEvent[] = [];
    mainDoc.addEventListener("mousedown", (e) =>
      mousedowns.push(e as MouseEvent),
    );

    // No PointerEvent/TouchEvent/Touch globals in the node environment.
    const bridge = bridgeForeignEvents(fakeEl(foreignDoc), mainDoc);
    expect(() => {
      foreignDoc.dispatchEvent(new Event("pointerdown"));
      foreignDoc.dispatchEvent(new Event("touchstart"));
      foreignDoc.dispatchEvent(new Event("touchend"));
    }).not.toThrow();
    expect(mousedowns).toHaveLength(0);

    bridge();
  });
});
