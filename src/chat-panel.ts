import { renderMarkdown } from "./markdown";
import { button, requestForm } from "./request-ui";
import { terminal } from "./errors";
import type { ChatStore } from "./store";
import { ModelPanel } from "./model-panel";
import { ContextPanel } from "./context-panel";
import { decodeNoteMessage, noteLabel } from "./note-context";
import type { NoteAttachment } from "./note-context";
import { UsagePanel } from "./usage-panel";
import { icon } from "./composer-icons";
import { MentionPicker } from "./mention-picker";
import type { VaultNoteSource } from "./vault-note-source";

type Actions = { readonly pick: () => void; readonly settings: () => void; readonly mobile: boolean;
  readonly previewContext: (context: NoteAttachment) => void;
  readonly noteSource: Pick<VaultNoteSource, "list" | "load">; readonly newTab: () => void };
const phases: Readonly<Record<string, string>> = {
  preparing: "전송 접수 확인 중", admitted: "접수됨", queued: "대기 중", running: "실행 중",
  completed: "응답 종료 · 업무 검증은 별도", failed: "실패", cancelled: "중단됨", unknown: "실행 결과 확인 필요", expired: "상세 만료",
};

export class ChatPanel {
  private readonly controller = new AbortController();
  private readonly messages: HTMLElement;
  private readonly requests: HTMLElement;
  private readonly status: HTMLElement;
  private readonly source: HTMLElement;
  private readonly operations: HTMLElement;
  private readonly input: HTMLTextAreaElement;
  private readonly send: HTMLButtonElement;
  private readonly create: HTMLButtonElement;
  private readonly fork: HTMLButtonElement;
  private readonly models: ModelPanel;
  private readonly context: ContextPanel;
  private readonly usage: UsagePanel;
  private readonly usageTimer: number;
  private timer: number | undefined;
  private requestKey = "";
  private messageKey = "";
  private composing = false;
  private readonly listener = (): void => {
    if (this.timer === undefined) this.timer = window.setTimeout(() => { this.timer = undefined; this.render(); }, 75);
  };
  constructor(private readonly root: HTMLElement, readonly store: ChatStore, actions: Actions) {
    root.replaceChildren(); root.classList.add("kkh-chat");
    const header = document.createElement("header"); header.className = "kkh-header";
    this.status = document.createElement("p"); this.status.className = "kkh-status";
    this.status.setAttribute("role", "status"); this.source = document.createElement("p");
    const toolbar = document.createElement("nav"); toolbar.className = "kkh-toolbar"; toolbar.setAttribute("aria-label", "대화 관리");
    const tool = (title: string, glyph: string, action: () => void): HTMLButtonElement => {
      const control = button(toolbar, title, action); icon(control, glyph); control.title = title; control.setAttribute("aria-label", title); return control;
    };
    tool("현재 대화를 새 탭에서 열기", "square-plus", actions.newTab);
    this.create = tool("새 대화", "square-pen", () => this.run(() => store.submit("create")));
    tool("대화 이력", "history", actions.pick);
    this.fork = tool("대화 분기", "git-fork", () => {
      if (window.confirm("원본을 보존하고 Hermes native 방식으로 문맥을 승계한 새 대화를 만듭니다. 분기할까요?")) this.run(() => store.submit("fork"));
    });
    this.fork.title = "현재 대화의 문맥을 이어받아 별도의 새 대화를 만듭니다. 원래 대화는 유지됩니다.";
    tool("설정", "settings", actions.settings);
    header.append(this.status, this.source);
    this.messages = document.createElement("section"); this.messages.className = "kkh-messages";
    this.messages.setAttribute("aria-label", "대화 이력"); this.messages.tabIndex = 0;
    this.requests = document.createElement("section"); this.requests.className = "kkh-requests";
    this.requests.setAttribute("aria-label", "승인 및 추가 질문");
    this.operations = document.createElement("div"); this.operations.className = "kkh-operations";
    const composer = document.createElement("form"); composer.className = "kkh-composer";
    const label = document.createElement("label");
    this.input = document.createElement("textarea"); this.input.rows = 1; this.input.value = store.draft;
    this.input.placeholder = "변경 요청, @로 노트 참조"; this.input.setAttribute("aria-label", "Message Yeon");
    const mentions = new MentionPicker(this.input, { list: () => actions.noteSource.list(), load: (path) => actions.noteSource.load(path), notes: store.notes, report: (error) => store.report(error) }, this.controller.signal);
    label.append(this.input); this.send = document.createElement("button");
    this.send.type = "submit"; this.send.className = "kkh-send"; icon(this.send, "arrow-up"); this.send.setAttribute("aria-label", "전송"); this.send.title = "전송";
    this.models = new ModelPanel(store.models, this.controller.signal, () => store.settings.visibleModels);
    this.context = new ContextPanel(store.notes, this.controller.signal, actions.previewContext, (error) => store.report(error));
    const box = document.createElement("div"); box.className = "kkh-input-box";
    const footer = document.createElement("div"); footer.className = "kkh-composer-footer";
    const access = document.createElement("span"); access.className = "kkh-access"; const shield = document.createElement("span"); icon(shield, "shield-check"); access.append(shield, document.createTextNode("Hermes 권한")); access.title = "실행 권한은 Hermes 서버 설정을 따릅니다. 승인 요청은 대화에서 확인하세요.";
    footer.append(this.models.element, access, this.send);
    box.append(this.context.selection, label, footer);
    this.usage = new UsagePanel(store.models, this.controller.signal);
    composer.append(this.operations, toolbar, this.context.element, mentions.element, box, this.usage.element);
    this.usageTimer = window.setInterval(() => {
      this.usage.render();
      if (store.state === "ready" && !store.models.loading && !store.models.changing && !store.current?.running) void store.models.load();
    }, 60000);
    root.append(header, this.messages, this.requests, composer);
    const options = { signal: this.controller.signal };
    this.input.addEventListener("input", () => { store.draft = this.input.value; this.input.style.height = "auto"; this.input.style.height = `${Math.min(this.input.scrollHeight, 200)}px`; this.send.disabled = !store.draft.trim() || store.busy || store.models.changing || store.state !== "ready"; store.emit(); }, options);
    this.input.addEventListener("compositionstart", () => { this.composing = true; }, options);
    this.input.addEventListener("compositionend", () => { this.composing = false; }, options);
    this.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !actions.mobile && !this.composing && !event.isComposing && event.keyCode !== 229) {
        event.preventDefault(); composer.requestSubmit();
      }
    }, options);
    composer.addEventListener("submit", (event) => {
      event.preventDefault(); if (this.composing) return;
      this.run(async () => { await store.submit("send"); this.input.value = store.draft; });
    }, options);
    store.listeners.add(this.listener); this.render();
  }
  private run(action: () => Promise<void>): void { void action().catch((error: unknown) => { this.requestKey = ""; this.store.report(error); }); }
  render(): void {
    const store = this.store; const current = store.current;
    if (this.input.value !== store.draft) this.input.value = store.draft;
    this.root.style.setProperty("--kkh-desktop-shift", `${store.settings.desktopFontStep * 2}px`);
    this.root.style.setProperty("--kkh-mobile-shift", `${store.settings.mobileFontStep * 2}px`);
    this.status.textContent = store.status;
    this.status.dataset["state"] = store.state;
    this.source.textContent = current?.source === "slack" ? "Slack 연동 대화 · 응답이 Slack에도 표시될 수 있습니다."
      : current?.source === "unknown" ? "응답이 원래 연결 채널에도 전달될 수 있습니다." : "";
    this.source.hidden = !this.source.textContent;
    this.status.hidden = store.state === "ready";
    this.send.disabled = store.state !== "ready" || store.busy || store.models.changing || !store.draft.trim();
    this.models.render(store.state !== "ready" || store.busy, current?.running ?? false);
    this.context.render();
    this.usage.render();
    this.create.disabled = store.state !== "ready" || store.busy || store.models.changing;
    this.fork.disabled = store.state !== "ready" || store.busy || store.models.changing || !current || current.running;
    this.operations.replaceChildren();
    const active = store.operations.filter((item) => !terminal(item.phase));
    const settled = store.operations.findLast((item) => terminal(item.phase));
    if (!active.length && settled && settled.phase !== "completed") { const result = document.createElement("p"); result.textContent = phases[settled.phase] ?? settled.phase; this.operations.append(result); }
    if (store.busy && !active.length) {
      const pending = document.createElement("p");
      pending.textContent = store.state === "ready" || store.state === "recovering"
        ? "전송 결과 확인 필요 · 서버의 실행 상태를 자동으로 다시 조회하고 있습니다."
        : "전송 결과 확인 필요 · 연결 후 서버의 실행 상태를 다시 조회합니다.";
      this.operations.append(pending);
    }
    for (const item of active) {
      const row = document.createElement("div"); const label = document.createElement("span");
      label.textContent = `${phases[item.phase] ?? item.phase}${item.result["cancelRequested"] ? " · 중단 요청됨" : ""}`; row.append(label);
      if (item.result["admission_id"]) button(row, "이 요청 중지", () => this.run(() => store.cancel(item.operationId)));
      this.operations.append(row);
    }
    const requests = current?.requests ?? [];
    const requestKey = JSON.stringify(requests);
    if (requestKey !== this.requestKey) {
      const closed = this.requestKey !== "" && this.requestKey !== "[]" && requests.length === 0;
      this.requestKey = requestKey; this.requests.replaceChildren();
      if (closed) { const notice = document.createElement("p"); notice.textContent = "요청 처리됨 · 서버에서 종료를 확인했습니다."; notice.setAttribute("role", "status"); this.requests.append(notice); }
      for (const card of requests) this.requests.append(requestForm(card, (answer) => this.run(() => store.respond(card, answer))));
    }
    const messageKey = JSON.stringify([current?.messages, store.stream, [...store.tools], current?.nextCursor]);
    if (messageKey === this.messageKey) return;
    this.messageKey = messageKey;
    const following = this.messages.scrollHeight - this.messages.scrollTop - this.messages.clientHeight < 80;
    const oldTop = this.messages.scrollTop; const oldHeight = this.messages.scrollHeight;
    const oldFirst = this.messages.querySelector("article")?.getAttribute("data-id");
    this.messages.replaceChildren();
    if (current?.nextCursor) button(this.messages, "이전 이력 불러오기", () => this.run(() => store.older()));
    const visibleMessages = current?.messages.filter((message) => message.text.trim()) ?? [];
    const hasStream = Boolean(store.stream.trim());
    if (!visibleMessages.length && !hasStream && !current?.running) {
      const empty = document.createElement("p"); empty.className = "kkh-empty";
      empty.textContent = current ? "아직 저장된 메시지가 없습니다." : "Chat with Yeon"; this.messages.append(empty);
    }
    for (const message of visibleMessages) {
      const article = document.createElement("article"); article.dataset["id"] = message.id; article.className = `kkh-message kkh-role-${message.role}`;
      const author = document.createElement("h3"); author.textContent = message.role === "user" ? "나" : message.role === "assistant" ? "연이" : message.name || message.role;
      const attached = message.role === "user" ? decodeNoteMessage(message.text) : null;
      const body = document.createElement("div"); body.className = "kkh-markdown"; renderMarkdown(body, attached?.request ?? message.text);
      article.append(author, body);
      if (attached) {
        const details = document.createElement("details"); details.className = "kkh-context-history";
        const summary = document.createElement("summary"); summary.textContent = `참조: ${noteLabel(attached.context)}`;
        const text = document.createElement("pre"); text.textContent = attached.context.text;
        details.append(summary, text); article.append(details);
      }
      if (message.compaction || message.truncated) { const note = document.createElement("p"); note.className = "kkh-muted"; note.textContent = message.truncated ? "서버가 크기 제한으로 축약한 저장 행입니다." : "Hermes가 저장한 압축 문맥입니다."; article.append(note); }
      this.messages.append(article);
    }
    if (hasStream) { const article = document.createElement("article"); article.className = "kkh-message";
      const label = document.createElement("h3"); label.textContent = "연이 · 응답 중";
      const body = document.createElement("div"); body.className = "kkh-stream"; body.textContent = store.stream; article.append(label, body); this.messages.append(article); }
    else if (current?.running) { const waiting = document.createElement("p"); waiting.setAttribute("role", "status"); waiting.textContent = "이 대화에서 실행 중입니다. 실시간 이벤트와 저장 결과를 확인하고 있습니다."; this.messages.append(waiting); }
    for (const description of store.tools.values()) { const tool = document.createElement("p"); tool.className = "kkh-tool"; tool.textContent = description; this.messages.append(tool); }
    const newFirst = this.messages.querySelector("article")?.getAttribute("data-id");
    this.messages.scrollTop = following ? this.messages.scrollHeight : oldFirst !== newFirst ? oldTop + this.messages.scrollHeight - oldHeight : oldTop;
  }
  destroy(): void {
    this.controller.abort(); this.store.listeners.delete(this.listener);
    window.clearInterval(this.usageTimer);
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    this.root.replaceChildren();
  }
}
