import { Modal, Setting } from "obsidian";
import { notify } from "./notices";
import { BridgeError, errorText } from "./errors";
import { ENVIRONMENT_LIMIT, exportEnvironment, parseEnvironment, privateExportPath } from "./environment";
import type { EnvironmentDetails } from "./environment";
import type HermesPlugin from "./main";
import { runButtonAction } from "./button-action";

const fields = [
  ["tailscaleIp", "Tailscale IP"], ["ubuntuUser", "Ubuntu 계정명"],
  ["windowsVaultPath", "Windows 볼트 경로"], ["ubuntuHomePath", "Ubuntu 홈 경로"],
  ["ubuntuPluginPath", "Ubuntu 플러그인 경로"], ["hermesExecutable", "Hermes 실행 파일 경로"],
  ["bridgeStatePath", "브리지 데이터 경로"], ["profileName", "프로필 이름"],
] as const;
const lists = [
  ["slackChannelIds", "Slack 채널 ID"], ["verificationSessionIds", "검수 세션 ID"], ["operationIds", "작업 ID"],
] as const;

export class EnvironmentModal extends Modal {
  constructor(private readonly owner: HermesPlugin, private readonly applied: () => void) { super(owner.app); }
  override onOpen(): void { this.draw(); }
  private draw(contents?: string): void {
    this.titleEl.textContent = "접속 환경 가져오기 / 내보내기";
    let endpoint = this.owner.settings.endpoint;
    let profileId = this.owner.settings.profileId;
    let environment: EnvironmentDetails = structuredClone(this.owner.settings.environment);
    if (contents !== undefined) {
      const imported = parseEnvironment(contents);
      endpoint = imported.connection.endpoint; profileId = imported.connection.profileId; environment = imported.environment;
    }
    this.contentEl.empty(); this.contentEl.classList.add("kkh-environment");
    this.contentEl.createEl("p", { text: "주소·경로·참조 ID를 한 번에 저장합니다. 환경 파일에는 개인 접속 정보가 포함되며, 인증 토큰은 내보내지 않습니다." });
    const file = this.contentEl.createEl("input", { type: "file" });
    file.accept = ".json,application/json"; file.setAttribute("aria-label", "환경 JSON 파일 가져오기");
    file.addEventListener("change", () => {
      const selected = file.files?.[0]; if (!selected) return;
      if (selected.size > ENVIRONMENT_LIMIT) { notify(errorText(new BridgeError("environment_too_large"))); return; }
      void selected.text().then((text) => this.draw(text)).catch((error: unknown) => notify(errorText(error)));
    });
    let pasted = contents ?? "";
    if (contents !== undefined) this.contentEl.createEl("p", { text: "JSON을 불러왔습니다. 아래 항목을 확인한 뒤 전체 적용을 누르세요.", attr: { role: "status" } });
    new Setting(this.contentEl).setName("JSON 붙여넣기").addTextArea((input) => {
      input.inputEl.rows = 4; input.inputEl.setAttribute("aria-label", "환경 JSON 붙여넣기");
      input.setValue(pasted).onChange((value) => { pasted = value; });
    }).addButton((control) => control.setButtonText("JSON 미리보기").onClick(() => {
      try { this.draw(pasted); } catch (error) { if (error instanceof Error) notify(errorText(error)); else throw error; }
    }));
    new Setting(this.contentEl).setName("회사 HTTPS 주소").addText((input) => input.setValue(endpoint).setPlaceholder("https://company.example.ts.net").onChange((value) => { endpoint = value.trim(); }));
    new Setting(this.contentEl).setName("서버 프로필 ID / 경로").addText((input) => input.setValue(profileId).setPlaceholder("/home/user/.hermes/profiles/profile-name").onChange((value) => { profileId = value.trim(); }));
    for (const [key, label] of fields) new Setting(this.contentEl).setName(label)
      .addText((input) => input.setValue(environment[key]).onChange((value) => { environment = { ...environment, [key]: value }; }));
    this.contentEl.createEl("p", { text: "아래 ID는 줄마다 하나씩 입력합니다. 가져오기만으로 세션을 열거나 작업을 재실행·중지하지 않습니다. 서버 경로는 회사 브리지의 설정에도 별도로 적용해야 합니다." });
    for (const [key, label] of lists) new Setting(this.contentEl).setName(label).addTextArea((input) => {
      input.inputEl.rows = 2; input.inputEl.setAttribute("aria-label", label);
      input.setValue(environment[key].join("\n")).onChange((value) => { environment = { ...environment, [key]: value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) }; });
    });
    const candidate = (): string => JSON.stringify({ format: "kk-hermes-connect/environment", version: 1, connection: { endpoint, profileId }, environment });
    new Setting(this.contentEl).setName("환경 적용").setDesc("파일을 불러온 뒤 이 버튼으로 확정합니다. 연결 대상이 바뀌면 해당 기기를 다시 등록해야 합니다.")
      .addButton((control) => control.setButtonText("전체 적용").setCta().onClick(() => {
        void runButtonAction(control, async () => {
          await this.owner.importEnvironment(candidate());
          this.applied(); this.close(); notify("접속 환경을 적용했습니다.");
        });
      }));
    let filename = "kk-hermes-environment.private.json";
    new Setting(this.contentEl).setName("내보낼 파일명").setDesc("현재 화면의 값을 볼트 안의 개인용 JSON 파일로 저장합니다. 기존 파일은 덮어쓰지 않습니다.")
      .addText((input) => input.setValue(filename).onChange((value) => { filename = value; }))
      .addButton((control) => control.setButtonText("파일로 내보내기").onClick(() => {
        void runButtonAction(control, async () => {
          const profile = parseEnvironment(candidate());
          const path = privateExportPath(filename);
          const data = exportEnvironment({ ...this.owner.settings, ...profile.connection, environment: profile.environment });
          if (await this.app.vault.adapter.exists(path)) throw new BridgeError("environment_file_exists");
          await this.app.vault.create(path, data); notify(`내보냈습니다: ${path}`);
        });
      }));
  }
  override onClose(): void { this.contentEl.empty(); }
}
