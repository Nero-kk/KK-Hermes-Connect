import { Lexer } from "marked";
import type { Token } from "marked";

function tokens(parent: HTMLElement, items: readonly Token[] | undefined): void {
  for (const token of items ?? []) {
    switch (token.type) {
      case "space": break;
      case "heading": {
        const heading = document.createElement(`h${Math.min(6, Math.max(1, token.depth))}`);
        tokens(heading, token.tokens); parent.append(heading); break;
      }
      case "paragraph": {
        const paragraph = document.createElement("p");
        tokens(paragraph, token.tokens); parent.append(paragraph); break;
      }
      case "strong": case "em": case "del": {
        const element = document.createElement(token.type === "strong" ? "strong" : token.type === "em" ? "em" : "del");
        tokens(element, token.tokens); parent.append(element); break;
      }
      case "code": {
        const pre = document.createElement("pre"); const code = document.createElement("code");
        code.textContent = token.text; pre.append(code); parent.append(pre); break;
      }
      case "codespan": {
        const code = document.createElement("code"); code.textContent = token.text; parent.append(code); break;
      }
      case "blockquote": {
        const quote = document.createElement("blockquote"); tokens(quote, token.tokens); parent.append(quote); break;
      }
      case "list": {
        const list = document.createElement(token.ordered ? "ol" : "ul");
        for (const item of token.items) { const li = document.createElement("li"); tokens(li, item.tokens); list.append(li); }
        parent.append(list); break;
      }
      case "table": {
        const wrapper = document.createElement("div"); wrapper.className = "kkh-table";
        const table = document.createElement("table"); const head = document.createElement("thead");
        const header = document.createElement("tr");
        for (const cell of token.header) { const th = document.createElement("th"); tokens(th, cell.tokens); header.append(th); }
        head.append(header); table.append(head); const body = document.createElement("tbody");
        for (const row of token.rows) { const tr = document.createElement("tr");
          for (const cell of row) { const td = document.createElement("td"); tokens(td, cell.tokens); tr.append(td); }
          body.append(tr);
        }
        table.append(body); wrapper.append(table); parent.append(wrapper); break;
      }
      case "link": {
        let target: URL | null = null;
        try { target = new URL(token.href); } catch (error) { if (!(error instanceof TypeError)) throw error; }
        if (target && ["https:", "http:"].includes(target.protocol) && !target.username && !target.password) {
          const link = document.createElement("a"); link.href = target.href;
          link.rel = "noopener noreferrer"; link.target = "_blank"; tokens(link, token.tokens); parent.append(link);
        } else parent.append(document.createTextNode(token.text));
        break;
      }
      case "br": parent.append(document.createElement("br")); break;
      case "hr": parent.append(document.createElement("hr")); break;
      case "image": parent.append(document.createTextNode(`[이미지: ${token.text}]`)); break;
      case "html": parent.append(document.createTextNode(token.raw)); break;
      case "text": case "escape": parent.append(document.createTextNode(token.text)); break;
      default: parent.append(document.createTextNode(token.raw)); break;
    }
  }
}

export function renderMarkdown(parent: HTMLElement, content: string): void {
  tokens(parent, Lexer.lex(content, { gfm: true }));
}
