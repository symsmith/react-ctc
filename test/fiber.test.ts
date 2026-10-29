// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { findOwnedDescendant, getComponentChain, getDisplayName, getFiberFromNode, getHostNodes } from "../src/fiber";
import { fiber, host } from "./fibers";

function App() {}
function Layout() {}
function Button() {}

describe("getFiberFromNode", () => {
  it("reads the fiber from the closest React-managed ancestor", () => {
    const parent = document.createElement("div");
    const child = document.createElement("span");
    parent.append(child);
    const parentFiber = host("div");
    Object.assign(parent, { __reactFiber$abc123: parentFiber });

    expect(getFiberFromNode(child)).toBe(parentFiber);
  });

  it("supports the React 16 property name", () => {
    const node = document.createElement("div");
    const nodeFiber = host("div");
    Object.assign(node, { __reactInternalInstance$xyz: nodeFiber });

    expect(getFiberFromNode(node)).toBe(nodeFiber);
  });

  it("returns null outside React", () => {
    expect(getFiberFromNode(document.createElement("div"))).toBeNull();
  });
});

describe("getDisplayName", () => {
  it("prefers displayName, then function name", () => {
    expect(
      getDisplayName(
        fiber(
          0,
          Object.assign(() => {}, { displayName: "Custom" }),
        ),
      ),
    ).toBe("Custom");
    expect(getDisplayName(fiber(0, Button))).toBe("Button");
  });

  it("unwraps forwardRef and memo", () => {
    expect(getDisplayName(fiber(11, { render: Button }))).toBe("Button");
    expect(getDisplayName(fiber(15, Button, [], { elementType: { type: Button } }))).toBe("Button");
  });

  it("falls back to Anonymous", () => {
    expect(getDisplayName(fiber(0, () => {}))).toBe("Anonymous");
  });
});

describe("getComponentChain", () => {
  it("lists composite ancestors from the leaf to the root, skipping host and context fibers", () => {
    const span = host("span");
    const button = fiber(0, Button, [span]);
    const provider = fiber(10, {}, [button]);
    const layout = fiber(11, { render: Layout }, [host("main", [provider])]);
    const app = fiber(0, App, [layout]);
    fiber(3, null, [app]);

    expect(getComponentChain(span).map(getDisplayName)).toEqual(["Button", "Layout", "App"]);
  });
});

describe("getHostNodes", () => {
  it("collects the outermost DOM nodes of a component", () => {
    const header = host("header", [host("h1", [], { stateNode: document.createElement("h1") })], {
      stateNode: document.createElement("header"),
    });
    const footer = host("footer", [], { stateNode: document.createElement("footer") });
    const inner = fiber(0, Button, [footer]);
    const layout = fiber(0, Layout, [header, inner]);

    expect(getHostNodes(layout)).toEqual([header.stateNode, footer.stateNode]);
  });
});

describe("findOwnedDescendant", () => {
  it("finds the first element the component rendered itself, not one passed as children", () => {
    const app = fiber(0, App);
    const layout = fiber(0, Layout);
    const passedChild = host("p", [], { _debugOwner: app });
    const ownWrapper = host("main", [passedChild], { _debugOwner: layout });
    layout.child = ownWrapper;
    ownWrapper.return = layout;

    expect(findOwnedDescendant(layout)).toBe(ownWrapper);
  });

  it("matches an owner recorded on the alternate fiber", () => {
    const current = fiber(0, Layout);
    const alternate = fiber(0, Layout);
    current.alternate = alternate;
    const div = host("div", [], { _debugOwner: alternate });
    current.child = div;

    expect(findOwnedDescendant(current)).toBe(div);
  });

  it("returns null when the component renders only foreign elements", () => {
    const app = fiber(0, App);
    expect(findOwnedDescendant(fiber(0, Layout, [host("p", [], { _debugOwner: app })]))).toBeNull();
  });
});
