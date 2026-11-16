import type { ModelStore } from "./model-store";
import { icon, providerIcon } from "./composer-icons";

export class UsagePanel {
  readonly element = document.createElement("div");
  constructor(private readonly store: ModelStore) { this.element.className = "kkh-usage"; }
  render(): void {
    this.element.replaceChildren();
    const data = this.store.data; const glyph = document.createElement("span"); icon(glyph, providerIcon(data?.selection.provider ?? "")); this.element.append(glyph);
    const windows = data?.usage?.filter((item) => item.provider === data.selection.provider) ?? [];
    if (!windows.length) { this.element.append(document.createTextNode("잔여량 정보 없음")); return; }
    for (const window of windows) {
      const row = document.createElement("span"); row.className = "kkh-usage-window";
      const labels: Readonly<Record<string, string>> = { Session: "5시간", Weekly: "주간" };
      const left = document.createElement("span"); left.textContent = `${labels[window.label] ?? window.label} 잔여 ${Math.floor(100 - window.usedPercent)}%`;
      const reset = document.createElement("span"); reset.className = "kkh-muted";
      const date = window.resetsAt ? new Date(window.resetsAt) : null;
      const minutes = date ? Math.max(0, Math.ceil((date.getTime() - Date.now()) / 60000)) : NaN;
      reset.textContent = Number.isFinite(minutes) ? ` · 초기화 ${minutes >= 1440 ? `${Math.floor(minutes / 1440)}d ` : ""}${Math.floor(minutes % 1440 / 60)}h ${minutes % 60}m` : " · 초기화 정보 없음";
      if (date && Number.isFinite(date.getTime())) row.title = date.toLocaleString();
      row.append(left, reset); this.element.append(row);
    }
  }
}
