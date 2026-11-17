from __future__ import annotations

import base64
import json

from qa_windows import ROOT, evaluate, run


def capture(name: str) -> None:
    shot = json.loads(run("dev:cdp", "method=Page.captureScreenshot"))
    (ROOT / "evidence" / f"{name}.png").write_bytes(base64.b64decode(shot["data"]))


def close_modal() -> None:
    run("dev:cdp", "method=Input.dispatchKeyEvent",
        'params={"type":"keyDown","key":"Escape","code":"Escape","windowsVirtualKeyCode":27}')


def main() -> None:
    run("command", "id=KK-Hermes-Connect:open-chat")
    while json.loads(evaluate("document.querySelectorAll('.modal-container').length")):
        close_modal()
    evaluate("""(()=>{const r=document.querySelector('.kkh-chat'),s=app.plugins.plugins['KK-Hermes-Connect'].store;
      window.__revisionQA={parent:r.parentNode,next:r.nextSibling,style:r.getAttribute('style'),
      mobile:document.body.classList.contains('is-mobile'),light:document.body.classList.contains('theme-light')};
      document.body.append(r);return true})()""")
    results = []
    try:
        for width in (320, 390, 570, 1440):
            run("dev:cdp", "method=Emulation.setDeviceMetricsOverride", "params=" + json.dumps({
                "width": width, "height": 900, "deviceScaleFactor": 1, "mobile": False}))
            for theme in ("light", "dark"):
                evaluate("""(()=>{const r=document.querySelector('.kkh-chat');
                  Object.assign(r.style,{position:'fixed',inset:'0',zIndex:'9999',width:'100vw',height:'100dvh'});
                  document.body.classList.toggle('is-mobile',MOBILE);
                  document.body.classList.toggle('theme-light',LIGHT);
                  document.body.classList.toggle('theme-dark',!LIGHT);return true})()"""
                         .replace("MOBILE", str(width <= 390).lower())
                         .replace("LIGHT", str(theme == "light").lower()))
                for state in ("chat", "picker", "settings"):
                    if state == "picker":
                        evaluate("document.querySelector('.kkh-model-trigger').click();true")
                    if state == "settings":
                        evaluate("""document.querySelector('.kkh-model-trigger').click();
                          document.querySelector('.kkh-chat').style.zIndex='1';
                          app.plugins.plugins['KK-Hermes-Connect'].openSettings();
                          [...document.querySelectorAll('.kkh-model-settings')].at(-1).open=true;true""")
                    evaluate("new Promise(resolve=>setTimeout(()=>resolve(true),120))")
                    probe = json.loads(evaluate("""(()=>{const r=document.querySelector('.kkh-chat'),
                      b=r.querySelector('.kkh-input-box'),p=r.querySelector('.kkh-model-popup'),
                      l=[...document.querySelectorAll('.kkh-model-list')].at(-1);
                      return {overflow:r.scrollWidth>r.clientWidth,boxOverflow:b.scrollWidth>b.clientWidth,
                      composerVisible:b.getBoundingClientRect().bottom<=innerHeight,
                      popupVisible:!p.hidden,popupOverflow:!p.hidden&&p.scrollWidth>p.clientWidth,
                      listHeight:l?.clientHeight,rowHeight:l?.querySelector('.setting-item')?.getBoundingClientRect().height,
                      title:r.querySelector('.kkh-conversation-title').textContent,
                      context:r.querySelector('.kkh-context-meter').title,
                      avatarLoaded:[...r.querySelectorAll('.kkh-avatar')].every(e=>e.complete&&e.naturalWidth>0)}})()"""))
                    assert not probe["overflow"] and not probe["boxOverflow"], probe
                    assert probe["composerVisible"] and not probe["popupOverflow"], probe
                    if state == "settings":
                        assert probe["listHeight"] > 0 and probe["rowHeight"] > 0, probe
                        assert probe["listHeight"] <= probe["rowHeight"] * 5 + 1, probe
                    name = f"revision-{width}-{theme}-{state}"
                    capture(name)
                    results.append({"capture": name, **probe})
                    if state == "settings":
                        close_modal()
        (ROOT / "evidence" / "revision-layout.json").write_text(json.dumps(results, ensure_ascii=False, indent=2))
        print(json.dumps({"captures": len(results), "overflow": False, "avatarLoaded": all(r["avatarLoaded"] for r in results)}))
    finally:
        while json.loads(evaluate("document.querySelectorAll('.modal-container').length")):
            close_modal()
        evaluate("""(()=>{const q=window.__revisionQA,
          r=document.querySelector('.kkh-chat');q.parent.insertBefore(r,q.next);
          if(q.style===null)r.removeAttribute('style');else r.setAttribute('style',q.style);
          document.body.classList.toggle('is-mobile',q.mobile);
          document.body.classList.toggle('theme-light',q.light);document.body.classList.toggle('theme-dark',!q.light);
          delete window.__revisionQA;return true})()""")
        run("dev:cdp", "method=Emulation.clearDeviceMetricsOverride")


if __name__ == "__main__":
    main()
