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
    background-image: none !important;
    background:
      var(--xq-grid, none) center / 100% 100% no-repeat,
      var(--xq-board-texture, none) center / cover no-repeat,
      var(--xq-board-bg, #d0b899) !important;
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
