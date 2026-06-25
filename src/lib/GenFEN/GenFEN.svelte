<script lang="ts">
  import Board from "../Board.svelte";
  import PieceBTNs from "./PieceBTNs.svelte";
  import type { ISettings } from "../../types";
  import type { EventBus } from "../../core/event-bus";
  import Toolbar from "./Toolbar.svelte";

  interface Props {
    settings: ISettings;
    fen: string;
    selectedPiece: string | null;
    eventBus: EventBus;
  }

  let { settings, fen, selectedPiece, eventBus }: Props = $props();
  let position = $derived(settings.position);
</script>

<div class="XQ-container {settings.position}">
  <Board settings={{...settings, showLastMove: false}} {fen} {eventBus} rotated={false} freeMode={true} />
  <PieceBTNs {settings} {fen} {eventBus} {position} {selectedPiece} />
  <Toolbar {eventBus} {position} currentTurn={fen.split(' ')[1] === 'b' ? 'black' : 'white'} />
</div>

<style>
  .XQ-container { --red: #861818; --black: #000080; }
  .XQ-container.right { display: flex; flex-direction: row; gap: 2px; }
  .XQ-container.bottom { display: flex; flex-direction: column; }
</style>
