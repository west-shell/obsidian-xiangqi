<script lang="ts">
  import { setIcon } from "obsidian";
  import type { EventBus } from "../../core/event-bus";
  import type { Move } from "../../chess";
  import type { ISettings } from "../../types";
  import { onLangChange, t } from "../../i18n";

  interface Props {
    settings: ISettings;
    eventBus: EventBus;
    modified: boolean;
    PGN: Move[];
    isprotected: boolean;
  }

  let { settings, eventBus, modified, PGN, isprotected }: Props = $props();

  let buttonClass: string = $state("");

  $effect(() => {
    buttonClass = modified ? "unsaved" : PGN.length > 0 ? "saved" : "empty";
  });

  let _lv = $state(0);
  onLangChange(() => _lv++);

  const buttons = $derived([
    { title: t("toolbar.reset", _lv), icon: "refresh-cw", event: "reset" },
    { title: t("toolbar.start", _lv), icon: "arrow-left-to-line", event: "toStart" },
    { title: t("toolbar.back", _lv), icon: "arrow-left", event: "undo" },
    { title: t("toolbar.forward", _lv), icon: "arrow-right", event: "redo" },
    { title: t("toolbar.end", _lv), icon: "arrow-right-to-line", event: "toEnd" },
    { title: t("toolbar.flip", _lv), icon: "flip-vertical", event: "rotate" },
    { title: "皮卡鱼Web", icon: "external-link", event: "openPikafish" },
  ]);

  let saveBtnEl: HTMLButtonElement;

  function emitEvent(name: string) {
    eventBus.emit(name);
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
</script>

<div class="toolbar-container {settings.position}">
  {#each buttons as { title, icon, event }}
    <button
      class="toolbar-btn"
      aria-label={title}
      use:useSetIcon={icon}
      onclick={() => emitEvent(event)}
    ></button>
  {/each}

  <button
    class="toolbar-btn {buttonClass}"
    class:disabled={isprotected}
    aria-label={t("toolbar.save", _lv)}
    bind:this={saveBtnEl}
    use:useSetSaveIcon
    onclick={() => emitEvent("save")}
  ></button>
</div>

<style>
  .toolbar-container.bottom {
    display: flex;
    flex-direction: row;
    gap: 4px;
  }

  .toolbar-container.right {
    display: flex;
    flex-direction: column;
    gap: 4px;
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

  /* === 状态颜色 === */
  .toolbar-btn.empty {
    background-color: hsl(33, 5%, 57%);
  }

  .toolbar-btn.saved {
    background-color: hsl(122, 39%, 49%);
  }

  .toolbar-btn.unsaved {
    background-color: hsl(35, 100%, 50%);
  }

  .toolbar-btn.disabled {
    pointer-events: none;
    opacity: 0.5;
  }
</style>
