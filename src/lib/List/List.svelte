<script lang="ts">
  import { tick } from "svelte";
  import { scrollToBTN } from "../../utils/utils";
  import type { EventBus } from "../../core/event-bus";
  import type { ChessNode, ISettings } from "../../types";

  interface Props {
    settings: ISettings;
    currentStep: number;
    moves: ChessNode[];
    eventBus: EventBus;
  }
  let { settings, currentStep, moves, eventBus }: Props = $props();

  let itemRefs: HTMLLIElement[] = [];
  let ulRef: HTMLUListElement | null = null;

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
<div class="move-container {settings.position}">
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
            {settings.showMovelistText ? move.move?.zh ?? "" : "红"}
          </span>
          {#if moves[i + 1]}
            <span
              class="move black"
              class:active={currentStep === i + 2}
              onclick={() => eventBus.emit("clickstep", i + 2)}
            >
              {settings.showMovelistText ? moves[i + 1].move?.zh ?? "" : "黑"}
            </span>
          {/if}
        </li>
      {/if}
    {/each}
  </ul>
</div>

<style>
  /* ========== 基础容器样式 ========== */
  .move-container {
    font-size: var(--xq-font-size, 12px);
    padding: 0;
    margin: 0;
  }

  .move-list {
    display: flex;
    padding: 0;
    margin: 0;
    color: var(--text-normal);
    background-color: var(--background-primary-alt);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
  }

  /* ========== 右侧垂直布局 (right) ========== */
  .move-list.right {
    flex-direction: column;
    height: calc(var(--xq-cell-size, 50px) * 10);
    overflow-y: auto;
    overflow-x: hidden;
    flex-wrap: nowrap;
    align-items: flex-start;
  }

  .move-list.right li {
    display: flex;
    flex-wrap: nowrap;
    flex-shrink: 0;
    flex-grow: 0;
    align-items: center;
    gap: 0.5em;
    width: 100%;
    padding: 0;
    margin: 0;
    border-bottom: none;
    white-space: nowrap;
  }

  .move-list.right .roundnum {
    display: inline-block;
    min-width: 1.5em;
    max-width: 3em;
    text-align: right;
    margin-right: 0.4em;
    color: var(--text-muted);
    flex-shrink: 0;
    white-space: nowrap;
  }

  /* right 布局的 move 按钮 */
  .move-list.right span.move {
    display: inline-block;
    line-height: 1.2;
    text-align: center;
    border-radius: 0.375em;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    flex-shrink: 0;
    padding: 0.25em 0.5em;
    margin: 0.125em 0;
    color: var(--text-normal);
  }

  .move-list.right span.move.red,
  .move-list.right span.move.black {
    min-width: 4em;
  }

  .move-list.right span.start {
    flex: 1;
  }

  .move-list.right span.move:hover {
    background-color: var(--background-modifier-hover);
    transform: scale(1.02);
  }

  .move-list.right span.move.active {
    background-color: var(--color-accent);
    color: var(--text-on-accent);
    box-shadow: 0 0.125em 0.375em rgba(0, 0, 0, 0.15);
    font-weight: 500;
    transform: scale(1.02);
  }

  /* ========== 底部水平布局 (bottom) - 竖向文字 ========== */
  .move-list.bottom {
    width: calc(var(--xq-cell-size, 50px) * 10.08);
    overflow-x: auto;
    overflow-y: hidden;
    flex-wrap: nowrap;
    align-items: flex-start;
  }

  .move-list.bottom li {
    display: flex;
    flex-wrap: nowrap;
    flex-shrink: 0;
    flex-grow: 0;
    align-items: center;
    justify-content: center;
    gap: 0.25em;
    padding: 0.125em 0.125em; /* 减小上下内边距 */
    margin: 0;
    border-bottom: none;
    white-space: nowrap;
    writing-mode: vertical-rl;
    text-orientation: upright;
  }

  .move-list.bottom .roundnum {
    writing-mode: horizontal-tb;
    text-orientation: mixed;
    display: inline-block;
    text-align: center;
    margin-bottom: 0.125em; /* 减小底部间距 */
  }

  /* bottom 布局的 move 按钮 - 竖向文字，减小内边距 */
  .move-list.bottom span.move {
    display: inline-block;
    line-height: 1.2;
    text-align: center;
    border-radius: 0.25em; /* 稍小圆角 */
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    flex-shrink: 0;
    padding: 0.125em 0.125em; /* 减小内边距，让竖向文字更紧凑 */
    margin: 0.0625em 0; /* 极小垂直间距 */
    color: var(--text-normal);
    /* font-size: 0.9em; 可选：稍微缩小字体 */
  }

  .move-list.bottom span.move.red,
  .move-list.bottom span.move.black {
    min-width: auto; /* 竖向排列不需要固定最小宽度 */
  }

  .move-list.bottom span.start {
    flex: 1;
  }

  .move-list.bottom span.move:hover {
    background-color: var(--background-modifier-hover);
    transform: scale(1.02);
  }

  .move-list.bottom span.move.active {
    background-color: var(--color-accent);
    color: var(--text-on-accent);
    box-shadow: 0 0.125em 0.375em rgba(0, 0, 0, 0.15);
    font-weight: 500;
    transform: scale(1.02);
  }
</style>
