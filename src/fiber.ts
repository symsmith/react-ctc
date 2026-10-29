export interface DebugSource {
  fileName: string;
  lineNumber: number;
  columnNumber?: number;
}

export interface Fiber {
  tag: number;
  type: unknown;
  elementType?: unknown;
  stateNode: unknown;
  return: Fiber | null;
  child: Fiber | null;
  sibling: Fiber | null;
  alternate?: Fiber | null;
  _debugOwner?: unknown;
  _debugSource?: DebugSource | null;
  _debugStack?: { stack?: string } | null;
}

const FunctionComponent = 0;
const ClassComponent = 1;
const IndeterminateComponent = 2;
const HostComponent = 5;
const ForwardRef = 11;
const SimpleMemoComponent = 15;

const COMPOSITE_TAGS = new Set([
  FunctionComponent,
  ClassComponent,
  IndeterminateComponent,
  ForwardRef,
  SimpleMemoComponent,
]);

function isFiber(value: unknown): value is Fiber {
  return typeof value === "object" && value !== null && "tag" in value && "return" in value;
}

export function getFiberFromNode(node: Node | null): Fiber | null {
  for (let current = node; current; current = current.parentNode) {
    for (const key of Object.keys(current)) {
      if (key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$")) {
        const fiber: unknown = Reflect.get(current, key);
        return isFiber(fiber) ? fiber : null;
      }
    }
  }
  return null;
}

export function isComposite(fiber: Fiber): boolean {
  return COMPOSITE_TAGS.has(fiber.tag);
}

function nameOf(type: unknown): string | null {
  if (typeof type === "function") {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName || fn.name || null;
  }
  if (type && typeof type === "object") {
    const wrapper = type as { displayName?: string; render?: unknown; type?: unknown };
    if (wrapper.displayName) return wrapper.displayName;
    return nameOf(wrapper.render) ?? nameOf(wrapper.type);
  }
  return null;
}

export function getDisplayName(fiber: Fiber): string {
  return nameOf(fiber.elementType) ?? nameOf(fiber.type) ?? "Anonymous";
}

export function getComponentChain(fiber: Fiber | null): Fiber[] {
  const chain: Fiber[] = [];
  for (let current = fiber; current; current = current.return) {
    if (isComposite(current)) chain.push(current);
  }
  return chain;
}

export function getHostNodes(fiber: Fiber): Element[] {
  const nodes: Element[] = [];
  const visit = (current: Fiber | null) => {
    for (let node = current; node; node = node.sibling) {
      if (node.tag === HostComponent) {
        if (node.stateNode instanceof Element) nodes.push(node.stateNode);
      } else {
        visit(node.child);
      }
    }
  };
  if (fiber.tag === HostComponent) return fiber.stateNode instanceof Element ? [fiber.stateNode] : [];
  visit(fiber.child);
  return nodes;
}

export function findOwnedDescendant(fiber: Fiber): Fiber | null {
  const stack: Fiber[] = [];
  if (fiber.child) stack.push(fiber.child);
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current._debugOwner === fiber || (fiber.alternate && current._debugOwner === fiber.alternate)) {
      return current;
    }
    if (current.sibling) stack.push(current.sibling);
    if (current.child) stack.push(current.child);
  }
  return null;
}
