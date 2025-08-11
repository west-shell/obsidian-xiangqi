<script lang="ts">
  import { setIcon } from "obsidian";
  import type { EventBus } from "../../core/event-bus";

  export let eventBus: EventBus;

  const buttons = [
    { title: "删除", icon: "circle-x", event: "remove" },
    { title: "提升", icon: "arrow-up-wide-narrow", event: "promote" },
    { title: "开局", icon: "arrow-left-to-line", event: "toStart" },
    { title: "回退", icon: "chevron-left", event: "back" },
    { title: "前进", icon: "chevron-right", event: "next" },
    { title: "终局", icon: "arrow-right-to-line", event: "toEnd" },
  ];

  const annotations = [
    { title: "红优", symbol: "R+", event: "annotation" },
    { title: "黑优", symbol: "B+", event: "annotation" },
    { title: "均势", symbol: "=", event: "annotation" },
    { title: "问题手", symbol: "?", event: "annotation" },
    { title: "妙手", symbol: "!", event: "annotation" },
  ];

  function emitEvent(name: string, payload: any = null) {
    eventBus.emit("btn-click", { name, payload });
  }

  function useSetIcon(el: HTMLElement, icon: string) {
    setIcon(el, icon);
    return {
      update(newIcon: string) {
        setIcon(el, newIcon);
      },
    };
  }
</script>

<div class="toolbar-container">
  {#each buttons as { title, icon, event }}
    <button
      class="toolbar-btn"
      aria-label={title}
      use:useSetIcon={icon}
      on:click={() => emitEvent(event)}
    ></button>
  {/each}
  <hr />
  {#each annotations as { title, symbol, event }}
    <button class="toolbar-btn" aria-label={title} on:click={() => emitEvent(event, symbol)}>
      {symbol}
    </button>
  {/each}
</div>

<style>
  .toolbar-container {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
</style>
