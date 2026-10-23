<script lang="ts">
  import { Menu } from "obsidian";
  import { onDestroy, onMount, tick } from "svelte";
  import {
    CLS_PREFIX,
    getAutoResult,
    getMoveListSideClass,
    getMoveNotation,
    getStartLabel,
    getTurnFromFen,
    PRIMARY_PLAYER_KEY,
  } from "../../../chess";
  import type { EventBus } from "../../../core/event-bus";
  import { onLangChange, t } from "../../../i18n";
  import type { ChessNode, ISettings, NodeEval, NodeMap } from "../../../types";
  import { badgeSvg } from "../../../utils/icon";
  import { evalBarIntensity } from "../../../utils/winningChances";
  import { formatResult } from "./format";
  import type HoverPreview from "./HoverPreview.svelte";
  import { scrollToBTN } from "./scroll";

  interface Props {
    nodeMap: NodeMap;
    eventBus: EventBus;
    currentNode: ChessNode | null;
    currentPath: string[];
    settings?: ISettings;
    preview?: HoverPreview | null;
  }

  let {
    nodeMap,
    eventBus,
    currentNode,
    currentPath,
    settings,
    preview,
  }: Props = $props();

  // ---- List mode ----
  let _uiVer = $state(0);
  const onUiVer = () => {
    _uiVer++;
  };
  let listMoves = $derived.by(() => {
    // Engine/save code mutates plain ChessNode fields (eval, glyph, comments,
    // annotation) without Svelte signals; `updateUI` bumps _uiVer after each
    // mutation, so reading it here keeps the move list in sync.
    void _uiVer;
    return currentPath
      .map((id) => nodeMap.get(id)!)
      .filter((n): n is ChessNode => n != null && n.move !== null);
  });
  let listCurrentStep = $derived(currentPath.indexOf(currentNode?.id ?? ""));
  // lila-style fixed columns: the first side keeps the left column even when
  // black is to move first — the first row then pads the left cell with a
  // "..." placeholder (PGN "1. ..." convention) instead of swapping columns.
  let blackStarts = $derived.by(() => {
    if (currentPath.length === 0) return false;
    const root = nodeMap.get(currentPath[0]);
    return root != null && getTurnFromFen(root.fen) === "black";
  });
  // Move rows pair up starting at this listMoves index; when black starts,
  // listMoves[0] gets its own "1. ..." row above and pairing begins at 1.
  let pairOffset = $derived(blackStarts ? 1 : 0);
  let startMarks = $derived.by(() => {
    void _uiVer;
    const node =
      currentPath.length > 0 ? (nodeMap.get(currentPath[0]) ?? null) : null;
    // Wrap in a fresh object on every recompute: Svelte 5 skips notifying
    // dependents when a derived recomputes to a reference-equal value, and
    // the root node object never changes identity, so marks set on it
    // (eval / glyph / annotation / comments) would never re-render.
    return { node };
  });
  // Rows use display: contents, so scroll anchors are the number spans.
  let listItemRefs: HTMLSpanElement[] = [];
  let listUlRef: HTMLUListElement | null = $state(null);

  $effect(() => {
    const step = listCurrentStep;
    void listMoves;
    (async () => {
      await tick();
      if (destroyed) return;
      // Row number of the current step: rows pair two moves each, shifted by
      // pairOffset when black moves first (its first move sits alone in row 1).
      const index = step <= 0 ? 0 : Math.floor((step + 1 + pairOffset) / 2);
      const targetEl = listItemRefs[index];
      if (targetEl) {
        scrollToBTN(targetEl, listUlRef);
      }
    })();
  });

  let _lv = $state(0);
  const unsubLang = onLangChange(() => _lv++);
  let destroyed = false;

  function onClickStep(step: number) {
    const nodeId = step === 0 ? currentPath[0] : currentPath[step];
    if (nodeId) eventBus.emit("slider-navigate", nodeId);
  }

  function listBadge(key: string): string {
    const size = 10;
    const r = size / 2;
    return `<svg class="${CLS_PREFIX}-moves__badge" viewBox="${-r} ${-r} ${size} ${size}" aria-hidden="true">${badgeSvg(key, size)}</svg>`;
  }

  /**
   * All move-list badges concatenated into ONE html string: rendering them
   * through a single {@html} keeps the badges 1px apart (svg margin-left).
   * Separate {@html} blocks would leave a collapsed space text node between
   * them in the DOM, widening the gap to a full word space.
   */
  function moveBadges(node: ChessNode): string {
    let html = "";
    if (node.glyph && settings?.showListGlyph !== false) {
      html += listBadge(`glyph_${node.glyph.symbol}`);
    }
    if (node.annotations?.length && settings?.showListAnnotation !== false) {
      html += node.annotations.map(listBadge).join("");
    }
    return html;
  }

  function evalBarStyle(ev: NodeEval): string {
    // Same intensity/colour logic as the tree graph node eval bar
    const intensity = evalBarIntensity(ev);
    const color =
      ev.score > 0 || (ev.scoreType === "mate" && ev.score >= 0)
        ? `color-mix(in srgb, var(--eval-plus) ${60 + intensity * 40}%, transparent)`
        : ev.score < 0 || (ev.scoreType === "mate" && ev.score < 0)
          ? `color-mix(in srgb, var(--eval-minus) ${60 + intensity * 40}%, transparent)`
          : `color-mix(in srgb, var(--text-muted) 60%, transparent)`;
    const width = Math.round(20 + intensity * 60);
    return `width:${width}%;background-color:${color}`;
  }

  // ---- Result toolbar ----
  // The current branch's result lives on the line's tip node (the last
  // id of currentPath). node.result mutates outside Svelte signals, so
  // read _uiVer like the other list deriveds. A terminal tip position
  // (checkmate/stalemate) contributes the game-forced result — even when
  // nothing was stored on the node — and locks the toolbar against
  // manual changes.
  let branchInfo = $derived.by(() => {
    void _uiVer;
    if (currentPath.length === 0) return { result: "", locked: false };
    const tip = nodeMap.get(currentPath[currentPath.length - 1]);
    if (!tip) return { result: "", locked: false };
    const auto = getAutoResult(tip.fen);
    return { result: tip.result ?? auto ?? "", locked: auto !== null };
  });
  let branchResult = $derived(branchInfo.result);
  let branchResultLocked = $derived(branchInfo.locked);
  // "1-0" is the primary side winning (White in chess, Red in xiangqi).
  // Widen to string so the same synced comparison type-checks in both
  // variants (each chess.ts types the constant as its own literal).
  const primaryKey: string = PRIMARY_PLAYER_KEY;
  let primaryWinsLabel = $derived(
    primaryKey === "Red" ? t("tree.redWins", _lv) : t("tree.whiteWins", _lv),
  );
  function resultLabel(value: string): string {
    if (value === "1-0") return primaryWinsLabel;
    if (value === "0-1") return t("tree.blackWins", _lv);
    if (value === "1/2-1/2") return t("tree.draw", _lv);
    return t("tree.undecided", _lv);
  }
  function showResultMenu(evt: MouseEvent) {
    // Terminal positions keep their game-forced result.
    if (branchResultLocked) return;
    const items: Array<{ value: string; label: string }> = [
      { value: "", label: t("tree.undecided", _lv) },
      { value: "1-0", label: primaryWinsLabel },
      { value: "0-1", label: t("tree.blackWins", _lv) },
      { value: "1/2-1/2", label: t("tree.draw", _lv) },
    ];
    const menu = new Menu();
    for (const item of items) {
      const isCurrent =
        item.value === branchResult ||
        (item.value === "" && branchResult === "*");
      menu.addItem((mi) =>
        mi
          .setTitle(item.label)
          .setChecked(isCurrent)
          .onClick(() => {
            if (!isCurrent) eventBus.emit("set-result", item.value);
          }),
      );
    }
    menu.showAtMouseEvent(evt);
  }

  onMount(() => {
    eventBus.on("updateUI", onUiVer);
  });

  onDestroy(() => {
    destroyed = true;
    unsubLang();
    eventBus.off("updateUI", onUiVer);
  });
</script>

<div class="{CLS_PREFIX}-moves-col">
  {#snippet moveLabelContent(node: ChessNode)}
    {@const badges = moveBadges(node)}
    {#if badges}
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html badges}
    {/if}
  {/snippet}
  {#snippet moveSpan(node: ChessNode, step: number)}
    {@const m = node.move}
    {@const hasComment = (node.comments ?? []).length > 0}
    {@const isActive = listCurrentStep === step}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span
      class={`${CLS_PREFIX}-moves__move ${getMoveListSideClass(
        node.color,
      )} ${isActive ? `${CLS_PREFIX}-moves__move--active` : ""}`}
      onclick={() => onClickStep(step)}
      onmouseenter={(e) => preview?.showNode(node, e, "left")}
      onmouseleave={() => preview?.hideNode(node)}
    >
      <span
        class={`${CLS_PREFIX}-moves__label ${hasComment && settings?.showListCommentMark !== false ? `${CLS_PREFIX}-moves__label--comment` : ""}`}
      >
        {m
          ? getMoveNotation(m, settings?.notationType)
          : "..."}{@render moveLabelContent(node)}
      </span>
      {#if node.eval && settings?.showListEval !== false}
        <span
          class="{CLS_PREFIX}-moves__evalbar"
          style={evalBarStyle(node.eval)}
        ></span>
      {/if}
    </span>
  {/snippet}
  <ul
    class="{CLS_PREFIX}-moves"
    bind:this={listUlRef}
    onmouseleave={() => preview?.hideAll()}
  >
    <li class="{CLS_PREFIX}-moves__row {CLS_PREFIX}-moves__row--start">
      <span class="{CLS_PREFIX}-moves__num" bind:this={listItemRefs[0]}>#</span>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <span
        class={`${CLS_PREFIX}-moves__move ${CLS_PREFIX}-moves__move--start ${listCurrentStep === 0 ? `${CLS_PREFIX}-moves__move--active` : ""}`}
        onclick={() => onClickStep(0)}
        onmouseenter={(e) => {
          const root = nodeMap.get(currentPath[0]);
          if (root) preview?.showNode(root, e, "left");
        }}
        onmouseleave={() => preview?.hideAll()}
      >
        <span
          class={`${CLS_PREFIX}-moves__label ${(startMarks.node?.comments ?? []).length > 0 && settings?.showListCommentMark !== false ? `${CLS_PREFIX}-moves__label--comment` : ""}`}
        >
          {getStartLabel()}{#if startMarks.node}{@render moveLabelContent(
              startMarks.node,
            )}{/if}
        </span>
        {#if startMarks.node?.eval && settings?.showListEval !== false}
          <span
            class="{CLS_PREFIX}-moves__evalbar"
            style={evalBarStyle(startMarks.node.eval)}
          ></span>
        {/if}
      </span>
    </li>
    {#if blackStarts}
      <!-- Black moves first: pad the left column with "..." so black's
         first move lands in the right column (lila/PGN convention). -->
      <li class="{CLS_PREFIX}-moves__row">
        <span class="{CLS_PREFIX}-moves__num" bind:this={listItemRefs[1]}
          >1</span
        >
        <span class="{CLS_PREFIX}-moves__placeholder" aria-hidden="true"
          >...</span
        >
        {#if listMoves[0]}
          {@render moveSpan(listMoves[0]!, 1)}
        {:else}
          <span class="{CLS_PREFIX}-moves__empty" aria-hidden="true"></span>
        {/if}
      </li>
    {/if}
    {#each listMoves as move, i (move.id)}
      {#if i >= pairOffset && (i - pairOffset) % 2 === 0}
        <!-- Row number expressed via i's parity only: row-opening items
           are even i when white starts and odd i when black starts, so
           this equals (i - pairOffset) / 2 + 1 + pairOffset WITHOUT
           reading the pairOffset derived — a derived read inside the
           bind:this index expression freezes list updates after the
           first $set when props are forwarded through a parent. -->
        {@const row = Math.floor(i / 2) + 1 + (i % 2)}
        <li class="{CLS_PREFIX}-moves__row">
          <span class="{CLS_PREFIX}-moves__num" bind:this={listItemRefs[row]}
            >{row}</span
          >
          <!-- Read listMoves[i] (the reactive derived) instead of the
             each-item value: the item reference never changes when the
             array recomputes, so Svelte would skip re-rendering white
             moves when engine analysis mutates node.eval in place. -->
          {@render moveSpan(listMoves[i]!, i + 1)}
          {#if listMoves[i + 1]}
            {@render moveSpan(listMoves[i + 1], i + 2)}
          {:else}
            <!-- Placeholder keeps the right column occupied so grid
               auto-placement does not shift the next row. -->
            <span class="{CLS_PREFIX}-moves__empty" aria-hidden="true"></span>
          {/if}
        </li>
      {/if}
    {/each}
    {#if branchResult && branchResult !== "*"}
      <!-- pgn-viewer style: the game result as its own full-width row
         at the end of the move list (comment.result). -->
      <li
        class="{CLS_PREFIX}-moves__result-row"
        title={formatResult(branchResult, _lv)}
      >
        {branchResult}
      </li>
    {/if}
  </ul>
  <div class="{CLS_PREFIX}-resultbar">
    <button
      class="{CLS_PREFIX}-btn {CLS_PREFIX}-resultbar__btn"
      aria-label={t("tree.switchResult", _lv)}
      aria-haspopup={branchResultLocked ? undefined : "menu"}
      onclick={showResultMenu}
      >{resultLabel(branchResult)}{branchResultLocked ? "" : " ▾"}</button
    >
  </div>
</div>
