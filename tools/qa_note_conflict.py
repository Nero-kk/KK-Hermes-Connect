from __future__ import annotations

import json
import shlex
import subprocess

from qa_windows import ROOT, evaluate


def main() -> None:
    saved = json.loads((ROOT / "evidence/revision-note-write.json").read_text())
    path = json.dumps(saved["note"])
    original = json.dumps(saved["text"])
    prepared = json.loads(evaluate("""(async()=>{const s=app.plugins.plugins['KK-Hermes-Connect'].store;
      window.__conflictQA={status:s.status};
      const file=app.vault.getAbstractFileByPath(PATH);
      const tool=await s.noteWriter.prepare(s.transport,s.current.logicalSessionId,{kind:'note',path:PATH,text:ORIGINAL});
      await app.vault.modify(file,ORIGINAL+'LOCAL_EDIT\\n');
      return JSON.stringify({command:tool.command})})()""".replace("PATH", path).replace("ORIGINAL", original)))
    try:
        response = subprocess.run(shlex.split(prepared["command"]), input=json.dumps({"text": "AI_REPLACEMENT"}),
                                  text=True, capture_output=True, timeout=100, check=False)
        receipt = json.loads(response.stdout)
        assert response.returncode == 1, response.stdout
        assert receipt["success"] is False and receipt["reason"] == "note_write_conflict", receipt
        actual = json.loads(evaluate("app.vault.read(app.vault.getAbstractFileByPath(" + path + ")).then(t=>JSON.stringify(t))"))
        assert actual == saved["text"] + "LOCAL_EDIT\n", actual
        result = {"conflictRefused": True, "localEditPreserved": True, "receipt": receipt}
        (ROOT / "evidence/revision-note-conflict.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
        print(json.dumps(result, ensure_ascii=False))
    finally:
        evaluate("""(async()=>{await app.vault.modify(app.vault.getAbstractFileByPath(PATH),ORIGINAL);
          const s=app.plugins.plugins['KK-Hermes-Connect'].store;s.status=window.__conflictQA.status;
          s.emit();delete window.__conflictQA;return true})()""".replace("PATH", path).replace("ORIGINAL", original))


if __name__ == "__main__":
    main()
