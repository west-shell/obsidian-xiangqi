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
  import type { ISettings } from "../types";

  function injectGridSVG(boardEl: HTMLElement): void {
    const xqBoard = boardEl.querySelector("xq-board");
    if (!xqBoard || xqBoard.querySelector("svg.xq-grid")) return;

    const C = 50,
      PAD = 25,
      COLS = 9,
      ROWS = 10,
      M = 5;
    const ns = "http://www.w3.org/2000/svg";
    const L = "var(--xq-grid-color, #555)";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "xq-grid");
    svg.setAttribute(
      "viewBox",
      `0 0 ${C * (COLS - 1) + PAD * 2} ${C * (ROWS - 1) + PAD * 2}`,
    );
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.style.position = "absolute";
    svg.style.top = "0";
    svg.style.left = "0";
    svg.style.pointerEvents = "none";

    const el = (tag: string, attrs: Record<string, string>): SVGElement => {
      const e = document.createElementNS(ns, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    };

    svg.appendChild(
      el("rect", {
        x: String(PAD - M),
        y: String(PAD - M),
        width: String((COLS - 1) * C + 2 * M),
        height: String((ROWS - 1) * C + 2 * M),
        fill: "none",
        stroke: L,
        "stroke-width": "3",
      }),
    );
    svg.appendChild(
      el("rect", {
        x: String(PAD),
        y: String(PAD),
        width: String((COLS - 1) * C),
        height: String((ROWS - 1) * C),
        fill: "none",
        stroke: L,
        "stroke-width": "1",
      }),
    );

    for (let y = 0; y < ROWS; y++) {
      svg.appendChild(
        el("line", {
          x1: String(PAD),
          y1: String(PAD + y * C),
          x2: String(PAD + (COLS - 1) * C),
          y2: String(PAD + y * C),
          stroke: L,
          "stroke-width": "1",
        }),
      );
    }
    for (let x = 0; x < COLS; x++) {
      svg.appendChild(
        el("line", {
          x1: String(PAD + x * C),
          y1: String(PAD),
          x2: String(PAD + x * C),
          y2: String(PAD + 4 * C),
          stroke: L,
          "stroke-width": "1",
        }),
      );
    }
    for (let x = 0; x < COLS; x++) {
      svg.appendChild(
        el("line", {
          x1: String(PAD + x * C),
          y1: String(PAD + 5 * C),
          x2: String(PAD + x * C),
          y2: String(PAD + 9 * C),
          stroke: L,
          "stroke-width": "1",
        }),
      );
    }

    svg.appendChild(
      el("line", {
        x1: String(PAD + 3 * C),
        y1: String(PAD),
        x2: String(PAD + 5 * C),
        y2: String(PAD + 2 * C),
        stroke: L,
        "stroke-width": "1",
      }),
    );
    svg.appendChild(
      el("line", {
        x1: String(PAD + 5 * C),
        y1: String(PAD),
        x2: String(PAD + 3 * C),
        y2: String(PAD + 2 * C),
        stroke: L,
        "stroke-width": "1",
      }),
    );
    svg.appendChild(
      el("line", {
        x1: String(PAD + 3 * C),
        y1: String(PAD + 7 * C),
        x2: String(PAD + 5 * C),
        y2: String(PAD + 9 * C),
        stroke: L,
        "stroke-width": "1",
      }),
    );
    svg.appendChild(
      el("line", {
        x1: String(PAD + 5 * C),
        y1: String(PAD + 7 * C),
        x2: String(PAD + 3 * C),
        y2: String(PAD + 9 * C),
        stroke: L,
        "stroke-width": "1",
      }),
    );

    const ry = PAD + 4.5 * C;
    const t1 = el("text", {
      x: String(PAD + 1.5 * C),
      y: String(ry),
      "font-size": String(C * 0.6),
      fill: L,
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      "font-family": "serif",
      dy: "0.1em",
    });
    t1.textContent = "楚 河";
    svg.appendChild(t1);
    const t2 = el("text", {
      x: String(PAD + 6.5 * C),
      y: String(ry),
      "font-size": String(C * 0.6),
      fill: L,
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      "font-family": "serif",
      dy: "0.1em",
    });
    t2.textContent = "漢 界";
    svg.appendChild(t2);

    const stars: [number, number][] = [
      [1, 2],
      [7, 2],
      [1, 7],
      [7, 7],
      [2, 3],
      [4, 3],
      [6, 3],
      [2, 6],
      [4, 6],
      [6, 6],
    ];
    for (const [sx, sy] of stars) {
      const cx = PAD + sx * C,
        cy = PAD + sy * C,
        d = C * 0.15,
        d2 = C * 0.08;
      svg.appendChild(
        el("path", {
          d: `M ${cx - d2},${cy - d - d2} v ${d} h ${-d} M ${cx + d2},${cy - d - d2} v ${d} h ${d} M ${cx + d2},${cy + d + d2} v ${-d} h ${d} M ${cx - d2},${cy + d + d2} v ${-d} h ${-d}`,
          stroke: L,
          "stroke-width": "1",
          fill: "none",
        }),
      );
    }

    const edges: [number, number][] = [
      [0, 3],
      [0, 6],
      [8, 3],
      [8, 6],
    ];
    for (const [ex, ey] of edges) {
      const cx = PAD + ex * C,
        cy = PAD + ey * C,
        d = C * 0.15,
        d2 = C * 0.08;
      if (ex === 0) {
        svg.appendChild(
          el("path", {
            d: `M ${cx + d2},${cy - d - d2} v ${d} h ${d} M ${cx + d2},${cy + d + d2} v ${-d} h ${d}`,
            stroke: L,
            "stroke-width": "1",
            fill: "none",
          }),
        );
      } else {
        svg.appendChild(
          el("path", {
            d: `M ${cx - d2},${cy - d - d2} v ${d} h ${-d} M ${cx - d2},${cy + d + d2} v ${-d} h ${-d}`,
            stroke: L,
            "stroke-width": "1",
            fill: "none",
          }),
        );
      }
    }

    xqBoard.insertBefore(svg, xqBoard.firstChild);
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
  }: Props = $props();

  // oxlint-disable-next-line no-unassigned-vars
  let boardElement: HTMLDivElement;
  let api: Api | null = null;
  let layoutChangeHandler: (() => void) | null = null;

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

  let shapes = $derived(
    settings.showNextMove ? computeVariationShapes(variations) : [],
  );
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
</script>

<div class="board-wrapper">
  <div bind:this={boardElement} class="xq-wrap {turnClass}"></div>
</div>

<style>
  .board-wrapper {
    --bw: var(--xq-board-width, calc(var(--xq-cell-size, 50px) * 9));
    width: var(--bw);
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
</style>
