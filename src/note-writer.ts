import { z } from "zod";
import { BridgeError } from "./errors";
import type { NoteAttachment } from "./note-context";
import type { Transport } from "./transport";

const grantSchema = z.object({ grant: z.string(), path: z.string(), command: z.string() });
const editsSchema = z.object({ edits: z.array(z.object({ grant: z.string(), path: z.string(), text: z.string().max(262144) })) });
export type NoteWritePort = {
  readonly capture: (path: string) => Promise<string>;
  readonly commit: (path: string, before: string, after: string, id: string) => Promise<string>;
};
type Prepared = { readonly session: string; readonly path: string; readonly before: string; readonly context: NoteAttachment; readonly expires: number };
export type WriteTool = { readonly command: string; readonly target: string };

export function replaceNoteContext(before: string, context: NoteAttachment, replacement: string): string {
  if (context.kind === "note") {
    if (before !== context.text) throw new BridgeError("note_write_conflict");
    return replacement;
  }
  const start = before.indexOf(context.text);
  if (!context.text || start < 0 || before.indexOf(context.text, start + 1) >= 0) throw new BridgeError("note_selection_changed");
  return before.slice(0, start) + replacement + before.slice(start + context.text.length);
}

export class NoteWriter {
  private readonly grants = new Map<string, Prepared>();
  private readonly receipts = new Map<string, { readonly success: boolean; readonly reason: string; readonly backupPath: string }>();
  private polling = false;
  constructor(private readonly port: NoteWritePort) {}
  async prepare(transport: Pick<Transport, "rpc">, session: string, context: NoteAttachment): Promise<WriteTool> {
    const before = await this.port.capture(context.path);
    replaceNoteContext(before, context, context.text);
    const grant = grantSchema.parse(await transport.rpc("notes.prepare", { logicalSessionId: session, path: context.path }));
    if (grant.path !== context.path) throw new BridgeError("note_invalid_path");
    this.grants.set(grant.grant, { session, path: context.path, before, context, expires: Date.now() + 1800000 });
    return { command: grant.command, target: context.path };
  }
  async poll(transport: Pick<Transport, "rpc">, session: string): Promise<void> {
    if (this.polling || !this.grants.size) return;
    this.polling = true;
    try {
      for (const [token, prepared] of this.grants) if (prepared.expires < Date.now()) this.grants.delete(token);
      for (const pendingSession of new Set([session, ...[...this.grants.values()].map((item) => item.session)])) {
      const pending = editsSchema.parse(await transport.rpc("notes.pending", { logicalSessionId: pendingSession }));
      for (const edit of pending.edits) {
        let receipt = this.receipts.get(edit.grant);
        if (!receipt) {
          const prepared = this.grants.get(edit.grant);
          try {
            if (!prepared || prepared.path !== edit.path) throw new BridgeError("note_grant_expired");
            const after = replaceNoteContext(prepared.before, prepared.context, edit.text);
            const backupPath = await this.port.commit(edit.path, prepared.before, after, crypto.randomUUID());
            receipt = { success: true, reason: "", backupPath };
          } catch (error) {
            if (!(error instanceof Error)) throw error;
            receipt = { success: false, reason: error instanceof BridgeError ? error.code : "note_write_failed", backupPath: "" };
          }
          this.receipts.set(edit.grant, receipt);
        }
        await transport.rpc("notes.complete", { logicalSessionId: pendingSession, grant: edit.grant, ...receipt });
        this.grants.delete(edit.grant); this.receipts.delete(edit.grant);
        if (!receipt.success) throw new BridgeError(receipt.reason);
      }
      }
    } finally { this.polling = false; }
  }
}
