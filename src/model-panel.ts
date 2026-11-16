import { modelKey, reasoningEffort } from "./model-schema";
import type { ModelStore } from "./model-store";

export class ModelPanel {
  readonly element: HTMLElement;
  private readonly model: HTMLSelectElement;
  private readonly effort: HTMLSelectElement;
  private readonly status: HTMLElement;
  private optionKey = "";
  constructor(private readonly store: ModelStore, signal: AbortSignal) {
    this.element = document.createElement("div"); this.element.className = "kkh-model-controls";
    const modelLabel = document.createElement("label"); modelLabel.textContent = "모델";
    const effortLabel = document.createElement("label"); effortLabel.textContent = "추론 강도";
    this.model = document.createElement("select"); this.model.setAttribute("aria-label", "Hermes 모델 선택");
    this.effort = document.createElement("select"); this.effort.setAttribute("aria-label", "Hermes 추론 강도 선택");
    modelLabel.append(this.model); effortLabel.append(this.effort);
    this.status = document.createElement("p"); this.status.className = "kkh-model-status";
    this.status.setAttribute("role", "status"); this.status.setAttribute("aria-live", "polite");
    this.element.append(modelLabel, effortLabel, this.status);
    this.model.addEventListener("change", () => {
      const option = store.data?.options.find((item) => modelKey(item) === this.model.value && item.available);
      if (option) void store.change({ kind: "model", model: option.model, provider: option.provider }, (message) => window.confirm(message));
    }, { signal });
    this.effort.addEventListener("change", () => {
      const parsed = reasoningEffort.safeParse(this.effort.value);
      if (parsed.success) void store.change({ kind: "reasoning", effort: parsed.data }, (message) => window.confirm(message));
    }, { signal });
  }
  render(disabled: boolean, running: boolean): void {
    const store = this.store; const data = store.data;
    const options = data?.options ?? [];
    const optionKey = JSON.stringify([options, data?.selection]);
    if (optionKey !== this.optionKey) {
      this.optionKey = optionKey; this.model.replaceChildren(); this.effort.replaceChildren();
      for (const item of options) {
        const option = document.createElement("option"); option.value = modelKey(item); option.textContent = item.label;
        option.disabled = !item.available; this.model.append(option);
      }
      if (data && !options.some((item) => modelKey(item) === modelKey(data.selection))) {
        const current = document.createElement("option"); current.value = modelKey(data.selection);
        current.textContent = `${data.selection.provider} · ${data.selection.model} (현재 모델)`; current.disabled = true; this.model.append(current);
      }
      const selected = options.find((item) => data && modelKey(item) === modelKey(data.selection));
      for (const value of reasoningEffort.options) {
        if (value === "none" && selected?.canDisableReasoning === false && data?.selection.reasoning !== "none") continue;
        const option = document.createElement("option"); option.value = value; option.textContent = value === "none" ? "None (끔)" : value[0]?.toUpperCase() + value.slice(1);
        this.effort.append(option);
      }
      if (!data) { const option = document.createElement("option"); option.textContent = "대화 선택 후 표시"; this.model.append(option); }
    }
    if (data) { this.model.value = modelKey(data.selection); this.effort.value = data.selection.reasoning; }
    const selected = options.find((item) => data && modelKey(item) === modelKey(data.selection));
    const locked = disabled || running || store.loading || store.changing || !data;
    this.model.disabled = locked; this.effort.disabled = locked || !selected?.reasoning;
    const wire = data?.selection.reasoningWire;
    this.status.textContent = running ? "응답이 끝나면 모델과 추론 강도를 변경할 수 있습니다."
      : `${store.status}${wire && wire !== data?.selection.reasoning ? ` · 실제 요청 강도: ${wire}` : ""}`;
    if (data && !selected?.reasoning && !locked) this.status.textContent += " · 이 모델은 추론 강도 조절을 지원하지 않습니다.";
  }
}
