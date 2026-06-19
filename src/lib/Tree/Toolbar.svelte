<script lang="ts">
  import { Menu, setIcon } from "obsidian";
  import type { EventBus } from "../../core/event-bus";
  import { onLangChange, t } from "../../i18n";

  interface Props {
    eventBus: EventBus;
  }
  let { eventBus }: Props = $props();

  let _lv = $state(0);
  onLangChange(() => _lv++);

  let modified = $state(false);

  $effect(() => {
    eventBus.on("modified", () => { modified = true; });
    eventBus.on('reset',() => { modified = false; }    )
    eventBus.on("setViewData", () => { modified = false; });
    eventBus.on("save", () => { modified = false; });
  });

  let saveBtnClass = $derived(modified ? "unsaved" : "saved");

  const buttons = $derived([
    { title: t("toolbar.reset", _lv), icon: "rotate-ccw", event: "reset" },
    { title: t("toolbar.delete", _lv), icon: "circle-x", event: "remove" },
    { title: t("toolbar.promote", _lv), icon: "arrow-up-wide-narrow", event: "promote" },
    { title: t("toolbar.start", _lv), icon: "arrow-left-to-line", event: "toStart" },
    { title: t("toolbar.back", _lv), icon: "arrow-left", event: "back" },
    { title: t("toolbar.forward", _lv), icon: "arrow-right", event: "next" },
    { title: t("toolbar.end", _lv), icon: "arrow-right-to-line", event: "toEnd" },
    { title: t("toolbar.flip", _lv), icon: "flip-vertical", event: "rotate" },
    { title: "皮卡鱼Web", icon: "external-link", event: "openPikafish" },
    { title: t("toolbar.annotate", _lv), icon: "tag", event: "toggle-annotation-menu" },
  ]);

  const annotations = $derived([
    { title: t("annotation.r+", _lv), icon: "thumbs-up", symbol: "R+", event: "annotation" },
    { title: t("annotation.b+", _lv), icon: "thumbs-down", symbol: "B+", event: "annotation" },
    { title: t("annotation.eq", _lv), icon: "handshake", symbol: "=", event: "annotation" },
    { title: t("annotation.key", _lv), icon: "bookmark", symbol: "?", event: "annotation" },
    { title: t("annotation.br", _lv), icon: "star", symbol: "!", event: "annotation" },
  ]);

  function emitEvent(name: string, data: unknown = null) {
    eventBus.emit("btn-click", { name, data});
  }

  function useSetIcon(el: HTMLElement, icon: string) {
    setIcon(el, icon);
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
  {#each buttons as { title, icon, event }}
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
    gap: 2px;
  }

  :global(.tree-view.bottom) .toolbar-container {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    box-sizing: border-box;
  }

  :global(.tree-view.bottom) .toolbar-container .toolbar-btn {
    flex: 1 1 0;
    min-width: 24px;
    max-width: 100%;
    font-size: clamp(12px, 3vw, 16px);
    padding: 0;
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
</style>
