<script lang="ts">
  import Panel from "./panel/Panel.svelte";
  import Board from "../Board.svelte";
  import Toolbar from "./Toolbar.svelte";
  import PieceBTNs from "../GenFEN/PieceBTNs.svelte";
  import GenFENToolbar from "../GenFEN/Toolbar.svelte";
  import type {
    ChessNode,
    GameSlot,
    IOptions,
    ISettings,
    NodeMap,
    NodeShape,
    ParseWarning,
  } from "../../types";
  import type { EventBus } from "../../core/event-bus";
  import {
    type cg,
    CLS_PREFIX,
    type DrawShape,
    FIRST_PLAYER_COLOR,
    getMoveDest,
    isMoveCheck,
    type Move,
    type Piece,
    SECOND_PLAYER_COLOR,
    type Square,
  } from "../../chess";
  import type ChessPlugin from "../../main";
  import { onDestroy, onMount, tick } from "svelte";
  import { onLangChange, t } from "../../i18n";
  import { annotationShapes } from "./glyphs";
  import { GLYPH_BY_KEY } from "../../utils/annotation-glyphs";
  import { badgeBoardSvg, resultBadgeKeyOf } from "../../utils/icon";
  import { parseOrientationTag } from "../../modules/Source/parse";
  import {
    clockForColor,
    formatClock,
    formatSeconds,
    getPlayerInfo,
    initialClockSeconds,
    type PlayerInfo,
  } from "./player";

  const BRUSH_MAP: Record<string, string> = {
    green: "g",
    red: "r",
    blue: "b",
    yellow: "y",
  };
  const BRUSH_REV: Record<string, string> = {
    g: "green",
    r: "red",
    b: "blue",
    y: "yellow",
  };

  function loadShapes(node: ChessNode): DrawShape[] {
    if (!node.shapes) return [];
    return node.shapes.map((s: NodeShape) => ({
      orig: s.orig as cg.Key,
      dest: s.dest as cg.Key | undefined,
      brush: BRUSH_REV[s.brush] ?? s.brush,
    }));
  }

  function saveShapes(node: ChessNode, shapes: DrawShape[]) {
    node.shapes = shapes.map((s) => ({
      orig: s.orig,
      dest: s.dest,
      brush: BRUSH_MAP[s.brush ?? "green"] ?? s.brush,
    }));
  }

  interface Props {
    settings: ISettings;
    fen: string;
    eventBus: EventBus;
    nodeMap: NodeMap;
    currentNode: ChessNode;
    currentPath: string[];
    options: IOptions;
    parseWarnings?: ParseWarning[];
    editing?: boolean;
    selectedPiece?: Piece | null;
    isFenMode?: boolean;
    plugin?: ChessPlugin;
    games?: GameSlot[];
    currentGameIndex?: number;
    isBlockMode?: boolean;
  }

  let {
    settings,
    fen,
    eventBus,
    nodeMap,
    currentNode,
    currentPath,
    options,
    parseWarnings = [],
    editing = false,
    selectedPiece = null,
    isFenMode = false,
    plugin,
    games = [],
    currentGameIndex = 0,
    isBlockMode = false,
  }: Props = $props();

  let lastMove: [Square, Square] | null = $derived(
    currentNode.move ? [currentNode.move.from, currentNode.move.to] : null,
  );
  function orientationKey(): string {
    return `${currentGameIndex}:${options?.rotated ?? ""}`;
  }
  function initialRotated(): boolean {
    return (
      options?.rotated ??
      parseOrientationTag(games[currentGameIndex]?.raw ?? "") ??
      false
    );
  }
  let rotated = $state(initialRotated());
  // Re-apply the initial orientation when the active game changes (a lichess
  // [Orientation "black"] chapter flips the board); manual flips persist
  // until then. Explicit block options (r:/[Rotated]) win over the tag.
  let orientKey = orientationKey();
  $effect(() => {
    const key = orientationKey();
    if (key === orientKey) return;
    orientKey = key;
    rotated = initialRotated();
  });
  let nextPathChild = $derived.by(() => {
    const idx = currentPath.indexOf(currentNode.id);
    if (idx === -1 || idx >= currentPath.length - 1) return null;
    const next = nodeMap.get(currentPath[idx + 1]);
    return next && next.parentID === currentNode.id ? next : null;
  });
  let mainVariation = $derived.by(() => {
    const main = nextPathChild ?? currentNode.children[0];
    return main?.move ? [main.move] : [];
  });
  let otherVariations = $derived(
    currentNode.children
      .filter((child) => child !== (nextPathChild ?? currentNode.children[0]))
      .map((child) => child.move)
      .filter((m): m is Move => m != null) ?? [],
  );
  let userShapes = $derived(loadShapes(currentNode));
  let _lv = $state(0);
  const unsubLang = onLangChange(() => _lv++);
  let warningKey = $derived(
    parseWarnings.map((w) => `${w.line}:${w.column}:${w.text}`).join("|"),
  );
  let dismissedWarning = $state("");
  let showParseWarning = $derived(
    parseWarnings.length > 0 && dismissedWarning !== warningKey,
  );

  function warningLoc(w: ParseWarning): string {
    return (
      t("source.parseWarningLinePrefix", _lv) +
      w.line +
      t("source.parseWarningLineSuffix", _lv) +
      t("source.parseWarningColPrefix", _lv) +
      w.column +
      t("source.parseWarningColSuffix", _lv)
    );
  }
  let engineBestMove: { from: Square; to: Square } | null = $state(null);
  let enginePonder: { from: Square; to: Square } | null = $state(null);
  let glyphShapes = $derived.by(() => {
    if (!settings.showBoardAnnotations) return [];
    const node = currentNode;
    const shapes: DrawShape[] = [];
    const dest = node.move ? getMoveDest(node.move) : undefined;
    // Result mark on the last move's square; mirrors the tree node's
    // resultBadgeKey via the shared helper so board and tree always
    // show the same badge (# for mates, flag for resignations).
    const resultKey = resultBadgeKeyOf(node.result, node.isCheckmate);
    const resultSvg = dest ? badgeBoardSvg(resultKey) : "";
    if (node.glyph && dest) {
      const engineShapes = annotationShapes(dest, node.glyph);
      shapes.push(...engineShapes);
    }
    if (dest) {
      for (const ann of node.annotations ?? []) {
        const def = GLYPH_BY_KEY[ann];
        // Position annotations share the result mark's top-left corner;
        // when that mark is drawn they are skipped, otherwise the
        // diff-rendered badge stack can cover it.
        if (resultSvg && def?.category === "position") continue;
        let x = -12;
        let y = -12;
        if (def?.category === "custom") {
          y = 68;
          if (def.key === "st") x = 71;
        }
        const svg = badgeBoardSvg(ann, x, y);
        if (svg) {
          shapes.push({
            orig: dest as DrawShape["orig"],
            brush: "",
            customSvg: { html: svg },
          });
        }
      }
    }
    if (resultSvg) {
      shapes.push({
        orig: dest as DrawShape["orig"],
        brush: "",
        customSvg: { html: resultSvg },
      });
    }
    return shapes;
  });
  let checkColor = $derived(
    currentNode.move && isMoveCheck(currentNode.move)
      ? currentNode.move.color === "w"
        ? "black"
        : "white"
      : null,
  ) as "white" | "black" | null;

  // ---- Player bars (names / ratings / clocks above and below the board) ---
  let gameHeaders = $derived(games[currentGameIndex]?.headers);
  /** First player (White/Red) sits at the bottom unless the board is flipped. */
  let boardFirst = $derived(!rotated);
  let bottomInfo = $derived(getPlayerInfo(gameHeaders, boardFirst));
  let topInfo = $derived(getPlayerInfo(gameHeaders, !boardFirst));
  let initialSeconds = $derived(
    gameHeaders ? initialClockSeconds(gameHeaders) : undefined,
  );
  let bottomClock = $derived.by(() => {
    const clk = clockForColor(
      currentNode,
      nodeMap,
      boardFirst ? "white" : "black",
    );
    if (clk !== undefined) return formatClock(clk);
    // The side has no [%clk] yet (or the game only has [TimeControl]):
    // fall back to the initial time.
    return initialSeconds !== undefined
      ? formatSeconds(initialSeconds)
      : undefined;
  });
  let topClock = $derived.by(() => {
    const clk = clockForColor(
      currentNode,
      nodeMap,
      boardFirst ? "black" : "white",
    );
    if (clk !== undefined) return formatClock(clk);
    return initialSeconds !== undefined
      ? formatSeconds(initialSeconds)
      : undefined;
  });
  let turnColor = $derived(fen.split(" ")[1] === "b" ? "black" : "white") as
    "white" | "black";
  let bottomActive = $derived(
    bottomClock !== undefined && turnColor === (boardFirst ? "white" : "black"),
  );
  let topActive = $derived(
    topClock !== undefined && turnColor === (boardFirst ? "black" : "white"),
  );
  /** Side marks: the first player (White/Red) sits bottom unless flipped. */
  let bottomColor = $derived(
    boardFirst ? FIRST_PLAYER_COLOR : SECOND_PLAYER_COLOR,
  );
  let topColor = $derived(
    boardFirst ? SECOND_PLAYER_COLOR : FIRST_PLAYER_COLOR,
  );
  function hasPlayerText(info: PlayerInfo): boolean {
    return !!(info.name || info.title || info.rating);
  }
  let showPlayerBar = $derived(
    hasPlayerText(topInfo) ||
      hasPlayerText(bottomInfo) ||
      topClock !== undefined ||
      bottomClock !== undefined,
  );

  let destroyed = false;
  onDestroy(() => {
    destroyed = true;
    unsubLang();
  });

  onMount(async () => {
    // activateGame() emits engine-result while this component is not yet
    // mounted (no listener yet), so seed the arrows from the initial node's
    // stored eval here.
    const ev = currentNode.eval;
    if (ev?.bestmove) {
      engineBestMove = {
        from: ev.bestmove.slice(0, 2) as Square,
        to: ev.bestmove.slice(2, 4) as Square,
      };
      enginePonder = ev.ponder
        ? {
            from: ev.ponder.slice(0, 2) as Square,
            to: ev.ponder.slice(2, 4) as Square,
          }
        : null;
    }
    await tick();
    if (destroyed) return;
    eventBus.emit("ready");
  });

  $effect(() => {
    const onEngineResult = (
      result?: {
        bestmove: string;
        ponder?: string;
        score?: number;
        depth?: number;
      } | null,
    ) => {
      if (result) {
        const from = result.bestmove.slice(0, 2) as Square;
        const to = result.bestmove.slice(2, 4) as Square;
        engineBestMove = { from, to };
        if (result.ponder) {
          enginePonder = {
            from: result.ponder.slice(0, 2) as Square,
            to: result.ponder.slice(2, 4) as Square,
          };
        } else {
          enginePonder = null;
        }
      } else {
        engineBestMove = null;
        enginePonder = null;
      }
    };
    const onClearBestmove = () => {
      engineBestMove = null;
      enginePonder = null;
    };
    eventBus.on("engine-result", onEngineResult);
    eventBus.on("clear-engine-bestmove", onClearBestmove);
    return () => {
      eventBus.off("engine-result", onEngineResult);
      eventBus.off("clear-engine-bestmove", onClearBestmove);
    };
  });

  $effect(() => {
    const onShapesChanged = (shapes?: DrawShape[]) => {
      saveShapes(currentNode, shapes ?? []);
      eventBus.emit("modified", null);
      eventBus.emit("updateUI", null);
    };
    eventBus.on("user-shapes-changed", onShapesChanged);
    return () => {
      eventBus.off("user-shapes-changed", onShapesChanged);
    };
  });

  $effect(() => {
    const onRotate = () => {
      rotated = !rotated;
    };
    eventBus.on("rotate", onRotate);
    return () => {
      eventBus.off("rotate", onRotate);
    };
  });
</script>

{#snippet barContent(
  info: PlayerInfo,
  clock: string | undefined,
  active: boolean,
  color: string,
)}
  <span
    class="{CLS_PREFIX}-player-bar__mark {CLS_PREFIX}-player-bar__mark--{color}"
  ></span>
  <span class="{CLS_PREFIX}-player-bar__person">
    {#if info.title}
      <span class="{CLS_PREFIX}-player-bar__title">{info.title}</span>
    {/if}
    {#if info.name}
      <span class="{CLS_PREFIX}-player-bar__name">{info.name}</span>
    {/if}
    {#if info.rating}
      <span class="{CLS_PREFIX}-player-bar__rating">({info.rating})</span>
    {/if}
  </span>
  {#if clock !== undefined}
    <span
      class="{CLS_PREFIX}-player-bar__clock{active
        ? ` ${CLS_PREFIX}-player-bar__clock--active`
        : ''}"
      role="timer"
      aria-label={t("player.clock", _lv)}>{clock}</span
    >
  {/if}
{/snippet}

{#snippet topBar()}
  <div class="{CLS_PREFIX}-player-bar {CLS_PREFIX}-player-bar--top">
    {@render barContent(topInfo, topClock, topActive, topColor)}
  </div>
{/snippet}

{#snippet bottomBar()}
  <div class="{CLS_PREFIX}-player-bar {CLS_PREFIX}-player-bar--bottom">
    {@render barContent(bottomInfo, bottomClock, bottomActive, bottomColor)}
  </div>
{/snippet}

{#if showParseWarning}
  <div class="{CLS_PREFIX}-parse-warning">
    <div class="{CLS_PREFIX}-parse-warning-head">
      <span class="{CLS_PREFIX}-parse-warning-title">
        {t("source.parseWarning", _lv)}
      </span>
      <button
        class="{CLS_PREFIX}-parse-warning-close"
        aria-label={t("source.parseWarningClose", _lv)}
        onclick={() => (dismissedWarning = warningKey)}>×</button
      >
    </div>
    {#each parseWarnings as w (`${w.line}:${w.column}:${w.text}`)}
      <div class="{CLS_PREFIX}-parse-warning-item">
        <span class="{CLS_PREFIX}-parse-warning-loc">{warningLoc(w)}</span>
        <span class="{CLS_PREFIX}-parse-warning-text">{w.text}</span>
        <span class="{CLS_PREFIX}-parse-warning-reason">
          {w.kind === "fen"
            ? t("source.parseWarningFen", _lv)
            : w.kind === "unknown"
              ? t("source.parseWarningUnknown", _lv)
              : t("source.parseWarningMove", _lv)}
        </span>
      </div>
    {/each}
  </div>
{/if}

{#if editing}
  <div class="{CLS_PREFIX}-layout {CLS_PREFIX}-layout--edit">
    <Board
      {settings}
      {fen}
      {eventBus}
      {rotated}
      freeMode={true}
      {mainVariation}
      {otherVariations}
    />
    <PieceBTNs {fen} {eventBus} {selectedPiece} />
    <GenFENToolbar {eventBus} {fen} {isFenMode} />
  </div>
{:else}
  <div
    class="{CLS_PREFIX}-layout{showPlayerBar
      ? ` ${CLS_PREFIX}-layout--bars`
      : ''}"
  >
    <Board
      {settings}
      {fen}
      {lastMove}
      {checkColor}
      {eventBus}
      {rotated}
      {mainVariation}
      {otherVariations}
      {userShapes}
      {engineBestMove}
      {enginePonder}
      {glyphShapes}
      topBar={showPlayerBar ? topBar : undefined}
      bottomBar={showPlayerBar ? bottomBar : undefined}
    />
    <Toolbar
      {eventBus}
      {options}
      {settings}
      {plugin}
      {rotated}
      {isBlockMode}
      getCurrentNode={() => currentNode}
    />
    <Panel
      {nodeMap}
      {eventBus}
      {currentNode}
      {currentPath}
      {settings}
      {games}
      {currentGameIndex}
      {isBlockMode}
      {plugin}
    />
  </div>
{/if}
