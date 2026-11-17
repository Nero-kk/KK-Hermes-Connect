from __future__ import annotations

import json
import time
from datetime import datetime

from qa_windows import ROOT, evaluate


def main() -> None:
    name = f"X/99_Archive/KK-Hermes-Connect-QA-{datetime.now():%Y%m%d-%H%M%S}.md"
    initial = "# 연결 저장 검증\n\nQA_BEFORE\n"
    expected = initial.replace("QA_BEFORE", "QA_AFTER")
    evaluate("""(()=>{const s=app.plugins.plugins['KK-Hermes-Connect'].store;
      if(s.current?.running||s.busy)throw new Error('현재 대화 작업 중');
      window.__noteWriteQA={session:s.current?.logicalSessionId,draft:s.draft,target:s.notes.target,
        enabled:s.notes.enabled,pinned:s.notes.pinned};return true})()""")
    result = {}
    try:
        evaluate("app.vault.create(" + json.dumps(name) + "," + json.dumps(initial) + ").then(()=>true)")
        admitted = json.loads(evaluate("""(async()=>{const s=app.plugins.plugins['KK-Hermes-Connect'].store;
          await s.submit('create');s.notes.pin({path:PATH,read:()=>CONTENT});
          s.draft='연결 검증입니다. 첨부한 노트의 QA_BEFORE를 QA_AFTER로 바꾸고 실제 노트 파일에 저장해주세요. 제공된 writeTool.command를 terminal 도구로 실행하고 표준입력에 JSON을 전달해 저장 결과를 확인하세요. 다른 파일은 건드리지 말고 결과만 알려주세요.';
          await s.submit('send');return JSON.stringify({session:s.current.logicalSessionId})})().catch(e=>JSON.stringify({error:String(e),stack:e.stack}))"""
                                       .replace("PATH", json.dumps(name))
                                       .replace("CONTENT", json.dumps(initial))))
        assert "session" in admitted, admitted
        deadline = time.monotonic() + 180
        while time.monotonic() < deadline:
            result = json.loads(evaluate("""(async()=>{const s=app.plugins.plugins['KK-Hermes-Connect'].store;
              await s.refresh();const f=app.vault.getAbstractFileByPath(PATH);
              return JSON.stringify({text:await app.vault.read(f),running:s.current.running,
                title:s.current.title,status:s.status,operations:s.operations.map(o=>o.phase),
                reply:s.current.messages.filter(m=>m.role==='assistant').at(-1)?.text.slice(-1000)})})()"""
                                        .replace("PATH", json.dumps(name))))
            if not result["running"] and any(p in ("completed", "failed") for p in result["operations"]):
                break
            time.sleep(1)
        assert result["text"] == expected, result
        assert not result["running"], result
        metrics = json.loads(evaluate("""(async()=>{const s=app.plugins.plugins['KK-Hermes-Connect'].store;
          await s.models.load();const autoTitle=s.current.title;
          await s.renameTitle('KK Hermes Connect 실제 노트 저장 검증');await s.refresh();
          return JSON.stringify({autoTitle,renamed:s.current.title,context:s.models.data?.contextUsage,
            backupCount:(await app.vault.adapter.list('.obsidian/plugins/KK-Hermes-Connect/private/note-history')).files.length})})()"""))
        assert metrics["renamed"] == "KK Hermes Connect 실제 노트 저장 검증", metrics
        assert metrics["backupCount"] > 0, metrics
        record = {"note": name, **admitted, **result, **metrics, "savedMatches": True}
        (ROOT / "evidence" / "revision-note-write.json").write_text(json.dumps(record, ensure_ascii=False, indent=2))
        print(json.dumps(record, ensure_ascii=False), flush=True)
    finally:
        evaluate("""(async()=>{const q=window.__noteWriteQA,s=app.plugins.plugins['KK-Hermes-Connect'].store;
          s.notes.pinned=false;s.notes.set(q.target);s.notes.pinned=q.pinned;s.notes.enabled=q.enabled;s.draft=q.draft;
          if(q.session)await s.open(q.session);s.emit();delete window.__noteWriteQA;return true})()""")


if __name__ == "__main__":
    main()
