<script lang="ts">
  import { tick } from "svelte";
  import { scrollToBTN } from "../../utils/utils";
  import type { EventBus } from "../../core/event-bus";
  import type { Move } from "@west-shell/xiangqi.js";
  import type { ISettings } from "../../types";

  interface Props {
    settings: ISettings;
    currentStep: number;
    moves: Move[];
    eventBus: EventBus;
  }
  let { settings, currentStep, moves, eventBus }: Props = $props();

  let itemRefs: HTMLLIElement[] = [];
  let ulRef: HTMLUListElement;

  $effect(() => {
    void currentStep;
    void moves;

    (async () => {
      await tick();

      const index = currentStep === 0 ? 0 : Math.ceil(currentStep / 2);
      const targetEl = itemRefs[index];

      if (targetEl) {
        scrollToBTN(targetEl, ulRef);
      }
    })();
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="move-container {settings.position}"
  style="--height: {10 * settings.cellSize}px;
    --width: {9 * settings.cellSize}px;
    --fontsize: {settings.fontSize}px;"
>
  <ul class="move-list {settings.position}" bind:this={ulRef}>
    <li class="start" bind:this={itemRefs[0]}>
      <span class="roundnum">0</span>
      <span
        class="move start"
        class:active={currentStep === 0}
        onclick={() => eventBus.emit("clickstep", 0)}
      >
        {settings.showMovelistText ? "= 开 局 =" : "开 局"}
      </span>
    </li>
    {#each moves as move, i}
      {#if i % 2 === 0}
        <li class="round" bind:this={itemRefs[i / 2 + 1]}>
          <span class="roundnum">{i / 2 + 1}</span>
          <span
            class="move red"
            class:active={currentStep === i + 1}
            onclick={() => eventBus.emit("clickstep", i + 1)}
          >
            {settings.showMovelistText ? move.zh : "红"}
          </span>
          {#if moves[i + 1]}
            <span
              class="move black"
              class:active={currentStep === i + 2}
              onclick={() => eventBus.emit("clickstep", i + 2)}
            >
              {settings.showMovelistText ? moves[i + 1].zh : "黑"}
            </span>
          {/if}
        </li>
      {/if}
    {/each}
  </ul>
</div>

<style>
  .move-container {
    font-size: var(--fontsize);
    padding: 0;
    margin: 0;
  }

  .move-list.right {
    display: flex;
    flex-wrap: nowrap;
    flex-direction: column;
    align-items: flex-start;
    overflow-y: auto;
    overflow-x: hidden;
    height: var(--height);
    padding: 0;
    margin: 0;
    color: var(--text-normal);
    background-color: var(--background-primary-alt);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
  }

  .move-list.bottom {
    display: flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    width: var(--width);
    align-content: flex-start;
    padding: 0;
    margin: 0;
    background-color: var(--background-secondary);
    border-top: 1px solid var(--background-modifier-border);
  }

  .move-list.right li {
    display: flex;
    flex-wrap: nowrap;
    flex-shrink: 0;
    flex-grow: 0;
    align-items: center;
    gap: 0.5em;
    padding: 0;
    margin: 0;
    border-bottom: none;
    width: 100%;
    white-space: nowrap;
  }

  .move-list.bottom li {
    display: flex;
    flex-wrap: nowrap;
    flex-shrink: 0;
    flex-grow: 0;
    align-items: center;
    justify-content: center;
    gap: 0.25em;
    padding: 0.25em 0.125em; /* 4px -> 0.25em, 2px -> 0.125em (假设 font-size=16px) */
    margin: 0;
    border-bottom: none;
    white-space: nowrap;
    writing-mode: vertical-rl;
    text-orientation: upright;
  }

  .move-list.right .roundnum {
    display: inline-block;
    min-width: 1.5em;
    max-width: 3em;
    text-align: right;
    margin-right: 0.4em;
    white-space: nowrap;
    flex-shrink: 0;
    color: var(--text-muted);
  }

  .move-list.bottom .roundnum {
    writing-mode: horizontal-tb;
    text-orientation: mixed;
    display: inline-block;
    text-align: center;
    margin-bottom: 0.25em; /* 4px -> 0.25em */
  }

  /* 美化后的 move 样式 */
  span.move {
    display: inline-block;
    line-height: 1.2;
    justify-content: center;
    align-items: center;
    text-align: center;
    border-radius: 0.375em; /* 6px -> 0.375em (6/16) */
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    flex-shrink: 0;
    padding: 0.25em 0.5em; /* 4px -> 0.25em, 8px -> 0.5em */
  }

  span.move.red,
  span.move.black {
    min-width: 4em; /* 稍微加宽 */
  }

  span.start {
    flex: 1;
  }

  span.move:hover {
    background-color: var(--background-modifier-hover);
    transform: scale(1.02); /* 悬停时轻微放大 */
  }

  span.move {
    color: var(--text-normal);
  }

  /* 美化后的选中样式 - 增加内边距和圆角 */
  span.move.active {
    background-color: var(--color-accent);
    color: var(--text-on-accent);
    box-shadow: 0 0.125em 0.375em rgba(0, 0, 0, 0.15); /* 0 2px 6px -> 0 0.125em 0.375em */
    font-weight: 500;
    transform: scale(1.02);
  }

  /* 可选：为右侧列表的 li 添加间隙，让选中效果更舒展 */
  .move-list.right li span.move {
    margin: 0.125em 0; /* 2px -> 0.125em */
  }

  /* 可选：底部列表的 move 间距优化 */
  .move-list.bottom li span.move {
    margin: 0.125em 0; /* 2px -> 0.125em */
    padding: 0.375em 0.25em; /* 6px -> 0.375em, 4px -> 0.25em */
  }
</style>
