<script lang="ts">
  import { setIcon } from "obsidian";
  import type { EventBus } from "../../core/event-bus";

  interface Props {
    eventBus: EventBus;
  }
  let { eventBus }: Props = $props();

  const buttons = [
    { title: "删除", icon: "circle-x", event: "remove" },
    { title: "提升", icon: "arrow-up-wide-narrow", event: "promote" },
    { title: "开局", icon: "arrow-left-to-line", event: "toStart" },
    { title: "回退", icon: "arrow-left", event: "back" },
    { title: "前进", icon: "arrow-right", event: "next" },
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
  }
</script>

<div class="toolbar-container">
  {#each buttons as { title, icon, event }}
    <button
      class="toolbar-btn"
      aria-label={title}
      use:useSetIcon={icon}
      onclick={() => emitEvent(event)}
    ></button>
  {/each}
  <hr />
  {#each annotations as { title, symbol, event }}
    <button class="toolbar-btn" aria-label={title} onclick={() => emitEvent(event, symbol)}>
      {symbol}
    </button>
  {/each}
</div>

<style>
  :global(.tree-view.right) .toolbar-container {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  :global(.tree-view.bottom) .toolbar-container {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
  }

  :global(.tree-view.bottom) .toolbar-container hr {
    flex-basis: 100%;
    height: 0;
    border: none;
    margin: 0;
  }
</style>
