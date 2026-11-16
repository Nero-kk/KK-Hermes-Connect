import type { RequestCard } from "./schema";

export function button(parent: HTMLElement, label: string, action: () => void): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button"; element.textContent = label; element.addEventListener("click", action);
  parent.append(element); return element;
}

export function requestForm(card: RequestCard, send: (answer: unknown) => void): HTMLFormElement {
  const form = document.createElement("form"); form.className = "kkh-request";
  const title = document.createElement("h3");
  title.textContent = card.kind === "approval" ? "실행 승인" : card.kind === "clarify" ? "추가 질문" : "다른 Hermes 화면의 입력 필요";
  form.append(title);
  const detail = document.createElement("p"); detail.textContent = card.question; form.append(detail);
  if (card.command) { const command = document.createElement("pre"); command.textContent = card.command; form.append(command); }
  const submitting = card.state === "responding";
  if (card.kind === "unsupported") {
    const explanation = document.createElement("p");
    explanation.textContent = `${card.nativeKind}: 같은 대화를 Hermes TUI에서 열어 처리하거나 본인 요청을 중지하세요. 이 화면은 비밀값을 수집하거나 요청을 자동 종료하지 않습니다.`;
    form.append(explanation); return form;
  }
  if (submitting) { const status = document.createElement("p"); status.textContent = "응답 제출 중 · 서버의 종료 확인을 기다립니다."; form.append(status); }
  if (card.kind === "approval") {
    const actions = document.createElement("div"); actions.className = "kkh-request-actions";
    const labels: Readonly<Record<string, string>> = { once: "이번만 허용", session: "세션 동안 허용", always: "항상 허용", deny: "거절" };
    for (const choice of card.choices) {
      const element = button(actions, labels[choice] ?? choice, () => {
        for (const control of form.querySelectorAll("button")) control.disabled = true;
        send({ choice });
      }); element.disabled = submitting;
    }
    form.append(actions);
    form.addEventListener("submit", (event) => event.preventDefault()); return form;
  }
  const answers = new Map<string, HTMLTextAreaElement | HTMLSelectElement>();
  const questions = card.questions.length ? card.questions : [{ qid: "answer", question: card.question, choices: card.choices, multi_select: false }];
  for (const question of questions) {
    const label = document.createElement("label"); label.textContent = question.question;
    let input: HTMLTextAreaElement | HTMLSelectElement;
    if (question.choices?.length) {
      input = document.createElement("select"); input.multiple = question.multi_select ?? false;
      const placeholder = document.createElement("option"); placeholder.value = ""; placeholder.textContent = "선택하세요"; placeholder.disabled = true; placeholder.selected = true;
      if (!input.multiple) input.append(placeholder);
      for (const choice of question.choices) { const option = document.createElement("option"); option.value = choice; option.textContent = choice; input.append(option); }
    } else { input = document.createElement("textarea"); input.rows = 2; }
    input.required = true; input.disabled = submitting;
    const locked = card.lockedAnswers[question.qid];
    if (locked != null) { input.value = locked; input.disabled = true; }
    label.append(input); form.append(label); answers.set(question.qid, input);
  }
  const submit = document.createElement("button"); submit.type = "submit";
  submit.textContent = "질문에 응답"; submit.disabled = submitting; form.append(submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    for (const control of form.querySelectorAll("button,textarea,select")) {
      if (control instanceof HTMLButtonElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) control.disabled = true;
    }
    const values: Record<string, string | null> = {};
    for (const [id, input] of answers) {
      values[id] = card.lockedAnswers[id] ?? (input instanceof HTMLSelectElement && input.multiple
        ? [...input.selectedOptions].map((option) => option.value).join(", ") : input.value);
    }
    send(card.questions.length ? { answers: values } : { answer: values["answer"] ?? "" });
  });
  return form;
}
