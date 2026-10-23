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
      return;
    }
    commentsText = (currentNode.comments ?? []).join("\n");
    commentEditing = false;
    tick().then(() => {
      if (destroyed) return;
      if (textareaEl) adjustTextareaHeight();
      return undefined;
    });
  });
</script>

<div class="{CLS_PREFIX}-panel__comment">
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
      onblur={handleCommentsBlur}
      onkeydown={handleCommentsKeydown}
      rows="1"></textarea>
  {/if}
  <button
    class="{CLS_PREFIX}-btn {CLS_PREFIX}-comment__toggle"
    aria-label={listVisible ? t("tree.hideList", _lv) : t("tree.showList", _lv)}
    use:useSetIcon={listVisible ? "panel-right-close" : "panel-right-open"}
    onclick={onToggleList}
  ></button>
</div>
