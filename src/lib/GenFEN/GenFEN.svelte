<script lang="ts">
  import Board from "../Board.svelte";
  import PieceBTNs from "./PieceBTNs.svelte";
  import type { IBoard, IOptions, IPosition, ISettings } from "../../types";
  import type { EventBus } from "../../core/event-bus";
  import Toolbar from "./Toolbar.svelte";

  interface Props {
    settings: ISettings;
    board: IBoard;
    markedPos: IPosition;
    selectedPiece: string;
    currentTurn: string;
    eventBus: EventBus;
  }

  let { settings, board, markedPos, selectedPiece, currentTurn, eventBus }: Props = $props();

  let position = $derived(settings.position);
</script>

<div class="XQ-container {settings.position}">
  <Board {settings} {board} {markedPos} {currentTurn} {eventBus} rotated={false} />
  <PieceBTNs {settings} {board} {eventBus} {position} {selectedPiece} />
  <Toolbar {eventBus} {position} {currentTurn} />
</div>

<style>
  .XQ-container {
    --red: #861818;
    --black: #000080;
    margin: 10px;
  }

  .XQ-container.right {
    display: flex;
    flex-direction: row;
    gap: 2px;
  }

  .XQ-container.bottom {
    display: flex;
    flex-direction: column;
  }
</style>
