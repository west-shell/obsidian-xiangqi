<script lang="ts">
  import { MarkdownRenderer } from "obsidian";
  import { onDestroy, onMount, tick } from "svelte";
  import { ANNOTATOR_URL_PREFIX, CLS_PREFIX } from "../../../chess";
  import type { EventBus } from "../../../core/event-bus";
  import { onLangChange, t } from "../../../i18n";
  import type ChessPlugin from "../../../main";
  import type { ChessNode } from "../../../types";
  import { useSetIcon } from "./set-icon";

  interface Props {
    eventBus: EventBus;
    currentNode: ChessNode | null;
    plugin?: ChessPlugin;
    listVisible: boolean;
    onToggleList: () => void;
  }

  let { eventBus, currentNode, plugin, listVisible, onToggleList }: Props =
    $props();

  let commentsText = $state("");
  let textareaEl: HTMLTextAreaElement | undefined = $state();

  // Pin-button visibility. saveComments() mutates currentNode.comments in
  // place — a plain-object write Svelte cannot observe — so the pin
  // button's {#if} would go stale (button missing after adding a comment,
  // still shown after deleting it). Track the flag explicitly and sync it
  // at both mutation sites: the save handler and the node-switch effect.
  let hasComments = $state(false);

  // ---- 自动保存逻辑 ----
  let saveTimeout: number | undefined;

  function handleCommentsInput() {
    adjustTextareaHeight();

    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = window.setTimeout(() => {
      saveComments();
      saveTimeout = undefined;
    }, 700);
  }

  // ---- Comment rendered view (clickable links) ----
  let commentEditing = $state(false);
  let commentViewEl: HTMLDivElement | undefined = $state();

  // Wrap bare URLs in angle brackets so markdown linkifies them; URLs
  // already inside markdown links ](...) or <...> autolinks are skipped.
  const BARE_URL_REGEX =
    /(?<!<)(?<!\]\()((?:https?|obsidian):\/\/[^\s<>"')\]]+)/g;

  function autolinkBareUrls(text: string): string {
    return text.replace(BARE_URL_REGEX, (url: string) => {
      const trailing = url.match(/[.,;:!?]+$/)?.[0] ?? "";
      return `<${url.slice(0, url.length - trailing.length)}>${trailing}`;
    });
  }

  let _uiVer = $state(0);
  const onUiVer = () => {
    _uiVer++;
  };
  let _lv = $state(0);
  const unsubLang = onLangChange(() => _lv++);
  let destroyed = false;

  // ---- Pin/toggle button strip ----
  // Once the comment box is tall enough to fit both buttons in one
  // column (28px each + gap), stack them vertically to save horizontal
  // space; below that they sit side by side as before.
  let commentRowEl: HTMLDivElement | undefined = $state();
  let actionsStacked = $state(false);
  let rowResizeObserver: ResizeObserver | undefined;
  const ACTION_BTN_SIZE = 28;
  const ACTIONS_STACK_MIN = ACTION_BTN_SIZE * 2 + 2;

  // ---- Pinned comment cards (tree canvas) ----
  // Mirrors the tree graph's pin state so this button's icon matches the
  // hover pin button on tree nodes; toggling goes through the event bus.
  let pinnedIds = $state(new Set<string>());
  const onPinnedChanged = (ids: unknown) => {
    pinnedIds = ids instanceof Set ? new Set(ids as Set<string>) : new Set();
  };
  let commentPinned = $derived(
    currentNode ? pinnedIds.has(currentNode.id) : false,
  );

  $effect(() => {
    void _uiVer;
    const node = currentNode;
    const el = commentViewEl;
    if (!el || !plugin || !node) return;
    // Render into a fresh container per run: a still-pending previous
    // render then writes into a detached node instead of interleaving.
    el.replaceChildren();
    const inner = document.createElement("div");
    el.appendChild(inner);
    // Each comment block renders with its own [%anno] author byline, so
    // several comments by different authors stay correctly attributed.
    const markdown = (node.comments ?? [])
      .map((text, i) => {
        let part = autolinkBareUrls(text);
        const author = node.commentAuthors?.[i];
        if (author) part += `\n\n${bylineMarkdown(author)}`;
        return part;
      })
      .join("\n\n");
    const sourcePath = plugin.app.workspace.getActiveFile()?.path ?? "";
    void MarkdownRenderer.render(
      plugin.app,
      markdown,
      inner,
      sourcePath,
      plugin,
    );
  });

  function bylineMarkdown(author: { name: string; user: string }): string {
    const name = author.name || author.user;
    const linked =
      author.user && ANNOTATOR_URL_PREFIX
        ? `<a href="${ANNOTATOR_URL_PREFIX}${encodeURI(author.user)}" target="_blank" rel="noopener">${escapeHtml(name)}</a>`
        : escapeHtml(name);
    return `<small class="${CLS_PREFIX}-comment__byline">${t("tree.annotatedBy", _lv)} ${linked}</small>`;
  }

  function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (ch) => {
      if (ch === "&") return "&amp;";
      if (ch === "<") return "&lt;";
      if (ch === ">") return "&gt;";
      if (ch === '"') return "&quot;";
      return "&#39;";
    });
  }

  function enterCommentEdit(evt: MouseEvent) {
    // Clicks on links navigate instead of starting edit mode; selecting
    // rendered text to copy should not enter editing either.
    if ((evt.target as HTMLElement).closest("a")) return;
    if (activeWindow.getSelection()?.toString()) return;
    commentEditing = true;
    void tick().then(() => {
      if (destroyed || !textareaEl) return undefined;
      adjustTextareaHeight();
      textareaEl.focus();
      const len = textareaEl.value.length;
      textareaEl.setSelectionRange(len, len);
      return undefined;
    });
  }

  function handleCommentsKeydown(evt: KeyboardEvent) {
    if (evt.key === "Escape") {
      evt.stopPropagation();
      textareaEl?.blur();
    }
  }

  onMount(() => {
    eventBus.on("updateUI", onUiVer);
    eventBus.on("pinned-comments-changed", onPinnedChanged);
    // Pin/toggle strip: track the comment row's height and stack the two
    // buttons vertically once there is room for both (28px each + gap).
    // The row never grows from stacking (the comment box dominates its
    // height), so this cannot oscillate at the threshold.
    if (commentRowEl) {
      rowResizeObserver = new ResizeObserver(() => {
        if (destroyed || !commentRowEl) return;
        actionsStacked = commentRowEl.clientHeight >= ACTIONS_STACK_MIN;
      });
      rowResizeObserver.observe(commentRowEl);
    }
    // Panel-mounted-while-hidden path (mirrors the tree graph's initial
    // reset): the commentsText effect measured the textarea while it was
    // display:none (scrollHeight 0), so re-adjust once the box becomes
    // measurable, then stop watching.
    if (!textareaEl) return;
    const ro = new ResizeObserver(() => {
      if (destroyed || !textareaEl) return;
      if (textareaEl.clientWidth === 0 || textareaEl.clientHeight === 0) return;
      ro.disconnect();
      adjustTextareaHeight();
    });
    ro.observe(textareaEl);
  });

  onDestroy(() => {
    destroyed = true;
    unsubLang();
    eventBus.off("updateUI", onUiVer);
    eventBus.off("pinned-comments-changed", onPinnedChanged);
    rowResizeObserver?.disconnect();
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = undefined;
    }
  });

  function handleCommentsBlur() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = undefined;
    }
    saveComments();
    commentEditing = false;
  }

  function saveComments() {
    if (!currentNode) return;
    const regularComments = commentsText
      .split("\n")
      .filter((c) => c.trim() !== "");
    const oldComments = currentNode.comments ?? [];
    const changed =
      regularComments.length !== oldComments.length ||
      regularComments.some((c, i) => c !== oldComments[i]);
    currentNode.comments = regularComments;
    hasComments = regularComments.length > 0;
    if (changed) {
      // Rewritten lines no longer map to their original [%anno] authors.
      currentNode.commentAuthors = undefined;
    }
    eventBus.emit("updateUI");
    if (changed) eventBus.emit("modified");
  }

  function adjustTextareaHeight() {
    if (!textareaEl) return;
    textareaEl.classList.add(`${CLS_PREFIX}-comment__input--auto`);
    textareaEl.style.setProperty(
      "--textarea-h",
      `${textareaEl.scrollHeight}px`,
    );
    textareaEl.classList.remove(`${CLS_PREFIX}-comment__input--auto`);
  }

  $effect(() => {
    if (!currentNode) {
      commentsText = "";
      commentEditing = false;
      hasComments = false;
      return;
    }
    commentsText = (currentNode.comments ?? []).join("\n");
    hasComments = (currentNode.comments ?? []).length > 0;
    commentEditing = false;
    tick().then(() => {
      if (destroyed) return;
      if (textareaEl) adjustTextareaHeight();
      return undefined;
    });
  });
</script>

<div class="{CLS_PREFIX}-panel__comment" bind:this={commentRowEl}>
  {#if plugin && !commentEditing && commentsText}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="{CLS_PREFIX}-comment__view"
      bind:this={commentViewEl}
      title={t("tree.editComment", _lv)}
      onclick={enterCommentEdit}
    ></div>
  {:else}
    <textarea
      bind:value={commentsText}
      class="{CLS_PREFIX}-comment__input {CLS_PREFIX}-comment__input--auto"
      placeholder={t("tree.placeholder")}
      bind:this={textareaEl}
      oninput={handleCommentsInput}
      onfocus={() => {
        // Entering the textarea is editing mode: keeps the {#if} above
        // from flipping to the rendered view on the first typed
        // character (which destroyed the textarea and stole focus).
        commentEditing = true;
      }}
      onblur={handleCommentsBlur}
      onkeydown={handleCommentsKeydown}
      rows="1"></textarea>
  {/if}
  <div
    class="{CLS_PREFIX}-comment__actions{actionsStacked
      ? ` ${CLS_PREFIX}-comment__actions--stacked`
      : ``}"
  >
    {#if currentNode && hasComments}
      <button
        class="{CLS_PREFIX}-btn {CLS_PREFIX}-comment__pin"
        aria-label={commentPinned
          ? t("tree.unpinComment", _lv)
          : t("tree.pinComment", _lv)}
        use:useSetIcon={commentPinned ? "pin-off" : "pin"}
        onclick={() => eventBus.emit("tree-pin-comment", currentNode!.id)}
      ></button>
    {/if}
    <button
      class="{CLS_PREFIX}-btn {CLS_PREFIX}-comment__toggle"
      aria-label={listVisible
        ? t("tree.hideList", _lv)
        : t("tree.showList", _lv)}
      use:useSetIcon={listVisible ? "panel-right-close" : "panel-right-open"}
      onclick={onToggleList}
    ></button>
  </div>
</div>
