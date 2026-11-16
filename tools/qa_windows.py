from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLI = "/mnt/d/Program Files/Obsidian/Obsidian.com"


def run(*arguments: str) -> str:
    result = subprocess.run([CLI, "vault=Zero", *arguments], capture_output=True, text=True,
                            timeout=60, check=True)
    return result.stdout.strip().removeprefix("=> ")


def evaluate(code: str) -> str:
    return run("eval", f"code={code}")


def capture(name: str) -> None:
    ready = json.loads(evaluate("new Promise(resolve=>{let start=performance.now();let check=()=>{let s=app.plugins.plugins['KK-Hermes-Connect'].store,r=document.querySelector('.kkh-chat');if(document.hidden){resolve(false);return;}if(r&&r.querySelector('h2').textContent===(s.current?.title??'연이 채팅')&&r.querySelector('.kkh-status').textContent===s.status&&!document.querySelector('.notice-container .notice')){requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true)));return;}if(performance.now()-start>20000){resolve(false);return;}requestAnimationFrame(check)};check()})"))
    assert ready, "The target window must be visible and fully painted before capture"
    destination = "D:\\Jin\\Obsidian\\Obsidian_Remote\\Zero\\.obsidian\\plugins\\KK-Hermes-Connect\\evidence\\" + name + ".png"
    run("dev:screenshot", f"path={destination}")


def main() -> None:
    evidence = ROOT / "evidence"
    evidence.mkdir(exist_ok=True)
    assert json.loads(evaluate("!document.hidden")), "Open the Zero vault window before visual QA"
    run("dev:mobile", "on")
    run("command", "id=KK-Hermes-Connect:open-chat")
    evaluate("window.__kkhQa={current:app.plugins.plugins['KK-Hermes-Connect'].store.current,status:app.plugins.plugins['KK-Hermes-Connect'].store.status,themeLight:document.body.classList.contains('theme-light')};true")
    results = []
    try:
        for width, height in [(390, 844), (768, 1024), (1440, 900)]:
            run("dev:cdp", "method=Emulation.setDeviceMetricsOverride", "params=" + json.dumps({"width": width, "height": height, "deviceScaleFactor": 1, "mobile": width == 390}))
            for theme in ("light", "dark"):
                evaluate(f"document.body.classList.toggle('theme-light',{str(theme == 'light').lower()});document.body.classList.toggle('theme-dark',{str(theme == 'dark').lower()});true")
                for state in ("empty", "conversation", "requests"):
                    if state == "empty":
                        evaluate("(()=>{let s=app.plugins.plugins['KK-Hermes-Connect'].store;s.current=null;s.status='연결 해제됨';s.emit();return true})()")
                    else:
                        cards = [] if state == "conversation" else [{"requestId": "qa-approval", "kind": "approval", "nativeKind": "approval", "generation": 1, "state": "open", "question": "검수용 도구를 실행할까요?", "command": "printf 검수", "choices": ["once", "deny"], "questions": [], "lockedAnswers": {}}, {"requestId": "qa-secret", "kind": "unsupported", "nativeKind": "secret", "generation": None, "state": "open", "question": "다른 화면의 입력이 필요합니다.", "command": "", "choices": [], "questions": [], "lockedAnswers": {}}]
                        fixture = {"logicalSessionId": "layout-only-session", "profileId": "orchestrator_yeon", "title": "한글·코드·긴 응답 화면 검수", "source": "slack", "running": False, "revision": 1, "generation": 1, "replayEpoch": "layout", "sequence": 0, "instanceId": "layout", "nextCursor": None, "reset": True, "requests": cards, "operations": [], "messages": [{"id": "1", "role": "user", "text": "모바일에서도 같은 대화를 이어갈 수 있나요?", "name": "", "compaction": False, "truncated": False}, {"id": "2", "role": "assistant", "text": "## 연결 확인\n\n기기마다 등록한 뒤 같은 세션을 선택합니다.\n\n| 항목 | 결과 |\n|---|---|\n| 저장 이력 | 확인 |\n| 재접속 | 상태 조회 |\n\n```dataviewjs\n이 코드 블록은 실행되지 않습니다.\n```\n\n" + "긴문자열" * 70, "name": "", "compaction": False, "truncated": False}]}
                        evaluate("(()=>{let s=app.plugins.plugins['KK-Hermes-Connect'].store;s.current=" + json.dumps(fixture, ensure_ascii=False) + ";s.status='화면 배치 검수용 데이터 · 실제 연결 결과 아님';s.emit();return true})()")
                    probe = json.loads(evaluate("(()=>{let r=document.querySelector('.kkh-chat');return {width:innerWidth,overflow:r.scrollWidth>r.clientWidth,composerVisible:r.querySelector('.kkh-composer').getBoundingClientRect().bottom<=innerHeight,scrollers:[...r.querySelectorAll('*')].filter(e=>/auto|scroll/.test(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight).map(e=>e.className)}})()"))
                    assert not probe["overflow"], probe
                    assert probe["composerVisible"], probe
                    clickability = json.loads(evaluate("(()=>{let r=document.querySelector('.kkh-chat'),b=r.querySelector('.kkh-composer button'),t=r.querySelector('textarea'),br=b.getBoundingClientRect(),tr=t.getBoundingClientRect();return{sendVisible:b.contains(document.elementFromPoint(br.x+br.width/2,br.y+br.height/2)),inputVisible:t.contains(document.elementFromPoint(tr.x+tr.width/2,tr.y+tr.height/2))}})()"))
                    assert clickability["sendVisible"] and clickability["inputVisible"], clickability
                    name = f"{width}-{theme}-{state}"
                    capture(name)
                    results.append({"capture": name, **probe, **clickability})
        (evidence / "layout-checks.json").write_text(json.dumps(results, ensure_ascii=False, indent=2))
        print(json.dumps({"captures": len(results), "overflow": False, "composerVisible": True}))
    finally:
        evaluate("(()=>{let s=app.plugins.plugins['KK-Hermes-Connect'].store;s.current=window.__kkhQa.current;s.status=window.__kkhQa.status;s.emit();document.body.classList.toggle('theme-light',window.__kkhQa.themeLight);document.body.classList.toggle('theme-dark',!window.__kkhQa.themeLight);delete window.__kkhQa;return true})()")
        run("dev:cdp", "method=Emulation.clearDeviceMetricsOverride")
        run("dev:mobile", "off")
        run("command", "id=KK-Hermes-Connect:open-chat")


if __name__ == "__main__":
    main()
