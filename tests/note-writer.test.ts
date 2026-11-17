import { describe, expect, it } from "vitest";
import { NoteWriter, replaceNoteContext } from "../src/note-writer";
import { BridgeError } from "../src/errors";

describe("connected Obsidian note edits", () => {
  it("replaces only the attached selection and refuses ambiguous selections", () => {
    const selected = { kind: "selection" as const, path: "A.md", text: "middle" };
    expect(replaceNoteContext("before middle after", selected, "changed")).toBe("before changed after");
    expect(() => replaceNoteContext("middle middle", selected, "changed")).toThrow("note_selection_changed");
    expect(() => replaceNoteContext("different", { ...selected, kind: "note" }, "changed")).toThrow("note_write_conflict");
  });

  it("saves once and retries the receipt without repeating a completed write", async () => {
    let text = "original"; let writes = 0; let completed = 0;
    const writer = new NoteWriter({ capture: async () => text, commit: async (_path, before, after) => {
      if (text !== before) throw new BridgeError("note_write_conflict");
      text = after; writes++; return "private/history.json";
    } });
    const rpc = async (method: string): Promise<unknown> => {
      switch (method) {
        case "notes.prepare": return { grant: "token", path: "A.md", command: "local-tool" };
        case "notes.pending": return { edits: [{ grant: "token", path: "A.md", text: "updated" }] };
        case "notes.complete": if (++completed === 1) throw new BridgeError("outcome_unknown"); return { success: true };
        default: throw new BridgeError("method_not_allowed");
      }
    };
    await writer.prepare({ rpc }, "session-a", { kind: "note", path: "A.md", text });
    await expect(writer.poll({ rpc }, "session-a")).rejects.toThrow("outcome_unknown");
    await writer.poll({ rpc }, "session-a");
    expect(text).toBe("updated"); expect(writes).toBe(1); expect(completed).toBe(2);
  });

  it("reports conflict and preserves the newer local edit", async () => {
    let text = "original"; const results: unknown[] = [];
    const writer = new NoteWriter({ capture: async () => text, commit: async (_path, before, after) => {
      if (text !== before) throw new BridgeError("note_write_conflict"); text = after; return "backup";
    } });
    const rpc = async (method: string, params: unknown): Promise<unknown> => {
      switch (method) {
        case "notes.prepare": return { grant: "token", path: "A.md", command: "local-tool" };
        case "notes.pending": return { edits: [{ grant: "token", path: "A.md", text: "AI edit" }] };
        case "notes.complete": results.push(params); return { success: false };
        default: throw new BridgeError("method_not_allowed");
      }
    };
    await writer.prepare({ rpc }, "session-a", { kind: "note", path: "A.md", text });
    text = "newer local edit";
    await expect(writer.poll({ rpc }, "session-a")).rejects.toThrow("note_write_conflict");
    expect(text).toBe("newer local edit");
    expect(results).toEqual([expect.objectContaining({ success: false, reason: "note_write_conflict" })]);
  });
});
