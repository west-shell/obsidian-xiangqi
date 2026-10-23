<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { CLS_PREFIX } from "../../../chess";
  import type { EventBus } from "../../../core/event-bus";
  import type { ChessNode, NodeMap } from "../../../types";
  import { useSetIcon } from "./set-icon";

  interface Props {
    eventBus: EventBus;
    nodeMap: NodeMap;
    currentNode: ChessNode | null;
    currentPath: string[];
  }

  let { eventBus, nodeMap, currentNode, currentPath }: Props = $props();

  let sliderDragging = $state(false);
  let sliderInnerEl: HTMLDivElement | undefined = $state();
  let handleSliderMouseMove: ((evt: MouseEvent) => void) | null = null;
  let handleSliderMouseUp: (() => void) | null = null;
  let handleSliderTouchMove: ((evt: TouchEvent) => void) | null = null;
  let handleSliderTouchEnd: (() => void) | null = null;

  function handleSliderAreaMouseDown(evt: MouseEvent) {
    if (evt.button !== 0) return;
    sliderDragging = true;
    navigateFromSliderY(evt.clientY);
  }

  function handleSliderLabelTouchStart(evt: TouchEvent) {
    evt.preventDefault();
    sliderDragging = true;
  }

  function navigateFromSliderY(clientY: number) {
    if (!sliderInnerEl || currentPath.length <= 1) return;
    const { top, height } = sliderInnerEl.getBoundingClientRect();
    const percent = Math.min(1, Math.max(0, (clientY - top) / height));
    const idx = Math.round(percent * (currentPath.length - 1));
    const targetId = currentPath[idx];
    if (targetId && targetId !== currentNode?.id) {
      eventBus.emit("slider-navigate", targetId);
    }
  }

  let sliderPercent = $derived.by(() => {
    if (!currentNode || currentPath.length <= 1) return 0;
    const idx = currentPath.indexOf(currentNode.id);
    if (idx === -1) return 0;
    return (idx / (currentPath.length - 1)) * 100;
  });

  let sliderText = $derived.by(() => {
    if (!currentNode || currentPath.length <= 1) return "";
    const idx = currentPath.indexOf(currentNode.id);
    return idx !== -1 ? `${idx}/${currentPath.length - 1}` : "";
  });

  let evalChartData = $derived.by(() => {
    if (currentPath.length === 0) return [];
    return currentPath.map((id) => {
      const n = nodeMap.get(id);
      if (!n?.eval) return null;
      if (n.eval.scoreType === "mate")
        return n.eval.score >= 0 ? Infinity : -Infinity;
      const s = n.eval.score;
      return Number.isFinite(s) ? s : null;
    });
  });

  let evalChartMax = $derived.by(() => {
    let max = 0;
    for (const v of evalChartData) {
      if (v !== null && Number.isFinite(v) && Math.abs(v) > max)
        max = Math.abs(v);
    }
    return max || 1;
  });

  let evalChartSegments = $derived.by(() => {
    const data = evalChartData;
    const hasAny = data.some((v) => v !== null);
    if (!hasAny || currentPath.length <= 1) return null;
    const w = 20;
    const midX = w / 2;
    const maxAbs = evalChartMax;
    if (!Number.isFinite(maxAbs) || maxAbs === 0) return null;
    const scaleX = (w - 2) / 2 / maxAbs;
    const edgeR = w - 1;
    const edgeL = 1;
    const segments: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: string;
    }[] = [];
    const validIndices: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (data[i] === null) continue;
      validIndices.push(i);
    }
    for (let j = 0; j < validIndices.length - 1; j++) {
      const i1 = validIndices[j];
      const i2 = validIndices[j + 1];
      const v1 = data[i1]!;
      const v2 = data[i2]!;
      const x1 =
        v1 === Infinity ? edgeR : v1 === -Infinity ? edgeL : midX + v1 * scaleX;
      const x2 =
        v2 === Infinity ? edgeR : v2 === -Infinity ? edgeL : midX + v2 * scaleX;
      const color =
        v2 === Infinity || (Number.isFinite(v2) && v2 >= 0)
          ? "var(--eval-plus)"
          : "var(--eval-minus)";
      const color1 =
        v1 === Infinity || (Number.isFinite(v1) && v1 >= 0)
          ? "var(--eval-plus)"
          : "var(--eval-minus)";
      if (color1 !== color) {
        segments.push({
          x1,
          y1: i1,
          x2: midX,
          y2: i1 + (i2 - i1) * 0.5,
          color: color1,
        });
        segments.push({
          x1: midX,
          y1: i1 + (i2 - i1) * 0.5,
          x2,
          y2: i2,
          color,
        });
      } else {
        segments.push({ x1, y1: i1, x2, y2: i2, color });
      }
    }
    return { w, h: currentPath.length - 1, midX, segments };
  });

  onMount(() => {
    handleSliderMouseMove = (evt: MouseEvent) => {
      if (!sliderDragging) return;
      navigateFromSliderY(evt.clientY);
    };
    handleSliderMouseUp = () => {
      sliderDragging = false;
    };
    activeDocument.addEventListener("mousemove", handleSliderMouseMove);
    activeDocument.addEventListener("mouseup", handleSliderMouseUp);

    handleSliderTouchMove = (evt: TouchEvent) => {
      if (!sliderDragging) return;
      evt.preventDefault();
      navigateFromSliderY(evt.touches[0].clientY);
    };
    handleSliderTouchEnd = () => {
      sliderDragging = false;
    };
    activeDocument.addEventListener("touchmove", handleSliderTouchMove, {
      passive: false,
    });
    activeDocument.addEventListener("touchend", handleSliderTouchEnd);
  });

  onDestroy(() => {
    if (handleSliderMouseMove)
      activeDocument.removeEventListener("mousemove", handleSliderMouseMove);
    if (handleSliderMouseUp)
      activeDocument.removeEventListener("mouseup", handleSliderMouseUp);
    if (handleSliderTouchMove)
      activeDocument.removeEventListener("touchmove", handleSliderTouchMove);
    if (handleSliderTouchEnd)
      activeDocument.removeEventListener("touchend", handleSliderTouchEnd);
  });
</script>

<div
  class={`${CLS_PREFIX}-slider ${sliderDragging ? `${CLS_PREFIX}-slider--dragging` : ""} ${evalChartSegments ? `${CLS_PREFIX}-slider--eval` : ""}`}
>
  <button
    class="{CLS_PREFIX}-slider__btn {CLS_PREFIX}-slider__btn--start"
    aria-label="To start"
    use:useSetIcon={"minus"}
    onclick={() =>
      eventBus.emit("btn-click", { name: "toStart", payload: null })}
  ></button>
  <button
    class="{CLS_PREFIX}-slider__btn {CLS_PREFIX}-slider__btn--prev"
    aria-label="Previous"
    use:useSetIcon={"arrow-up"}
    onclick={() => eventBus.emit("btn-click", { name: "back", payload: null })}
  ></button>
  <div
    role="slider"
    tabindex={-1}
    aria-valuenow={sliderPercent}
    aria-valuemin={0}
    aria-valuemax={100}
    bind:this={sliderInnerEl}
    class="{CLS_PREFIX}-slider__track"
    onmousedown={handleSliderAreaMouseDown}
  >
    {#if evalChartSegments}
      <svg
        width={evalChartSegments.w}
        height="100%"
        viewBox="0 0 {evalChartSegments.w} {evalChartSegments.h}"
        preserveAspectRatio="none"
        class="{CLS_PREFIX}-slider__chart"
      >
        <line
          x1={evalChartSegments.midX}
          y1="0"
          x2={evalChartSegments.midX}
          y2={evalChartSegments.h}
          stroke="var(--text-faint)"
          stroke-width="0.5"
          vector-effect="non-scaling-stroke"
        />
        {#each evalChartSegments.segments as seg, i (i)}
          <line
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke={seg.color}
            stroke-width="1"
            vector-effect="non-scaling-stroke"
          />
        {/each}
      </svg>
    {/if}
    <span class="{CLS_PREFIX}-slider__thumb" style="top: {sliderPercent}%"
    ></span>
    {#if sliderText}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <span
        class="{CLS_PREFIX}-slider__label"
        style="top: {sliderPercent}%"
        onmousedown={handleSliderAreaMouseDown}
        ontouchstart={handleSliderLabelTouchStart}>{sliderText}</span
      >
    {/if}
  </div>
  <button
    class="{CLS_PREFIX}-slider__btn {CLS_PREFIX}-slider__btn--next"
    aria-label="Next"
    use:useSetIcon={"arrow-down"}
    onclick={() => eventBus.emit("btn-click", { name: "next", payload: null })}
  ></button>
  <button
    class="{CLS_PREFIX}-slider__btn {CLS_PREFIX}-slider__btn--end"
    aria-label="To end"
    use:useSetIcon={"minus"}
    onclick={() => eventBus.emit("btn-click", { name: "toEnd", payload: null })}
  ></button>
</div>
