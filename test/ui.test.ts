// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { vscodeUrl } from "../src/editor";
import { labelPosition, unionRect } from "../src/overlay";
import { accumulateWheel, arrowStep, moveSelection, wheelPixels, type Selection } from "../src/selection";
import { host } from "./fibers";

describe("vscodeUrl", () => {
  it("builds file URLs for POSIX and Windows paths", () => {
    expect(vscodeUrl({ fileName: "/Users/me/My App/src/A.tsx", line: 3, column: 7 })).toBe(
      "vscode://file/Users/me/My%20App/src/A.tsx:3:7",
    );
    expect(vscodeUrl({ fileName: "C:\\app\\src\\A.tsx", line: 1, column: 1 })).toBe(
      "vscode://file/C:/app/src/A.tsx:1:1",
    );
  });
});

describe("unionRect", () => {
  it("bounds visible rects and ignores empty ones", () => {
    expect(
      unionRect([
        { top: 10, left: 10, right: 50, bottom: 20 },
        { top: 0, left: 0, right: 0, bottom: 0 },
        { top: 30, left: 5, right: 40, bottom: 60 },
      ]),
    ).toEqual({ top: 10, left: 5, right: 50, bottom: 60 });
  });

  it("returns null when nothing is visible", () => {
    expect(unionRect([{ top: 5, left: 5, right: 5, bottom: 5 }])).toBeNull();
  });
});

describe("labelPosition", () => {
  const label = { width: 100, height: 20 };
  const viewport = { width: 800, height: 600 };

  it("sits above the box when there is room", () => {
    expect(labelPosition({ top: 50, left: 30, right: 200, bottom: 90 }, label, viewport)).toEqual({
      top: 30,
      left: 30,
    });
  });

  it("moves inside the box at the top edge", () => {
    expect(labelPosition({ top: 10, left: 30, right: 200, bottom: 90 }, label, viewport)).toEqual({
      top: 10,
      left: 30,
    });
  });

  it("stays inside the viewport near the right and left edges", () => {
    expect(labelPosition({ top: 50, left: 750, right: 790, bottom: 90 }, label, viewport).left).toBe(700);
    expect(labelPosition({ top: 50, left: -40, right: 90, bottom: 90 }, label, viewport).left).toBe(0);
  });

  it("stays inside the viewport for boxes above or below it", () => {
    expect(labelPosition({ top: -300, left: 30, right: 200, bottom: -10 }, label, viewport).top).toBe(0);
    expect(labelPosition({ top: 900, left: 30, right: 200, bottom: 950 }, label, viewport).top).toBe(580);
  });

  it("pins to the left edge when wider than the viewport", () => {
    expect(labelPosition({ top: 50, left: 30, right: 90, bottom: 90 }, label, { width: 80, height: 600 }).left).toBe(0);
  });
});

describe("arrowStep", () => {
  it("maps ArrowUp toward the root and ArrowDown toward the leaf", () => {
    expect(arrowStep("ArrowUp")).toBe(-1);
    expect(arrowStep("ArrowDown")).toBe(1);
    expect(arrowStep("ArrowLeft")).toBe(0);
    expect(arrowStep("Alt")).toBe(0);
  });
});

describe("wheel handling", () => {
  it("converts line and page deltas to pixels", () => {
    expect(wheelPixels(3, 1)).toBe(48);
    expect(wheelPixels(-1, 2)).toBe(-400);
    expect(wheelPixels(12, 0)).toBe(12);
  });

  it("steps once per threshold and resets on direction change", () => {
    let state = accumulateWheel(0, -30);
    expect(state).toEqual({ accumulated: -30, step: 0 });
    state = accumulateWheel(state.accumulated, -30);
    expect(state).toEqual({ accumulated: 0, step: -1 });
    expect(accumulateWheel(-30, 20)).toEqual({ accumulated: 20, step: 0 });
    expect(accumulateWheel(0, 48 * 3)).toEqual({ accumulated: 0, step: 1 });
  });

  it("wheel up moves toward the root, wheel down back toward the leaf, within bounds", () => {
    const selection: Selection = {
      target: document.createElement("div"),
      chain: [host("a"), host("b"), host("c")],
      index: 0,
    };

    const up = moveSelection(selection, -1);
    expect(up.index).toBe(1);
    expect(moveSelection(up, 1).index).toBe(0);
    expect(moveSelection(selection, 1)).toBe(selection);
    expect(moveSelection({ ...selection, index: 2 }, -1).index).toBe(2);
  });
});
