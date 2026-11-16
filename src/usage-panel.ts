import type { ModelStore } from "./model-store";
import { icon, providerIcon } from "./composer-icons";

export class UsagePanel {
  readonly element = document.createElement("div");
  private readonly toggle = document.createElement("button");
  private readonly details = document.createElement("div");
  constructor(private readonly store: ModelStore, signal?: AbortSignal) {
    this.element.className = "kkh-usage"; this.details.className = "kkh-usage-details";
    this.details.id = `kkh-usage-${crypto.randomUUID()}`;
    this.toggle.type = "button"; this.toggle.className = "kkh-usage-toggle";
    this.toggle.setAttribute("aria-label", "잔여 사용량과 초기화 시간"); this.toggle.title = "잔여 사용량과 초기화 시간";
    this.toggle.setAttribute("aria-controls", this.details.id); this.toggle.setAttribute("aria-expanded", "false");
    const options = signal ? { signal } : {};
    this.toggle.addEventListener("click", () => this.toggle.setAttribute("aria-expanded", String(this.toggle.getAttribute("aria-expanded") !== "true")), options);
    this.element.addEventListener("keydown", (event) => { if (event.key === "Escape") { this.toggle.setAttribute("aria-expanded", "false"); this.toggle.focus(); } }, options);
    if (signal) document.addEventListener("pointerdown", (event) => {
      if (event.target instanceof Node && !this.element.contains(event.target)) this.toggle.setAttribute("aria-expanded", "false");
    }, { signal });
    this.element.append(this.toggle, this.details);
  }
  render(): void {
    this.details.replaceChildren();
    const data = this.store.data; icon(this.toggle, providerIcon(data?.selection.provider ?? ""));
    const windows = data?.usage?.filter((item) => item.provider === data.selection.provider) ?? [];
    if (!windows.length) { this.details.append(document.createTextNode("잔여량 정보 없음")); return; }
    for (const window of windows) {
      const row = document.createElement("span"); row.className = "kkh-usage-window";
      const labels: Readonly<Record<string, string>> = { Session: "5시간", Weekly: "주간" };
      const left = document.createElement("span"); left.textContent = `${labels[window.label] ?? window.label} 잔여 ${Math.floor(100 - window.usedPercent)}%`;
      const reset = document.createElement("span"); reset.className = "kkh-muted";
      const date = window.resetsAt ? new Date(window.resetsAt) : null;
      const minutes = date ? Math.max(0, Math.ceil((date.getTime() - Date.now()) / 60000)) : NaN;
      reset.textContent = Number.isFinite(minutes) ? ` · 초기화 ${minutes >= 1440 ? `${Math.floor(minutes / 1440)}d ` : ""}${Math.floor(minutes % 1440 / 60)}h ${minutes % 60}m` : " · 초기화 정보 없음";
      if (date && Number.isFinite(date.getTime())) row.title = date.toLocaleString();
      row.append(left, reset); this.details.append(row);
    }
  }
}
