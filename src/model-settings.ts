import { Setting } from "obsidian";
import type HermesPlugin from "./main";
import { modelKey } from "./model-schema";
import { visibleOptions } from "./model-preferences";
import { errorText } from "./errors";
import { notify } from "./notices";

export function modelSettings(root: HTMLElement, owner: HermesPlugin): void {
  const section = root.createEl("details", { cls: "kkh-model-settings" });
  const heading = section.createEl("summary", { cls: "kkh-model-settings-heading", text: "모델 선택창" });
  heading.createSpan({ cls: "kkh-model-settings-chevron", text: "▾" });
  section.createEl("p", { cls: "setting-item-description", text: "활성화한 모델만 선택창에 표시하며 위·아래 버튼으로 순서를 바꿉니다. 기본값 설정은 현재 목록과 순서를 저장하고, 초기화는 저장한 기본값을 적용합니다. 목록은 5개씩 보이며 스크롤할 수 있습니다. 현재 사용 중인 모델은 항상 표시됩니다." });
  const options = owner.store.models.data?.options ?? [];
  if (!options.length) { section.createEl("p", { text: "대화에 연결한 뒤 설정을 다시 열면 모델 목록이 표시됩니다." }); return; }
  const initial = visibleOptions(options, null, owner.store.models.data?.selection.provider).map(modelKey);
  let order = [...(owner.settings.visibleModels ?? owner.settings.visibleModelsDefault ?? initial)];
  const list = section.createDiv({ cls: "kkh-model-list" });
  const save = (): void => {
    owner.settings.visibleModels = [...order]; owner.store.emit();
    void owner.saveSettings().catch((error: unknown) => notify(errorText(error)));
  };
  let query = "";
  const render = (): void => {
    list.replaceChildren();
    const ranked = [...options].sort((a, b) => {
      const ai = order.indexOf(modelKey(a)); const bi = order.indexOf(modelKey(b));
      return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi);
    });
    for (const option of ranked.filter((item) => `${item.label} ${item.model} ${item.provider}`.toLowerCase().includes(query))) {
      const key = modelKey(option); const index = order.indexOf(key);
      const row = new Setting(list).setName(option.label);
      row.settingEl.title = option.available ? option.label : `${option.label} · 현재 사용할 수 없음`;
      row.settingEl.classList.toggle("kkh-model-unavailable", !option.available);
      row
        .addToggle((toggle) => toggle.setValue(index >= 0).onChange((value) => {
          order = value ? [...order, key] : order.filter((item) => item !== key); save(); render();
        }))
        .addButton((button) => button.setIcon("arrow-up").setTooltip("위로").setDisabled(index <= 0).onClick(() => {
          const previous = order[index - 1]; if (previous === undefined) return;
          order.splice(index - 1, 2, key, previous); save(); render();
        }))
        .addButton((button) => button.setIcon("arrow-down").setTooltip("아래로").setDisabled(index < 0 || index === order.length - 1).onClick(() => {
          const next = order[index + 1]; if (next === undefined) return;
          order.splice(index, 2, next, key); save(); render();
        }));
    }
    if (!list.childElementCount) list.createEl("p", { cls: "setting-item-description", text: "검색 결과가 없습니다." });
  };
  new Setting(section).setName("모델 검색").setClass("kkh-model-search").addSearch((search) => {
    search.inputEl.setAttribute("aria-label", "모델 또는 제공자 검색");
    search.setPlaceholder("모델 또는 제공자").onChange((value) => { query = value.trim().toLowerCase(); render(); });
  });
  new Setting(section).setName("표시 목록 초기화")
    .addButton((button) => button.setButtonText("기본값 설정").setTooltip("현재 활성화한 모델과 순서를 기본값으로 저장").onClick(() => {
      owner.settings.visibleModelsDefault = [...order];
      void owner.saveSettings().then(() => notify("현재 모델 목록과 순서를 기본값으로 저장했습니다.")).catch((error: unknown) => notify(errorText(error)));
    }))
    .addButton((button) => button.setButtonText("초기화").setTooltip("저장한 기본 모델 목록과 순서 적용").onClick(() => {
      order = [...(owner.settings.visibleModelsDefault ?? initial)]; save(); render();
    }));
  section.append(list); render();
}
