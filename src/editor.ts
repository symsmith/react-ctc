import type { SourceLocation } from "./source";

export function vscodeUrl({ fileName, line, column }: SourceLocation): string {
  const path = fileName.replace(/\\/g, "/");
  return `vscode://file${path.startsWith("/") ? "" : "/"}${encodeURI(path)}:${line}:${column}`;
}

export function openUrl(url: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.click();
}
