# React CTC

React Click to Component, as a Firefox extension. Works on local pages (`localhost` on any port, its subdomains, `127.0.0.1` and `[::1]`) that run a development build of React 16–19. To add a host, edit `content_scripts.matches` in `extension/manifest.json`.

| Gesture                | Effect                                                   |
| ---------------------- | -------------------------------------------------------- |
| Alt + hover            | Highlights the closest React component under the pointer |
| Alt + scroll up / down | Moves to the parent / back to the child component        |
| Alt + click            | Opens the highlighted component's code in VS Code        |

Alt + click opens the first JSX element the component renders, so it lands in the component's own file. A component that renders nothing of its own opens where it is used.

## How the source is found

- React ≤ 18: `fiber._debugSource`, set by the JSX dev transform.
- React 19: the JSX call site from `fiber._debugStack`, mapped through the module's source map. The absolute path comes from the `fileName` that the JSX dev transform (Babel, SWC, esbuild) writes into the compiled module.

Known gaps: bundles served as `eval` or `webpack-internal://` modules, and transforms that do not write absolute file names (for example Turbopack's `[project]/…` paths) cannot be resolved for React 19.

## Develop

```bash
pnpm install
pnpm build
pnpm test
pnpm start
```

| Script              | Effect                                                   |
| ------------------- | -------------------------------------------------------- |
| `pnpm typecheck`    | Type-checks with `tsc`                                   |
| `pnpm lint`         | Runs `oxlint` with type-aware rules, then `web-ext lint` |
| `pnpm format`       | Formats with `oxfmt`, including JSDoc and import sorting |
| `pnpm format:check` | Checks formatting without writing                        |

`pnpm start` launches Firefox with the extension loaded (`web-ext run`). To load it by hand, open `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on…" and pick `extension/manifest.json`.

`pnpm package` writes a zip to `web-ext-artifacts/`. Requires Firefox 142+.

## Build from source

These steps produce the exact `extension/content.js` that is in the published package. esbuild bundles it from `src/*.ts`, without minification.

Environment: macOS or Linux with a POSIX shell and network access. Built on macOS 26.0 (arm64).

Required programs:

| Program | Version | Install                                                                                   |
| ------- | ------- | ----------------------------------------------------------------------------------------- |
| Node.js | 24.x    | `nvm install` (reads `.nvmrc`, 24.14.0), or the installer from https://nodejs.org         |
| npm     | 10+     | Comes with Node.js                                                                        |
| pnpm    | 12.4.2  | No install needed. `build.sh` runs it with `npx pnpm@12.4.2`                              |
| esbuild | 0.28.2  | No install needed. `pnpm install` installs it from `pnpm-lock.yaml`, like all other tools |

Steps:

1. Install Node.js 24.
2. In the project folder, run `./build.sh`.

`build.sh` checks the Node.js version, installs the dependencies from the lockfile, builds `extension/content.js` and writes the package to `web-ext-artifacts/react_ctc-<version>.zip`.
