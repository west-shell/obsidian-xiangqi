<script lang="ts">
  import { addIcon, Menu, setIcon } from "obsidian";
  import { onDestroy } from "svelte";
  import {
    ANALYSIS_SITES,
    CLS_PREFIX,
    FIRST_SIDE_KEY,
    SECOND_SIDE_KEY,
  } from "../../chess";
  import { BOARD_THEME_PICKER, PIECE_SET_PICKER } from "../../style/themes";
  import type { EventBus } from "../../core/event-bus";
  import type { ChessNode, IOptions, ISettings } from "../../types";
  import type ChessPlugin from "../../main";
  import { getLang, onLangChange, t } from "../../i18n";
  import { hasAnnotation, STUDY_GLYPHS } from "../../utils/annotation-glyphs";
  import { annotationBadgeIconSvg } from "../../utils/icon";

  interface Props {
    eventBus: EventBus;
    options?: IOptions;
    settings?: ISettings;
    plugin?: ChessPlugin;
    rotated?: boolean;
    isBlockMode?: boolean;
    /** Current tree node, for the annotation menu's checked state. */
    getCurrentNode?: () => ChessNode | null;
  }
  let {
    eventBus,
    options = {},
    settings,
    plugin,
    rotated = false,
    isBlockMode = false,
    getCurrentNode,
  }: Props = $props();

  let _lv = $state(0);
  const unsubLang = onLangChange(() => _lv++);
  onDestroy(() => {
    unsubLang();
  });

  let modified = $state(false);

  // Pinned board/comment ids mirrored from the tree graph (broadcast over
  // the event bus) so the node menu's pin entries reflect current state.
  let pinnedBoardIds = new Set<string>();
  let pinnedCommentIds = new Set<string>();
  $effect(() => {
    const onBoardsChanged = (ids: unknown) => {
      pinnedBoardIds =
        ids instanceof Set ? new Set(ids as Set<string>) : new Set();
    };
    const onCommentsChanged = (ids: unknown) => {
      pinnedCommentIds =
        ids instanceof Set ? new Set(ids as Set<string>) : new Set();
    };
    eventBus.on("pinned-boards-changed", onBoardsChanged);
    eventBus.on("pinned-comments-changed", onCommentsChanged);
    return () => {
      eventBus.off("pinned-boards-changed", onBoardsChanged);
      eventBus.off("pinned-comments-changed", onCommentsChanged);
    };
  });

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
  let simWhite = $state(false);
  let simBlack = $state(false);

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
    const onSimState = (state?: { white: boolean; black: boolean }) => {
      if (!state) return;
      simWhite = state.white;
      simBlack = state.black;
    };
    eventBus.on("engine-busy", onBusy);
    eventBus.on("engine-result", onResult);
    eventBus.on("engine-batch-start", onBatchStart);
    eventBus.on("engine-batch-done", onBatchDone);
    eventBus.on("engine-auto-on", onAutoOn);
    eventBus.on("engine-auto-off", onAutoOff);
    eventBus.on("engine-stop", onStop);
    eventBus.on("engine-batch-stop", onBatchStop);
    eventBus.on("engine-sim-state", onSimState);
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
      eventBus.off("engine-sim-state", onSimState);
    };
  });

  let analyzeBtnClass = $derived(
    autoAnalyze && engineBusy
      ? ` ${CLS_PREFIX}-btn--engine ${CLS_PREFIX}-btn--busy`
      : autoAnalyze
        ? ` ${CLS_PREFIX}-btn--engine`
        : engineBusy
          ? ` ${CLS_PREFIX}-btn--busy`
          : batchAnalyzing
            ? ` ${CLS_PREFIX}-btn--engine ${CLS_PREFIX}-btn--busy`
            : "",
  );

  let isprotected = $derived(options?.protected || false);
  let saveBtnClass = $derived(
    modified ? `${CLS_PREFIX}-btn--unsaved` : `${CLS_PREFIX}-btn--saved`,
  );

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

  let btnCount = $derived(navButtons.length + menuButtons.length + 2);

  // Annotation menu sections follow the catalog (annotation-glyphs.ts):
  // move quality, position, then the legacy custom marks. Every item gets
  // a badge-style SVG icon (annotationBadgeIconSvg) alongside its label.
  const buildAnnotationSections = (v: number) =>
    (["move", "position", "custom"] as const).map((category) => ({
      category,
      items: STUDY_GLYPHS.filter((g) => g.category === category).map((g) => ({
        title: g.side
          ? t(g.nameKey, v).replace(
              "{side}",
              t(g.side === "first" ? FIRST_SIDE_KEY : SECOND_SIDE_KEY, v),
            )
          : t(g.nameKey, v),
        symbol: g.symbol,
        key: g.key,
      })),
    }));
  let annotationSections = $derived(buildAnnotationSections(_lv));

  // Custom SVG icons registered via addIcon, keyed by annotation key.
  const registeredAnnotIcons: Record<string, true> = {};
  function ensureAnnotationIcon(item: {
    key: string;
    symbol: string;
  }): string | null {
    const name = `chess-annot-${item.key}`;
    if (!registeredAnnotIcons[name]) {
      const svg = annotationBadgeIconSvg(item.key, item.symbol);
      if (!svg) return null;
      addIcon(name, svg);
      registeredAnnotIcons[name] = true;
    }
    return name;
  }
  function handleMenuButton(event: string, evt: MouseEvent) {
    if (event === "toggle-edit-menu") {
      handleEditMenu(evt);
    } else if (event === "toggle-node-menu") {
      handleNodeMenu(evt, getCurrentNode?.() ?? null);
    } else if (event === "toggle-board-menu") {
      handleBoardMenu(evt);
    }
  }

  function emitEvent(name: string, payload: unknown = null, nodeId?: string) {
    eventBus.emit("btn-click", { name, payload, nodeId });
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

    if (!isBlockMode) {
      menu.addItem((mi) => {
        mi.setTitle(t("game.new", _lv))
          .setIcon("plus")
          .onClick(() => eventBus.emit("create-game"));
      });
    }

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

  // The node menu acts on a target node: the toolbar button passes the
  // current node, the tree's right-click passes the clicked node (which
  // need not be current). Every action carries the target's id so the
  // edit handlers operate on it without moving the current node.
  function handleNodeMenu(evt: MouseEvent, target: ChessNode | null) {
    const menu = new Menu();
    const nodeId = target?.id;

    menu.addItem((mi) => {
      mi.setTitle(t("toolbar.delete", _lv))
        .setIcon("circle-x")
        .onClick(() => emitEvent("remove", null, nodeId));
    });

    menu.addItem((mi) => {
      mi.setTitle(t("toolbar.removeOtherVariations", _lv))
        .setIcon("scissors")
        .onClick(() => emitEvent("removeOtherVariations", null, nodeId));
    });

    menu.addSeparator();

    menu.addItem((mi) => {
      mi.setTitle(t("toolbar.promote", _lv))
        .setIcon("arrow-up-wide-narrow")
        .onClick(() => emitEvent("promote", null, nodeId));
    });

    menu.addItem((mi) => {
      mi.setTitle(t("toolbar.moveUp", _lv))
        .setIcon("arrow-up")
        .onClick(() => emitEvent("moveUp", null, nodeId));
    });

    menu.addItem((mi) => {
      mi.setTitle(t("toolbar.moveDown", _lv))
        .setIcon("arrow-down")
        .onClick(() => emitEvent("moveDown", null, nodeId));
    });

    menu.addSeparator();

    // Pin board preview / pin comment for the target node (before the
    // annotate entry). The tree graph owns the pin sets and broadcasts
    // them over the event bus; toggling goes through the same bus.
    if (target) {
      const boardPinned = pinnedBoardIds.has(target.id);
      menu.addItem((mi) => {
        mi.setTitle(
          boardPinned ? t("tree.unpinBoard", _lv) : t("tree.pinBoard", _lv),
        )
          .setIcon(boardPinned ? "pin-off" : "pin")
          .onClick(() => eventBus.emit("tree-pin-board", target.id));
      });
      if ((target.comments ?? []).length > 0) {
        const commentPinned = pinnedCommentIds.has(target.id);
        menu.addItem((mi) => {
          mi.setTitle(
            commentPinned
              ? t("tree.unpinComment", _lv)
              : t("tree.pinComment", _lv),
          )
            .setIcon(commentPinned ? "pin-off" : "pin")
            .onClick(() => eventBus.emit("tree-pin-comment", target.id));
        });
      }
    }

    menu.addSeparator();

    menu.addItem((mi) => {
      mi.setTitle(t("toolbar.annotate", _lv)).setIcon("tag");
      mi.onClick(() => {
        const sub = new Menu();
        for (const [sectionIdx, section] of annotationSections.entries()) {
          if (sectionIdx > 0) sub.addSeparator();
          for (const item of section.items) {
            const iconName = ensureAnnotationIcon(item);
            sub.addItem((si) => {
              si.setTitle(item.title);
              if (iconName) si.setIcon(iconName);
              if (target) si.setChecked(hasAnnotation(target, item.key));
              si.onClick(() => emitEvent("annotation", item.key, nodeId));
            });
          }
        }
        sub.showAtMouseEvent(evt);
      });
    });

    menu.showAtMouseEvent(evt);
  }

  // Right-clicking a tree node opens the same node menu targeting the
  // clicked node: the tree graph sends the contextmenu event + node
  // over the bus (no navigation happens).
  $effect(() => {
    const onNodeMenu = (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const data = payload as { event?: unknown; node?: unknown };
      if (!(data.event instanceof MouseEvent) || !data.node) return;
      handleNodeMenu(data.event, data.node as ChessNode);
    };
    eventBus.on("node-menu", onNodeMenu);
    return () => {
      eventBus.off("node-menu", onNodeMenu);
    };
  });

  function handleBoardMenu(evt: MouseEvent) {
    const menu = new Menu();

    if (BOARD_THEME_PICKER && plugin) {
      menu.addItem((mi) => {
        mi.setTitle(t("boardMenu.boardTheme", _lv))
          .setIcon("palette")
          .onClick(() => {
            void BOARD_THEME_PICKER.open(plugin);
          });
      });
    }

    if (PIECE_SET_PICKER && plugin) {
      menu.addItem((mi) => {
        mi.setTitle(t("boardMenu.pieceSet", _lv))
          .setIcon("crown")
          .onClick(() => {
            void PIECE_SET_PICKER.open(plugin);
          });
      });
    }

    menu.addItem((mi) => {
      mi.setTitle(t("boardMenu.flip", _lv))
        .setIcon("refresh-cw")
        .setChecked(rotated)
        .onClick(() => eventBus.emit("rotate"));
    });

    menu.addItem((mi) => {
      mi.setTitle(t("boardMenu.showCoordinates", _lv))
        .setIcon("hash")
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
        .setIcon("box-select")
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
        .setIcon("history")
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
        .setIcon("chevrons-right")
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
          .setIcon("git-branch")
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
        .setIcon("lightbulb")
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
        .setIcon("eye")
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
        .setIcon("pencil")
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

    menu.addSeparator();

    menu.addItem((mi) => {
      mi.setTitle(
        t("toolbar.simSide", _lv).replace("{side}", t(FIRST_SIDE_KEY, _lv)),
      )
        .setIcon("bot")
        .setChecked(simWhite)
        .onClick(() => eventBus.emit("engine-sim-toggle", "white"));
    });

    menu.addItem((mi) => {
      mi.setTitle(
        t("toolbar.simSide", _lv).replace("{side}", t(SECOND_SIDE_KEY, _lv)),
      )
        .setIcon("bot")
        .setChecked(simBlack)
        .onClick(() => eventBus.emit("engine-sim-toggle", "black"));
    });

    if (ANALYSIS_SITES.length > 0) {
      menu.addSeparator();
      for (const site of ANALYSIS_SITES) {
        const label = getLang() === "zh" ? site.labelZh : site.label;
        menu.addItem((mi) => {
          mi.setTitle(`${label}: ${t("toolbar.analyzePosition", _lv)}`)
            .setIcon(site.icon)
            .onClick(() => emitEvent("open-analysis", site.positionUrl));
        });
        menu.addItem((mi) => {
          mi.setTitle(`${label}: ${t("toolbar.analyzeGame", _lv)}`)
            .setIcon(site.icon)
            .onClick(() => emitEvent("open-analysis", site.gameUrl));
        });
      }
    }

    menu.showAtMouseEvent(evt);
  }
</script>

<div class="{CLS_PREFIX}-toolbar" style="--{CLS_PREFIX}-btn-count: {btnCount}">
  {#each navButtons as { title, icon, event } (event)}
    <button
      class="{CLS_PREFIX}-btn"
      aria-label={title}
      use:useSetIcon={icon}
      onclick={() => emitEvent(event)}
    ></button>
  {/each}

  {#each menuButtons as { title, icon, event } (event)}
    <button
      class="{CLS_PREFIX}-btn"
      aria-label={title}
      use:useSetIcon={icon}
      onclick={(e) => handleMenuButton(event, e)}
    ></button>
  {/each}

  <button
    class="{CLS_PREFIX}-btn{analyzeBtnClass}"
    aria-label={t("toolbar.analyzeMenu", _lv)}
    use:useSetIcon={"brain"}
    onclick={(e) => handleAnalyzeMenu(e)}
  ></button>

  <button
    class="{CLS_PREFIX}-btn {saveBtnClass}"
    aria-label={t("toolbar.save", _lv)}
    use:useSetSaveIcon
    disabled={isprotected}
    onclick={() => emitEvent("save")}
  ></button>
</div>
