export interface Rect {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export function unionRect(rects: Rect[]): Rect | null {
  const visible = rects.filter((rect) => rect.right > rect.left || rect.bottom > rect.top);
  if (visible.length === 0) return null;
  return {
    top: Math.min(...visible.map((rect) => rect.top)),
    left: Math.min(...visible.map((rect) => rect.left)),
    right: Math.max(...visible.map((rect) => rect.right)),
    bottom: Math.max(...visible.map((rect) => rect.bottom)),
  };
}

const STYLE = `
  .box {
    position: fixed;
    box-sizing: border-box;
    border: 2px solid #149eca;
    background: rgba(20, 158, 202, 0.12);
    border-radius: 3px;
  }
  .label {
    position: fixed;
    padding: 2px 6px;
    border-radius: 3px;
    background: #23272f;
    color: #fff;
    font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
    white-space: nowrap;
  }
  .label .level {
    color: #99a1b3;
    margin-left: 6px;
  }
`;

export interface Size {
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function labelPosition(rect: Rect, label: Size, viewport: Size): { top: number; left: number } {
  const top = rect.top >= label.height ? rect.top - label.height : rect.top;
  return {
    top: clamp(top, 0, viewport.height - label.height),
    left: clamp(rect.left, 0, viewport.width - label.width),
  };
}

export interface Overlay {
  show(rect: Rect, name: string, level: string): void;
  hide(): void;
}

function element(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

export function createOverlay(): Overlay {
  const host = document.createElement("react-ctc-overlay");
  host.style.cssText = "all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;";
  const root = host.attachShadow({ mode: "closed" });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(STYLE);
  root.adoptedStyleSheets = [sheet];
  const box = element("div", "box");
  const nameNode = element("span", "name");
  const levelNode = element("span", "level");
  const label = element("div", "label");
  label.append(nameNode, levelNode);
  root.append(box, label);

  return {
    show(rect, name, level) {
      if (!host.isConnected) document.documentElement.append(host);
      Object.assign(box.style, {
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.right - rect.left}px`,
        height: `${rect.bottom - rect.top}px`,
      });
      nameNode.textContent = name;
      levelNode.textContent = level;
      const { width, height } = label.getBoundingClientRect();
      const { clientWidth, clientHeight } = document.documentElement;
      const position = labelPosition(rect, { width, height }, { width: clientWidth, height: clientHeight });
      Object.assign(label.style, { top: `${position.top}px`, left: `${position.left}px` });
    },
    hide() {
      host.remove();
    },
  };
}
