import type { Fiber } from "./fiber";

export interface Selection {
  target: Element;
  chain: Fiber[];
  index: number;
}

const PIXELS_PER_STEP = 50;
const PIXELS_PER_LINE = 16;
const PIXELS_PER_PAGE = 400;

export function wheelPixels(deltaY: number, deltaMode: number): number {
  if (deltaMode === 1) return deltaY * PIXELS_PER_LINE;
  if (deltaMode === 2) return deltaY * PIXELS_PER_PAGE;
  return deltaY;
}

/**
 * Accumulates wheel distance so a trackpad flick and a mouse notch both move one level. Returns the new accumulator and
 * the step: -1 toward the root, 1 toward the leaf.
 */
export function accumulateWheel(accumulated: number, pixels: number): { accumulated: number; step: -1 | 0 | 1 } {
  const total = Math.sign(accumulated) === Math.sign(pixels) ? accumulated + pixels : pixels;
  if (total <= -PIXELS_PER_STEP) return { accumulated: 0, step: -1 };
  if (total >= PIXELS_PER_STEP) return { accumulated: 0, step: 1 };
  return { accumulated: total, step: 0 };
}

export function arrowStep(key: string): -1 | 0 | 1 {
  if (key === "ArrowUp") return -1;
  if (key === "ArrowDown") return 1;
  return 0;
}

export function moveSelection(selection: Selection, step: -1 | 0 | 1): Selection {
  const index = Math.min(Math.max(selection.index - step, 0), selection.chain.length - 1);
  return index === selection.index ? selection : { ...selection, index };
}
