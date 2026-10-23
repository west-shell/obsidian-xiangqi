<script lang="ts">
  import { Menu } from "obsidian";
  import { onDestroy, onMount } from "svelte";
  import { CLS_PREFIX, PRIMARY_PLAYER_KEY } from "../../../chess";
  import type { EventBus } from "../../../core/event-bus";
  import { onLangChange, t } from "../../../i18n";
  import type { GameSlot } from "../../../types";
  import { formatResult } from "./format";
  import { useSetIcon } from "./set-icon";

  interface Props {
    eventBus: EventBus;
    games?: GameSlot[];
    currentGameIndex?: number;
    isBlockMode?: boolean;
  }

  let {
    eventBus,
    games = [],
    currentGameIndex = 0,
    isBlockMode = false,
  }: Props = $props();

  let _uiVer = $state(0);
  const onUiVer = () => {
    _uiVer++;
  };
  let _lv = $state(0);
  const unsubLang = onLangChange(() => _lv++);

  let showGameNav = $derived(games && games.length > 1 && !isBlockMode);
  let hasHeaders = $derived.by(() => {
    void _uiVer;
    if (!games || games.length === 0) return false;
    const slot = games[currentGameIndex ?? 0];
    return slot ? slot.headers.size > 0 : false;
  });
  let showGameInfo = $derived.by(() => {
    void _uiVer;
    if (!games || games.length === 0) return false;
    if (games.length === 1) {
      const h = games[0].headers;
      if (!h.get(PRIMARY_PLAYER_KEY) && !h.get("Black")) return false;
    }
    return hasHeaders || !isBlockMode;
  });
  let gameLabel = $derived(
    showGameNav
      ? t("game.label", _lv)
          .replace("{current}", String((currentGameIndex ?? 0) + 1))
          .replace("{total}", String(games!.length))
      : "",
  );
  let gameTitle = $derived.by(() => {
    void _uiVer;
    if (!showGameInfo) return "";
    const slot = games![currentGameIndex ?? 0];
    if (!slot) return "";
    const h = slot.headers;
    const white = h.get(PRIMARY_PLAYER_KEY) || "?";
    const black = h.get("Black") || "?";
    const event = h.get("Event") || "";
    const date = h.get("Date") || "";
    const resultRaw = h.get("Result") || "";
    const result = formatResult(resultRaw, _lv);
    return `${white} ${result} ${black}${event ? ", " + event : ""}${date ? " " + date : ""}`;
  });

  function prevGame() {
    const idx = (currentGameIndex ?? 0) - 1;
    if (idx >= 0) eventBus.emit("switch-game", idx);
  }
  function nextGame() {
    const idx = (currentGameIndex ?? 0) + 1;
    if (games && idx < games.length) eventBus.emit("switch-game", idx);
  }
  function handleGameMenu(evt: MouseEvent) {
    if (!games) return;
    const menu = new Menu();
    games.forEach((slot, i) => {
      const h = slot.headers;
      const white = h.get(PRIMARY_PLAYER_KEY) || "?";
      const black = h.get("Black") || "?";
      const event = h.get("Event") || "";
      const date = h.get("Date") || "";
      const resultRaw = h.get("Result") || "";
      const result = formatResult(resultRaw, _lv);
      const label = `${i + 1}. ${white} ${result} ${black}${event ? ", " + event : ""}${date ? " " + date : ""}`;
      menu.addItem((mi) => {
        mi.setTitle(label)
          .setChecked(i === (currentGameIndex ?? 0))
          .onClick(() => eventBus.emit("switch-game", i));
      });
    });
    menu.addSeparator();
    if (!isBlockMode) {
      menu.addItem((mi) => {
        mi.setTitle(t("game.new", _lv))
          .setIcon("plus")
          .onClick(() => eventBus.emit("create-game"));
      });
    }
    const idx = currentGameIndex ?? 0;
    if (!isBlockMode && games.length > 1) {
      menu.addItem((mi) => {
        mi.setTitle(t("game.moveUp", _lv))
          .setIcon("arrow-up")
          .setDisabled(idx <= 0)
          .onClick(() => eventBus.emit("move-game", -1));
      });
      menu.addItem((mi) => {
        mi.setTitle(t("game.moveDown", _lv))
          .setIcon("arrow-down")
          .setDisabled(idx >= games.length - 1)
          .onClick(() => eventBus.emit("move-game", 1));
      });
      menu.addItem((mi) => {
        mi.setTitle(t("game.delete", _lv))
          .setIcon("trash")
          .onClick(() => eventBus.emit("delete-game"));
      });
    }
    menu.showAtMouseEvent(evt);
  }

  onMount(() => {
    eventBus.on("updateUI", onUiVer);
  });

  onDestroy(() => {
    unsubLang();
    eventBus.off("updateUI", onUiVer);
  });
</script>

{#if showGameInfo}
  <div class="{CLS_PREFIX}-gamenav">
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="{CLS_PREFIX}-gamenav__info"
      role={isBlockMode ? undefined : "button"}
      tabindex={isBlockMode ? undefined : 0}
      onclick={isBlockMode ? undefined : handleGameMenu}
      onkeydown={isBlockMode
        ? undefined
        : (e: KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ")
              handleGameMenu(e as unknown as MouseEvent);
          }}
    >
      <span class="{CLS_PREFIX}-gamenav__title">{gameTitle}</span>
      {#if showGameNav}
        <span class="{CLS_PREFIX}-gamenav__index">{gameLabel}</span>
      {/if}
    </div>
    {#if showGameNav}
      <div class="{CLS_PREFIX}-gamenav__arrows">
        <button
          class="{CLS_PREFIX}-btn {CLS_PREFIX}-gamenav__arrow"
          aria-label={t("game.prev", _lv)}
          disabled={currentGameIndex <= 0}
          use:useSetIcon={"chevron-left"}
          onclick={prevGame}
        ></button>
        <button
          class="{CLS_PREFIX}-btn {CLS_PREFIX}-gamenav__arrow"
          aria-label={t("game.next", _lv)}
          disabled={!games || currentGameIndex >= games.length - 1}
          use:useSetIcon={"chevron-right"}
          onclick={nextGame}
        ></button>
      </div>
    {/if}
    {#if !isBlockMode}
      <button
        class="{CLS_PREFIX}-btn {CLS_PREFIX}-gamenav__arrow {CLS_PREFIX}-gamenav__menu"
        aria-label={t("game.select", _lv)}
        use:useSetIcon={"list"}
        onclick={handleGameMenu}
      ></button>
    {/if}
  </div>
{/if}
