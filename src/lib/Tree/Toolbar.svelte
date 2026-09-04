<script lang="ts">
  import { Menu, setIcon } from "obsidian";
  import { onDestroy } from "svelte";
  import type { EventBus } from "../../core/event-bus";
  import type { IOptions, ISettings } from "../../types";
  import type ChessPlugin from "../../main";
  import { onLangChange, t } from "../../i18n";

  interface Props {
    eventBus: EventBus;
    options?: IOptions;
    settings?: ISettings;
    plugin?: ChessPlugin;
    rotated?: boolean;
  }
  let {
    eventBus,
    options = {},
    settings,
    plugin,
    rotated = false,
  }: Props = $props();

  let _lv = $state(0);
  const unsubLang = onLangChange(() => _lv++);
  onDestroy(() => {
    unsubLang();
  });

  let modified = $state(false);

  $effect(() => {
    const onModified = () => {
      modified = true;
    };
    const onResetModified = () => {
      modified = false;
    };
    eventBus.on("modified", onModified);
    eventBus.on("setViewData", onResetModified);
    eventBus.on("load", onResetModified);
    eventBus.on("save", onResetModified);
    eventBus.on("reset", onResetModified);
    return () => {
      eventBus.off("modified", onModified);
      eventBus.off("setViewData", onResetModified);
      eventBus.off("load", onResetModified);
      eventBus.off("save", onResetModified);
      eventBus.off("reset", onResetModified);
    };
  });

  let autoAnalyze = $state(false);
  let engineBusy = $state(false);
  let batchAnalyzing = $state(false);

  $effect(() => {
    const onBusy = () => {
      engineBusy = true;
    };
    const onResult = () => {
      engineBusy = false;
    };
    const onBatchStart = () => {
      batchAnalyzing = true;
    };
    const onBatchDone = () => {
      engineBusy = false;
      batchAnalyzing = false;
    };
    const onAutoOn = () => {
      autoAnalyze = true;
    };
    const onAutoOff = () => {
      autoAnalyze = false;
    };
    const onStop = () => {
      autoAnalyze = false;
      engineBusy = false;
      batchAnalyzing = false;
    };
    const onBatchStop = () => {
      batchAnalyzing = false;
    };
    eventBus.on("engine-busy", onBusy);
    eventBus.on("engine-result", onResult);
    eventBus.on("engine-batch-start", onBatchStart);
    eventBus.on("engine-batch-done", onBatchDone);
    eventBus.on("engine-auto-on", onAutoOn);
    eventBus.on("engine-auto-off", onAutoOff);
    eventBus.on("engine-stop", onStop);
    eventBus.on("engine-batch-stop", onBatchStop);
    eventBus.emit("request-engine-state");
    return () => {
      eventBus.off("engine-busy", onBusy);
      eventBus.off("engine-result", onResult);
      eventBus.off("engine-batch-start", onBatchStart);
      eventBus.off("engine-batch-done", onBatchDone);
      eventBus.off("engine-auto-on", onAutoOn);
      eventBus.off("engine-auto-off", onAutoOff);
      eventBus.off("engine-stop", onStop);
      eventBus.off("engine-batch-stop", onBatchStop);
    };
  });

  let analyzeBtnClass = $derived(
    autoAnalyze && engineBusy
      ? " engine-active engine-busy"
      : autoAnalyze
        ? " engine-active"
        : engineBusy
          ? " engine-busy"
          : batchAnalyzing
            ? " engine-active engine-busy"
            : "",
  );

  let isprotected = $derived(options?.protected || false);
  let saveBtnClass = $derived(modified ? "unsaved" : "saved");

  const buildNavButtons = (v: number) => [
    { title: t("toolbar.reset", v), icon: "rotate-ccw", event: "reset" },
    {
      title: t("toolbar.start", v),
      icon: "arrow-left-to-line",
      event: "toStart",
    },
    { title: t("toolbar.back", v), icon: "arrow-left", event: "back" },
    { title: t("toolbar.forward", v), icon: "arrow-right", event: "next" },
    { title: t("toolbar.end", v), icon: "arrow-right-to-line", event: "toEnd" },
  ];
  let navButtons = $derived(buildNavButtons(_lv));

  const buildMenuButtons = (v: number) => [
    {
      title: t("toolbar.board", v),
      icon: "layout-grid",
      event: "toggle-board-menu",
    },
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
  let menuButtons = $derived(buildMenuButtons(_lv));

  const buildAnnotations = (v: number) => [
    {
      title: t("annotation.w+", v),
      icon: "thumbs-up",
      symbol: "+",
      event: "annotation",
    },
    {
      title: t("annotation.b+", v),
      icon: "thumbs-down",
      symbol: "-",
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
      symbol: "bm",
      event: "annotation",
    },
    {
      title: t("annotation.br", v),
      icon: "star",
      symbol: "st",
      event: "annotation",
    },
  ];
  let annotations = $derived(buildAnnotations(_lv));

  function handleMenuButton(event: string, evt: MouseEvent) {
    if (event === "toggle-edit-menu") {
      handleEditMenu(evt);
    } else if (event === "toggle-node-menu") {
      handleNodeMenu(evt);
    } else if (event === "toggle-board-menu") {
      handleBoardMenu(evt);
    }
  }

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

    menu.addSeparator();

    menu.addItem((mi) => {
      mi.setTitle(t("toolbar.import", _lv))
        .setIcon("log-in")
        .onClick(() => eventBus.emit("import"));
    });

    menu.addItem((mi) => {
      mi.setTitle(t("toolbar.export", _lv))
        .setIcon("log-out")
        .onClick(() => eventBus.emit("export"));
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
      mi.onClick(() => {
        const sub = new Menu();
        annotations.forEach((ann) => {
          sub.addItem((si) => {
            si.setTitle(ann.title)
              .setIcon(ann.icon)
              .onClick(() => emitEvent(ann.event, ann.symbol));
          });
        });
        sub.showAtMouseEvent(evt);
      });
    });

    menu.showAtMouseEvent(evt);
  }

  function handleBoardMenu(evt: MouseEvent) {
    const menu = new Menu();

    menu.addItem((mi) => {
      mi.setTitle(t("boardMenu.flip", _lv))
        .setChecked(rotated)
        .onClick(() => eventBus.emit("rotate"));
    });

    menu.addItem((mi) => {
      mi.setTitle(t("boardMenu.showCoordinates", _lv))
        .setChecked(settings?.showCoordinateLabels ?? true)
        .onClick(() => {
          if (!plugin) return;
          plugin.settings.showCoordinateLabels =
            !plugin.settings.showCoordinateLabels;
          void plugin.saveSettings();
          eventBus.emit("updateUI");
        });
    });

    menu.addItem((mi) => {
      mi.setTitle(t("boardMenu.showTurnBorder", _lv))
        .setChecked(settings?.showTurnBorder ?? true)
        .onClick(() => {
          if (!plugin) return;
          plugin.settings.showTurnBorder = !plugin.settings.showTurnBorder;
          void plugin.saveSettings();
          eventBus.emit("updateUI");
        });
    });

    menu.addSeparator();

    menu.addItem((mi) => {
      mi.setTitle(t("boardMenu.showLastMove", _lv))
        .setChecked(settings?.showLastMove ?? true)
        .onClick(() => {
          if (!plugin) return;
          plugin.settings.showLastMove = !plugin.settings.showLastMove;
          void plugin.saveSettings();
          eventBus.emit("updateUI");
        });
    });

    menu.addItem((mi) => {
      mi.setTitle(t("boardMenu.showNextMove", _lv))
        .setChecked(settings?.showNextMove ?? true)
        .onClick(() => {
          if (!plugin) return;
          plugin.settings.showNextMove = !plugin.settings.showNextMove;
          void plugin.saveSettings();
          eventBus.emit("updateUI");
        });
    });

    if (settings?.showNextMove) {
      menu.addItem((mi) => {
        mi.setTitle(t("boardMenu.showOtherVariations", _lv))
          .setChecked(settings.showOtherVariations ?? true)
          .onClick(() => {
            if (!plugin) return;
            plugin.settings.showOtherVariations =
              !plugin.settings.showOtherVariations;
            void plugin.saveSettings();
            eventBus.emit("updateUI");
          });
      });
    }

    menu.addSeparator();

    menu.addItem((mi) => {
      mi.setTitle(t("boardMenu.showEngineBestMove", _lv))
        .setChecked(settings?.showEngineBestMove ?? true)
        .onClick(() => {
          if (!plugin) return;
          plugin.settings.showEngineBestMove =
            !plugin.settings.showEngineBestMove;
          void plugin.saveSettings();
          eventBus.emit("updateUI");
        });
    });

    menu.addItem((mi) => {
      mi.setTitle(t("boardMenu.showEnginePonder", _lv))
        .setChecked(settings?.showEnginePonder ?? true)
        .onClick(() => {
          if (!plugin) return;
          plugin.settings.showEnginePonder = !plugin.settings.showEnginePonder;
          void plugin.saveSettings();
          eventBus.emit("updateUI");
        });
    });

    menu.addItem((mi) => {
      mi.setTitle(t("boardMenu.showAnnotations", _lv))
        .setChecked(settings?.showBoardAnnotations ?? true)
        .onClick(() => {
          if (!plugin) return;
          plugin.settings.showBoardAnnotations =
            !plugin.settings.showBoardAnnotations;
          void plugin.saveSettings();
          eventBus.emit("updateUI");
        });
    });

    menu.showAtMouseEvent(evt);
  }

  function handleAnalyzeMenu(evt: MouseEvent) {
    const menu = new Menu();

    menu.addItem((mi) => {
      mi.setTitle(t("toolbar.engineSettings", _lv))
        .setIcon("sliders-horizontal")
        .onClick(() => eventBus.emit("open-engine-settings"));
    });

    menu.addItem((mi) => {
      mi.setTitle(t("toolbar.analyze", _lv))
        .setIcon("brain")
        .onClick(() => eventBus.emit("analyze-btn-click", "once"));
    });

    menu.addItem((mi) => {
      mi.setTitle(
        autoAnalyze ? t("toolbar.stop", _lv) : t("toolbar.autoAnalyze", _lv),
      )
        .setIcon(autoAnalyze ? "circle-stop" : "play")
        .onClick(() => eventBus.emit("analyze-btn-click", "auto"));
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
            eventBus.emit("analyze-btn-click", "batch");
          }
        });
    });

    menu.showAtMouseEvent(evt);
  }
</script>

<div class="toolbar-container chess-layout__toolbar">
  <div class="toolbar-group">
    {#each navButtons as { title, icon, event }, i (event)}
      {#if i === 1}<div class="toolbar-sep"></div>{/if}
      <button
        class="toolbar-btn"
        aria-label={title}
        use:useSetIcon={icon}
        onclick={() => emitEvent(event)}
      ></button>
    {/each}
  </div>

  <div class="toolbar-group">
    {#each menuButtons as { title, icon, event } (event)}
      <button
        class="toolbar-btn"
        aria-label={title}
        use:useSetIcon={icon}
        onclick={(e) => handleMenuButton(event, e)}
      ></button>
    {/each}
  </div>

  <button
    class="toolbar-btn toolbar-single{analyzeBtnClass}"
    aria-label={t("toolbar.analyzeMenu", _lv)}
    use:useSetIcon={"brain"}
    onclick={(e) => handleAnalyzeMenu(e)}
  ></button>

  <button
    class="toolbar-btn toolbar-single {saveBtnClass}"
    aria-label={t("toolbar.save", _lv)}
    use:useSetSaveIcon
    disabled={isprotected}
    onclick={() => emitEvent("save")}
  ></button>
</div>

<style>
  .toolbar-btn.saved {
    background-color: var(--color-green, hsl(122, 39%, 49%));
    color: var(--text-on-accent);
  }

  .toolbar-btn.saved:hover {
    background-color: var(--color-green, hsl(122, 39%, 49%));
    filter: brightness(1.1);
  }

  .toolbar-btn.unsaved {
    background-color: var(--color-orange, hsl(35, 100%, 50%));
    color: var(--text-on-accent);
  }

  .toolbar-btn.unsaved:hover {
    background-color: var(--color-orange, hsl(35, 100%, 50%));
    filter: brightness(1.1);
  }

  .toolbar-container {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  .toolbar-single {
    width: 28px;
    height: 28px;
  }

  .toolbar-btn.engine-active {
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .toolbar-btn.engine-active:hover {
    background-color: var(--interactive-accent);
    filter: brightness(1.15);
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
