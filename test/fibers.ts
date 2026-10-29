import type { Fiber } from "../src/fiber";

export function fiber(tag: number, type: unknown, children: Fiber[] = [], extra: Partial<Fiber> = {}): Fiber {
  const node: Fiber = {
    tag,
    type,
    elementType: type,
    stateNode: null,
    return: null,
    child: null,
    sibling: null,
    ...extra,
  };
  children.forEach((child, index) => {
    child.return = node;
    if (index === 0) node.child = child;
    else children[index - 1].sibling = child;
  });
  return node;
}

export function host(tagName: string, children: Fiber[] = [], extra: Partial<Fiber> = {}): Fiber {
  return fiber(5, tagName, children, extra);
}
