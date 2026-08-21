<script lang="ts">
  import Board from "../Board.svelte";
  import PieceBTNs from "./PieceBTNs.svelte";
  import type { ISettings } from "../../types";
  import type { EventBus } from "../../core/event-bus";
  import Toolbar from "./Toolbar.svelte";
  import { onDestroy, onMount } from "svelte";
  import type { Piece } from "../../chess";
  import { LAYOUT_CLASS, LAYOUT_CLASS_GENFEN } from "../../chess";

  interface Props {
    settings: ISettings;
    fen: string;
    selectedPiece: Piece | null;
    eventBus: EventBus;
  }

  let { settings, fen, selectedPiece, eventBus }: Props = $props();

  let flipped = $state(false);

  function onBtnClick(action: { name: string; payload?: unknown } | null) {
    if (!action) return;
    if (action.name === "flip") {
      flipped = !flipped;
    }
  }

  onMount(() => {
    eventBus.on("btn-click", onBtnClick);
  });
  onDestroy(() => {
    eventBus.off("btn-click", onBtnClick);
  });
</script>

<div class="{LAYOUT_CLASS} {LAYOUT_CLASS_GENFEN}">
  <Board {settings} {fen} {eventBus} rotated={flipped} freeMode={true} />
  <PieceBTNs {fen} {eventBus} {selectedPiece} />
  <Toolbar {eventBus} {fen} />
</div>

<style>
  .chess-layout {
    --red: #861818;
    --black: #000080;
  }
</style>
