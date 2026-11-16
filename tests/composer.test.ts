import { describe, it, expect, vi } from "vitest";
import { visibleOptions } from "../src/model-preferences";
import { modelKey } from "../src/model-schema";
import { ModelPanel } from "../src/model-panel";
import { ModelStore } from "../src/model-store";
import { UsagePanel } from "../src/usage-panel";
import { NoteContextStore } from "../src/note-context";
import { ContextPanel } from "../src/context-panel";

const options = Array.from({ length: 12 }, (_, i) => ({ model: `model-${i}`, provider: "codex", label: `Codex · model-${i}`, available: true, reasoning: true, canDisableReasoning: true }));
const key = (i: number): string => modelKey({ provider: "codex", model: `model-${i}` });

describe("composer preferences and reference controls", () => {
  it("limits initial choices and preserves an explicit order including an empty list", () => {
    expect(visibleOptions(options, null)).toHaveLength(8);
    expect(visibleOptions(options, [key(5), "gone", key(1), key(5)]).map((item) => item.model)).toEqual(["model-5", "model-1"]);
    expect(visibleOptions(options, [])).toEqual([]);
  });
  it("shows only curated models plus the active model and sends an actual popup choice", async () => {
    const rpc = vi.fn(async (): Promise<unknown> => ({}));
    const store = new ModelStore({ rpc }, () => undefined);
    store.data = { logicalSessionId: "s", selection: { model: "model-0", provider: "codex", reasoning: "medium", reasoningWire: "medium" }, revision: 1, generation: 1, running: false, options };
    const controller = new AbortController();
    const panel = new ModelPanel(store, controller.signal, () => [key(5), key(1)]);
    panel.render(false, false); document.body.append(panel.element);
    const select = panel.element.querySelector("select");
    expect([...select?.options ?? []].map((item) => item.value)).toEqual([key(5), key(1), key(0)]);
    panel.element.querySelector<HTMLButtonElement>(".kkh-model-trigger")?.click();
    const focus = document.activeElement; panel.render(false, false);
    expect(document.activeElement).toBe(focus);
    const pick = [...panel.element.querySelectorAll<HTMLButtonElement>(".kkh-picker-models button")].find((item) => item.textContent === "model-5");
    pick?.click();
    expect(panel.element.querySelector(".kkh-model-popup")?.getAttribute("hidden")).toBe("");
    expect(rpc).toHaveBeenCalledWith("models.set", expect.objectContaining({ provider: "codex", model: "model-5" }));
    await vi.waitFor(() => expect(store.changing).toBe(false)); controller.abort(); panel.element.remove();
  });
  it("removes the selected range while retaining the note reference", () => {
    const notes = new NoteContextStore(() => panel.render());
    const panel = new ContextPanel(notes, new AbortController().signal, () => undefined, () => undefined);
    notes.set({ path: "A.md", read: () => "whole note", selection: { text: "two lines", startLine: 3, endLine: 4, isCurrent: () => true } });
    expect(panel.selection.textContent).toContain("2줄 선택됨");
    panel.selection.querySelector<HTMLButtonElement>("button[aria-label]")?.click();
    expect(notes.snapshot()).toEqual({ kind: "note", path: "A.md", text: "whole note" });
    expect(panel.selection.hidden).toBe(true);
  });
  it("renders remaining percent and reset duration for the selected provider only", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-17T00:00:00Z"));
    try {
      const store = new ModelStore({ rpc: async () => ({}) }, () => undefined);
      store.data = { logicalSessionId: "s", selection: { model: "model-0", provider: "codex", reasoning: "medium", reasoningWire: "medium" }, revision: 1, generation: 1, running: false, options,
        usage: [{ provider: "codex", label: "5시간", usedPercent: 39, resetsAt: "2026-11-17T02:42:00Z" }, { provider: "other", label: "비공개", usedPercent: 10, resetsAt: null }] };
      const panel = new UsagePanel(store); panel.render();
      expect(panel.element.textContent).toContain("5시간 잔여 61% · 초기화 2h 42m");
      expect(panel.element.textContent).not.toContain("비공개");
      const toggle = panel.element.querySelector("button"); toggle?.click();
      expect(toggle?.getAttribute("aria-expanded")).toBe("true");
      panel.render(); expect(toggle?.getAttribute("aria-expanded")).toBe("true");
      toggle?.click(); expect(toggle?.getAttribute("aria-expanded")).toBe("false");
      store.data.usage = []; panel.render(); expect(panel.element.textContent).toBe("잔여량 정보 없음");
    } finally { vi.useRealTimers(); }
  });
});
