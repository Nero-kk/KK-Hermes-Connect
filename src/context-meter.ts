import type { ModelState } from "./model-schema";

export class ContextMeter {
  readonly element = document.createElement("span");
  private readonly value = document.createElement("span");
  private readonly arc = document.createElementNS("http://www.w3.org/2000/svg", "circle");

  constructor() {
    this.element.className = "kkh-context-meter";
    this.element.tabIndex = 0;
    const svg = document.createElementNS(this.arc.namespaceURI, "svg");
    svg.setAttribute("viewBox", "0 0 20 20"); svg.setAttribute("aria-hidden", "true");
    const track = document.createElementNS(this.arc.namespaceURI, "circle");
    for (const circle of [track, this.arc]) {
      circle.setAttribute("cx", "10"); circle.setAttribute("cy", "10"); circle.setAttribute("r", "8");
      circle.setAttribute("fill", "none"); circle.setAttribute("stroke", "currentColor");
      circle.setAttribute("stroke-width", "2"); circle.setAttribute("pathLength", "100");
    }
    track.classList.add("kkh-context-track");
    this.arc.classList.add("kkh-context-arc");
    svg.append(track, this.arc); this.element.append(svg, this.value);
  }

  render(usage: ModelState["contextUsage"]): void {
    const known = usage && usage.maxTokens > 0;
    const percent = known ? Math.min(100, Math.max(0, usage.usedTokens / usage.maxTokens * 100)) : 0;
    this.element.dataset["available"] = String(Boolean(known));
    this.value.textContent = known ? `${Math.round(percent)}%` : "—";
    this.arc.setAttribute("stroke-dasharray", `${percent} 100`);
    const description = known
      ? `컨텍스트 사용량 ${usage.usedTokens.toLocaleString()} / ${usage.maxTokens.toLocaleString()} 토큰 (${Math.round(percent)}%)`
      : "컨텍스트 사용량 정보 없음";
    this.element.title = description; this.element.setAttribute("aria-label", description);
  }
}
