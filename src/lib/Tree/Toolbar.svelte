<script lang="ts">
  import { setIcon, Menu } from "obsidian";
  import type { EventBus } from "../../core/event-bus";

  interface Props {
    eventBus: EventBus;
  }
  let { eventBus }: Props = $props();

  const buttons = [
    { title: "删除", icon: "circle-x", event: "remove" },
    { title: "提升", icon: "arrow-up-wide-narrow", event: "promote" },
    { title: "开局", icon: "arrow-left-to-line", event: "toStart" },
    { title: "回退", icon: "arrow-left", event: "back" },
    { title: "前进", icon: "arrow-right", event: "next" },
    { title: "终局", icon: "arrow-right-to-line", event: "toEnd" },
    { title: "翻转", icon: "flip-vertical", event: "rotate" },
    { title: "皮卡鱼Web", icon: "external-link", event: "openPikafish" },
    { title: "标注", icon: "tag", event: "toggle-annotation-menu" },
  ];

  // 你的 annotation 项目 —— 会放进菜单
  const annotations = [
    { title: "优势", icon: "thumbs-up", symbol: "R+", event: "annotation" },
    { title: "劣势", icon: "thumbs-down", symbol: "B+", event: "annotation" },
    { title: "均势", icon: "handshake", symbol: "=", event: "annotation" },
    { title: "关键", icon: "bookmark", symbol: "?", event: "annotation" },
    { title: "妙手", icon: "star", symbol: "!", event: "annotation" },
  ];

  function emitEvent(name: string, payload: any = null) {
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
    flex-wrap: nowrap;
    justify-content: center;
    align-items: center;
  }
</style>
