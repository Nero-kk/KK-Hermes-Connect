import { describe, expect, it, vi } from "vitest";
import { runButtonAction } from "../src/button-action";
import { BridgeError } from "../src/errors";

vi.mock("../src/notices", () => ({ notify: vi.fn() }));

class FluentButton {
  disabled = false;
  setDisabled(disabled: boolean): this { this.disabled = disabled; return this; }
  then(): never { throw new Error("Obsidian button escaped into Promise resolution"); }
}

describe("button actions", () => {
  it.each(["success", "failure"])("completes %s without resolving to a fluent Obsidian component", async (outcome) => {
    const button = new FluentButton();

    await runButtonAction(button, async () => {
      if (outcome === "failure") throw new BridgeError("invalid_pair_code");
      expect(button.disabled).toBe(true);
    });

    expect(button.disabled).toBe(false);
  });
});
