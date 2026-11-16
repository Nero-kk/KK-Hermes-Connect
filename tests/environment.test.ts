import { describe, expect, it } from "vitest";
import { ENVIRONMENT_LIMIT, exportEnvironment, parseEnvironment, planEnvironmentImport, privateExportPath } from "../src/environment";
import { settingsSchema } from "../src/schema";

const profile = {
  format: "kk-hermes-connect/environment", version: 1,
  connection: { endpoint: "https://company.test", profileId: "/home/example/.hermes/profiles/assistant" },
  environment: { tailscaleIp: "100.100.10.20", ubuntuUser: "example",
    windowsVaultPath: "D:\\Notes\\Vault", ubuntuHomePath: "/home/example",
    ubuntuPluginPath: "/opt/plugin", hermesExecutable: "/opt/bin/hermes",
    bridgeStatePath: "/var/lib/bridge", profileName: "assistant",
    slackChannelIds: ["C1234567890"], verificationSessionIds: ["local-test-session"],
    operationIds: ["12345678-1234-4234-8234-123456789012"] },
};
const current = () => settingsSchema.parse({ endpoint: profile.connection.endpoint,
  profileId: profile.connection.profileId, serverId: "registered-server", lastSession: "current-session",
  pending: [{ operationId: "abcdef12-1234-4234-8234-123456789012", serverId: "registered-server", profileId: profile.connection.profileId, logicalSessionId: "current-session", kind: "send" }] });

describe("portable environment", () => {
  it("accepts an environment JSON file with a Windows UTF-8 BOM", () => {
    expect(parseEnvironment("\uFEFF" + JSON.stringify(profile))).toEqual(profile);
  });
  it("explains missing JSON input before attempting to parse it", () => {
    expect(() => parseEnvironment(" \r\n ")).toThrow("environment_empty_json");
  });
  it("round trips all connection, path and reference fields without runtime credentials", () => {
    const imported = parseEnvironment(JSON.stringify(profile));
    const configured = settingsSchema.parse({ ...current(), ...imported.connection, environment: imported.environment });
    Object.assign(configured, { token: "secret-not-for-export", deviceId: "this-device", secretRef: "local-secret" });
    const exported: unknown = JSON.parse(exportEnvironment(configured));
    expect(exported).toEqual(profile);
  });
  it("keeps the existing session, server pin and pending operations for the same connection", () => {
    const original = current();
    const planned = planEnvironmentImport(original, parseEnvironment(JSON.stringify(profile)));
    expect(planned.connectionChanged).toBe(false);
    expect(planned.settings.serverId).toBe("registered-server");
    expect(planned.settings.lastSession).toBe("current-session");
    expect(planned.settings.pending).toEqual(original.pending);
    expect(planned.settings.environment.operationIds).toEqual(profile.environment.operationIds);
    expect(original.environment.operationIds).toEqual([]);
  });
  it.each(["endpoint", "profileId"])("blocks a change to %s while an operation is unfinished", (field) => {
    const candidate = { ...profile, connection: { ...profile.connection, [field]: field === "endpoint" ? "https://other.test" : "/home/other/profile" } };
    expect(() => planEnvironmentImport(current(), parseEnvironment(JSON.stringify(candidate)))).toThrow("environment_pending_operations");
  });
  it("clears old server and session pins after an explicit target change, without importing a pending job", () => {
    const original = current(); original.pending = [];
    const imported = parseEnvironment(JSON.stringify({ ...profile, connection: { ...profile.connection, endpoint: "https://other.test" } }));
    const planned = planEnvironmentImport(original, imported);
    expect(planned.connectionChanged).toBe(true);
    expect(planned.settings.serverId).toBe("");
    expect(planned.settings.lastSession).toBe("");
    expect(planned.settings.pending).toEqual([]);
  });
  it.each(["token", "deviceId", "pending", "secretRef"])("rejects runtime field %s in an import file", (key) => {
    expect(() => parseEnvironment(JSON.stringify({ ...profile, [key]: "secret" }))).toThrow("environment_invalid_schema");
  });
  it.each(["http://company.test", "https://user:secret@company.test", "https://company.test/path"])("rejects unsafe imported endpoint %s before applying it", (url) => {
    expect(() => parseEnvironment(JSON.stringify({ ...profile, connection: { ...profile.connection, endpoint: url } }))).toThrow("environment_invalid_schema");
  });
  it.each(["{broken-json", "null", "[]", JSON.stringify({ ...profile, version: 99 }), JSON.stringify({ ...profile, environment: { ...profile.environment, tailscaleIp: "not-an-ip" } })])("rejects invalid or unsupported files: %s", (contents) => {
    expect(() => parseEnvironment(contents)).toThrow();
  });
  it("enforces the byte limit before parsing", () => {
    expect(() => parseEnvironment("한".repeat(ENVIRONMENT_LIMIT / 2))).toThrow("environment_too_large");
  });
  it.each(["../outside.private.json", "/tmp/outside.private.json", ".obsidian/auth.private.json", "D:\\outside.private.json", "profile.json"])("rejects export outside the private file contract: %s", (path) => {
    expect(() => privateExportPath(path)).toThrow("environment_invalid_path");
  });
  it("supports a vault-relative private JSON destination", () => {
    expect(privateExportPath("profiles\\work.private.json")).toBe("profiles/work.private.json");
  });
});
