import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatPanel } from "../src/chat-panel";
import { ContextMeter } from "../src/context-meter";
import { ChatStore } from "../src/store";
import { settingsSchema, snapshot } from "../src/schema";

const panels: ChatPanel[] = [];
afterEach(() => { panels.splice(0).forEach((panel) => panel.destroy()); document.body.replaceChildren(); vi.restoreAllMocks(); });

function mount() {
  const store = new ChatStore(settingsSchema.parse({ composerPlaceholder: "검토할 내용을 입력하세요", inputFontStep: 2 }), { deviceId: "test-device", token: () => null }, async () => undefined);
  store.state = "ready";
  store.current = snapshot.parse({ logicalSessionId: "chat", profileId: "yeon", title: "설계 검토", source: "gui", running: false,
    revision: 1, generation: 1, replayEpoch: "epoch", sequence: 1, instanceId: "instance", nextCursor: null, reset: false, requests: [], operations: [],
    messages: [{ id: "reply", role: "assistant", text: "검토 내용입니다.", name: "", compaction: false, truncated: false }] });
  const root = document.createElement("div"); document.body.append(root);
  const panel = new ChatPanel(root, store, { mobile: false, pick: () => undefined, settings: () => undefined,
    previewContext: () => undefined, newTab: () => undefined, avatarUrl: "app://local/avatar.png",
    noteSource: { list: () => [], load: async (path) => ({ path, read: () => "note" }) } });
  panels.push(panel); return { store, root, panel };
}

describe("chat navigation and personalization", () => {
  it("keeps the reading position on a new reply and jumps to the latest reply on request", () => {
    const { store, root, panel } = mount();
    const messages = root.querySelector<HTMLElement>(".kkh-messages");
    if (!messages) throw new Error("Message surface missing");
    Object.defineProperties(messages, { scrollHeight: { configurable: true, value: 1200 }, clientHeight: { configurable: true, value: 400 } });
    messages.scrollTop = 150;
    store.stream = "새 응답"; panel.render();
    expect(messages.scrollTop).toBe(150);
    const jump = root.querySelector<HTMLButtonElement>(".kkh-jump-bottom");
    expect(jump?.hidden).toBe(false);
    jump?.click();
    expect(messages.scrollTop).toBe(1200);
    expect(jump?.hidden).toBe(true);
  });

  it("submits a trimmed edited title and lets Escape cancel without saving", async () => {
    const { store, root } = mount(); const rename = vi.spyOn(store, "renameTitle").mockResolvedValue(undefined);
    const title = root.querySelector<HTMLButtonElement>(".kkh-conversation-title"); title?.click();
    const input = root.querySelector<HTMLInputElement>(".kkh-title-editor input");
    if (!input) throw new Error("Title input missing");
    input.value = "취소할 제목"; input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(rename).not.toHaveBeenCalled(); expect(document.activeElement).toBe(title);
    title?.click(); input.value = "  최종 설계 검토  ";
    root.querySelector<HTMLFormElement>(".kkh-title-editor")?.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(root.querySelector<HTMLFormElement>(".kkh-title-editor")?.hidden).toBe(true));
    expect(rename).toHaveBeenCalledExactlyOnceWith("최종 설계 검토");
  });

  it("cancels a pending title edit when another conversation opens", () => {
    const { store, root, panel } = mount(); root.querySelector<HTMLButtonElement>(".kkh-conversation-title")?.click();
    store.current = snapshot.parse({ ...store.current, logicalSessionId: "another", title: "다른 대화" }); panel.render();
    expect(root.querySelector<HTMLFormElement>(".kkh-title-editor")?.hidden).toBe(true);
    expect(root.querySelector(".kkh-conversation-title")?.textContent).toBe("다른 대화");
  });

  it("applies input preferences and the avatar to saved and streaming assistant replies", () => {
    const { store, root, panel } = mount(); store.stream = "응답 중"; panel.render();
    expect(root.querySelector("textarea")?.placeholder).toBe("검토할 내용을 입력하세요");
    expect(root.style.getPropertyValue("--kkh-input-shift")).toBe("4px");
    expect([...root.querySelectorAll<HTMLImageElement>(".kkh-message > h3 img")].map((img) => img.getAttribute("src"))).toEqual(["app://local/avatar.png", "app://local/avatar.png"]);
    expect(root.querySelector(".kkh-composer-topbar > .kkh-usage")).not.toBeNull();
  });
});

describe("context usage meter", () => {
  it("shows the measured fraction and switches to unavailable when telemetry disappears", () => {
    const meter = new ContextMeter();
    meter.render({ usedTokens: 16000, maxTokens: 128000 });
    expect(meter.element.textContent).toBe("13%");
    expect(meter.element.title).toContain("16,000 / 128,000");
    expect(meter.element.querySelector(".kkh-context-arc")?.getAttribute("stroke-dasharray")).toBe("12.5 100");
    meter.render(null);
    expect(meter.element.textContent).toBe("—");
    expect(meter.element.dataset["available"]).toBe("false");
    expect(meter.element.querySelector(".kkh-context-arc")?.getAttribute("stroke-dasharray")).toBe("0 100");
  });
});
