import { icon, providerIcon } from "./composer-icons";
import type { ModelState } from "./model-schema";
import { modelName } from "./model-preferences";

export class ModelPicker {
  readonly trigger = document.createElement("button");
  private readonly popup = document.createElement("div");
  private provider = "";
  private data: ModelState | null = null;
  private renderKey = "";
  constructor(private readonly controls: { readonly model: HTMLSelectElement; readonly effort: HTMLSelectElement }, signal: AbortSignal) {
    this.trigger.type = "button"; this.trigger.className = "kkh-model-trigger";
    this.trigger.setAttribute("aria-haspopup", "dialog"); this.trigger.setAttribute("aria-expanded", "false");
    this.popup.className = "kkh-model-popup"; this.popup.hidden = true;
    this.popup.setAttribute("role", "dialog"); this.popup.setAttribute("aria-label", "모델과 추론 강도 선택");
    this.trigger.addEventListener("click", () => {
      this.popup.hidden = !this.popup.hidden; this.trigger.setAttribute("aria-expanded", String(!this.popup.hidden));
      this.provider = this.data?.selection.provider ?? ""; this.draw();
      if (!this.popup.hidden) this.popup.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    }, { signal });
    document.addEventListener("pointerdown", (event) => {
      if (event.target instanceof Node && !this.popup.contains(event.target) && !this.trigger.contains(event.target)) this.close(false);
    }, { signal });
    this.popup.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); this.close(true); }
      if (event.key === "Tab") {
        const buttons = [...this.popup.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
        const first = buttons[0]; const last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }, { signal });
  }
  mount(root: HTMLElement): void { root.append(this.trigger, this.popup); }
  private close(focus: boolean): void {
    this.popup.hidden = true; this.trigger.setAttribute("aria-expanded", "false"); if (focus) this.trigger.focus();
  }
  render(data: ModelState | null): void {
    this.data = data; const { model, effort } = this.controls;
    this.trigger.disabled = model.disabled;
    this.trigger.replaceChildren(); const glyph = document.createElement("span"); icon(glyph, providerIcon(data?.selection.provider ?? ""));
    const label = document.createElement("span"); label.className = "kkh-model-name";
    label.textContent = data ? modelName(data.selection.model) : "모델 선택";
    const level = document.createElement("span"); level.className = "kkh-effort-label";
    level.textContent = ` · ${effort.selectedOptions[0]?.textContent ?? "추론"}`;
    const chevron = document.createElement("span"); icon(chevron, "chevron-down");
    this.trigger.append(glyph, label, level, chevron); this.trigger.title = `${label.textContent}${level.textContent}`;
    if (model.disabled) this.close(false);
    const key = JSON.stringify([data?.selection, [...model.options].map((option) => [option.value, option.disabled]), effort.disabled]);
    if (!this.popup.hidden && key !== this.renderKey) this.draw();
    this.renderKey = key;
  }
  private draw(): void {
    this.popup.replaceChildren(); const { model, effort } = this.controls;
    const choices = [...model.options];
    const providers = [...new Set(choices.map((option) => this.data?.options.find((item) => JSON.stringify([item.provider, item.model]) === option.value)?.provider ?? this.data?.selection.provider ?? ""))];
    if (!providers.includes(this.provider)) this.provider = providers[0] ?? "";
    const tabs = document.createElement("nav"); tabs.className = "kkh-provider-tabs"; tabs.setAttribute("aria-label", "모델 제공자");
    for (const provider of providers) {
      const tab = document.createElement("button"); tab.type = "button"; icon(tab, providerIcon(provider));
      tab.title = provider; tab.setAttribute("aria-label", provider); tab.setAttribute("aria-pressed", String(provider === this.provider));
      tab.addEventListener("click", () => { this.provider = provider; this.draw(); this.popup.querySelector<HTMLButtonElement>("button[aria-pressed=true]")?.focus(); }); tabs.append(tab);
    }
    const models = document.createElement("section"); models.className = "kkh-picker-models";
    const heading = document.createElement("div"); heading.className = "kkh-picker-heading"; heading.textContent = "모델"; models.append(heading);
    for (const choice of choices) {
      const option = this.data?.options.find((item) => JSON.stringify([item.provider, item.model]) === choice.value);
      if ((option?.provider ?? this.data?.selection.provider) !== this.provider) continue;
      const row = document.createElement("button"); row.type = "button"; row.textContent = option ? modelName(option.model) : choice.text;
      row.disabled = choice.disabled; row.title = choice.text; row.setAttribute("aria-pressed", String(choice.selected));
      row.addEventListener("click", () => { model.value = choice.value; model.dispatchEvent(new Event("change")); this.close(true); }); models.append(row);
    }
    const levels = document.createElement("section"); levels.className = "kkh-picker-efforts";
    const title = document.createElement("div"); title.className = "kkh-picker-heading"; title.textContent = "사고"; levels.append(title);
    for (const choice of effort.options) {
      const row = document.createElement("button"); row.type = "button";
      const bars = document.createElement("span"); icon(bars, "signal"); row.append(bars, document.createTextNode(choice.text));
      row.disabled = effort.disabled || choice.disabled; row.setAttribute("aria-pressed", String(choice.selected));
      row.addEventListener("click", () => { effort.value = choice.value; effort.dispatchEvent(new Event("change")); this.close(true); }); levels.append(row);
    }
    this.popup.append(tabs, models, levels);
  }
}
