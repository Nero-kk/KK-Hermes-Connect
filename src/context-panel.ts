import type { NoteAttachment, NoteContextStore } from "./note-context";
import { noteLabel } from "./note-context";
import { icon } from "./composer-icons";

export class ContextPanel {
  readonly element = document.createElement("div");
  readonly selection = document.createElement("div");
  private readonly toggle = document.createElement("button");
  private readonly label = document.createElement("span");
  private readonly preview = document.createElement("button");
  private readonly clear = document.createElement("button");
  private readonly chip = document.createElement("button");
  constructor(private readonly notes: NoteContextStore, signal: AbortSignal,
    show: (context: NoteAttachment) => void, report: (error: unknown) => void) {
    this.element.className = "kkh-note-context"; this.selection.className = "kkh-selection";
    this.toggle.type = this.preview.type = this.clear.type = this.chip.type = "button";
    icon(this.toggle, "file-text"); this.toggle.title = "노트 참조 켜기 / 끄기";
    this.toggle.setAttribute("aria-label", this.toggle.title);
    this.preview.setAttribute("aria-label", "전송할 노트 참조 내용 미리 보기");
    this.clear.setAttribute("aria-label", "노트 참조 제거"); icon(this.clear, "x");
    this.toggle.addEventListener("click", () => { notes.toggle(); }, { signal });
    const preview = (): void => {
      try { const context = notes.snapshot(); if (context) show(context); } catch (error) { report(error); }
    };
    this.preview.addEventListener("click", preview, { signal });
    this.chip.addEventListener("click", preview, { signal });
    this.clear.addEventListener("click", () => { if (notes.enabled) notes.toggle(); }, { signal });
    const remove = document.createElement("button"); remove.type = "button";
    remove.setAttribute("aria-label", "줄 선택 해제, 노트 전체 참조"); icon(remove, "x");
    remove.addEventListener("click", () => notes.clearSelection(), { signal });
    this.preview.append(this.label); this.element.append(this.toggle, this.preview, this.clear);
    this.selection.append(this.chip, remove);
  }
  render(): void {
    const target = this.notes.target;
    this.toggle.setAttribute("aria-pressed", String(this.notes.enabled));
    const selected = target?.selection;
    this.label.textContent = target && this.notes.enabled ? (target.path.split("/").at(-1) ?? target.path).replace(/\.md$/, "") : "노트 참조 꺼짐";
    this.label.title = target ? noteLabel({ kind: selected ? "selection" : "note", path: target.path, ...selected }) : this.label.textContent;
    this.preview.hidden = !target || !this.notes.enabled;
    this.clear.hidden = this.preview.hidden; this.selection.hidden = !selected || !this.notes.enabled;
    const count = selected?.startLine === undefined ? null : (selected.endLine ?? selected.startLine) - selected.startLine + 1;
    this.chip.replaceChildren(); const glyph = document.createElement("span"); icon(glyph, "text-select");
    this.chip.append(glyph, document.createTextNode(count === null ? "선택 문장" : `${count}줄 선택됨`));
    this.chip.title = this.label.title;
  }
}
