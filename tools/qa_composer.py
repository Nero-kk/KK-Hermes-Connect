from __future__ import annotations

import json
import base64

from qa_windows import ROOT, evaluate, run


def main() -> None:
    run("command", "id=KK-Hermes-Connect:open-chat")
    while json.loads(evaluate("!!document.querySelector('.modal-container')")):
        run("dev:cdp", "method=Input.dispatchKeyEvent", 'params={"type":"keyDown","key":"Escape","code":"Escape","windowsVirtualKeyCode":27}')
    evaluate("(()=>{for(const b of [...document.querySelectorAll('.modal-close-button')].reverse())b.click();const r=document.querySelector('.kkh-chat');window.__composerQA={parent:r.parentNode,next:r.nextSibling,notes:app.plugins.plugins['KK-Hermes-Connect'].store.notes.target,enabled:app.plugins.plugins['KK-Hermes-Connect'].store.notes.enabled,light:document.body.classList.contains('theme-light'),style:r.getAttribute('style')};document.body.append(r);return true})()")
    results = []
    try:
        for width in (390, 768):
            run("dev:cdp", "method=Emulation.setDeviceMetricsOverride", "params=" + json.dumps({"width": width, "height": 844, "deviceScaleFactor": 1, "mobile": False}))
            for theme in ("light", "dark"):
                evaluate("(()=>{const r=document.querySelector('.kkh-chat');r.style.cssText='position:fixed;inset:0;z-index:9999;width:100vw;height:100dvh';document.body.classList.toggle('theme-light'," + str(theme == "light").lower() + ");document.body.classList.toggle('theme-dark'," + str(theme == "dark").lower() + ");const s=app.plugins.plugins['KK-Hermes-Connect'].store;s.notes.enabled=true;s.notes.set({path:'20_Project/U610HM-MF-ECN-D001-00-DOOR(LEFT).md',read:()=> '검수용 노트',selection:{text:'선택 문장',startLine:3,endLine:3,isCurrent:()=>true}});return true})()")
                for state in ("composer", "picker", "settings"):
                    if state == "picker":
                        evaluate("document.querySelector('.kkh-model-trigger').click();true")
                    if state == "settings":
                        evaluate("document.querySelector('.kkh-model-trigger').click();document.querySelector('.kkh-chat').style.zIndex='1';app.plugins.plugins['KK-Hermes-Connect'].openSettings();true")
                    evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))")
                    probe = json.loads(evaluate("(()=>{const r=document.querySelector('.kkh-chat');const box=r.querySelector('.kkh-input-box');const b=box.getBoundingClientRect();return {width:innerWidth,overflow:r.scrollWidth>r.clientWidth,boxOverflow:box.scrollWidth>box.clientWidth,composerVisible:b.bottom<=innerHeight,popupOverflow:r.querySelector('.kkh-model-popup').scrollWidth>r.querySelector('.kkh-model-popup').clientWidth}})()"))
                    assert not probe["overflow"] and not probe["boxOverflow"] and probe["composerVisible"], probe
                    name = f"composer-{width}-{theme}-{state}"
                    shot = json.loads(run("dev:cdp", "method=Page.captureScreenshot"))
                    (ROOT / "evidence" / (name + ".png")).write_bytes(base64.b64decode(shot["data"]))
                    results.append({"capture": name, **probe})
                    if state == "settings":
                        run("dev:cdp", "method=Input.dispatchKeyEvent", 'params={"type":"keyDown","key":"Escape","code":"Escape","windowsVirtualKeyCode":27}')
        print(json.dumps(results))
    finally:
        evaluate("(()=>{const q=window.__composerQA,s=app.plugins.plugins['KK-Hermes-Connect'].store;s.notes.enabled=q.enabled;s.notes.set(q.notes);const r=document.querySelector('.kkh-chat');q.parent.insertBefore(r,q.next);if(q.style===null)r.removeAttribute('style');else r.setAttribute('style',q.style);document.body.classList.toggle('theme-light',q.light);document.body.classList.toggle('theme-dark',!q.light);delete window.__composerQA;return true})()")
        run("dev:cdp", "method=Emulation.clearDeviceMetricsOverride")


if __name__ == "__main__":
    main()
