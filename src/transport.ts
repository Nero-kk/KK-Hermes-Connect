import { z } from "zod";
import { BridgeError } from "./errors";

const bootstrap = z.object({ apiVersion: z.literal(1), wsUrl: z.string(), ticket: z.string() });
const paired = z.object({ apiVersion: z.literal(1), deviceId: z.string(), token: z.string(), serverId: z.string(), profileId: z.string() });
const registrationCode = z.string().trim().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/);
const deviceLabel = z.string().trim().min(1).max(100);
const envelope = z.object({ jsonrpc: z.literal("2.0"), id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string().optional(), params: z.unknown().optional(), result: z.unknown().optional(),
  error: z.object({ code: z.number(), message: z.string() }).optional() });
type Waiter = { readonly resolve: (value: unknown) => void; readonly reject: (error: BridgeError) => void; readonly timer: number };

export function endpoint(value: string): URL {
  let parsed: URL;
  try { parsed = new URL(value); } catch (error) {
    if (error instanceof TypeError) throw new BridgeError("invalid_endpoint");
    throw error;
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
    throw new BridgeError("invalid_endpoint");
  }
  return parsed;
}

export function socketTarget(origin: URL, value: string): URL {
  const target = new URL(value);
  if (target.protocol !== "wss:" || target.host !== origin.host || target.username || target.password || target.search || target.hash || target.pathname !== "/v1/ws") {
    throw new BridgeError("invalid_ws_target");
  }
  return target;
}

async function post(origin: URL, action: string, payload: { readonly body?: unknown; readonly token?: string }): Promise<unknown> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (payload.token) headers["Authorization"] = `Bearer ${payload.token}`;
    let response: Response;
    try {
      response = await fetch(new URL(`/v1/${action}`, origin), {
        method: "POST", headers, body: JSON.stringify(payload.body ?? {}),
        redirect: "error", mode: "cors", credentials: "omit", cache: "no-store", signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) throw new BridgeError("endpoint_unreachable");
      if (error instanceof TypeError) {
        const message = error.message.toLowerCase();
        if (message.includes("redirect")) throw new BridgeError("auth_redirect_blocked");
        if (message.includes("fetch") || message.includes("cors") || message.includes("network")) throw new BridgeError("auth_network_failed");
        throw new BridgeError("auth_transport_unsupported");
      }
      throw error;
    }
    const value: unknown = await response.json();
    if (!response.ok) {
      const error = z.object({ error: z.string().regex(/^[a-z_]{1,80}$/) }).safeParse(value);
      if (error.success && error.data.error === "origin_rejected") throw new BridgeError("auth_origin_blocked");
      if (error.success && error.data.error === "invalid_pair_code") throw new BridgeError("auth_registration_code");
      if (response.status >= 500) throw new BridgeError("auth_server_unavailable");
      if (response.status >= 300 && response.status < 400) throw new BridgeError("auth_redirect_blocked");
      throw new BridgeError(error.success ? error.data.error : "auth_server_http_error");
    }
    return value;
  } catch (error) {
    if (error instanceof BridgeError) throw error;
    if (error instanceof Error) throw new BridgeError("auth_transport_unsupported");
    throw error;
  } finally { window.clearTimeout(timeout); }
}

export class Transport {
  private socket: WebSocket | null = null;
  private readonly pending = new Map<string, Waiter>();
  onEvent: (method: string, params: unknown) => void = () => undefined;
  onClose: (code: number) => void = () => undefined;
  async pair(url: string, code: string, label: string): Promise<z.infer<typeof paired>> {
    const origin = endpoint(url);
    const parsedCode = registrationCode.safeParse(code);
    if (!parsedCode.success) throw new BridgeError(code.trim() ? "invalid_pair_code_format" : "pair_code_required");
    const parsedLabel = deviceLabel.safeParse(label);
    if (!parsedLabel.success) throw new BridgeError("invalid_device_label");
    return paired.parse(await post(origin, "pair", { body: { code: parsedCode.data, label: parsedLabel.data } }));
  }
  async connect(url: string, token: string): Promise<void> {
    this.close();
    const origin = endpoint(url);
    const boot = bootstrap.parse(await post(origin, "connect", { token }));
    const target = socketTarget(origin, boot.wsUrl);
    const socket = new WebSocket(target, ["obsidian-hermes-v1", `oh-ticket.${boot.ticket}`]);
    this.socket = socket;
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => { socket.close(); reject(new BridgeError("endpoint_unreachable")); }, 12000);
      socket.onopen = () => {
        window.clearTimeout(timeout);
        if (socket.protocol !== "obsidian-hermes-v1") { socket.close(); reject(new BridgeError("incompatible_gateway")); }
        else resolve();
      };
      socket.onerror = () => { window.clearTimeout(timeout); reject(new BridgeError("endpoint_unreachable")); };
      socket.onclose = () => { window.clearTimeout(timeout); reject(new BridgeError("endpoint_unreachable")); };
    });
    socket.onmessage = (event: MessageEvent<unknown>) => {
      if (typeof event.data !== "string" || new TextEncoder().encode(event.data).byteLength > 2 * 1024 * 1024) { socket.close(); return; }
      let raw: unknown;
      try { raw = JSON.parse(event.data); } catch (error) { if (error instanceof SyntaxError) { socket.close(); return; } throw error; }
      const parsed = envelope.safeParse(raw);
      if (!parsed.success) { socket.close(); return; }
      const frame = parsed.data;
      if (frame.method) { this.onEvent(frame.method, frame.params); return; }
      const id = String(frame.id);
      const waiter = this.pending.get(id);
      if (!waiter) return;
      this.pending.delete(id); window.clearTimeout(waiter.timer);
      if (frame.error) waiter.reject(new BridgeError(/^[a-z_]{1,80}$/.test(frame.error.message) ? frame.error.message : "request_failed"));
      else waiter.resolve(frame.result);
    };
    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      this.rejectPending(); this.socket = null; this.onClose(event.code);
    };
  }
  async rpc(method: string, params: unknown): Promise<unknown> {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) throw new BridgeError("endpoint_unreachable");
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => { this.pending.delete(id); reject(new BridgeError("outcome_unknown")); }, 50000);
      this.pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
    });
  }
  close(): void {
    const socket = this.socket; this.socket = null;
    this.rejectPending(); socket?.close();
  }
  private rejectPending(): void {
    for (const waiter of this.pending.values()) { window.clearTimeout(waiter.timer); waiter.reject(new BridgeError("outcome_unknown")); }
    this.pending.clear();
  }
}
