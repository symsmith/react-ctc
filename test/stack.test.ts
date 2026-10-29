import { describe, expect, it } from "vitest";

import { jsxCallSite, parseStack } from "../src/stack";

const FIREFOX = [
  "exports.jsxDEV@http://localhost:5173/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=7e718067:247:37",
  "App@http://localhost:5173/src/App.tsx?t=1730000000:12:30",
  "renderWithHooks@http://localhost:5173/node_modules/.vite/deps/react-dom_client.js?v=7e718067:5652:24",
  "",
].join("\n");

const CHROME = [
  "Error: react-stack-top-frame",
  "    at exports.jsxDEV (http://localhost:5173/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=7e718067:247:37)",
  "    at App (http://localhost:5173/src/App.tsx?t=1730000000:12:30)",
  "    at http://localhost:5173/node_modules/@scope/pkg/index.js:3:4",
].join("\n");

describe("parseStack", () => {
  it("parses Firefox frames", () => {
    expect(parseStack(FIREFOX)).toEqual([
      {
        url: "http://localhost:5173/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=7e718067",
        line: 247,
        column: 37,
      },
      { url: "http://localhost:5173/src/App.tsx?t=1730000000", line: 12, column: 30 },
      { url: "http://localhost:5173/node_modules/.vite/deps/react-dom_client.js?v=7e718067", line: 5652, column: 24 },
    ]);
  });

  it("parses Chrome frames, including anonymous ones and URLs with @", () => {
    expect(parseStack(CHROME)).toEqual([
      {
        url: "http://localhost:5173/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=7e718067",
        line: 247,
        column: 37,
      },
      { url: "http://localhost:5173/src/App.tsx?t=1730000000", line: 12, column: 30 },
      { url: "http://localhost:5173/node_modules/@scope/pkg/index.js", line: 3, column: 4 },
    ]);
  });

  it("keeps @ inside Firefox URLs", () => {
    expect(parseStack("Comp@http://localhost:5173/@fs/Users/me/lib/Comp.tsx:1:2")).toEqual([
      { url: "http://localhost:5173/@fs/Users/me/lib/Comp.tsx", line: 1, column: 2 },
    ]);
  });
});

describe("jsxCallSite", () => {
  it("skips React's own frame", () => {
    expect(jsxCallSite(FIREFOX)?.url).toBe("http://localhost:5173/src/App.tsx?t=1730000000");
    expect(jsxCallSite(CHROME)?.url).toBe("http://localhost:5173/src/App.tsx?t=1730000000");
  });
});
