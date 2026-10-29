import { openUrl, vscodeUrl } from "./editor";
import { getComponentChain, getDisplayName, getFiberFromNode, getHostNodes } from "./fiber";
import { createOverlay, unionRect } from "./overlay";
import { accumulateWheel, arrowStep, moveSelection, wheelPixels, type Selection } from "./selection";
import { cachedFetchText, resolveComponentSource } from "./source";

const fetchText = cachedFetchText((url) =>
  fetch(url).then((response) => {
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    return response.text();
  }),
);

const overlay = createOverlay();
let selection: Selection | null = null;
let pointer: { x: number; y: number } | null = null;
let wheel = 0;

function render() {
  if (!selection) return overlay.hide();
  const fiber = selection.chain[selection.index];
  const rect = unionRect(getHostNodes(fiber).map((node) => node.getBoundingClientRect()));
  if (!rect) return overlay.hide();
  overlay.show(rect, getDisplayName(fiber), `${selection.index + 1}/${selection.chain.length}`);
}

function inspect(target: Element | null) {
  if (!target) return clear();
  if (selection?.target !== target) {
    const chain = getComponentChain(getFiberFromNode(target));
    selection = chain.length > 0 ? { target, chain, index: 0 } : null;
    wheel = 0;
  }
  render();
}

function clear() {
  selection = null;
  wheel = 0;
  overlay.hide();
}

function move(step: -1 | 0 | 1) {
  if (!selection) return;
  const moved = moveSelection(selection, step);
  if (moved !== selection) {
    selection = moved;
    render();
  }
}

function swallow(event: Event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

async function open(selected: Selection) {
  const fiber = selected.chain[selected.index];
  const source = await resolveComponentSource(fiber, fetchText);
  if (source) {
    openUrl(vscodeUrl(source));
  } else {
    console.warn(`[React CTC] No source location found for <${getDisplayName(fiber)}>.`);
  }
}

const capture = { capture: true };
const active = { capture: true, passive: false };

window.addEventListener(
  "pointermove",
  (event) => {
    pointer = { x: event.clientX, y: event.clientY };
    if (event.altKey) inspect(event.target instanceof Element ? event.target : null);
    else if (selection) clear();
  },
  { capture: true, passive: true },
);

window.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Alt" && pointer && !selection) {
      inspect(document.elementFromPoint(pointer.x, pointer.y));
      return;
    }
    const step = arrowStep(event.key);
    if (!event.altKey || !selection || step === 0) return;
    swallow(event);
    move(step);
  },
  capture,
);

window.addEventListener(
  "keyup",
  (event) => {
    if (event.key !== "Alt" || !selection) return;
    // Keeps Windows/Linux from focusing the menu bar on Alt release.
    event.preventDefault();
    clear();
  },
  capture,
);

window.addEventListener(
  "wheel",
  (event) => {
    if (!event.altKey || !selection) return;
    swallow(event);
    const result = accumulateWheel(wheel, wheelPixels(event.deltaY, event.deltaMode));
    wheel = result.accumulated;
    move(result.step);
  },
  active,
);

for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"] as const) {
  window.addEventListener(
    type,
    (event) => {
      if (event.altKey && selection && event.button === 0) swallow(event);
    },
    active,
  );
}

window.addEventListener(
  "click",
  (event) => {
    if (!event.altKey || !selection || event.button !== 0) return;
    swallow(event);
    void open(selection);
  },
  active,
);

window.addEventListener("blur", clear);
window.addEventListener("scroll", render, { capture: true, passive: true });
