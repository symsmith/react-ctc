import { transformSync } from "esbuild";
import { describe, expect, it, vi } from "vitest";

import {
  cachedFetchText,
  findJsxFileNames,
  pickFileName,
  resolveComponentSource,
  resolveElementSource,
  resolveFrame,
  type FetchText,
} from "../src/source";
import { fiber, host } from "./fibers";

const FILE = "/Users/me/app/src/App.tsx";
const MODULE_URL = "http://localhost:5173/src/App.tsx?t=1730000000";

const SOURCE = `import { useState } from "react";

export function App() {
  const [n] = useState(0);
  return (
    <main>
      <p>{n}</p>
    </main>
  );
}
`;

function compile() {
  const result = transformSync(SOURCE, {
    loader: "tsx",
    jsx: "automatic",
    jsxDev: true,
    sourcemap: "external",
    sourcefile: FILE,
    format: "esm",
  });
  const map = JSON.parse(result.map);
  map.sources = ["App.tsx"];
  return { code: result.code, map };
}

function positionOf(code: string, needle: string) {
  const offset = code.indexOf(needle);
  const before = code.slice(0, offset).split("\n");
  return { line: before.length, column: before.at(-1)!.length + 1 };
}

function fetchFrom(files: Record<string, string>): FetchText {
  return async (url) => {
    if (!(url in files)) throw new Error(`404 ${url}`);
    return files[url];
  };
}

describe("resolveFrame", () => {
  const { code, map } = compile();
  const frame = { url: MODULE_URL, ...positionOf(code, 'jsxDEV("p"') };

  it("maps a frame through an inline source map to the absolute JSX file name", async () => {
    const inline = `${code}//# sourceMappingURL=data:application/json;base64,${btoa(JSON.stringify(map))}\n`;
    const location = await resolveFrame(frame, fetchFrom({ [MODULE_URL]: inline }));

    expect(location).toEqual({ fileName: FILE, line: 7, column: 7 });
  });

  it("fetches an external source map relative to the module URL", async () => {
    const external = `${code}//# sourceMappingURL=App.tsx.map\n`;
    const location = await resolveFrame(
      frame,
      fetchFrom({ [MODULE_URL]: external, "http://localhost:5173/src/App.tsx.map": JSON.stringify(map) }),
    );

    expect(location).toEqual({ fileName: FILE, line: 7, column: 7 });
  });

  it("returns null when the module carries no JSX file name", async () => {
    const stripped = code.replaceAll(`fileName: "${FILE}"`, "");
    expect(await resolveFrame(frame, fetchFrom({ [MODULE_URL]: stripped }))).toBeNull();
  });
});

describe("findJsxFileNames", () => {
  it("reads Babel's _jsxFileName and inline fileName properties, unescaping them", () => {
    const code = [
      'var _jsxFileName = "/Users/me/app/src/App.tsx";',
      'jsxDEV("p", {}, void 0, false, { fileName: "C:\\\\app\\\\src\\\\Card.tsx", lineNumber: 1 })',
      'jsxDEV("p", {}, void 0, false, { fileName: _jsxFileName, lineNumber: 2 })',
    ].join("\n");

    expect(findJsxFileNames(code)).toEqual(["/Users/me/app/src/App.tsx", "C:\\app\\src\\Card.tsx"]);
  });
});

describe("pickFileName", () => {
  const candidates = [
    "/Users/me/app/src/components/Button.tsx",
    "/Users/me/app/src/Button.tsx",
    "C:\\app\\src\\Card.tsx",
  ];

  it("picks the candidate sharing the longest path suffix with the source", () => {
    expect(pickFileName("http://localhost:5173/src/components/Button.tsx", candidates)).toBe(
      "/Users/me/app/src/components/Button.tsx",
    );
    expect(pickFileName("webpack://app/./src/Button.tsx", candidates)).toBe("/Users/me/app/src/Button.tsx");
  });

  it("normalizes Windows separators", () => {
    expect(pickFileName("http://localhost:3000/src/Card.tsx", candidates)).toBe("C:/app/src/Card.tsx");
  });

  it("uses file URLs directly", () => {
    expect(pickFileName("file:///Users/me/My%20App/src/A.tsx", [])).toBe("/Users/me/My App/src/A.tsx");
  });

  it("returns null when no file name matches", () => {
    expect(pickFileName("http://localhost:5173/src/Other.tsx", candidates)).toBeNull();
  });
});

describe("resolveElementSource", () => {
  it("uses React 18 _debugSource without fetching", async () => {
    const fetchText = vi.fn<FetchText>();
    const div = host("div", [], { _debugSource: { fileName: FILE, lineNumber: 3, columnNumber: 5 } });

    expect(await resolveElementSource(div, fetchText)).toEqual({ fileName: FILE, line: 3, column: 5 });
    expect(fetchText).not.toHaveBeenCalled();
  });

  it("returns null when the stack cannot be fetched", async () => {
    const div = host("div", [], { _debugStack: { stack: `jsxDEV@http://x/r.js:1:1\nApp@${MODULE_URL}:1:1` } });
    expect(await resolveElementSource(div, fetchFrom({}))).toBeNull();
  });
});

function Layout() {}

describe("resolveComponentSource", () => {
  it("opens the component's own JSX rather than its usage site", async () => {
    const usage = { fileName: "/app/src/App.tsx", lineNumber: 10 };
    const definition = { fileName: "/app/src/Layout.tsx", lineNumber: 4, columnNumber: 3 };
    const layout = fiber(0, Layout, [], { _debugSource: usage });
    const main = host("main", [], { _debugOwner: layout, _debugSource: definition });
    layout.child = main;

    expect(await resolveComponentSource(layout, fetchFrom({}))).toEqual({
      fileName: "/app/src/Layout.tsx",
      line: 4,
      column: 3,
    });
  });

  it("falls back to the usage site when the component renders nothing of its own", async () => {
    const layout = fiber(0, Layout, [], { _debugSource: { fileName: "/app/src/App.tsx", lineNumber: 10 } });

    expect(await resolveComponentSource(layout, fetchFrom({}))).toEqual({
      fileName: "/app/src/App.tsx",
      line: 10,
      column: 1,
    });
  });
});

describe("cachedFetchText", () => {
  it("fetches each URL once and retries after a failure", async () => {
    const fetchText = vi.fn<FetchText>().mockRejectedValueOnce(new Error("offline")).mockResolvedValue("code");
    const cached = cachedFetchText(fetchText);

    await expect(cached("a")).rejects.toThrow("offline");
    expect(await cached("a")).toBe("code");
    expect(await cached("a")).toBe("code");
    expect(fetchText).toHaveBeenCalledTimes(2);
  });
});
