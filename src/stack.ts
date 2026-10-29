export interface StackFrame {
  url: string;
  line: number;
  column: number;
}

const FIREFOX_FRAME = /^[^@]*@(.+):(\d+):(\d+)$/;
const CHROME_FRAME = /^\s*at (?:.*? \()?(.+?):(\d+):(\d+)\)?$/;

export function parseStack(stack: string): StackFrame[] {
  const frames: StackFrame[] = [];
  for (const line of stack.split("\n")) {
    const match = CHROME_FRAME.exec(line) ?? FIREFOX_FRAME.exec(line);
    if (match) {
      frames.push({ url: match[1], line: Number(match[2]), column: Number(match[3]) });
    }
  }
  return frames;
}

// React creates `_debugStack` inside jsxDEV/createElement, so the first frame is
// React's own and the second is the JSX call site.
export function jsxCallSite(stack: string): StackFrame | null {
  return parseStack(stack)[1] ?? null;
}
