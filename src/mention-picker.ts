import { icon } from "./composer-icons";
import type { NoteContextStore, NoteTarget } from "./note-context";

export type NoteChoice = { readonly path: string; readonly label: string; readonly modified: number };
type MentionSource = {
  readonly list: () => readonly NoteChoice[];
  readonly load: (path: string) => Promise<NoteTarget>;
  readonly notes: NoteContextStore;
  readonly report: (error: unknown) => void;
};

export class MentionPicker {
  readonly element = document.createElement("div");
  private items: readonly NoteChoice[] = [];
  private index = 0;
  private start = 0;
  private version = 0;
  private loading = false;
  private dismissed = "";
  constructor(private readonly input: HTMLTextAreaElement, private readonly source: MentionSource, signal: AbortSignal) {
    this.element.className = "kkh-mentions"; this.element.hidden = true;
    this.element.id = `kkh-mentions-${crypto.randomUUID()}`;
    this.element.setAttribute("role", "listbox"); this.element.setAttribute("aria-label", "참조 노트 선택");
    input.setAttribute("aria-controls", this.element.id); input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.addEventListener("input", () => { this.dismissed = ""; this.update(); }, { signal });
    input.addEventListener("click", () => this.update(), { signal });
    input.addEventListener("keyup", (event) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) this.update(); }, { signal });
    input.addEventListener("keydown", (event) => {
      if (this.element.hidden || event.isComposing || event.keyCode === 229) return;
      if (event.key === "Tab" && event.shiftKey) { this.close(); return; }
      if (["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.key === "Escape") { this.dismissed = input.value; this.close(); }
        else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          this.index = (this.index + (event.key === "ArrowDown" ? 1 : -1) + this.items.length) % Math.max(1, this.items.length); this.draw();
        } else { const item = this.items[this.index]; if (item) void this.choose(item); }
      }
    }, { signal });
    document.addEventListener("pointerdown", (event) => {
      if (event.target instanceof Node && event.target !== input && !this.element.contains(event.target)) this.close();
    }, { signal });
    signal.addEventListener("abort", () => { this.version++; this.close(); }, { once: true });
  }
  update(): void {
    this.version++;
    const before = this.input.value.slice(0, this.input.selectionStart);
    const match = /(?:^|\s)@([^@\n]*)$/.exec(before);
    if (!match || this.input.value === this.dismissed) { this.close(); return; }
    const raw = match[1] ?? ""; const query = raw.toLocaleLowerCase(); this.start = before.length - raw.length - 1;
    this.items = this.source.list().filter((item) => item.path.toLocaleLowerCase().includes(query))
      .sort((a, b) => Number(b.label.toLocaleLowerCase().startsWith(query)) - Number(a.label.toLocaleLowerCase().startsWith(query)) || b.modified - a.modified || a.path.localeCompare(b.path)).slice(0, 30);
    this.index = 0; this.element.hidden = false; this.input.setAttribute("aria-expanded", "true"); this.draw();
  }
  private draw(): void {
    this.element.replaceChildren();
    if (!this.items.length) { const empty = document.createElement("p"); empty.textContent = "일치하는 노트가 없습니다."; this.element.append(empty); this.input.removeAttribute("aria-activedescendant"); return; }
    for (const [index, item] of this.items.entries()) {
      const row = document.createElement("button"); row.type = "button"; row.className = "kkh-mention-option"; row.id = `${this.element.id}-${index}`;
      row.setAttribute("role", "option"); row.setAttribute("aria-selected", String(index === this.index)); row.tabIndex = -1; row.title = item.path;
      const glyph = document.createElement("span"); icon(glyph, "file-text"); const label = document.createElement("span");
      const name = document.createElement("span"); name.textContent = item.label;
      const folder = document.createElement("small"); folder.textContent = item.path; label.append(name, folder);
      row.append(glyph, label); row.addEventListener("pointerdown", (event) => event.preventDefault());
      row.addEventListener("click", () => { void this.choose(item); }); this.element.append(row);
      if (index === this.index) this.input.setAttribute("aria-activedescendant", row.id);
    }
    this.element.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: "nearest" });
  }
  private async choose(item: NoteChoice): Promise<void> {
    if (this.loading) return;
    const version = this.version; const draft = this.input.value; const end = this.input.selectionStart;
    this.loading = true; this.element.setAttribute("aria-busy", "true");
    try {
      const target = await this.source.load(item.path);
      if (version !== this.version || draft !== this.input.value || end !== this.input.selectionStart) return;
      this.source.notes.pin(target);
      this.input.setRangeText("", this.start, end, "end"); this.close(); this.input.dispatchEvent(new Event("input", { bubbles: true })); this.input.focus();
    } catch (error) { if (version === this.version) this.source.report(error); }
    finally { this.loading = false; this.element.removeAttribute("aria-busy"); }
  }
  private close(): void {
    this.version++; this.element.hidden = true; this.input.setAttribute("aria-expanded", "false"); this.input.removeAttribute("aria-activedescendant");
  }
}
