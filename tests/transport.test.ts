import { describe, expect, it } from "vitest";
import { endpoint, socketTarget } from "../src/transport";

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
