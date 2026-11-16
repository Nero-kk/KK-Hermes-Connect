import { describe, expect, it } from "vitest";
import { requestForm } from "../src/request-ui";
import type { RequestCard } from "../src/schema";

const base: RequestCard = { requestId: "r", kind: "approval", nativeKind: "approval", generation: 3,
  state: "open", question: "실행할까요?", command: "test-command", choices: ["once", "deny"],
  questions: [], lockedAnswers: {} };
describe("approval and handoff cards", () => {
  it("sends only an explicit selected approval and blocks a second click", () => {
    const answers: unknown[] = []; const form = requestForm(base, (answer) => answers.push(answer));
    const control = form.querySelector("button"); control?.click(); control?.click();
    expect(answers).toEqual([{ choice: "once" }]);
    expect([...form.querySelectorAll("button")].every((item) => item.disabled)).toBe(true);
  });
  it("offers no input or automatic response for a secret request", () => {
    const answers: unknown[] = [];
    const form = requestForm({ ...base, kind: "unsupported", nativeKind: "secret" }, (answer) => answers.push(answer));
    expect(form.querySelectorAll("input,textarea,select,button")).toHaveLength(0);
    expect(answers).toEqual([]);
  });
  it("preserves question IDs and collects a typed clarify answer", () => {
    const answers: unknown[] = [];
    const form = requestForm({ ...base, kind: "clarify", choices: [],
      questions: [{ qid: "destination", question: "어디인가요?", multi_select: false }] }, (answer) => answers.push(answer));
    document.body.append(form);
    const input = form.querySelector("textarea"); if (input) input.value = "서울";
    form.requestSubmit(); form.remove();
    expect(answers).toEqual([{ answers: { destination: "서울" } }]);
  });
});
