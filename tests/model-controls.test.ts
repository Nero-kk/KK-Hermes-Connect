import { afterEach, describe, expect, it, vi } from "vitest";
import { ModelStore } from "../src/model-store";
import { ModelPanel } from "../src/model-panel";
import { modelKey } from "../src/model-schema";
import type { ModelState } from "../src/model-schema";
import { snapshot } from "../src/schema";
import { BridgeError } from "../src/errors";
import { z } from "zod";

const state = (id = "s", model = "model-a"): ModelState => ({ logicalSessionId: id,
  selection: { model, provider: "configured", reasoning: "medium", reasoningWire: "medium" },
  revision: 2, generation: 3, running: false,
  options: ["model-a", "model-b", "server-choice"].map((name) => ({ model: name, provider: "configured", label: name,
    available: true, reasoning: true, canDisableReasoning: true })),
});
const context = (id = "s") => snapshot.parse({ logicalSessionId: id, profileId: "profile", title: "Test", source: "gui",
  running: false, revision: 2, generation: 3, replayEpoch: "epoch", sequence: 0, instanceId: "instance",
  messages: [], requests: [], operations: [], nextCursor: null, reset: false });
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

describe("Hermes execution controls", () => {
  it.each(["applied", "refused"])("shows the server value after a selection is %s", async (result) => {
    let panel: ModelPanel | undefined;
    const rpc = async (method: string): Promise<unknown> => {
      if (method === "models.get") return state();
      if (result === "refused") throw new BridgeError("revision_conflict");
      return { status: "applied", settings: state("s", "server-choice") };
    };
    const store = new ModelStore({ rpc }, () => panel?.render(false, false));
    panel = new ModelPanel(store, new AbortController().signal); document.body.append(panel.element);
    store.sync(context());
    await vi.waitFor(() => expect(store.loading).toBe(false));
    const select = panel.element.querySelector("select");
    if (!select) throw new Error("model select missing");

    select.value = modelKey({ model: "model-b", provider: "configured" });
    select.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(store.changing).toBe(false));

    expect(select.value).toBe(modelKey({ model: result === "applied" ? "server-choice" : "model-a", provider: "configured" }));
    expect(select.disabled).toBe(false);
  });
  it("does not confirm a guarded model pick without consent", async () => {
    let writes = 0;
    const store = new ModelStore({ rpc: async (method) => {
      if (method === "models.get") return state();
      writes++; return { status: "confirmation_required", confirm: "a".repeat(64), message: "Confirm selection" };
    } }, () => undefined);
    store.sync(context()); await vi.waitFor(() => expect(store.loading).toBe(false));

    await store.change({ kind: "model", provider: "configured", model: "model-b" }, () => false);

    expect(store.data?.selection.model).toBe("model-a"); expect(writes).toBe(1);
  });
  it("ignores an old selection result after switching conversations", async () => {
    let release: ((value: unknown) => void) | undefined;
    const waiting = new Promise<unknown>((resolve) => { release = resolve; });
    const store = new ModelStore({ rpc: async (method, params) => method === "models.get"
      ? state(z.object({ logicalSessionId: z.string() }).parse(params).logicalSessionId) : waiting }, () => undefined);
    store.sync(context()); await vi.waitFor(() => expect(store.loading).toBe(false));

    const changing = store.change({ kind: "model", provider: "configured", model: "model-b" }, () => true);
    store.sync(context("other")); await vi.waitFor(() => expect(store.loading).toBe(false));
    if (!release) throw new Error("pending mutation missing");
    release({ status: "applied", settings: state("s", "model-b") }); await changing;

    expect(store.data?.logicalSessionId).toBe("other"); expect(store.data?.selection.model).toBe("model-a");
  });
  it("disables both selects while an answer is running", async () => {
    const store = new ModelStore({ rpc: async () => state() }, () => undefined);
    store.sync(context()); await vi.waitFor(() => expect(store.loading).toBe(false));
    const panel = new ModelPanel(store, new AbortController().signal);

    panel.render(false, true);

    expect([...panel.element.querySelectorAll("select")].map((select) => select.disabled)).toEqual([true, true]);
  });
});
