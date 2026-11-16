import { Modal } from "obsidian";
import { notify } from "./notices";
import type { App } from "obsidian";
import type { ChatStore } from "./store";
import { errorText } from "./errors";
import { button } from "./request-ui";

export class SessionPicker extends Modal {
  constructor(app: App, private readonly store: ChatStore) { super(app); }
  override async onOpen(): Promise<void> {
    this.titleEl.textContent = "기존 대화 선택";
    const search = document.createElement("input"); search.type = "search";
    search.placeholder = "제목 또는 세션 ID"; search.setAttribute("aria-label", "불러온 대화 내 검색");
    const description = document.createElement("p"); description.textContent = "불러오는 중…";
    const results = document.createElement("div"); results.className = "kkh-session-results";
    this.contentEl.append(search, description, results);
    try {
      const listed = await this.store.list();
      description.textContent = `${listed.loadedCount}개 불러옴 · 불러온 대화 내 검색${listed.listingComplete ? "" : " · 최신 200개로 제한됨"}`;
      const render = (): void => {
        results.replaceChildren(); const query = search.value.toLocaleLowerCase();
        const filtered = listed.summaries.filter((item) => `${item.title} ${item.logicalSessionId}`.toLocaleLowerCase().includes(query));
        for (const item of filtered) {
          const row = button(results, `${item.title}\n${item.source}${item.running ? " · 실행 중" : ""}\n${item.logicalSessionId}`, () => {
            void this.store.open(item.logicalSessionId).then(() => this.close()).catch((error: unknown) => { notify(errorText(error)); });
          }); row.className = "kkh-session-row"; row.disabled = !item.canResume;
        }
        if (!filtered.length) { const empty = document.createElement("p"); empty.textContent = "일치하는 대화가 없습니다."; results.append(empty); }
      };
      search.addEventListener("input", render); render(); search.focus();
    } catch (error) { if (error instanceof Error) description.textContent = errorText(error); else throw error; }
  }
  override onClose(): void { this.contentEl.empty(); }
}
