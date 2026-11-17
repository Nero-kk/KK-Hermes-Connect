import type { App } from "obsidian";
import { z } from "zod";

const identity = z.object({ deviceId: z.string(), secretRef: z.string() });
export class Credentials {
  private memory: string | null = null;
  private record: z.infer<typeof identity> | null = null;
  private readonly key: string;
  constructor(private readonly app: App) {
    this.key = `kk-hermes-connect:${app.vault.getName()}:device`;
    const stored = localStorage.getItem(this.key);
    if (stored) {
      try {
        const parsed: unknown = JSON.parse(stored);
        const result = identity.safeParse(parsed);
        if (result.success) this.record = result.data;
      } catch (error) {
        if (error instanceof SyntaxError) localStorage.removeItem(this.key);
        else throw error;
      }
    }
  }
  get deviceId(): string { return this.record?.deviceId ?? ""; }
  deviceLabel(): string {
    const key = `${this.key}:label`;
    const stored = localStorage.getItem(key);
    if (stored) return stored;
    const platform = /Android/i.test(navigator.userAgent) ? "Android" : /iPad|iPhone/i.test(navigator.userAgent) ? "iOS" : /Windows/i.test(navigator.userAgent) ? "Windows" : "Obsidian";
    const label = `${platform} · ${crypto.randomUUID().slice(0, 8)}`;
    localStorage.setItem(key, label);
    return label;
  }
  token(): string | null {
    if (this.memory) return this.memory;
    if (this.record && this.app.secretStorage) return this.app.secretStorage.getSecret(this.record.secretRef);
    return null;
  }
  store(deviceId: string, token: string): void {
    this.memory = token;
    const secretRef = `kk-hermes-${crypto.randomUUID()}`;
    this.record = { deviceId, secretRef };
    localStorage.setItem(this.key, JSON.stringify(this.record));
    if (this.app.secretStorage) this.app.secretStorage.setSecret(secretRef, token);
  }
  clear(): void {
    if (this.record && this.app.secretStorage) this.app.secretStorage.setSecret(this.record.secretRef, "");
    this.memory = null;
    this.record = null;
    localStorage.removeItem(this.key);
  }
  get persistent(): boolean { return Boolean(this.app.secretStorage); }
}
