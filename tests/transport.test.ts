import { afterEach, describe, expect, it, vi } from "vitest";
import { endpoint, socketTarget, Transport } from "../src/transport";

afterEach(() => { vi.unstubAllGlobals(); });

describe("registration input", () => {
  it.each([
    { code: "", label: "QA device", error: "pair_code_required" },
    { code: "short", label: "QA device", error: "invalid_pair_code_format" },
    { code: "a".repeat(129), label: "QA device", error: "invalid_pair_code_format" },
    { code: "not a valid registration code", label: "QA device", error: "invalid_pair_code_format" },
    { code: "a".repeat(32), label: " ", error: "invalid_device_label" },
    { code: "a".repeat(32), label: "x".repeat(101), error: "invalid_device_label" },
  ])("rejects $error before contacting the server", async ({ code, label, error }) => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: "invalid_schema" }), { status: 400 }));
    vi.stubGlobal("fetch", fetch);

    await expect(new Transport().pair("https://company.test", code, label)).rejects.toThrow(error);

    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("credential destination", () => {
  it.each(["http://company.test", "https://user:secret@company.test", "https://company.test/path", "https://company.test/?target=evil", "file:///etc/passwd"])("rejects unsafe configured origin %s", (value) => {
    expect(() => endpoint(value)).toThrow("invalid_endpoint");
  });
  it.each(["wss://evil.test/v1/ws", "ws://company.test/v1/ws", "wss://company.test:8443/v1/ws", "wss://company.test/v1/ws?ticket=x", "wss://user@company.test/v1/ws"])("rejects a ticket target outside the fixed origin: %s", (value) => {
    expect(() => socketTarget(endpoint("https://company.test"), value)).toThrow("invalid_ws_target");
  });
  it("accepts only the paired WSS host and effective port", () => {
    expect(socketTarget(endpoint("https://company.test:8443"), "wss://company.test:8443/v1/ws").href).toBe("wss://company.test:8443/v1/ws");
  });
});
