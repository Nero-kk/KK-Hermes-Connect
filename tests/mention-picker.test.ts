import { afterEach, describe, expect, it, vi } from "vitest";
import { MentionPicker } from "../src/mention-picker";
import { NoteContextStore } from "../src/note-context";
import type { NoteTarget } from "../src/note-context";

const choices = [{ path: "Project/설계 검토.md", label: "설계 검토", modified: 2 }, { path: "Archive/설계.md", label: "설계", modified: 1 }];
const controllers: AbortController[] = [];
function setup(load: (path: string) => Promise<NoteTarget> = async (path) => ({ path, read: () => "reference" })) {
  const input = document.createElement("textarea"); const controller = new AbortController(); controllers.push(controller);
  const notes = new NoteContextStore(() => undefined); const report = vi.fn();
  const picker = new MentionPicker(input, { list: () => choices, load, notes, report }, controller.signal);
  document.body.append(input, picker.element); input.focus();
  const type = (value: string): void => { input.value = value; input.setSelectionRange(value.length, value.length); input.dispatchEvent(new Event("input")); };
  return { input, notes, picker, report, type };
}
afterEach(() => { controllers.splice(0).forEach((controller) => controller.abort()); document.body.replaceChildren(); });

describe("note mentions", () => {
  it("searches Korean names with spaces, consumes Enter and pins the chosen content", async () => {
    const { input, notes, picker, type } = setup(); type("이것 검토 @설계 검토");
    expect(picker.element.querySelectorAll("button")).toHaveLength(1);
    const send = vi.fn(); input.addEventListener("keydown", send);
    const event = new KeyboardEvent("keydown", { key: "Enter", cancelable: true }); input.dispatchEvent(event);
    await vi.waitFor(() => expect(notes.pinned).toBe(true));
    expect(event.defaultPrevented).toBe(true); expect(send).not.toHaveBeenCalled();
    expect(input.value).toBe("이것 검토 ");
    expect(notes.snapshot()).toEqual({ kind: "note", path: choices[0]?.path, text: "reference" });
    notes.set({ path: "Other.md", read: () => "other" }); expect(notes.target?.path).toBe(choices[0]?.path);
    notes.detach(); notes.set({ path: "Other.md", read: () => "other" }); notes.toggle();
    expect(notes.snapshot()?.path).toBe("Other.md");
  });
  it("moves the active candidate with arrows and selects with Tab", async () => {
    const { input, notes, type } = setup(); type("@");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", cancelable: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", cancelable: true }));
    await vi.waitFor(() => expect(notes.target?.path).toBe("Archive/설계.md"));
  });
  it("ignores email addresses and IME Enter and dismisses with Escape", () => {
    const { input, picker, notes, type } = setup(); type("test@example.com"); expect(picker.element.hidden).toBe(true);
    type("@"); const ime = new KeyboardEvent("keydown", { key: "Enter", isComposing: true, cancelable: true }); input.dispatchEvent(ime);
    expect(ime.defaultPrevented).toBe(false); expect(notes.target).toBeNull();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true })); expect(picker.element.hidden).toBe(true);
    input.click(); expect(picker.element.hidden).toBe(true);
  });
  it("does not replace a changed draft with a late file load", async () => {
    let resolve: ((target: NoteTarget) => void) | undefined;
    const pending = new Promise<NoteTarget>((done) => { resolve = done; });
    const { input, notes, type } = setup(() => pending); type("@"); input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    type("다른 질문"); if (!resolve) throw new Error("missing file load"); resolve({ path: "Old.md", read: () => "old" });
    await pending; await Promise.resolve(); expect(notes.target).toBeNull(); expect(input.value).toBe("다른 질문");
  });
  it("keeps the draft when a note cannot be read", async () => {
    const failure = new Error("unreadable"); const { input, picker, report, type } = setup(async () => { throw failure; });
    type("質問 @設計"); expect(picker.element.textContent).toContain("일치하는 노트가 없습니다");
    type("@"); picker.element.querySelector<HTMLButtonElement>("button")?.click();
    await vi.waitFor(() => expect(report).toHaveBeenCalledWith(failure)); expect(input.value).toBe("@");
  });
});
