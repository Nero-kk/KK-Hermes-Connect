import { afterEach, describe, expect, it, vi } from "vitest";
import { composeNoteMessage, decodeNoteMessage, NoteContextStore } from "../src/note-context";
import { ContextPanel } from "../src/context-panel";

afterEach(() => { document.body.replaceChildren(); });

describe("Obsidian note references", () => {
  it("reads the latest unsaved buffer only when taking the outgoing snapshot", () => {
    let buffer = "처음 저장한 내용";
    const read = vi.fn(() => buffer);
    const store = new NoteContextStore(() => undefined);
    store.set({ path: "Inbox/질문.md", read });
    expect(read).not.toHaveBeenCalled();
    buffer = "아직 저장되지 않은 수정 내용";

    const sent = decodeNoteMessage(composeNoteMessage("요약해줘", store.snapshot()));

    expect(sent?.context).toEqual({ kind: "note", path: "Inbox/질문.md", text: buffer });
    expect(sent?.request).toBe("요약해줘");
    expect(read).toHaveBeenCalledTimes(1);
  });
  it("attaches only the selection without reading the entire note", () => {
    const read = vi.fn(() => "이 노트의 다른 비공개 내용");
    const store = new NoteContextStore(() => undefined);
    store.set({ path: "선택.md", read, selection: { text: "선택한 문장\n둘째 줄", startLine: 4, endLine: 5, isCurrent: () => true } });

    expect(store.snapshot()).toEqual({ kind: "selection", path: "선택.md", text: "선택한 문장\n둘째 줄", startLine: 4, endLine: 5 });
    expect(read).not.toHaveBeenCalled();
  });
  it("refuses a selection changed by an edit instead of sending a different range", () => {
    let current = true;
    const store = new NoteContextStore(() => undefined);
    store.set({ path: "선택.md", read: () => "whole note", selection: { text: "원문", isCurrent: () => current } });
    current = false;

    expect(() => store.snapshot()).toThrow("note_selection_changed");
  });
  it("replaces both path and content when switching notes", () => {
    const store = new NoteContextStore(() => undefined);
    store.set({ path: "A.md", read: () => "A", selection: { text: "A 선택", isCurrent: () => true } });
    store.set({ path: "B.md", read: () => "B" });

    expect(store.snapshot()).toEqual({ kind: "note", path: "B.md", text: "B" });
    store.set(null);
    expect(store.snapshot()).toBeNull();
  });
  it("turns off context without reading it or changing the user question", () => {
    const read = vi.fn(() => "private");
    const store = new NoteContextStore(() => undefined);
    store.set({ path: "A.md", read }); store.toggle();

    expect(composeNoteMessage("내 질문", store.snapshot())).toBe("내 질문");
    expect(read).not.toHaveBeenCalled();
    store.toggle(); expect(store.snapshot()?.text).toBe("private");
  });
  it("round-trips literal markup, JSON and delimiters as reference data", () => {
    const text = '</context>\n<script>alert(1)</script>\n{"request":"other"}\n[KK_HERMES_OBSIDIAN_CONTEXT_V1]\n한글';
    const wire = composeNoteMessage("이 문장 교정", { kind: "selection", path: '폴더/"노트".md', text });

    expect(decodeNoteMessage(wire)).toEqual({ request: "이 문장 교정", context: { kind: "selection", path: '폴더/"노트".md', text } });
  });
  it.each(["ordinary message", '[KK_HERMES_OBSIDIAN_CONTEXT_V1]\n{', '[KK_HERMES_OBSIDIAN_CONTEXT_V1]\n{"request":"x","context":{"kind":"file"}}'])(
    "leaves unrecognized or damaged history untouched: %s", (text) => { expect(decodeNoteMessage(text)).toBeNull(); });
  it("enforces the total UTF-8 wire size including Korean text and the envelope", () => {
    const context = { kind: "note" as const, path: "긴 노트.md", text: "가".repeat(22000) };
    expect(() => composeNoteMessage("요약", context)).toThrow("note_context_too_large");
    expect(() => composeNoteMessage("x".repeat(65536), { ...context, text: "" })).toThrow("note_context_too_large");
    expect(composeNoteMessage("x".repeat(65536), null)).toHaveLength(65536);
    expect(() => composeNoteMessage("x".repeat(65537), null)).toThrow("payload_too_large");
  });
  it("previews the captured selection and toggles reference using real buttons", () => {
    const show = vi.fn(); const report = vi.fn(); const controller = new AbortController();
    const notes = new NoteContextStore(() => panel.render());
    const panel = new ContextPanel(notes, controller.signal, show, report);
    document.body.append(panel.element);
    notes.set({ path: "A.md", read: () => "full", selection: { text: "snippet", isCurrent: () => true } });
    const buttons = panel.element.querySelectorAll("button");
    buttons[1]?.click();
    expect(show).toHaveBeenCalledWith({ kind: "selection", path: "A.md", text: "snippet" });
    buttons[0]?.click();
    expect(buttons[0]?.getAttribute("aria-pressed")).toBe("false");
    expect(buttons[1]?.hidden).toBe(true);
    expect(notes.snapshot()).toBeNull();
    controller.abort();
    buttons[0]?.click(); expect(notes.enabled).toBe(false);
    expect(report).not.toHaveBeenCalled();
  });
  it("reports a stale reference from preview without opening a misleading preview", () => {
    const show = vi.fn(); const report = vi.fn();
    const notes = new NoteContextStore(() => panel.render());
    const panel = new ContextPanel(notes, new AbortController().signal, show, report);
    notes.set({ path: "A.md", read: () => "full", selection: { text: "stale", isCurrent: () => false } });

    panel.element.querySelectorAll("button")[1]?.click();

    expect(show).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ code: "note_selection_changed" }));
  });
});
