<script lang="ts">
  import { tick } from "svelte";
  import { scrollToBTN } from "../../utils/utils";
  import type { EventBus } from "../../core/event-bus";
  import type { ISettings, IBoard, IMove } from "../../types";

  interface Props {
    settings: ISettings;
    currentStep: number;
    moves: IMove[];
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
  style="--height: {11 * settings.cellSize}px;
    --width: {10 * settings.cellSize}px;
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
            {settings.showMovelistText ? move.WXF : "红"}
          </span>
          {#if moves[i + 1]}
            <span
              class="move black"
              class:active={currentStep === i + 2}
              onclick={() => eventBus.emit("clickstep", i + 2)}
            >
              {settings.showMovelistText ? moves[i + 1].WXF : "黑"}
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
    overflow-x: auto; /* 添加水平滚动条以处理溢出 */
    width: var(--width);
    /* max-height: calc(var(--width) / 2); */
    align-content: flex-start;
    padding: 0;
    margin: 0;
    background-color: var(--background-secondary);
    border-top: 1px solid var(--background-modifier-border);
  }

  .move-list.right li {
    display: flex; /* 明确设置为 flex 容器 */
    flex-wrap: nowrap; /* 确保 li 内部的元素不换行 */
    flex-shrink: 0; /* 防止 li 元素收缩 */
    flex-grow: 0; /* 防止 li 元素增长 */
    align-items: center;
    gap: 0.25em;
    padding: 2px;
    margin: 0;
    border-bottom: none;
    width: 100%; /* 每个 li 元素占据一行 */
    white-space: nowrap; /* 强制 li 元素本身不换行 */
  }

  .move-list.bottom li {
    display: flex; /* 明确设置为 flex 容器 */
    flex-wrap: nowrap; /* 确保 li 内部的元素不换行 */
    flex-shrink: 0; /* 防止 li 元素收缩 */
    flex-grow: 0; /* 防止 li 元素增长 */
    align-items: center;
    gap: 0.25em;
    padding: 2px;
    margin: 0;
    border-bottom: none;
    /* height: 100%; 每个 li 元素占据一行 */
    white-space: nowrap; /* 强制 li 元素本身不换行 */
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
    flex-shrink: 0; /* 防止收缩 */
    color: var(--text-muted);
  }

  .move-list.bottom .roundnum {
    writing-mode: horizontal-tb; /* 强制水平方向 */
    text-orientation: mixed; /* 确保数字横排 */
    display: inline-block;
    width: 2ch; /* 固定宽度对齐 */
    text-align: center; /* 右对齐，个位数前会空出 */
  }

  span.move {
    display: inline-block;
    line-height: 1;
    justify-content: center;
    align-items: center;
    text-align: center;
    border-radius: 4px;
    color: var(--text-accent);
    cursor: pointer;
    transition: background-color 0.2s ease;
    white-space: nowrap;
    flex-shrink: 0; /* 防止收缩 */
  }

  span.start {
    flex: 1;
  }

  span.move:hover {
    background-color: var(--background-modifier-hover);
  }

  span.move {
    /* color: #337ab7; */
    color: var(--text-normal);
    padding: 2px;
  }

  span.move.active {
    /* background-color: var(--interactive-accent); */
    /* color: red; */
    color: var(--text-error);
    /* font-weight: bold; */
  }
</style>
