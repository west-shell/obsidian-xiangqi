<script lang="ts">
  import type { EventBus } from "../../core/event-bus";
  import { onLangChange, t } from "../../i18n";
  import { onMount } from "svelte";

  interface Props {
    eventBus: EventBus;
    fen: string;
    isFenMode?: boolean;
  }
  let { eventBus, fen, isFenMode = false }: Props = $props();

  let _lv = $state(0);
  onLangChange(() => _lv++);

  function parseFen(fen: string) {
    const parts = fen.split(" ");
    return {
      turn: (parts[1] || "w") as string,
    };
  }

  let _turn = $state("w");

  function toggleTurn() {
    eventBus.emit("btn-click", { name: "turn" });
  }

  function buttonClick(action: string) {
    if (action === "save") {
      const bp = fen.split(" ")[0];
      const fullFen = `${bp} ${_turn}`;
      eventBus.emit("btn-click", { name: "save", payload: fullFen });
      return;
    }
    eventBus.emit("btn-click", { name: action });
  }

  onMount(() => {
    const parsed = parseFen(fen);
    _turn = parsed.turn;
    eventBus.on<string>("updateUI", (fenStr) => {
      const currentFen = fenStr || fen;
      const parsed = parseFen(currentFen);
      _turn = parsed.turn;
    });
  });
</script>

<div class="fen-editor-tools chess-layout__toolbar">
  <div class="tool-group-fen-meta">
    <div class="tool-section turn-row">
      <button
        class="turn-toggle {_turn === 'b' ? 'black' : 'white'}"
        onclick={toggleTurn}
        >{_turn === "b"
          ? t("genfen.black_turn", _lv)
          : t("genfen.white_turn", _lv)}</button
      >
    </div>
  </div>

  <div class="tool-section tool-buttons">
    <button class="fen-btn" onclick={() => buttonClick("start")}>
      {t("genfen.start", _lv)}
    </button>
    <button class="fen-btn" onclick={() => buttonClick("empty")}>
      {t("genfen.empty", _lv)}
    </button>
    <button class="fen-btn" onclick={() => buttonClick("flip")}>
      {t("genfen.flip", _lv)}
    </button>
    <button class="fen-btn fen-btn-save" onclick={() => buttonClick("save")}>
      {t("genfen.save", _lv)}
    </button>
    {#if !isFenMode}
      <button
        class="fen-btn fen-btn-back"
        onclick={() => eventBus.emit("exit-edit")}
      >
        {t("genfen.back", _lv)}
      </button>
    {/if}
  </div>
</div>

<style>
  .fen-editor-tools {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 8px;
    max-height: 100%;
  }

  .tool-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .turn-row {
    flex-direction: row;
    align-items: center;
    gap: 4px;
  }
  .turn-toggle {
    padding: 2px 12px;
    border: 1.5px solid rgba(0, 0, 0, 0.35);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85em;
    transition:
      box-shadow 0.15s,
      border-color 0.15s;
    white-space: nowrap;
  }
  .turn-toggle.white {
    background-color: var(--chess-piece-white);
    color: black;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }
  .turn-toggle.black {
    background-color: var(--chess-piece-black);
    color: white;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }
  .turn-toggle:hover {
    filter: brightness(1.1);
  }
  .tool-buttons {
    display: flex;
    flex-direction: column;
    flex-wrap: wrap;
    gap: 4px;
    align-content: start;
  }
  .fen-btn {
    padding: 6px 12px;
    border: 1px solid var(--background-modifier-border, #ccc);
    border-radius: 4px;
    cursor: pointer;
    background: var(--background-secondary, #f0f0f0);
    color: var(--text-normal, #000);
    font-size: 0.85em;
    transition: background 0.15s;
  }
  .fen-btn:hover {
    background: var(--background-modifier-hover, #e0e0e0);
  }
  .fen-btn-save {
    background: var(--interactive-accent, #6a9fb5);
    color: var(--text-on-accent, #fff);
    border-color: var(--interactive-accent, #6a9fb5);
    font-weight: 600;
  }
  .fen-btn-save:hover {
    opacity: 0.9;
  }
</style>
