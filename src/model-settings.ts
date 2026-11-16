import { Setting } from "obsidian";
import type HermesPlugin from "./main";
import { modelKey } from "./model-schema";
import { visibleOptions } from "./model-preferences";
import { errorText } from "./errors";
import { notify } from "./notices";

export function modelSettings(root: HTMLElement, owner: HermesPlugin): void {
  const section = root.createDiv({ cls: "kkh-model-settings" });
  section.createEl("h3", { text: "모델 선택창" });
  section.createEl("p", { text: "체크한 모델만 선택창에 표시합니다. 위·아래 버튼으로 순서를 바꾸세요. 기본값은 처음 8개입니다. 현재 사용 중인 모델은 항상 표시됩니다." });
  const options = owner.store.models.data?.options ?? [];
  if (!options.length) { section.createEl("p", { text: "대화에 연결한 뒤 설정을 다시 열면 모델 목록이 표시됩니다." }); return; }
  const defaults = visibleOptions(options, null, owner.store.models.data?.selection.provider).map(modelKey);
  let order = [...(owner.settings.visibleModels ?? defaults)];
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
    for (const option of ranked.filter((item) => item.label.toLowerCase().includes(query))) {
      const key = modelKey(option); const index = order.indexOf(key);
      new Setting(list).setName(option.label).setDesc(option.available ? option.provider : "현재 사용할 수 없음")
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
  };
  new Setting(section).setName("모델 검색").addSearch((search) => search.setPlaceholder("모델 또는 제공자").onChange((value) => { query = value.toLowerCase(); render(); }));
  new Setting(section).setName("표시 목록 초기화").addButton((button) => button.setButtonText("기본 8개").onClick(() => {
    order = [...defaults]; save(); render();
  }));
  section.append(list); render();
}
