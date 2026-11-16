import { z } from "zod";
import { BridgeError, errorText, terminal } from "./errors";
import { eventSchema, hello, history, operation, operationId, sessionId, sessionList, snapshot } from "./schema";
import type { Message, NativeEvent, Operation, Pending, RequestCard, Settings, Snapshot } from "./schema";
import type { Credentials } from "./credentials";
import { Transport } from "./transport";
import { ModelStore } from "./model-store";
import { composeNoteMessage, NoteContextStore } from "./note-context";

export class ChatStore {
  readonly transport = new Transport();
  readonly models = new ModelStore(this.transport, () => this.emit());
  readonly notes = new NoteContextStore(() => this.emit());
  readonly listeners = new Set<() => void>();
  state: "offline" | "connecting" | "recovering" | "ready" | "blocked" = "offline";
  status = "연결 설정에서 이 기기를 등록하세요.";
  current: Snapshot | null = null;
  operations: readonly Operation[] = [];
  stream = "";
  draft = "";
  tools = new Map<string, string>();
  private cursor = { epoch: "", sequence: 0, instance: "" };
  private poll: number | undefined;
  private retry: number | undefined;
  private backoff = 0;
  private stopped = true;
  private refreshing = false;
  private connecting = false;
  constructor(readonly settings: Settings, readonly credentials: Credentials, private readonly save: () => Promise<void>) {
    this.transport.onEvent = (method, params) => this.event(method, params);
    this.transport.onClose = (code) => {
      if (this.stopped) return;
      this.state = code === 4001 ? "blocked" : "recovering";
      this.status = code === 4001 ? errorText(new BridgeError("device_revoked")) : "연결이 끊겼습니다. 저장 상태를 다시 확인합니다.";
      this.emit(); if (code !== 4001) this.scheduleReconnect();
    };
  }
  emit(): void { for (const listener of this.listeners) listener(); }
  async connect(): Promise<void> {
    if (this.connecting) return;
    this.connecting = true; this.stopped = false;
    if (this.retry !== undefined) window.clearTimeout(this.retry);
    if (this.poll !== undefined) window.clearInterval(this.poll);
    this.state = "connecting"; this.status = "회사 연이에 연결 중…"; this.emit();
    try {
      const token = this.credentials.token();
      if (!token) throw new BridgeError("authentication_required");
      await this.transport.connect(this.settings.endpoint, token);
      const identity = hello.parse(await this.transport.rpc("bridge.hello", {
        apiVersion: 1, clientVersion: "0.4.0", deviceId: this.credentials.deviceId,
      }));
      if (identity.profileId !== this.settings.profileId) throw new BridgeError("profile_mismatch");
      if (this.settings.serverId !== identity.serverId) throw new BridgeError("server_mismatch");
      this.state = "recovering";
      if (this.settings.lastSession) await this.open(this.settings.lastSession);
      await this.recover();
      this.state = "ready"; this.status = `연결됨 · ${identity.profileName}`; this.backoff = 0;
      this.poll = window.setInterval(() => { void this.refresh().catch((error: unknown) => this.report(error)); }, 3000);
    } catch (error) {
      if (error instanceof Error) {
        this.status = errorText(error);
        const transient = error instanceof BridgeError && ["endpoint_unreachable", "gateway_unavailable", "outcome_unknown"].includes(error.code);
        this.state = transient ? "recovering" : "blocked";
        this.transport.close();
        if (transient) this.scheduleReconnect();
      } else throw error;
    } finally { this.connecting = false; this.emit(); }
  }
  private scheduleReconnect(): void {
    if (this.retry !== undefined) window.clearTimeout(this.retry);
    const seconds = Math.min(30, 2 ** this.backoff++);
    this.retry = window.setTimeout(() => { if (!this.stopped) void this.connect(); }, seconds * 1000 * (0.8 + Math.random() * 0.4));
  }
  disconnect(): void {
    this.models.reset();
    this.stopped = true;
    if (this.poll !== undefined) window.clearInterval(this.poll);
    if (this.retry !== undefined) window.clearTimeout(this.retry);
    this.transport.close(); this.state = "offline"; this.status = "연결 해제됨"; this.emit();
  }
  report(error: unknown): void { this.status = errorText(error); this.emit(); }
  async list(query = ""): Promise<z.infer<typeof sessionList>> {
    return sessionList.parse(await this.transport.rpc("sessions.list", { query }));
  }
  async open(id: string): Promise<void> {
    const previous = this.current?.logicalSessionId;
    const next = snapshot.parse(await this.transport.rpc("sessions.open", { logicalSessionId: sessionId.parse(id),
      ...(previous === id && this.cursor.epoch ? { cursor: { replayEpoch: this.cursor.epoch, sequence: this.cursor.sequence } } : {}) }));
    if (next.profileId !== this.settings.profileId) throw new BridgeError("profile_mismatch");
    const changed = previous !== next.logicalSessionId || this.cursor.epoch !== next.replayEpoch || this.cursor.instance !== next.instanceId;
    if (changed || !next.running) { this.stream = ""; this.tools.clear(); }
    const old = this.current;
    if (!changed && old && old.revision === next.revision && old.messages.length > next.messages.length) {
      const latestIds = new Set(next.messages.map((item) => item.id));
      const firstLatest = next.messages[0]?.id;
      const boundary = old.messages.findIndex((item) => item.id === firstLatest);
      const prefix = boundary >= 0 ? old.messages.slice(0, boundary).filter((item) => !latestIds.has(item.id)) : [];
      this.current = { ...next, messages: [...prefix, ...next.messages], nextCursor: old.nextCursor };
    } else this.current = next;
    this.operations = next.operations;
    this.models.sync(this.current);
    this.cursor = { epoch: next.replayEpoch, sequence: next.sequence, instance: next.instanceId };
    this.settings.lastSession = next.logicalSessionId; await this.save();
    if (previous && previous !== next.logicalSessionId) await this.transport.rpc("sessions.release", { logicalSessionId: previous });
    this.emit();
  }
  async refresh(): Promise<void> {
    if (this.refreshing || this.state === "offline" || this.state === "blocked" || this.state === "connecting") return;
    this.refreshing = true;
    try {
      await this.transport.rpc("bridge.ping", { nonce: crypto.randomUUID() });
      if (this.current) await this.open(this.current.logicalSessionId);
      await this.recover();
    } finally { this.refreshing = false; }
  }
  async older(): Promise<void> {
    const current = this.current;
    if (!current?.nextCursor) return;
    const page = history.parse(await this.transport.rpc("sessions.history", {
      logicalSessionId: current.logicalSessionId, cursor: current.nextCursor, limit: 100,
    }));
    if (this.current?.logicalSessionId !== current.logicalSessionId) return;
    const combined = page.reset ? page.messages : [...page.messages, ...current.messages];
    const unique = new Map<string, Message>();
    for (const row of combined) unique.set(row.id, row);
    this.current = { ...current, messages: [...unique.values()], nextCursor: page.nextCursor }; this.emit();
  }
  get busy(): boolean { return this.settings.pending.some((item) => item.serverId === this.settings.serverId); }
  async submit(kind: Pending["kind"]): Promise<void> {
    if (this.busy || this.models.changing || this.state !== "ready") return;
    const id = operationId.parse(crypto.randomUUID());
    const logicalSessionId = this.current?.logicalSessionId ?? "";
    if (kind !== "create" && !logicalSessionId) return;
    const draft = this.draft;
    if (kind === "send" && !draft.trim()) return;
    const text = kind === "send" ? composeNoteMessage(draft, this.notes.snapshot()) : "";
    const saved: Pending = { operationId: id, serverId: this.settings.serverId, profileId: this.settings.profileId, logicalSessionId, kind };
    this.settings.pending = [...this.settings.pending, saved]; await this.save(); this.emit();
    const params = kind === "send" ? { operationId: id, logicalSessionId, text }
      : kind === "fork" ? { operationId: id, logicalSessionId } : { operationId: id };
    if (kind === "send") this.draft = "";
    try {
      const raw = await this.transport.rpc(kind === "send" ? "messages.send" : `sessions.${kind}`, params);
      if (kind === "send") this.accept(operation.parse(raw));
      else {
        const response = z.object({ operation, snapshot: snapshot.optional() }).parse(raw);
        this.accept(response.operation);
        if (response.snapshot) await this.open(response.snapshot.logicalSessionId);
      }
      await this.save();
    } catch (error) {
      if (error instanceof Error) {
        this.status = errorText(error);
        if (kind === "send" && error instanceof BridgeError && !["outcome_unknown", "gateway_unavailable"].includes(error.code)) {
          this.draft = draft;
          if (error.code === "endpoint_unreachable") this.settings.pending = this.settings.pending.filter((item) => item.operationId !== id);
          await this.save();
        }
      }
      else throw error;
    }
    this.emit();
  }
  private accept(result: Operation): void {
    this.operations = [...this.operations.filter((item) => item.operationId !== result.operationId), result];
    if (terminal(result.phase)) this.settings.pending = this.settings.pending.filter((item) => item.operationId !== result.operationId);
  }
  private async recover(): Promise<void> {
    for (const item of [...this.settings.pending]) {
      if (item.serverId !== this.settings.serverId || item.profileId !== this.settings.profileId) continue;
      try { this.accept(operation.parse(await this.transport.rpc("operations.get", { operationId: item.operationId }))); }
      catch (error) { if (error instanceof Error) this.status = errorText(error); else throw error; }
    }
    await this.save(); this.emit();
  }
  async cancel(id: string): Promise<void> {
    this.accept(operation.parse(await this.transport.rpc("operations.cancel", { operationId: operationId.parse(id) })));
    await this.save(); await this.refresh();
  }
  async respond(card: RequestCard, answer: unknown): Promise<void> {
    if (!this.current) return;
    await this.transport.rpc("requests.respond", { logicalSessionId: this.current.logicalSessionId,
      requestId: card.requestId, generation: card.generation, answer });
    await this.refresh();
  }
  private event(method: string, raw: unknown): void {
    if (method === "session.changed") { void this.refresh().catch((error: unknown) => this.report(error)); return; }
    if (method !== "session.event") return;
    const parsed = eventSchema.safeParse(raw);
    if (!parsed.success || parsed.data.logicalSessionId !== this.current?.logicalSessionId) return;
    const event = parsed.data;
    if (event.instanceId !== this.cursor.instance || (event.replayEpoch && event.replayEpoch !== this.cursor.epoch)) {
      void this.refresh().catch((error: unknown) => this.report(error)); return;
    }
    if (event.sequence != null) {
      if (event.sequence <= this.cursor.sequence) return;
      if (event.sequence !== this.cursor.sequence + 1) { void this.refresh().catch((error: unknown) => this.report(error)); return; }
      this.cursor.sequence = event.sequence;
    }
    this.applyEvent(event); this.emit();
  }
  private applyEvent(event: NativeEvent): void {
    switch (event.kind) {
      case "message.start": this.stream = ""; this.tools.clear(); break;
      case "message.delta": this.stream += event.text ?? ""; break;
      case "tool.start": this.tools.set(event.toolId ?? "tool", `${event.name ?? "도구"} · 실행 중`); break;
      case "tool.complete": {
        const result = z.object({ error: z.unknown().optional(), success: z.boolean().optional(), exit_code: z.number().optional(), partial: z.boolean().optional(), status: z.string().optional() }).safeParse(event.result);
        const failed = result.success && (Boolean(result.data.error) || result.data.success === false || (result.data.exit_code !== undefined && result.data.exit_code !== 0) || ["failed", "error"].includes(result.data.status ?? ""));
        const partial = result.success && (result.data.partial === true || result.data.status === "partial");
        const succeeded = result.success && (result.data.success === true || result.data.exit_code === 0 || ["completed", "success"].includes(result.data.status ?? ""));
        const name = this.tools.get(event.toolId ?? "tool")?.split(" · ")[0] ?? "도구";
        this.tools.set(event.toolId ?? "tool", `${name} · ${failed ? "실패" : partial ? "부분 완료" : succeeded ? "도구 완료 (업무 검증은 별도)" : "종료 · 결과 확인 필요"}${event.summary ? ` · ${event.summary.slice(0, 500)}` : ""}`); break;
      }
      case "message.complete":
      case "request.cancel":
      case "approval.request":
      case "clarify.request":
      case "session.replay_gap":
        void this.refresh().catch((error: unknown) => this.report(error)); break;
      default: break;
    }
  }
}
