/**
 * Type declarations for the `gifenc` dependency, which ships without its
 * own TypeScript definitions.
 *
 * See https://github.com/mattdesl/gifenc
 */
declare module "gifenc" {
  type RgbaBytes = Uint8Array | Uint8ClampedArray;
  type Palette = number[][];

  interface GifFrameOptions {
    /** Palette to use for this frame (from `quantize`). */
    palette?: Palette;
    /** Delay in milliseconds before the next frame is shown. */
    delay?: number;
    /** Frame index that is treated as transparent (0-255). */
    transparentIndex?: number;
    transparent?: boolean;
    /** Disposal code (0-7). */
    dispose?: number;
    /** Palette color bit depth (1-8). */
    colorDepth?: number;
  }

  interface GifEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: GifFrameOptions,
    ): void;
    finish(): void;
    /** Copy of the encoded GIF bytes. */
    bytes(): Uint8Array;
    /** View into the internal byte buffer (may be oversized). */
    bytesView(): Uint8Array;
    reset(): void;
  }

  interface QuantizeOptions {
    /** "rgb565" (default) | "rgb444" | "rgba4444". */
    format?: string;
    oneBitAlpha?: boolean | number;
    clearAlpha?: boolean;
    clearAlphaThreshold?: number;
    clearAlphaColor?: number;
  }

  interface ApplyPaletteOptions {
    oneBitAlpha?: boolean | number;
  }

  export function GIFEncoder(options?: {
    auto?: boolean;
    initialCapacity?: number;
  }): GifEncoderInstance;

  export function quantize(
    rgba: RgbaBytes,
    maxColors: number,
    options?: QuantizeOptions,
  ): Palette;

  export function applyPalette(
    rgba: RgbaBytes,
    palette: Palette,
    format?: string,
    options?: ApplyPaletteOptions,
  ): Uint8Array;

  export function prequantize(
    rgba: RgbaBytes,
    options?: {
      roundRGB?: number;
      roundAlpha?: number;
      oneBitAlpha?: boolean | number;
    },
  ): void;

  export function dither(
    rgba: RgbaBytes,
    width: number,
    height: number,
    palette: Palette,
    format?: string,
  ): RgbaBytes;
}
