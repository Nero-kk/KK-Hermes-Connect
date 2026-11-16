from __future__ import annotations

import base64
import json

from qa_windows import ROOT, evaluate, run


def escape() -> None:
    run("dev:cdp", "method=Input.dispatchKeyEvent", 'params={"type":"keyDown","key":"Escape","code":"Escape","windowsVirtualKeyCode":27}')


def main() -> None:
    run("command", "id=KK-Hermes-Connect:open-chat")
    evaluate("(()=>{const r=document.querySelector('.kkh-chat'),s=app.plugins.plugins['KK-Hermes-Connect'].store;window.__compactQA={parent:r.parentNode,next:r.nextSibling,style:r.getAttribute('style'),mobile:document.body.classList.contains('is-mobile'),light:document.body.classList.contains('theme-light'),draft:s.draft};document.body.append(r);return true})()")
    results = []
    try:
        for width in (320, 390, 768, 1440):
            mobile = width <= 390
            run("dev:cdp", "method=Emulation.setDeviceMetricsOverride", "params=" + json.dumps({"width": width, "height": 844, "deviceScaleFactor": 1, "mobile": False}))
            for theme in ("light", "dark"):
                evaluate("(()=>{const r=document.querySelector('.kkh-chat');r.style.position='fixed';r.style.inset='0';r.style.zIndex='9999';r.style.width='100vw';r.style.height='100dvh';document.body.classList.toggle('is-mobile'," + str(mobile).lower() + ");document.body.classList.toggle('theme-light'," + str(theme == "light").lower() + ");document.body.classList.toggle('theme-dark'," + str(theme == "dark").lower() + ");return true})()")
                for state in ("chat", "mentions", "usage", "settings"):
                    if state == "mentions":
                        evaluate("(()=>{const t=document.querySelector('.kkh-composer textarea');t.value='검토 @U610';t.focus();t.setSelectionRange(t.value.length,t.value.length);t.dispatchEvent(new Event('input',{bubbles:true}));return true})()")
                    if state == "usage":
                        escape()
                        evaluate("(()=>{const t=document.querySelector('.kkh-composer textarea');t.value='';t.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.kkh-usage-toggle').click();return true})()")
                    if state == "settings":
                        evaluate("document.querySelector('.kkh-usage-toggle').click();document.querySelector('.kkh-chat').style.zIndex='1';app.plugins.plugins['KK-Hermes-Connect'].openSettings();true")
                    evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))")
                    probe = json.loads(evaluate("(()=>{const r=document.querySelector('.kkh-chat'),b=r.querySelector('.kkh-input-box'),u=r.querySelector('.kkh-usage-details'),t=r.querySelector('textarea');return {width:innerWidth,overflow:r.scrollWidth>r.clientWidth,boxOverflow:b.scrollWidth>b.clientWidth,composerVisible:b.getBoundingClientRect().bottom<=innerHeight,bodyFont:getComputedStyle(r.querySelector('.kkh-markdown')??r.querySelector('.kkh-empty')).fontSize,inputFont:getComputedStyle(t).fontSize,usageVisible:getComputedStyle(u).display!=='none',headingCount:r.querySelectorAll('.kkh-header h2').length,connectButtons:[...r.querySelectorAll('button')].filter(e=>e.textContent==='연결').length}})()"))
                    assert not probe["overflow"] and not probe["boxOverflow"] and probe["composerVisible"], probe
                    assert probe["headingCount"] == 0 and probe["connectButtons"] == 0, probe
                    if mobile and state in ("chat", "usage"):
                        assert probe["usageVisible"] == (state == "usage"), probe
                    name = f"compact-{width}-{theme}-{state}"
                    shot = json.loads(run("dev:cdp", "method=Page.captureScreenshot"))
                    (ROOT / "evidence" / (name + ".png")).write_bytes(base64.b64decode(shot["data"]))
                    results.append({"capture": name, **probe})
                    if state == "settings":
                        escape()
        print(json.dumps(results))
    finally:
        evaluate("(()=>{const q=window.__compactQA,r=document.querySelector('.kkh-chat'),s=app.plugins.plugins['KK-Hermes-Connect'].store;q.parent.insertBefore(r,q.next);if(q.style===null)r.removeAttribute('style');else r.setAttribute('style',q.style);const t=r.querySelector('textarea');t.value=q.draft;t.dispatchEvent(new Event('input',{bubbles:true}));s.draft=q.draft;document.body.classList.toggle('is-mobile',q.mobile);document.body.classList.toggle('theme-light',q.light);document.body.classList.toggle('theme-dark',!q.light);delete window.__compactQA;return true})()")
        run("dev:cdp", "method=Emulation.clearDeviceMetricsOverride")


if __name__ == "__main__":
    main()
