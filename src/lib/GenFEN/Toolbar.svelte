<script lang="ts">
  import type { EventBus } from "../../core/event-bus";

  export let eventBus: EventBus;
  export let position: string = "";
  export let currentTurn: string = "";

  const buttons = [
    { title: "先手", text: "先", action: "turn", color: true },
    { title: "清空", text: "空", action: "empty" },
    { title: "填满", text: "满", action: "full" },
    { title: "保存", text: "存", action: "save" },
  ];
</script>

<div class={`getFENT-toolbar-container ${position}`}>
  {#each buttons as { title, text, action, color }}
    <button
      {title}
      class={`toolbar-btn ${color ? currentTurn : ""}`}
      on:click={() => eventBus.emit("btn-click", action)}
    >
      {text}
    </button>
  {/each}
</div>

<style>
  .getFENT-toolbar-container.right {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
  }

  .getFENT-toolbar-container.bottom {
    display: flex;
    flex-direction: row;
    gap: 0.5em;
  }

  .toolbar-btn {
    padding: 0.4em 0.8em;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .red {
    background-color: var(--red);
  }

  .blue {
    background-color: var(--blue);
  }
</style>
