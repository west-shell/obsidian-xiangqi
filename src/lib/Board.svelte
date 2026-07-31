<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { SvelteMap } from "svelte/reactivity";
  import {
    type Api,
    type cg,
    Chess,
    Chessground,
    type Config,
    type DrawShape,
    type Move,
    type Square,
  } from "../chess";
  import type { EventBus } from "../core/event-bus";
  import { GRID_SVG } from "../themes";
  import type { ISettings } from "../types";

  function injectGridSVG(boardEl: HTMLElement): void {
    const xqBoard = boardEl.querySelector("xq-board");
    if (!xqBoard || xqBoard.querySelector("svg.xq-grid")) return;
    xqBoard.insertAdjacentHTML("afterbegin", GRID_SVG);
  }

  interface Props {
    settings: ISettings;
    fen: string;
    lastMove?: [Square, Square] | null;
    selectedSquare?: Square | null;
    eventBus: EventBus;
    rotated: boolean;
    checkColor?: cg.Color | null;
    variations?: Move[];
    freeMode?: boolean;
    userShapes?: DrawShape[];
    engineBestMove?: { from: Square; to: Square } | null;
    enginePonder?: { from: Square; to: Square } | null;
  }

  let {
    settings,
    fen,
    lastMove = null,
    selectedSquare = null,
    eventBus,
    rotated,
    checkColor = null,
    variations = [],
    freeMode = false,
    userShapes = [],
    engineBestMove = null,
    enginePonder = null,
  }: Props = $props();

  let boardElement: HTMLDivElement;
  let api: Api | null = $state(null);
  let layoutChangeHandler: (() => void) | null = null;
  let boardResizeRo: ResizeObserver | null = null;
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;

  function handleWheel(e: WheelEvent) {
    if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    e.preventDefault();
    if (e.deltaY > 0) {
      eventBus.emit("btn-click", { name: "next" });
    } else if (e.deltaY < 0) {
      eventBus.emit("btn-click", { name: "back" });
    }
  }

  let turnColor: cg.Color = $derived(
    fen.split(" ")[1] === "b" ? "black" : "white",
  );
  let turnClass = $derived(
    settings.showTurnBorder
      ? `turn-${fen.split(" ")[1] === "b" ? "black" : "white"}`
      : "",
  );
  let _check: cg.Color | false = $derived(checkColor || false);
  const chess = new Chess();

  function computeDests(fen: string): SvelteMap<cg.Key, cg.Key[]> {
    try {
      chess.load(fen);
      const dests = new SvelteMap<cg.Key, cg.Key[]>();
      const moves = chess.moves({ verbose: true }) as Move[];
      for (const move of moves) {
        const orig = move.from;
        const dest = move.to;
        if (!dests.has(orig)) {
          dests.set(orig, []);
        }
        dests.get(orig)!.push(dest);
      }
      return dests;
    } catch {
      return new SvelteMap();
    }
  }

  function computeVariationShapes(variations: Move[]): DrawShape[] {
    return variations.map((move) => ({
      orig: move.from,
      dest: move.to,
      brush: "blue",
    }));
  }

  let engineShapes: DrawShape[] = $derived([
    ...(engineBestMove
      ? [{ orig: engineBestMove.from, dest: engineBestMove.to, brush: "green" }]
      : []),
    ...(enginePonder
      ? [{ orig: enginePonder.from, dest: enginePonder.to, brush: "yellow" }]
      : []),
  ]);
  let shapes = $derived([
    ...(settings.showNextMove ? computeVariationShapes(variations) : []),
    ...engineShapes,
  ]);
  let dests = $derived(computeDests(fen));

  onMount(async () => {
    const events: Config["events"] = freeMode
      ? {
          change: () => {
            if (api) eventBus.emit("fen-updated", api.getFen());
          },
          select: (key) => {
            eventBus.emit("click", key);
          },
        }
      : {
          move: (orig, dest) => {
            api?.cancelMove();
            eventBus.emit("trymove", {
              from: orig as Square,
              to: dest as Square,
            });
          },
        };

    const config: Config = {
      fen,
      orientation: rotated ? "black" : "white",
      turnColor,
      coordinates: true,
      viewOnly: settings.viewOnly ?? false,
      movable: freeMode
        ? { free: true, color: "both" }
        : {
            free: false,
            color: turnColor,
            showDests: true,
            dests,
          },
      highlight: freeMode
        ? { lastMove: false }
        : {
            lastMove: settings.showLastMove,
          },
      drawable: {
        enabled: true,
        visible: true,
        shapes: userShapes,
        autoShapes: shapes,
        onChange: (s) => {
          eventBus.emit("user-shapes-changed", s);
        },
      },
      events,
      ...(_check ? { check: _check } : {}),
      ...(lastMove ? { lastMove } : {}),
      ...(selectedSquare ? { selected: selectedSquare } : {}),
    };

    if (!boardElement.offsetWidth) {
      await new Promise<void>((resolve) => {
        const ro = new ResizeObserver(() => {
          if (boardElement.offsetWidth) {
            ro.disconnect();
            resolve();
          }
        });
        ro.observe(boardElement);
      });
    }
    api = Chessground(boardElement, config);
    injectGridSVG(boardElement);

    boardResizeRo = new ResizeObserver(() => {
      if (!api || !boardElement.offsetWidth) return;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        if (api && boardElement.offsetWidth) {
          api.state.dom.bounds.clear();
          api.state.dom.redraw();
        }
      }, 100);
    });
    boardResizeRo.observe(boardElement);

    layoutChangeHandler = () => {
      if (api && boardElement.offsetWidth) {
        api.state.dom.bounds.clear();
        api.state.dom.redraw();
      }
    };
    activeDocument.body.addEventListener(
      "xq-layout-change",
      layoutChangeHandler,
    );
  });

  onDestroy(() => {
    if (boardResizeRo) {
      boardResizeRo.disconnect();
      boardResizeRo = null;
    }
    if (resizeTimer) {
      clearTimeout(resizeTimer);
      resizeTimer = null;
    }
    if (layoutChangeHandler) {
      activeDocument.body.removeEventListener(
        "xq-layout-change",
        layoutChangeHandler,
      );
    }
    if (api) {
      api.destroy();
    }
  });

  $effect(() => {
    if (!api) return;
    if (freeMode) {
      api.set({ fen, turnColor, check: _check });
    } else {
      api.set({
        fen,
        turnColor,
        movable: { color: turnColor, dests },
        check: _check,
      });
    }
    api.selectSquare(null);
  });

  $effect(() => {
    if (!api) return;
    api.set({ orientation: rotated ? "black" : "white" });
    injectGridSVG(boardElement);
  });

  $effect(() => {
    if (!api) return;
    api.set({
      lastMove: lastMove ? lastMove : undefined,
    });
  });

  $effect(() => {
    if (!api) return;
    api.set({ drawable: { autoShapes: shapes } });
  });

  $effect(() => {
    if (!api) return;
    api.setShapes(userShapes);
  });

  $effect(() => {
    if (!api || freeMode) return;
    if (selectedSquare) {
      api.selectSquare(selectedSquare, true);
    } else {
      api.selectSquare(null);
    }
  });

  $effect(() => {
    if (!api) return;
    const cfg: Config = {
      coordinates: true,
      viewOnly: settings.viewOnly ?? false,
    };
    if (!freeMode) {
      cfg.highlight = { lastMove: settings.showLastMove };
    }
    api.set(cfg);
  });

  function eventPosition(e: Event): [number, number] | undefined {
    const me = e as MouseEvent;
    if (me.clientX || me.clientX === 0) return [me.clientX, me.clientY];
    const te = e as TouchEvent;
    if (te.targetTouches?.[0])
      return [te.targetTouches[0].clientX, te.targetTouches[0].clientY];
    return undefined;
  }

  function startResize(start: Event) {
    start.preventDefault();
    const moveEvent = start.type === "touchstart" ? "touchmove" : "mousemove";
    const upEvent = start.type === "touchstart" ? "touchend" : "mouseup";
    const startPos = eventPosition(start);
    if (!startPos) return;
    const initialZoom = settings.zoom;
    let zoom = initialZoom;

    const resize = (move: Event) => {
      const pos = eventPosition(move);
      if (!pos) return;
      const delta = pos[0] - startPos[0] + pos[1] - startPos[1];
      zoom = Math.round(Math.min(100, Math.max(0, initialZoom + delta / 5)));
      const boardScale = (zoom / 100) * 0.75 + 0.25;
      activeDocument.body.style.setProperty(
        "--xq-board-scale",
        `${boardScale}`,
      );
      activeDocument.body.dispatchEvent(new Event("xiangqiground.resize"));
    };

    activeDocument.body.classList.add("resizing");
    activeDocument.addEventListener(moveEvent, resize);
    activeDocument.addEventListener(
      upEvent,
      () => {
        activeDocument.removeEventListener(moveEvent, resize);
        activeDocument.body.classList.remove("resizing");
        activeDocument.body.dispatchEvent(
          new CustomEvent("xq-zoom-changed", { detail: zoom }),
        );
      },
      { once: true },
    );
  }
</script>

<div class="board-wrapper xq-layout__board" onwheel={handleWheel}>
  <div bind:this={boardElement} class="xq-wrap {turnClass}"></div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="board-resize"
    onmousedown={startResize}
    ontouchstart={startResize}
  ></div>
</div>

<style>
  .board-wrapper {
    --bh: var(
      --xq-board-height,
      min(var(--xq-board-max-size, 100vh) * var(--xq-board-scale, 0.85), 100%)
    );
    width: calc(0.9 * var(--bh));
    position: relative;
    margin: 1.5px;
  }
  .xq-wrap :global(xq-board) {
    background:
      var(--xq-board-texture, none) center / cover no-repeat,
      var(--xq-board-bg, #d0b899);
  }
  .xq-wrap {
    aspect-ratio: 9 / 10;
    flex-shrink: 0;
    border-radius: 2px;
    --piece-red: var(--xq-piece-red, var(--color-red));
    --piece-black: var(--xq-piece-black, var(--color-blue));
  }

  .xq-wrap.turn-white {
    box-shadow: 0 0 0.12em 0.15em var(--xq-piece-red, var(--color-red));
  }

  .xq-wrap.turn-black {
    box-shadow: 0 0 0.15em 0.15em var(--xq-piece-black, var(--color-blue));
  }

  .board-resize {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 18px;
    height: 18px;
    cursor: nwse-resize;
    z-index: 5;

    &::before,
    &::after {
      background: var(--text-muted);
      content: "";
      position: absolute;
      height: 1px;
      left: 0;
    }

    &::before {
      width: 5px;
      transform: translate(7px, 8px) rotate(-45deg);
    }

    &::after {
      width: 10px;
      transform: translate(1px, 6px) rotate(-45deg);
    }

    &:hover {
      border-radius: 50%;
      background: var(--interactive-accent);
    }
  }

  :global(body.resizing) {
    user-select: none;
    -webkit-user-select: none;
  }
</style>
