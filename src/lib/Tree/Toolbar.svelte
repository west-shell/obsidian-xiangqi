<script lang="ts">
  import { setIcon, Menu } from "obsidian";
  import type { EventBus } from "../../core/event-bus";
  import { t, onLangChange } from "../../i18n";

  interface Props {
    eventBus: EventBus;
  }
  let { eventBus }: Props = $props();

  let _lv = $state(0);
  onLangChange(() => _lv++);

  const buttons = $derived([
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

  // 你的 annotation 项目 —— 会放进菜单
  const annotations = $derived([
    { title: t("annotation.r+", _lv), icon: "thumbs-up", symbol: "R+", event: "annotation" },
    { title: t("annotation.b+", _lv), icon: "thumbs-down", symbol: "B+", event: "annotation" },
    { title: t("annotation.eq", _lv), icon: "handshake", symbol: "=", event: "annotation" },
    { title: t("annotation.key", _lv), icon: "bookmark", symbol: "?", event: "annotation" },
    { title: t("annotation.br", _lv), icon: "star", symbol: "!", event: "annotation" },
  ]);

  function emitEvent(name: string, payload: unknown = null) {
    eventBus.emit("btn-click", { name, payload });
  }

  function useSetIcon(el: HTMLElement, icon: string) {
    setIcon(el, icon);
  }

  // 👇 在这里实现菜单
  function handleAnnotationMenu(evt: MouseEvent) {
    const menu = new Menu();

    annotations.forEach((item) => {
      menu.addItem((mi) => {
        mi.setTitle(item.title)
          .setIcon(item.icon) // 你可以换别的 icon，也可以省略
          .onClick(() => emitEvent(item.event, item.symbol));
      });
    });

    menu.showAtMouseEvent(evt);
  }
</script>

<div class="toolbar-container">
  {#each buttons as { title, icon, event }}
    <!-- svelte-ignore event_directive_deprecated -->
    <button
      class="toolbar-btn"
      aria-label={title}
      use:useSetIcon={icon}
      onclick={(e) => {
        if (event === "toggle-annotation-menu") {
          handleAnnotationMenu(e); // ← 打开标注菜单
        } else if (event === "rotate") {
          eventBus.emit("rotate");
        } else {
          emitEvent(event);
        }
      }}
    ></button>
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
    flex-wrap: nowrap; /* 不换行 */
    justify-content: space-between; /* 平均分布 */
    align-items: center;
    width: 100%; /* 占满容器宽度 */
    /* padding: 0 4px; 留点边距 */
    box-sizing: border-box;
    /* gap: 4px; 按钮间距 */
  }

  :global(.tree-view.bottom) .toolbar-container .toolbar-btn {
    flex: 1 1 0; /* 平均分宽，可缩小 */
    min-width: 24px; /* 最小宽度，保证可点击 */
    max-width: 100%; /* 不超过容器 */
    font-size: clamp(12px, 3vw, 16px); /* 字体随屏幕宽度缩放 */
    padding: 0;
    margin: 0;
  }
</style>
