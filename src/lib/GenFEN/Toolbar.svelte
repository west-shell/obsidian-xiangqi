<script lang="ts">
  import type { EventBus } from "../../core/event-bus";
  import { onLangChange, t } from "../../i18n";

  interface Props {
    eventBus: EventBus;
    currentTurn: string;
  }
  let { eventBus, currentTurn }: Props = $props();

  let _lv = $state(0);
  onLangChange(() => _lv++);

  const buttons = $derived([
    { title: t("genfen.turn", _lv), text: "先", action: "turn", color: true },
    { title: t("genfen.clear", _lv), text: "空", action: "empty" },
    { title: t("genfen.fill", _lv), text: "满", action: "full" },
    { title: t("genfen.save", _lv), text: "存", action: "save" },
  ]);
</script>

<div class="getFENT-toolbar-container xq-layout__toolbar">
  {#each buttons as { title, text, action, color }, i (i)}
    <button
      {title}
      class={`toolbar-btn ${color ? currentTurn : ""}`}
      onclick={() => eventBus.emit("btn-click", action)}
    >
      {text}
    </button>
  {/each}
</div>

<style>
  .toolbar-btn {
    padding: 0.4em 0.8em;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .white {
    background-color: var(--xq-piece-red);
    color: white;
  }

  .black {
    background-color: var(--xq-piece-black);
    color: white;
  }
</style>
