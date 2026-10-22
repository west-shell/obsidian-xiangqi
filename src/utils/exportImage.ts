import { toCanvas } from "html-to-image";
import * as gifenc from "gifenc";
import type { Api, Config } from "../chess";
import { BOARD_ASPECT_RATIO, Chessground, CLS_PREFIX } from "../chess";
import type { ChessNode, IHost } from "../types";

/** Rendered pixel size (width) of exported PNG images. */
export const EXPORT_PNG_SIZE = 1024;
/** Rendered pixel size (width) of exported GIF frames. */
export const EXPORT_GIF_SIZE = 512;

/**
 * A rendered export ready to be saved: the binary file content plus a
 * suggested basename (no folder) used to prefill the save-as dialog.
 */
export interface ExportArtifact {
  data: ArrayBuffer;
  filename: string;
}

const nextPaint = (): Promise<void> =>
  new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      resolve();
    });
  });

/**
 * A hidden chessground instance rendered outside the viewport. Layout and
 * styles apply normally (theme, piece set, coordinates all come from the
 * app-wide stylesheets), but nothing is visible to the user, and the stage
 * element can be rasterized with html-to-image.
 */
class OffscreenBoard {
  private readonly container: HTMLElement;
  private readonly ground: Api;
  private readonly stage: HTMLElement;

  constructor(size: number, coordinates: boolean) {
    this.container = activeDocument.body.createDiv();
    this.container.addClass(`${CLS_PREFIX}-export-offscreen`);
    this.stage = this.container.createDiv(`${CLS_PREFIX}-export-stage`);
    this.stage.style.width = `${size}px`;
    this.stage.style.height = `${Math.round(size / BOARD_ASPECT_RATIO)}px`;
    this.stage.style.setProperty("--board-ratio", String(BOARD_ASPECT_RATIO));

    const config: Config = {
      coordinates,
      viewOnly: true,
      animation: { enabled: false },
    };
    this.ground = Chessground(this.stage, config);
  }

  async setPosition(fen: string): Promise<void> {
    this.ground.set({ fen });
    // Two paints: one for the chessground redraw, one for settled styles.
    await nextPaint();
    await nextPaint();
  }

  async toCanvas(): Promise<HTMLCanvasElement> {
    return toCanvas(this.stage, {
      width: this.stage.offsetWidth,
      height: this.stage.offsetHeight,
      pixelRatio: 1,
      skipFonts: true,
    });
  }

  destroy(): void {
    this.ground.destroy();
    this.container.remove();
  }
}

function timestampName(prefix: string, ext: string): string {
  const now = new Date();
  const pad = (value: number): string => String(value).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${prefix}-${stamp}.${ext}`;
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

export interface PngExportOptions {
  fen: string;
  /** Board width in pixels. */
  size: number;
  coordinates: boolean;
}

/**
 * Renders the given FEN on an offscreen board and encodes it as a PNG.
 * The caller decides where to save the returned artifact.
 */
export async function exportBoardPng(
  options: PngExportOptions,
): Promise<ExportArtifact> {
  const board = new OffscreenBoard(options.size, options.coordinates);
  try {
    await board.setPosition(options.fen);
    const canvas = await board.toCanvas();
    const blob = await canvasToPngBlob(canvas);
    if (!blob) throw new Error("PNG encoding failed");
    return {
      data: await blob.arrayBuffer(),
      filename: timestampName("board", "png"),
    };
  } finally {
    board.destroy();
  }
}

export interface GifExportOptions {
  /** One FEN per frame, in playback order (starting position first). */
  fens: string[];
  /** Delay between frames in milliseconds. */
  intervalMs: number;
  /** Board width in pixels. */
  size: number;
  coordinates: boolean;
  onProgress?: (done: number, total: number) => void;
}

/**
 * Renders each FEN on an offscreen board and encodes them into an animated
 * GIF (one frame per position). The caller decides where to save the
 * returned artifact.
 */
export async function exportGameGif(
  options: GifExportOptions,
): Promise<ExportArtifact> {
  const fens = options.fens;
  if (fens.length === 0) throw new Error("No positions to export");
  const board = new OffscreenBoard(options.size, options.coordinates);
  const gif = gifenc.GIFEncoder();
  try {
    for (let index = 0; index < fens.length; index++) {
      await board.setPosition(fens[index]);
      const canvas = await board.toCanvas();
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Failed to acquire 2D context");
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const palette = gifenc.quantize(imageData.data, 256);
      const indexed = gifenc.applyPalette(imageData.data, palette);
      gif.writeFrame(indexed, canvas.width, canvas.height, {
        palette,
        delay: options.intervalMs,
      });
      options.onProgress?.(index + 1, fens.length);
    }
  } finally {
    board.destroy();
  }
  gif.finish();
  const bytes = gif.bytes();
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return { data: buffer, filename: timestampName("game", "gif") };
}

/** FENs of the mainline (first-child chain) starting at `root`. */
export function collectMainlineFens(root: ChessNode): string[] {
  const fens: string[] = [root.fen];
  let node = root.children[0];
  while (node) {
    fens.push(node.fen);
    node = node.children[0];
  }
  return fens;
}

/** FENs along the path from the root down to the current node. */
export function collectPathFens(host: IHost): string[] {
  const chain: ChessNode[] = [];
  let node: ChessNode | undefined = host.currentNode;
  while (node) {
    chain.unshift(node);
    const parentID: string | null | undefined = node.parentID;
    node = parentID ? host.nodeMap.get(parentID) : undefined;
  }
  return chain.map((entry) => entry.fen);
}
