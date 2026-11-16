const paths: Readonly<Record<string, string>> = {
  "file-text": "M14 2H6v20h12V6Z M14 2v5h5 M8 12h8 M8 16h6",
  x: "m6 6 12 12 M6 18 18 6",
  "text-select": "M4 3H2v4 M20 3h2v4 M4 21H2v-4 M20 21h2v-4 M7 7h10 M7 12h10 M7 17h6",
  asterisk: "M12 2v20 M3.3 7l17.4 10 M3.3 17 20.7 7 M7 3.3l10 17.4 M17 3.3 7 20.7",
  sparkles: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z",
  aperture: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M14 3 8 13 M21 8H9 M19 19 13 8 M10 22l6-11 M3 16h12 M5 5l6 11",
  bot: "M5 7h14v13H5Z M12 3v4 M9 12v2 M15 12v2 M9 17h6",
  "chevron-down": "m6 9 6 6 6-6",
  "arrow-up": "M12 19V5 m-6 6 6-6 6 6",
  "shield-check": "m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z m-4 10 3 3 5-5",
  "signal": "M3 20v-3 M8 20v-7 M13 20V9 M18 20V5",
  "square-plus": "M3 3h18v18H3Z M12 7v10 M7 12h10",
  "square-pen": "M12 3H3v18h18v-9 M9 15l1-5L19 1l4 4-9 9Z",
  history: "M3 3v6h6 M3 9a9 9 0 1 1 0 6 M12 7v5l3 2",
  "git-fork": "M6 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4 M18 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4 M12 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4 M6 7v4h12V7 M12 11v6",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 2h6l1 4 4 1 2 5-3 3 1 4-5 3-3-3-4 1-3-5 3-3-1-4 3-1Z",
};
export function icon(node: HTMLElement, name: string): void {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("width", "16"); svg.setAttribute("height", "16");
  svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round"); svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(svg.namespaceURI, "path"); path.setAttribute("d", paths[name] ?? paths["bot"] ?? "");
  svg.append(path); node.replaceChildren(svg);
}
export function providerIcon(provider: string): string {
  if (/anthropic|claude/i.test(provider)) return "asterisk";
  if (/google|gemini/i.test(provider)) return "sparkles";
  if (/openai|codex/i.test(provider)) return "aperture";
  return "bot";
}
