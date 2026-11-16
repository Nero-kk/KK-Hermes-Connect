import { PluginSettingTab, Setting } from "obsidian";
import { notify } from "./notices";
import type { App } from "obsidian";
import type HermesPlugin from "./main";
import { BridgeError, errorText } from "./errors";
import { endpoint } from "./transport";

export class HermesSettings extends PluginSettingTab {
  constructor(app: App, private readonly owner: HermesPlugin) { super(app, owner); }
  override display(): void {
    this.containerEl.empty();
    const owner = this.owner;
    let code = "";
    let label = "Obsidian 기기";
    new Setting(this.containerEl).setName("회사 연결 주소")
      .setDesc("Tailscale 내부 HTTPS origin. 주소를 변경하면 이 기기의 인증을 해제합니다.")
      .addText((input) => input.setValue(owner.settings.endpoint).setPlaceholder("https://jin.tail8208fa.ts.net")
        .onChange((value) => {
          owner.store.disconnect(); owner.credentials.clear(); owner.settings.serverId = "";
          owner.settings.lastSession = "";
          owner.settings.endpoint = value.trim();
          void owner.saveSettings().catch((error: unknown) => notify(errorText(error)));
        }));
    new Setting(this.containerEl).setName("고정 연이 프로필").setDesc(owner.settings.profileId);
    new Setting(this.containerEl).setName("기기 이름").addText((input) => input.setValue(label).onChange((value) => { label = value; }));
    new Setting(this.containerEl).setName("1회 등록 코드")
      .setDesc("회사 WSL에서 kk-hermes-bridge pair로 발급합니다. 유효 시간은 5분입니다.")
      .addText((input) => { input.inputEl.type = "password"; input.inputEl.autocomplete = "off"; input.onChange((value) => { code = value.trim(); }); });
    new Setting(this.containerEl).setName("이 기기 등록")
      .setDesc(owner.credentials.persistent ? "인증값은 Obsidian SecretStorage에 보관합니다. 설정 파일에는 저장하지 않습니다." : "이 앱에서는 인증값을 메모리에 보관합니다. 앱을 종료하면 다시 등록해야 합니다.")
      .addButton((control) => control.setButtonText("등록").setCta().onClick(() => {
        control.setDisabled(true);
        void (async () => {
          endpoint(owner.settings.endpoint);
          const paired = await owner.store.transport.pair(owner.settings.endpoint, code, label);
          if (paired.profileId !== owner.settings.profileId) throw new BridgeError("profile_mismatch");
          owner.credentials.clear(); owner.credentials.store(paired.deviceId, paired.token);
          owner.settings.serverId = paired.serverId; await owner.saveSettings();
          code = ""; notify("이 기기를 등록했습니다."); this.display(); await owner.store.connect();
        })().catch((error: unknown) => notify(errorText(error))).finally(() => control.setDisabled(false));
      }));
    new Setting(this.containerEl).setName("연결 테스트").setDesc("인증·고정 프로필·Gateway 기능을 확인합니다.")
      .addButton((control) => control.setButtonText("연결 테스트").onClick(() => {
        void owner.store.connect().then(() => notify(owner.store.status));
      }));
    new Setting(this.containerEl).setName("이 기기의 인증 참조 해제")
      .setDesc("서버의 토큰 폐기는 회사 WSL의 revoke 명령으로 처리합니다. 진행 중인 작업을 취소하지 않습니다.")
      .addButton((control) => control.setButtonText("로컬 인증 해제").onClick(() => {
        owner.store.disconnect(); owner.credentials.clear(); this.display();
      }));
    const status = this.containerEl.createEl("p"); status.textContent = owner.store.status;
  }
}
