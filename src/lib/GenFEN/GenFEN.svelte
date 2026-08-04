<script lang="ts">
  import Board from "../Board.svelte";
  import PieceBTNs from "./PieceBTNs.svelte";
  import type { ISettings } from "../../types";
  import type { Piece } from "../../chess";
  import type { EventBus } from "../../core/event-bus";
  import Toolbar from "./Toolbar.svelte";

  interface Props {
    settings: ISettings;
    fen: string;
    selectedPiece: Piece | null;
    eventBus: EventBus;
  }

  let { settings, fen, selectedPiece, eventBus }: Props = $props();
</script>

<div class="xq-layout xq-layout--genfen">
  <Board
    settings={{ ...settings, showLastMove: false }}
    {fen}
    {eventBus}
    rotated={false}
    freeMode={true}
  />
  <PieceBTNs {fen} {eventBus} {selectedPiece} />
  <Toolbar
    {eventBus}
    currentTurn={fen.split(" ")[1] === "b" ? "black" : "white"}
  />
</div>

<style>
  .xq-layout {
    --red: #861818;
    --black: #000080;
  }
</style>
