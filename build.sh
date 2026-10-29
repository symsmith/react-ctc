#!/bin/sh
set -eu

cd "$(dirname "$0")"

required_node=24
node_major=$(node --version | sed 's/^v\([0-9]*\).*/\1/')
if [ "$node_major" != "$required_node" ]; then
  echo "Node.js $required_node is required, found $(node --version). See README.md." >&2
  exit 1
fi

pnpm="npx --yes pnpm@12.4.2"
$pnpm install --frozen-lockfile
$pnpm run build
$pnpm exec web-ext build --source-dir extension --overwrite-dest
