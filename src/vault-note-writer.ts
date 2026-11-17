import { MarkdownView, TFile } from "obsidian";
import type { App } from "obsidian";
import { BridgeError } from "./errors";
import type { NoteWritePort } from "./note-writer";

export class VaultNoteWriter implements NoteWritePort {
  constructor(private readonly app: App, private readonly pluginDir: string) {}
  private file(path: string): TFile {
    if (path.includes("\\") || path.split("/").some((part) => !part || part.startsWith(".") || part.includes(":"))) throw new BridgeError("note_invalid_path");
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile) || file.extension !== "md") throw new BridgeError("note_source_changed");
    return file;
  }
  private views(file: TFile): readonly MarkdownView[] {
    return this.app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view)
      .filter((view): view is MarkdownView => view instanceof MarkdownView && view.file === file);
  }
  async capture(path: string): Promise<string> {
    const file = this.file(path);
    const views = this.views(file);
    const before = views[0]?.getViewData() ?? await this.app.vault.read(file);
    if (views.some((view) => view.getViewData() !== before)) throw new BridgeError("note_write_conflict");
    for (const view of views) await view.save();
    if (await this.app.vault.read(file) !== before) throw new BridgeError("note_write_conflict");
    return before;
  }
  async commit(path: string, before: string, after: string, id: string): Promise<string> {
    const file = this.file(path);
    if (this.views(file).some((view) => view.getViewData() !== before)) throw new BridgeError("note_write_conflict");
    const adapter = this.app.vault.adapter;
    const folder = `${this.pluginDir}/private/note-history`;
    for (const dir of [`${this.pluginDir}/private`, folder]) if (!await adapter.exists(dir)) await adapter.mkdir(dir);
    const backupPath = `${folder}/${id}.json`;
    await adapter.write(backupPath, JSON.stringify({ path, savedAt: new Date().toISOString(), text: before }));
    await this.app.vault.process(file, (current) => {
      if (current !== before || this.views(file).some((view) => view.getViewData() !== before)) throw new BridgeError("note_write_conflict");
      return after;
    });
    if (await this.app.vault.read(file) !== after) throw new BridgeError("note_write_failed");
    return backupPath;
  }
}
