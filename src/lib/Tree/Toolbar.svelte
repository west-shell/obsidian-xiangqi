<script lang="ts">
  import { Menu, setIcon } from "obsidian";
  import type { EventBus } from "../../core/event-bus";
  import type { IOptions, ISettings } from "../../types";
  import { onLangChange, t } from "../../i18n";

  interface Props {
    eventBus: EventBus;
    fen?: string;
    options?: IOptions;
    settings?: ISettings;
  }
  let { eventBus, fen = "", options = {}, settings }: Props = $props();

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

  let autoAnalyze = $state(false);
  let engineBusy = $state(false);
  let batchAnalyzing = $state(false);
  let pendingBatch = false;
  let singleAnalyzing = false;

  $effect(() => {
    eventBus.on("engine-busy", () => {
      engineBusy = true;
      if (pendingBatch) {
        batchAnalyzing = true;
        pendingBatch = false;
      } else if (autoAnalyze) {
        // autoAnalyze already set
      } else {
        singleAnalyzing = true;
      }
    });
    eventBus.on("engine-result", () => {
      engineBusy = false;
      singleAnalyzing = false;
    });
    eventBus.on("engine-batch-done", () => {
      engineBusy = false;
      batchAnalyzing = false;
    });
    eventBus.on("engine-stop", () => {
      batchAnalyzing = false;
      autoAnalyze = false;
      engineBusy = false;
      singleAnalyzing = false;
    });
    eventBus.on("engine-batch-stop", () => {
      batchAnalyzing = false;
      engineBusy = false;
    });
  });

  $effect(() => {
    if (autoAnalyze && fen) {
      eventBus.emit("engine-analyze", true);
    }
  });

  function toggleAutoAnalyze() {
    if (autoAnalyze) {
      autoAnalyze = false;
      eventBus.emit("engine-stop");
    } else {
      autoAnalyze = true;
      eventBus.emit("engine-analyze");
    }
  }

  let analyzeBtnClass = $derived(
    autoAnalyze && engineBusy
      ? " engine-active engine-busy"
      : autoAnalyze
        ? " engine-active"
        : singleAnalyzing
          ? " engine-busy"
          : batchAnalyzing
            ? " engine-active engine-busy"
            : "",
  );

  let isprotected = $derived(options?.protected || false);
  let saveBtnClass = $derived(modified ? "unsaved" : "saved");

  const buildButtons = (v: number) => [
    { title: t("toolbar.reset", v), icon: "rotate-ccw", event: "reset" },
    {
      title: t("toolbar.start", v),
      icon: "arrow-left-to-line",
      event: "toStart",
    },
    { title: t("toolbar.back", v), icon: "arrow-left", event: "back" },
    { title: t("toolbar.forward", v), icon: "arrow-right", event: "next" },
    { title: t("toolbar.end", v), icon: "arrow-right-to-line", event: "toEnd" },
    { title: t("toolbar.flip", v), icon: "flip-vertical", event: "rotate" },
    {
      title: t("toolbar.editMenu", v),
      icon: "file-pen-line",
      event: "toggle-edit-menu",
    },
    {
      title: t("toolbar.nodeMenu", v),
      icon: "scan-line",
      event: "toggle-node-menu",
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

  function emitEvent(name: string, payload: string | null = null) {
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

  function handleEditMenu(evt: MouseEvent) {
    const menu = new Menu();

    menu.addItem((mi) => {
      mi.setTitle(t("toolbar.editBoard", _lv))
        .setIcon("pencil")
        .onClick(() => emitEvent("edit-board"));
    });

    menu.addItem((mi) => {
      mi.setTitle(t("toolbar.editTags", _lv))
        .setIcon("file-text")
        .onClick(() => emitEvent("edit-tags"));
    });

    menu.showAtMouseEvent(evt);
  }

  function handleNodeMenu(evt: MouseEvent) {
    const menu = new Menu();

    menu.addItem((mi) => {
      mi.setTitle(t("toolbar.delete", _lv))
        .setIcon("circle-x")
        .onClick(() => emitEvent("remove"));
    });

    menu.addItem((mi) => {
      mi.setTitle(t("toolbar.promote", _lv))
        .setIcon("arrow-up-wide-narrow")
        .onClick(() => emitEvent("promote"));
    });

    menu.addItem((mi) => {
      mi.setTitle(t("toolbar.annotate", _lv)).setIcon("tag");
      const sub = mi.setSubmenu();
      annotations.forEach((ann) => {
        sub.addItem((si) => {
          si.setTitle(ann.title)
            .setIcon(ann.icon)
            .onClick(() => emitEvent(ann.event, ann.symbol));
        });
      });
    });

    menu.showAtMouseEvent(evt);
  }

  function handleAnalyzeMenu(evt: MouseEvent) {
    const menu = new Menu();

    menu.addItem((mi) => {
      mi.setTitle(t("toolbar.analyzeDepth", _lv))
        .setIcon("sliders-horizontal")
        .onClick(() => eventBus.emit("set-depth"));
    });

    menu.addItem((mi) => {
      mi.setTitle(
        autoAnalyze ? t("toolbar.stop", _lv) : t("toolbar.autoAnalyze", _lv),
      )
        .setIcon(autoAnalyze ? "circle-stop" : "play")
        .onClick(() => toggleAutoAnalyze());
    });

    menu.addItem((mi) => {
      mi.setTitle(
        batchAnalyzing
          ? t("toolbar.cancelBatch", _lv)
          : t("toolbar.analyzeBatch", _lv),
      )
        .setIcon(batchAnalyzing ? "circle-stop" : "workflow")
        .onClick(() => {
          if (batchAnalyzing) {
            eventBus.emit("engine-batch-stop");
          } else {
            pendingBatch = true;
            eventBus.emit("engine-analyze-batch");
          }
        });
    });

    menu.showAtMouseEvent(evt);
  }
</script>

<div class="toolbar-container xq-layout__toolbar">
  {#each buttons as { title, icon, event } (event)}
    <button
      class="toolbar-btn"
      aria-label={title}
      use:useSetIcon={icon}
      onclick={(e) => {
        if (event === "toggle-edit-menu") {
          handleEditMenu(e);
        } else if (event === "toggle-node-menu") {
          handleNodeMenu(e);
        } else if (event === "rotate") {
          eventBus.emit("rotate");
        } else {
          emitEvent(event);
        }
      }}
    ></button>
  {/each}

  <button
    class="toolbar-btn{analyzeBtnClass}"
    aria-label={t("toolbar.analyzeMenu", _lv)}
    use:useSetIcon={"brain"}
    onclick={(e) => handleAnalyzeMenu(e)}
  ></button>

  <button
    class="toolbar-btn {saveBtnClass}"
    aria-label={t("toolbar.save", _lv)}
    use:useSetSaveIcon
    disabled={isprotected}
    onclick={() => emitEvent("save")}
  ></button>
</div>

<style>
  .toolbar-btn.saved {
    background-color: hsl(122, 39%, 49%);
  }

  .toolbar-btn.unsaved {
    background-color: hsl(35, 100%, 50%);
  }

  .toolbar-container {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    align-items: center;
  }

  .toolbar-container :global(.toolbar-btn) {
    width: 28px;
    height: 28px;
    padding: 0;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .toolbar-container :global(.toolbar-btn svg) {
    width: 18px;
    height: 18px;
  }

  .engine-active {
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .engine-busy {
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
