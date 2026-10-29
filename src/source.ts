import { findOwnedDescendant, type Fiber } from "./fiber";
import { findSourceMappingUrl, originalPositionFor, parseDataUrl, type RawSourceMap } from "./sourcemap";
import { jsxCallSite, type StackFrame } from "./stack";

export interface SourceLocation {
  fileName: string;
  line: number;
  column: number;
}

export type FetchText = (url: string) => Promise<string>;

export function cachedFetchText(fetchText: FetchText): FetchText {
  const cache = new Map<string, Promise<string>>();
  return (url) => {
    let text = cache.get(url);
    if (!text) {
      text = fetchText(url);
      text.catch(() => cache.delete(url));
      cache.set(url, text);
    }
    return text;
  };
}

/**
 * Locates the code of a component rather than the place it is used: the first element the component renders is created
 * inside its own render function.
 */
export async function resolveComponentSource(fiber: Fiber, fetchText: FetchText): Promise<SourceLocation | null> {
  const owned = findOwnedDescendant(fiber);
  return (owned && (await resolveElementSource(owned, fetchText))) ?? resolveElementSource(fiber, fetchText);
}

export async function resolveElementSource(fiber: Fiber, fetchText: FetchText): Promise<SourceLocation | null> {
  const debugSource = fiber._debugSource;
  if (debugSource) {
    return {
      fileName: debugSource.fileName,
      line: debugSource.lineNumber,
      column: debugSource.columnNumber ?? 1,
    };
  }
  const stack = fiber._debugStack?.stack;
  const frame = stack ? jsxCallSite(stack) : null;
  return frame ? resolveFrame(frame, fetchText).catch(() => null) : null;
}

export async function resolveFrame(frame: StackFrame, fetchText: FetchText): Promise<SourceLocation | null> {
  const code = await fetchText(frame.url);
  const mapUrl = findSourceMappingUrl(code);
  let position = { source: frame.url, line: frame.line, column: frame.column };

  if (mapUrl) {
    const inline = mapUrl.startsWith("data:");
    const mapBase = inline ? frame.url : new URL(mapUrl, frame.url).href;
    const map: RawSourceMap = JSON.parse(inline ? parseDataUrl(mapUrl) : await fetchText(mapBase));
    const original = originalPositionFor(map, frame.line - 1, frame.column - 1);
    if (!original) return null;
    position = {
      source: new URL(original.source, mapBase).href,
      line: original.line + 1,
      column: original.column + 1,
    };
  }

  const fileName = pickFileName(position.source, findJsxFileNames(code));
  return fileName ? { fileName, line: position.line, column: position.column } : null;
}

const JSX_FILE_NAME = /(?:_jsxFileName\s*=|fileName:)\s*("(?:[^"\\]|\\.)*")/g;

/** Absolute paths that the JSX dev transform (Babel, SWC, esbuild) writes into compiled modules. */
export function findJsxFileNames(code: string): string[] {
  const names = new Set<string>();
  for (const match of code.matchAll(JSX_FILE_NAME)) {
    try {
      names.add(JSON.parse(match[1]));
    } catch {}
  }
  return [...names];
}

function pathSegments(path: string): string[] {
  return path
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment && segment !== ".");
}

/** Picks the absolute path that shares the longest suffix with the source map's source URL. */
export function pickFileName(source: string, candidates: string[]): string | null {
  let sourcePath = source;
  try {
    const url = new URL(source);
    if (url.protocol === "file:") return decodeURIComponent(url.pathname);
    sourcePath = decodeURIComponent(url.pathname);
  } catch {}

  const sourceSegments = pathSegments(sourcePath);
  let best: string | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const segments = pathSegments(candidate);
    let score = 0;
    while (
      score < segments.length &&
      score < sourceSegments.length &&
      segments[segments.length - 1 - score] === sourceSegments[sourceSegments.length - 1 - score]
    ) {
      score++;
    }
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best?.replace(/\\/g, "/") ?? null;
}
