import { MarkdownView, TFile } from "obsidian";
import type { App } from "obsidian";
import { BridgeError } from "./errors";
import type { NoteTarget } from "./note-context";
import type { NoteChoice } from "./mention-picker";

export class VaultNoteSource {
  constructor(private readonly app: App) {}
  list(): readonly NoteChoice[] {
    return this.app.vault.getMarkdownFiles().map((file) => ({ path: file.path, label: file.basename, modified: file.stat.mtime }));
  }
  async load(path: string): Promise<NoteTarget> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile) || file.extension !== "md") throw new BridgeError("note_source_changed");
    const mtime = file.stat.mtime;
    const content = await this.app.vault.cachedRead(file);
    const currentView = (): MarkdownView | undefined => this.app.workspace.getLeavesOfType("markdown")
      .map((leaf) => leaf.view).find((view): view is MarkdownView => view instanceof MarkdownView && view.file === file);
    return { path, read: () => {
      if (this.app.vault.getAbstractFileByPath(path) !== file) throw new BridgeError("note_source_changed");
      const view = currentView(); if (view) return view.getViewData();
      if (file.stat.mtime !== mtime) throw new BridgeError("note_source_changed");
      return content;
    } };
  }
}
