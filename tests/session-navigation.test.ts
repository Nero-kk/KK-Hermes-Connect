import { describe, expect, it, vi } from "vitest";
import { ChatStore } from "../src/store";
import { settingsSchema, snapshot } from "../src/schema";

function context(id: string) {
  return snapshot.parse({ logicalSessionId: id, profileId: "profile", title: id, source: "gui",
    running: false, revision: 1, generation: 1, replayEpoch: "epoch", sequence: 0,
    instanceId: "instance", messages: [], requests: [], operations: [], nextCursor: null, reset: false });
}
function store() {
  const result = new ChatStore(settingsSchema.parse({ profileId: "profile" }),
    { deviceId: "device", token: () => null }, async () => undefined);
  result.current = context("original"); result.state = "ready"; return result;
}

describe("session navigation during refresh", () => {
  it("defers background refresh while another session is opening", async () => {
    const chat = store(); let complete: (value: unknown) => void = () => undefined;
    const incoming = new Promise<unknown>((resolve) => { complete = resolve; });
    const rpc = vi.spyOn(chat.transport, "rpc").mockImplementation(async (method) => method === "sessions.open" ? incoming : {});
    const opening = chat.open("new");
    await chat.refresh();
    expect(rpc.mock.calls.map(([method]) => method)).toEqual(["sessions.open"]);
    complete(context("new")); await opening;
    expect(chat.current?.logicalSessionId).toBe("new");
  });

  it("keeps the latest selection when an older open reply arrives late", async () => {
    const chat = store(); let complete: (value: unknown) => void = () => undefined;
    const incoming = new Promise<unknown>((resolve) => { complete = resolve; });
    const released: unknown[] = [];
    vi.spyOn(chat.transport, "rpc").mockImplementation(async (method, params: unknown) => {
      if (method === "sessions.open") {
        const request = snapshot.pick({ logicalSessionId: true }).parse(params);
        return request.logicalSessionId === "older" ? incoming : context("latest");
      }
      if (method === "sessions.release") released.push(params);
      return {};
    });
    const older = chat.open("older");
    await chat.open("latest"); complete(context("older")); await older;
    expect(chat.current?.logicalSessionId).toBe("latest");
    expect(chat.settings.lastSession).toBe("latest");
    expect(released).toEqual([{ logicalSessionId: "original" }]);
  });
});
