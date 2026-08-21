<script lang="ts">
  import { Menu, setIcon } from "obsidian";
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
    eventBus.on("reset", () => {
      modified = false;
    });
  });

  let autoAnalyze = $state(false);
  let engineBusy = $state(false);
  let batchAnalyzing = $state(false);

  $effect(() => {
    eventBus.on("engine-busy", () => {
      engineBusy = true;
    });
    eventBus.on("engine-result", () => {
      engineBusy = false;
    });
    eventBus.on("engine-batch-start", () => {
      batchAnalyzing = true;
    });
    eventBus.on("engine-batch-done", () => {
      engineBusy = false;
      batchAnalyzing = false;
    });
    eventBus.on("engine-auto-on", () => {
      autoAnalyze = true;
    });
    eventBus.on("engine-auto-off", () => {
      autoAnalyze = false;
    });
    eventBus.on("engine-stop", () => {
      autoAnalyze = false;
      engineBusy = false;
      batchAnalyzing = false;
    });
    eventBus.on("engine-batch-stop", () => {
      batchAnalyzing = false;
    });
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
  let buttons = $derived(buildButtons(_lv));

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
        .setChecked(settings?.showMoveAnnotations ?? true)
        .onClick(() => {
          if (!plugin) return;
          plugin.settings.showMoveAnnotations =
            !plugin.settings.showMoveAnnotations;
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
        } else if (event === "toggle-board-menu") {
          handleBoardMenu(e);
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
    width: 30px;
    height: 30px;
    padding: 0;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .toolbar-container :global(.toolbar-btn svg) {
    width: 20px;
    height: 20px;
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
