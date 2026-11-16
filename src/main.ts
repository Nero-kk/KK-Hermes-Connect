import { ItemView, Modal, Platform, Plugin } from "obsidian";
import { notify } from "./notices";
import type { WorkspaceLeaf } from "obsidian";
import { z } from "zod";
import { Credentials } from "./credentials";
import { ChatStore } from "./store";
import { ChatPanel } from "./chat-panel";
import { settingsSchema } from "./schema";
import type { Settings } from "./schema";
import { SessionPicker } from "./session-picker";
import { HermesSettings } from "./settings";
import { errorText } from "./errors";
import { parseEnvironment, planEnvironmentImport } from "./environment";

const VIEW = "kk-hermes-chat";

class HermesView extends ItemView {
  private panel: ChatPanel | null = null;
  constructor(leaf: WorkspaceLeaf, private readonly owner: HermesPlugin) { super(leaf); }
  override getViewType(): string { return VIEW; }
  override getDisplayText(): string { return "Yeon Chat"; }
  override getIcon(): string { return "messages-square"; }
  override async onOpen(): Promise<void> {
    this.panel = new ChatPanel(this.contentEl, this.owner.store, {
      mobile: Platform.isMobile,
      pick: () => new SessionPicker(this.app, this.owner.store).open(),
      settings: () => this.owner.openSettings(),
    });
  }
  override async onClose(): Promise<void> { this.panel?.destroy(); this.panel = null; }
}

export default class HermesPlugin extends Plugin {
  override settings: Settings = settingsSchema.parse({});
  credentials: Credentials = new Credentials(this.app);
  store: ChatStore = new ChatStore(this.settings, this.credentials, () => this.saveSettings());
  private saveQueue: Promise<void> = Promise.resolve();
  override async onload(): Promise<void> {
    const raw: unknown = await this.loadData();
    const parsed = settingsSchema.safeParse(raw ?? {});
    if (!parsed.success) { notify("KK Hermes Connect 설정을 해석할 수 없습니다. 기존 data.json을 보존하고 설정을 확인하세요."); return; }
    this.settings = parsed.data;
    this.credentials = new Credentials(this.app);
    this.store = new ChatStore(this.settings, this.credentials, () => this.saveSettings());
    this.registerView(VIEW, (leaf) => new HermesView(leaf, this));
    this.addSettingTab(new HermesSettings(this.app, this));
    this.addRibbonIcon("messages-square", "Hermes Chat Open", () => { void this.openChat(); });
    this.addCommand({ id: "open-chat", name: "Hermes Chat Open", callback: () => { void this.openChat(); } });
    this.addCommand({ id: "connect", name: "회사 연이에 연결", callback: () => { void this.store.connect(); } });
    this.addCommand({ id: "disconnect", name: "회사 연결 해제", callback: () => this.store.disconnect() });
    this.registerDomEvent(document, "visibilitychange", () => {
      if (document.visibilityState === "visible" && this.credentials.token()) void this.store.connect();
    });
    this.registerDomEvent(window, "online", () => { if (this.credentials.token()) void this.store.connect(); });
  }
  async saveSettings(): Promise<void> {
    const data: unknown = JSON.parse(JSON.stringify(this.settings));
    this.saveQueue = this.saveQueue.catch((error: unknown) => {
      if (error instanceof Error) notify(errorText(error));
      else throw error;
    }).then(() => this.saveData(data));
    return this.saveQueue;
  }
  async importEnvironment(contents: string): Promise<void> {
    const planned = planEnvironmentImport(this.settings, parseEnvironment(contents));
    const previous = this.settings;
    if (!planned.connectionChanged) {
      const before = { endpoint: previous.endpoint, profileId: previous.profileId, environment: previous.environment };
      Object.assign(previous, { endpoint: planned.settings.endpoint, profileId: planned.settings.profileId, environment: planned.settings.environment });
      try { await this.saveSettings(); }
      catch (error) { Object.assign(previous, before); throw error; }
      this.store.emit();
      return;
    }
    this.store.disconnect();
    this.settings = planned.settings;
    try { await this.saveSettings(); }
    catch (error) { this.settings = previous; if (this.credentials.deviceId) await this.store.connect(); throw error; }
    this.credentials.clear();
    this.store = new ChatStore(this.settings, this.credentials, () => this.saveSettings());
    const leaves = this.app.workspace.getLeavesOfType(VIEW);
    for (const leaf of leaves) { await leaf.setViewState({ type: "empty" }); await leaf.setViewState({ type: VIEW }); }
  }
  async openChat(): Promise<void> {
    try {
      const existing = this.app.workspace.getLeavesOfType(VIEW)[0];
      const leaf = existing ?? this.app.workspace.getLeaf("tab");
      if (!existing) await leaf.setViewState({ type: VIEW, active: true });
      await this.app.workspace.revealLeaf(leaf);
      if (this.credentials.token() && this.store.state === "offline") await this.store.connect();
    } catch (error) { if (error instanceof Error || error instanceof z.ZodError) notify(errorText(error)); else throw error; }
  }
  openSettings(): void {
    const modal = new Modal(this.app);
    modal.titleEl.textContent = "KK Hermes Connect 연결 설정";
    const tab = new HermesSettings(this.app, this);
    tab.containerEl = modal.contentEl;
    tab.display(); modal.open();
  }
  override onunload(): void {
    this.store.disconnect();
    this.app.workspace.detachLeavesOfType(VIEW);
  }
}
