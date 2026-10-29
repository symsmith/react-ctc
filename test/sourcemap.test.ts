import { describe, expect, it } from "vitest";

import { decodeVlq, findSourceMappingUrl, originalPositionFor, parseDataUrl } from "../src/sourcemap";

describe("decodeVlq", () => {
  it("decodes signed multi-digit values", () => {
    expect(decodeVlq("AAAA")).toEqual([0, 0, 0, 0]);
    expect(decodeVlq("IACD")).toEqual([4, 0, 1, -1]);
    expect(decodeVlq("gB")).toEqual([16]);
  });
});

describe("originalPositionFor", () => {
  const map = {
    version: 3,
    sources: ["a.tsx", "b.tsx"],
    // line 0: col 0 -> a.tsx 0:0, col 4 -> a.tsx 1:2
    // line 1: col 2 -> b.tsx 5:1
    mappings: "AAAA,IACE;ECID",
  };

  it("returns the closest segment at or before the column", () => {
    expect(originalPositionFor(map, 0, 0)).toEqual({ source: "a.tsx", line: 0, column: 0 });
    expect(originalPositionFor(map, 0, 10)).toEqual({ source: "a.tsx", line: 1, column: 2 });
  });

  it("carries source and original state across lines", () => {
    expect(originalPositionFor(map, 1, 3)).toEqual({ source: "b.tsx", line: 5, column: 1 });
  });

  it("returns null before the first segment or past the last line", () => {
    expect(originalPositionFor(map, 1, 0)).toBeNull();
    expect(originalPositionFor(map, 9, 0)).toBeNull();
  });

  it("prepends sourceRoot", () => {
    expect(originalPositionFor({ ...map, sourceRoot: "webpack://app" }, 0, 0)?.source).toBe("webpack://app/a.tsx");
  });

  it("resolves index maps through their sections", () => {
    const indexMap = {
      version: 3,
      sections: [
        { offset: { line: 0, column: 0 }, map: { version: 3, sources: ["first.tsx"], mappings: "AAAA" } },
        { offset: { line: 10, column: 5 }, map: { version: 3, sources: ["second.tsx"], mappings: "AAAA;AACA" } },
      ],
    };
    expect(originalPositionFor(indexMap, 0, 3)?.source).toBe("first.tsx");
    expect(originalPositionFor(indexMap, 10, 5)).toEqual({ source: "second.tsx", line: 0, column: 0 });
    expect(originalPositionFor(indexMap, 11, 0)).toEqual({ source: "second.tsx", line: 1, column: 0 });
  });
});

describe("findSourceMappingUrl", () => {
  it("returns the last annotation", () => {
    const code = 'const s = "//# sourceMappingURL=fake.map";\n//# sourceMappingURL=real.js.map\n';
    expect(findSourceMappingUrl(code)).toBe("real.js.map");
  });

  it("returns null without annotation", () => {
    expect(findSourceMappingUrl("const a = 1;")).toBeNull();
  });
});

describe("parseDataUrl", () => {
  it("decodes base64 UTF-8 and percent-encoded payloads", () => {
    const json = '{"name":"é"}';
    const base64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
    expect(parseDataUrl(`data:application/json;charset=utf-8;base64,${base64}`)).toBe(json);
    expect(parseDataUrl(`data:application/json,${encodeURIComponent(json)}`)).toBe(json);
  });
});
