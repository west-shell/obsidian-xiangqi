<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { CLS_PREFIX } from "../../../chess";
  import type { EventBus } from "../../../core/event-bus";
  import { onLangChange, t } from "../../../i18n";
  import type ChessPlugin from "../../../main";
  import type { ChessNode, GameSlot, ISettings, NodeMap } from "../../../types";
  import CommentBox from "./CommentBox.svelte";
  import GameNav from "./GameNav.svelte";
  import HoverPreview from "./HoverPreview.svelte";
  import MoveList from "./MoveList.svelte";
  import NavSlider from "./NavSlider.svelte";
  import { useSetIcon } from "./set-icon";
  import TreeGraph from "./TreeGraph.svelte";

  interface Props {
    nodeMap: NodeMap;
    eventBus: EventBus;
    currentNode: ChessNode | null;
    currentPath: string[];
    settings?: ISettings;
    games?: GameSlot[];
    currentGameIndex?: number;
    isBlockMode?: boolean;
    plugin?: ChessPlugin;
  }

  let {
    nodeMap,
    eventBus,
    currentNode = $bindable(),
    currentPath,
    settings,
    games = [],
    currentGameIndex = 0,
    isBlockMode = false,
    plugin,
  }: Props = $props();

  let destroyed = false;
  let _lv = $state(0);
  const unsubLang = onLangChange(() => _lv++);

  let graph: TreeGraph | undefined = $state();
  let preview: HoverPreview | undefined = $state();

  onDestroy(() => {
    destroyed = true;
    unsubLang();
  });

  // Switching games re-fits the tree view after the new game's nodes load.
  let gameIndexChanged = $state(false);
  $effect(() => {
    void currentGameIndex;
    if (!gameIndexChanged) {
      gameIndexChanged = true;
      return;
    }
    (async () => {
      await tick();
      if (destroyed) return;
      graph?.resetView();
    })();
  });

  // Standalone preview switch pinned to the canvas' top-left corner; a
  // single master switch for BOTH hover previews (tree graph + move
  // list). Mutates plugin.settings (the settings prop is a per-render
  // clone) so the value persists and survives later updateUI clones.
  // svelte-ignore state_referenced_locally
  let treePreviewOn = $state(settings?.showPreview !== false);
  function toggleTreePreview() {
    treePreviewOn = !treePreviewOn;
    if (plugin) {
      plugin.settings.showPreview = treePreviewOn;
      void plugin.saveSettings();
      eventBus.emit("updateUI");
    } else if (settings) {
      settings.showPreview = treePreviewOn;
    }
    if (!treePreviewOn) preview?.hideAll();
  }

  // svelte-ignore state_referenced_locally
  let listVisible = $state(settings?.showMovelist ?? true);
  function toggleListVisible() {
    listVisible = !listVisible;
    void tick().then(() => {
      if (destroyed) return undefined;
      graph?.resetView();
      return undefined;
    });
  }
</script>

<div class="{CLS_PREFIX}-layout__panel">
  <GameNav {eventBus} {games} {currentGameIndex} {isBlockMode} />
  <div class="{CLS_PREFIX}-panel__row">
    <div class="{CLS_PREFIX}-panel__canvas">
      <button
        class="{CLS_PREFIX}-btn {CLS_PREFIX}-preview-toggle"
        aria-label={t("tree.togglePreview", _lv)}
        aria-pressed={treePreviewOn}
        use:useSetIcon={treePreviewOn ? "eye" : "eye-off"}
        onclick={toggleTreePreview}
      ></button>
      <TreeGraph
        bind:this={graph}
        {nodeMap}
        {eventBus}
        {currentNode}
        {currentPath}
        {settings}
        {preview}
      />
      <HoverPreview bind:this={preview} {settings} />
      <NavSlider {eventBus} {nodeMap} {currentNode} {currentPath} />
    </div>
    {#if listVisible}
      <MoveList
        {nodeMap}
        {eventBus}
        {currentNode}
        {currentPath}
        {settings}
        {preview}
      />
    {/if}
  </div>
  <CommentBox
    {eventBus}
    {currentNode}
    {plugin}
    {listVisible}
    onToggleList={toggleListVisible}
  />
</div>
