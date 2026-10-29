export interface RawSourceMap {
  version: number;
  sources?: (string | null)[];
  sourceRoot?: string;
  mappings?: string;
  sections?: { offset: { line: number; column: number }; map: RawSourceMap }[];
}

export interface OriginalPosition {
  source: string;
  line: number;
  column: number;
}

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_INDEX = new Map(Array.from(BASE64, (char, index) => [char, index]));

export function decodeVlq(segment: string): number[] {
  const values: number[] = [];
  let value = 0;
  let shift = 0;
  for (const char of segment) {
    const digit = BASE64_INDEX.get(char);
    if (digit === undefined) throw new Error(`Invalid VLQ character: ${char}`);
    value += (digit & 31) << shift;
    if (digit & 32) {
      shift += 5;
    } else {
      values.push(value & 1 ? -(value >>> 1) : value >>> 1);
      value = 0;
      shift = 0;
    }
  }
  return values;
}

/** `line` and `column` are 0-based, as in the source map spec. */
export function originalPositionFor(map: RawSourceMap, line: number, column: number): OriginalPosition | null {
  if (map.sections) {
    let match: (typeof map.sections)[number] | undefined;
    for (const section of map.sections) {
      const { offset } = section;
      if (offset.line < line || (offset.line === line && offset.column <= column)) match = section;
    }
    if (!match) return null;
    const { offset } = match;
    return originalPositionFor(match.map, line - offset.line, line === offset.line ? column - offset.column : column);
  }

  const lines = (map.mappings ?? "").split(";");
  if (line >= lines.length) return null;

  const root = map.sourceRoot && !map.sourceRoot.endsWith("/") ? `${map.sourceRoot}/` : (map.sourceRoot ?? "");
  let sourceIndex = 0;
  let originalLine = 0;
  let originalColumn = 0;
  let best: OriginalPosition | null = null;

  for (let generatedLine = 0; generatedLine <= line; generatedLine++) {
    let generatedColumn = 0;
    for (const segment of lines[generatedLine].split(",")) {
      if (!segment) continue;
      const fields = decodeVlq(segment);
      generatedColumn += fields[0];
      if (fields.length < 4) continue;
      sourceIndex += fields[1];
      originalLine += fields[2];
      originalColumn += fields[3];
      if (generatedLine === line && generatedColumn <= column) {
        const source = map.sources?.[sourceIndex];
        if (source != null) {
          best = { source: root + source, line: originalLine, column: originalColumn };
        }
      }
    }
  }
  return best;
}

export function findSourceMappingUrl(code: string): string | null {
  const matches = [...code.matchAll(/[#@]\s*sourceMappingURL=(\S+)/g)];
  return matches.at(-1)?.[1] ?? null;
}

export function parseDataUrl(url: string): string {
  const comma = url.indexOf(",");
  const meta = url.slice(0, comma);
  const data = url.slice(comma + 1);
  if (!meta.endsWith(";base64")) return decodeURIComponent(data);
  const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
