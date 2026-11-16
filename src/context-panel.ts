import type { NoteAttachment, NoteContextStore } from "./note-context";
import { noteLabel } from "./note-context";

export class ContextPanel {
  readonly element = document.createElement("div");
  private readonly toggle = document.createElement("button");
  private readonly label = document.createElement("span");
  private readonly preview = document.createElement("button");
  constructor(private readonly notes: NoteContextStore, signal: AbortSignal,
    show: (context: NoteAttachment) => void, report: (error: unknown) => void) {
    this.element.className = "kkh-note-context";
    this.toggle.type = this.preview.type = "button";
    this.toggle.textContent = "노트 참조"; this.toggle.title = "활성 노트 또는 선택 문장을 질문과 함께 전송";
    this.preview.textContent = "보기"; this.preview.setAttribute("aria-label", "전송할 노트 참조 내용 미리 보기");
    this.toggle.addEventListener("click", () => { notes.toggle(); }, { signal });
    this.preview.addEventListener("click", () => {
      try { const context = notes.snapshot(); if (context) show(context); } catch (error) { report(error); }
    }, { signal });
    this.element.append(this.toggle, this.label, this.preview);
  }
  render(): void {
    const target = this.notes.target;
    this.toggle.setAttribute("aria-pressed", String(this.notes.enabled));
    const selected = target?.selection;
    const scope = selected ? selected.startLine === undefined ? "선택 문장" : `선택 ${selected.startLine}–${selected.endLine ?? selected.startLine}행` : "노트 전체";
    this.label.textContent = !this.notes.enabled ? "참조 꺼짐" : target
      ? `${scope} · ${target.path.split("/").at(-1) ?? target.path}`
      : "옆 노트를 클릭하거나 문장을 선택하세요";
    this.label.title = target ? noteLabel({ kind: selected ? "selection" : "note", path: target.path, ...selected }) : this.label.textContent;
    this.preview.hidden = !target || !this.notes.enabled;
  }
}
