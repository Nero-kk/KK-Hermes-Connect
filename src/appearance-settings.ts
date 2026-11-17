import { Setting } from "obsidian";
import type HermesPlugin from "./main";
import { errorText } from "./errors";
import { notify } from "./notices";

export function appearanceSettings(root: HTMLElement, owner: HermesPlugin): void {
  root.classList.add("kkh-settings");
  new Setting(root).setName("입력창 안내 문구").setDesc("메시지를 입력하기 전에 표시할 문구입니다.")
    .addText((control) => control.setValue(owner.settings.composerPlaceholder).onChange((value) => {
      owner.settings.composerPlaceholder = value.slice(0, 500); owner.store.emit();
      void owner.saveSettings().catch((error: unknown) => notify(errorText(error)));
    }));
  new Setting(root).setName("입력창 글자 크기").setDesc("채팅 글자 크기를 기준으로 입력창만 조절합니다. 한 단계는 2px입니다.")
    .addDropdown((control) => {
      for (let step = -4; step <= 4; step++) control.addOption(String(step), `${step > 0 ? "+" : ""}${step}단계`);
      control.setValue(String(owner.settings.inputFontStep)).onChange((value) => {
        owner.settings.inputFontStep = Number(value); owner.store.emit();
        void owner.saveSettings().catch((error: unknown) => notify(errorText(error)));
      });
    });
  for (const [key, label] of [["desktopFontStep", "PC 채팅 글자 크기"], ["mobileFontStep", "모바일 채팅 글자 크기"]] as const) {
    new Setting(root).setName(label).setDesc("기본 -2단계. 한 단계는 2px이며 대화·입력창·참조·모델·사용량에 함께 적용합니다.")
      .addDropdown((control) => {
        for (let step = -4; step <= 4; step++) control.addOption(String(step), `${step > 0 ? "+" : ""}${step}단계`);
        control.setValue(String(owner.settings[key])).onChange((value) => {
          owner.settings[key] = Number(value); owner.store.emit();
          void owner.saveSettings().catch((error: unknown) => notify(errorText(error)));
        });
      });
  }
}
