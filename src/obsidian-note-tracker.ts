import { Component, MarkdownView } from "obsidian";
import type { App, Editor, MarkdownFileInfo, WorkspaceLeaf } from "obsidian";
import { BridgeError } from "./errors";
import type { NoteContextStore, NoteTarget } from "./note-context";

export class ObsidianNoteTracker extends Component {
  constructor(private readonly app: App, private readonly notes: () => NoteContextStore,
    private readonly openChat: () => Promise<void>) { super(); }
  override onload(): void {
    this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => this.active(leaf)));
    this.registerEvent(this.app.workspace.on("file-open", () => this.captureActive()));
    this.registerEvent(this.app.workspace.on("editor-change", () => this.captureActive()));
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor, info) => {
      if (!info.file) return;
      menu.addItem((item) => { item.setTitle(editor.getSelection().trim() ? "선택 문장을 Yeon Chat에 첨부" : "이 노트를 Yeon Chat에 참조")
        .setIcon("messages-square").onClick(() => { this.attach(editor, info); void this.openChat(); }); });
    }));
    this.bind(document);
    this.registerEvent(this.app.workspace.on("window-open", (_workspace, win) => this.bind(win.document)));
    this.app.workspace.onLayoutReady(() => {
      const active = this.app.workspace.getActiveViewOfType(MarkdownView);
      const visible = this.app.workspace.getLeavesOfType("markdown").filter((leaf) => leaf.view.containerEl.getClientRects().length > 0);
      const view = active ?? (visible.length === 1 && visible[0]?.view instanceof MarkdownView ? visible[0].view : null);
      if (view) this.capture(view);
    });
  }
  private bind(doc: Document): void {
    for (const event of ["selectionchange", "pointerup", "keyup"] as const) {
      this.registerDomEvent(doc, event, (interaction) => this.captureActive(interaction));
    }
  }
  private active(leaf: WorkspaceLeaf | null): void {
    if (leaf?.view instanceof MarkdownView) this.capture(leaf.view);
    else if (leaf && leaf.view.getViewType() !== "kk-hermes-chat") this.notes().set(null);
  }
  private captureActive(interaction?: Event): void {
    const active = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!active) return;
    if (interaction) {
      const selection = active.containerEl.ownerDocument.getSelection();
      const ownsSelection = selection && !selection.isCollapsed && selection.anchorNode && selection.focusNode
        && active.contentEl.contains(selection.anchorNode) && active.contentEl.contains(selection.focusNode);
      const target = interaction.target;
      const withinNote = target && "nodeType" in target && active.contentEl.contains(target as Node);
      if (interaction.type === "selectionchange" ? !ownsSelection : !withinNote) return;
    }
    this.capture(active);
  }
  attach(editor: Editor, info: MarkdownView | MarkdownFileInfo): void {
    this.notes().enabled = true;
    this.captureEditor(editor, info);
  }
  private capture(view: MarkdownView): void {
    if (view.getMode() !== "preview") { this.captureEditor(view.editor, view); return; }
    const file = view.file;
    if (!file) { this.notes().set(null); return; }
    const path = file.path;
    const valid = (): boolean => view.file === file && this.app.vault.getAbstractFileByPath(path) === file && view.containerEl.isConnected;
    const range = view.containerEl.ownerDocument.getSelection();
    const selected = range && !range.isCollapsed && range.anchorNode && range.focusNode
      && view.contentEl.contains(range.anchorNode) && view.contentEl.contains(range.focusNode) ? range.toString() : "";
    const retained = selected.trim() && range?.rangeCount ? range.getRangeAt(0).cloneRange() : null;
    const mtime = file.stat.mtime;
    this.notes().set({ path, read: () => {
      if (!valid()) throw new BridgeError("note_source_changed");
      return view.getViewData();
    }, ...(retained ? { selection: { text: selected, isCurrent: () => valid() && file.stat.mtime === mtime
      && retained.startContainer.isConnected && retained.endContainer.isConnected && retained.toString() === selected } } : {}) });
  }
  private captureEditor(editor: Editor, info: MarkdownView | MarkdownFileInfo): void {
    const path = info.file?.path;
    if (!path) { this.notes().set(null); return; }
    const file = info.file;
    const valid = (): boolean => info.file === file && this.app.vault.getAbstractFileByPath(path) === file
      && (!(info instanceof MarkdownView) || info.containerEl.isConnected);
    const text = editor.getSelection();
    const from = editor.getCursor("from"); const to = editor.getCursor("to");
    const target: NoteTarget = { path, read: () => {
      if (!valid()) throw new BridgeError("note_source_changed");
      return editor.getValue();
    }, ...(text.trim() ? { selection: { text, startLine: from.line + 1, endLine: to.ch === 0 && to.line > from.line ? to.line : to.line + 1,
      isCurrent: () => valid() && editor.getRange(from, to) === text } } : {}) };
    this.notes().set(target);
  }
}
