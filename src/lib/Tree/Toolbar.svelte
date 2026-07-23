<script lang="ts">
  import { Menu, setIcon } from "obsidian";
  import type { EventBus } from "../../core/event-bus";
  import { onLangChange, t } from "../../i18n";

  interface Props {
    eventBus: EventBus;
    fen?: string;
  }
  let { eventBus, fen = "" }: Props = $props();

  let _lv = $state(0);
  onLangChange(() => _lv++);

  let modified = $state(false);

  $effect(() => {
    eventBus.on("modified", () => {
      modified = true;
    });
    eventBus.on("setViewData", () => {
      modified = false;
    });
    eventBus.on("load", () => {
      modified = false;
    });
    eventBus.on("save", () => {
      modified = false;
    });
  });

  let saveBtnClass = $derived(modified ? "unsaved" : "saved");

  let autoAnalyze = $state(false);
  let engineBusy = $state(false);
  let batchAnalyzing = $state(false);
  let pendingBatch = false;

  $effect(() => {
    eventBus.on("engine-busy", () => {
      engineBusy = true;
      if (pendingBatch) {
        batchAnalyzing = true;
        pendingBatch = false;
      } else {
        autoAnalyze = true;
      }
    });
    eventBus.on("engine-result", () => {
      engineBusy = false;
    });
    eventBus.on("engine-batch-done", () => {
      engineBusy = false;
      batchAnalyzing = false;
    });
    eventBus.on("engine-stop", () => {
      batchAnalyzing = false;
      autoAnalyze = false;
      engineBusy = false;
    });
    eventBus.on("engine-batch-stop", () => {
      batchAnalyzing = false;
      engineBusy = false;
    });
  });

  $effect(() => {
    if (autoAnalyze && fen) {
      eventBus.emit("engine-analyze");
    }
  });

  function toggleAutoAnalyze() {
    if (autoAnalyze) {
      autoAnalyze = false;
      eventBus.emit("engine-stop");
    } else {
      eventBus.emit("engine-analyze");
    }
  }

  const buildButtons = (v: number) => [
    { title: t("toolbar.reset", v), icon: "rotate-ccw", event: "reset" },
    { title: t("toolbar.delete", v), icon: "circle-x", event: "remove" },
    {
      title: t("toolbar.promote", v),
      icon: "arrow-up-wide-narrow",
      event: "promote",
    },
    {
      title: t("toolbar.start", v),
      icon: "arrow-left-to-line",
      event: "toStart",
    },
    { title: t("toolbar.back", v), icon: "arrow-left", event: "back" },
    { title: t("toolbar.forward", v), icon: "arrow-right", event: "next" },
    { title: t("toolbar.end", v), icon: "arrow-right-to-line", event: "toEnd" },
    { title: t("toolbar.flip", v), icon: "flip-vertical", event: "rotate" },
    { title: "皮卡鱼Web", icon: "external-link", event: "openPikafish" },
    {
      title: t("toolbar.annotate", v),
      icon: "tag",
      event: "toggle-annotation-menu",
    },
  ];
  let buttons = $derived(buildButtons(_lv));

  const buildAnnotations = (v: number) => [
    {
      title: t("annotation.w+", v),
      icon: "thumbs-up",
      symbol: "W+",
      event: "annotation",
    },
    {
      title: t("annotation.b+", v),
      icon: "thumbs-down",
      symbol: "B+",
      event: "annotation",
    },
    {
      title: t("annotation.eq", v),
      icon: "handshake",
      symbol: "=",
      event: "annotation",
    },
    {
      title: t("annotation.key", v),
      icon: "bookmark",
      symbol: "?",
      event: "annotation",
    },
    {
      title: t("annotation.br", v),
      icon: "star",
      symbol: "!",
      event: "annotation",
    },
  ];
  let annotations = $derived(buildAnnotations(_lv));

  function emitEvent(name: string, payload: unknown = null) {
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

  function useSetSaveIcon(el: HTMLElement) {
    setIcon(el, "save");
  }

  function handleAnnotationMenu(evt: MouseEvent) {
    const menu = new Menu();

    annotations.forEach((item) => {
      menu.addItem((mi) => {
        mi.setTitle(item.title)
          .setIcon(item.icon)
          .onClick(() => emitEvent(item.event, item.symbol));
      });
    });

    menu.showAtMouseEvent(evt);
  }
</script>

<div class="toolbar-container">
  {#each buttons as { title, icon, event } (event)}
    <button
      class="toolbar-btn"
      aria-label={title}
      use:useSetIcon={icon}
      onclick={(e) => {
        if (event === "toggle-annotation-menu") {
          handleAnnotationMenu(e);
        } else if (event === "rotate") {
          eventBus.emit("rotate");
        } else {
          emitEvent(event);
        }
      }}
    ></button>
  {/each}

  <button
    class="toolbar-btn engine-btn"
    class:active={autoAnalyze}
    class:busy={engineBusy}
    aria-label={autoAnalyze
      ? t("toolbar.stop", _lv)
      : t("toolbar.analyze", _lv)}
    use:useSetIcon={autoAnalyze ? "circle-stop" : "brain"}
    onclick={toggleAutoAnalyze}
  ></button>

  <button
    class="toolbar-btn engine-btn"
    class:busy={engineBusy && !batchAnalyzing}
    class:batch-analyzing={batchAnalyzing}
    aria-label={batchAnalyzing
      ? t("toolbar.cancelBatch", _lv)
      : t("toolbar.analyzeBatch", _lv)}
    use:useSetIcon={batchAnalyzing ? "circle-stop" : "workflow"}
    onclick={() => {
      if (batchAnalyzing) {
        eventBus.emit("engine-batch-stop");
      } else {
        pendingBatch = true;
        eventBus.emit("engine-analyze-batch");
      }
    }}
  ></button>

  <button
    class="toolbar-btn {saveBtnClass}"
    aria-label={t("toolbar.save", _lv)}
    use:useSetSaveIcon
    onclick={() => emitEvent("save")}
  ></button>
</div>

<style>
  :global(.tree-view.right) .toolbar-container {
    display: flex;
    flex-direction: column;
    flex-wrap: nowrap;
    justify-content: flex-start;
    align-items: center;
    gap: 2px;
  }

  :global(.tree-view.bottom) .toolbar-container {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    justify-content: flex-start;
    align-items: center;
    width: 100%;
    box-sizing: border-box;
  }

  :global(.tree-view.bottom) .toolbar-container .toolbar-btn {
    flex: 0 1 auto;
    min-width: 24px;
    font-size: clamp(12px, 3vw, 16px);
    padding: clamp(2px, 1vw, 6px) clamp(4px, 2vw, 10px);
    margin: 0;
  }

  :global(.tree-view.right) .toolbar-container .toolbar-btn {
    flex: 0 1 auto;
    min-height: 24px;
    font-size: clamp(12px, 3vw, 16px);
    padding: clamp(2px, 1vw, 6px) clamp(4px, 2vw, 10px);
    margin: 0;
  }

  .toolbar-btn {
    border: none;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition:
      background-color 0.2s ease,
      transform 0.1s ease;
  }

  .toolbar-btn.saved {
    background-color: hsl(122, 39%, 49%);
  }

  .toolbar-btn.unsaved {
    background-color: hsl(35, 100%, 50%);
  }

  .engine-btn.active {
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .engine-btn.active.busy {
    animation: engine-pulse 1.2s ease-in-out infinite;
  }

  .engine-btn.batch-analyzing {
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
    animation: engine-pulse 1.2s ease-in-out infinite;
  }

  @keyframes engine-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }
</style>
