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

<div class="ct-genfen">
  <div class="ct-genfen__group">
    <div class="ct-genfen__section ct-genfen__section--row">
      <button
        class="ct-genfen__turn ct-genfen__turn--{_turn === 'b'
          ? 'black'
          : 'white'}"
        onclick={toggleTurn}>{t("genfen.side_to_move", _lv)}</button
      >
    </div>
  </div>

  <div class="ct-genfen__actions">
    <button class="ct-genfen__action" onclick={() => buttonClick("start")}>
      {t("genfen.start", _lv)}
    </button>
    <button class="ct-genfen__action" onclick={() => buttonClick("empty")}>
      {t("genfen.empty", _lv)}
    </button>
    <button class="ct-genfen__action" onclick={() => buttonClick("flip")}>
      {t("genfen.flip", _lv)}
    </button>
    <button
      class="ct-genfen__action ct-genfen__action--save"
      onclick={() => buttonClick("save")}
    >
      {t("genfen.save", _lv)}
    </button>
    {#if !isFenMode}
      <button
        class="ct-genfen__action ct-genfen__action--back"
        onclick={() => eventBus.emit("exit-edit")}
      >
        {t("genfen.back", _lv)}
      </button>
    {/if}
  </div>
</div>
