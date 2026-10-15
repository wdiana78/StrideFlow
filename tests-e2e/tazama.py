from playwright.sync_api import sync_playwright
import os
URL=os.environ.get("KEPT_URL", "file://" + os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "kept-live-preview.html"))); S=os.path.join(os.path.dirname(__file__), "shots") + "/"; os.makedirs(S, exist_ok=True); errs=[]; ok=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":1440,"height":900}, geolocation={"latitude":-3.6305,"longitude":39.8499}, permissions=["geolocation"])
    pg=ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto(URL+"#/site/timiza/login"); pg.click(".tz-demo button:has-text('Zawadi Kahindi')"); pg.wait_for_selector("text=Good to see you")
    pg.goto(URL+"#/app/forms"); pg.click(".tile:has-text('Outreach field tracker') >> text=Analyse"); pg.wait_for_selector("text=Responses per day"); pg.wait_for_timeout(600)
    pg.screenshot(path=S+"tr-live.png", full_page=True); ok.append("tracker")
    before=int(pg.inner_text(".tracker-kpis > div:nth-child(3) b").replace(",",""))
    pg.click("text=Simulate a field team"); pg.wait_for_timeout(9000); pg.click("text=Stop field team simulation"); pg.wait_for_timeout(5500)
    after=int(pg.inner_text(".tracker-kpis > div:nth-child(3) b").replace(",",""))
    print("live updates:", before, "->", after); ok.append("live updates" if after>before else "LIVE FAILED")
    # collect in app with skip logic + gps
    pg.click("button[role=tab]:has-text('Collect')"); pg.click("button.chip:has-text('Watamu')"); pg.click("button.chip:has-text('Market outreach')")
    pg.fill("input[type=number] >> nth=0", "35"); pg.click("button.chip:has-text('Yes')"); pg.wait_for_selector("text=Number of referrals"); ok.append("skip logic reveals question")
    pg.click("text=Capture location"); pg.wait_for_selector("text=-3.63050"); ok.append("gps capture")
    pg.click("button:has-text('Submit')"); pg.wait_for_selector(".field-error"); ok.append("required hidden-then-shown question enforced")
    pg.fill("input[type=number] >> nth=2", "2"); pg.click("button:has-text('Submit')"); pg.wait_for_selector("text=Response saved."); ok.append("in-app collect")
    # public form, offline then back online
    pg.click("button[role=tab]:has-text('Share')"); href=pg.get_attribute("a:has-text('Open form')","href")
    pub=ctx.new_page(); pub.on("pageerror", lambda e: errs.append(str(e))); pub.goto(URL+href); pub.wait_for_selector("text=Your name")
    pub.fill("input[autocomplete=name]", "Field Officer Amani"); pub.click("button.chip:has-text('Tezo')"); pub.click("button.chip:has-text('Door to door')"); pub.fill("input[type=number] >> nth=0", "18"); pub.click("button.chip:has-text('No')")
    ctx.set_offline(True)
    pub.click("button:has-text('Submit')"); pub.wait_for_selector("text=Saved on this device"); ok.append("offline save") 
    print("queued while offline:", pub.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('kept_outbox')).map(k=>JSON.parse(localStorage.getItem(k)).length)"))
    ctx.set_offline(False); pub.wait_for_timeout(2500); print("outbox after sync:", pub.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('kept_outbox')).map(k=>JSON.parse(localStorage.getItem(k)).length)"))
    pg.click("button[role=tab]:has-text('Live tracker')"); pg.wait_for_selector("td >> text=Field Officer Amani", timeout=15000); ok.append("public response appears live")
    # import CSV
    pg.click("button[role=tab]:has-text('Import')")
    csv="Ward,Activity,Young people reached,Any referrals made?,Collector\nSokoni,School outreach,44,No,Neema Kazungu\nKaloleni,Market outreach,29,no,Juma Mwangome\nMombasa,School outreach,5,no,X\n"
    open(os.path.join(os.path.dirname(__file__), "sheet.csv"),"w").write(csv); pg.set_input_files(".dropzone input", os.path.join(os.path.dirname(__file__), "sheet.csv")); pg.wait_for_selector("text=Import 3 rows"); pg.click("text=Import 3 rows"); pg.wait_for_selector("text=2 responses imported"); pg.wait_for_selector("text=1 rows were not imported"); ok.append("csv import with row errors")
    pg.screenshot(path=S+"tr-import.png")
    pg.fill("input[placeholder^='https://docs.google.com']", "http://evil.example/x"); pg.click("text=Connect sheet"); pg.wait_for_selector("text=Paste a Google Sheets link"); ok.append("sheet link validated")
    m=ctx.new_page(); m.set_viewport_size({"width":390,"height":844}); m.goto(URL+href); m.wait_for_selector("text=Your name"); m.screenshot(path=S+"tr-mobile.png", full_page=True)
    print("mobile overflow", m.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth"))
    b.close()
print("OK:", ok); print("ERRORS:", errs)
