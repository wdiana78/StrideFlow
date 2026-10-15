from playwright.sync_api import sync_playwright
import os
URL=os.environ.get("KEPT_URL", "file://" + os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "kept-live-preview.html"))); S=os.path.join(os.path.dirname(__file__), "shots") + "/"; os.makedirs(S, exist_ok=True); errs=[]; ok=[]
def step(n): ok.append(n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1440,"height":900}, reduced_motion="reduce"); pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    def logout():
        pg.evaluate("localStorage.removeItem('kept_token')"); pg.goto(URL+"#/"); pg.reload()
    pg.goto(URL); pg.wait_for_selector("text=One system for the work"); pg.screenshot(path=S+"k-home.png"); step("kept home")
    for path,t in [("/product","Everything an organization runs on"),("/solutions","Built around the work"),("/customers","Five organizations"),("/pricing","Simple monthly plans")]:
        pg.goto(URL+"#"+path); pg.wait_for_selector(f"text={t}"); pg.wait_for_timeout(300); pg.screenshot(path=S+f"k{path.replace('/','-')}.png")
    step("kept pages")
    pg.goto(URL+"#/contact"); pg.fill("input[autocomplete=name]","Amina Yusuf"); pg.fill("input[autocomplete=organization]","Coast Clinics"); pg.fill(".mk input >> nth=2","amina@coast.example"); pg.click("text=Request a demo"); pg.wait_for_selector("text=We have your request"); step("demo request")
    # Timiza roles
    for who,expect,shot in [("Amani Charo","Administration","r-admin"),("Zawadi Kahindi","Good to see you","r-manager"),("Baraka Katana","Your day","r-member"),("Partner Observer","Board overview","r-viewer")]:
        logout(); pg.goto(URL+"#/site/timiza/login"); pg.click(f".tz-demo button:has-text('{who}')"); pg.wait_for_selector(f"text={expect}"); pg.wait_for_timeout(500); pg.screenshot(path=S+shot+".png"); step("role home: "+who)
        if who=="Zawadi Kahindi":
            pg.click("button[aria-label^='Notifications']"); pg.wait_for_selector("text=Assigned to you"); pg.keyboard.press("Escape")
            pg.click("button[aria-label='Account']"); pg.click("a:has-text('My account')"); pg.wait_for_selector("text=What your role allows"); pg.screenshot(path=S+"r-account.png"); step("top nav menus and my account")
    logout(); pg.goto(URL+"#/site/timiza"); pg.wait_for_selector("text=All Communities Deserve"); pg.screenshot(path=S+"t-site.png"); step("timiza site")
    # Hatua
    pg.goto(URL+"#/site/hatua"); pg.wait_for_selector("text=Made in our Nairobi workshop"); pg.wait_for_timeout(400); pg.screenshot(path=S+"h-site.png", full_page=True)
    pg.goto(URL+"#/site/hatua/shop"); pg.locator("button:has-text('Add to bag')").first.click(); pg.fill(".site-drawer input >> nth=0","Asha Mwende"); pg.fill(".site-drawer input >> nth=1","0712345678"); pg.fill(".site-drawer input >> nth=2","Kilimani, Argwings Kodhek Rd")
    pg.click("button:has-text('Place order')"); pg.wait_for_selector("text=Track this order"); pg.click("text=Track this order"); pg.fill("input[inputmode=tel]","0712 345 678"); pg.click("button:has-text('Track order')"); pg.wait_for_selector("text=Order received"); step("hatua order and tracking")
    pg.goto(URL+"#/site/hatua/stores"); pg.wait_for_selector("text=Hatua Nyali"); step("hatua stores")
    pg.goto(URL+"#/site/hatua/login"); pg.click("button:has-text('Wanjiru Mbugua')"); pg.wait_for_selector("text=Branch performance this month"); pg.wait_for_timeout(500); pg.screenshot(path=S+"h-dash.png"); step("hatua dashboard")
    pg.goto(URL+"#/app/forms"); pg.click(".tile:has-text('Rider check-ins') >> text=Analyse"); pg.wait_for_selector("text=Where responses come from"); pg.wait_for_timeout(500); pg.screenshot(path=S+"h-tazama.png"); step("hatua rider tracking")
    # Pwani
    logout(); pg.goto(URL+"#/site/pwani"); pg.wait_for_selector("text=From the reef to Tsavo"); pg.wait_for_timeout(400); pg.screenshot(path=S+"p-site.png", full_page=True)
    pg.goto(URL+"#/site/pwani/dining"); pg.fill("form >> input[autocomplete=name]","Dee Kamau"); pg.fill("form >> input[inputmode=tel]","0712345678"); pg.click("button:has-text('Book table')"); pg.wait_for_selector("text=is booked"); step("pwani table")
    pg.goto(URL+"#/site/pwani/experiences"); pg.locator("button:has-text('Book')").first.click(); pg.fill(".site-drawer input[autocomplete=name]","Ben Otieno"); pg.fill(".site-drawer input >> nth=2","ben@example.com"); pg.click("button:has-text('Request booking')"); pg.wait_for_selector("text=Request received"); step("pwani tour")
    pg.goto(URL+"#/site/pwani/login"); pg.click("button:has-text('Rehema Salim')"); pg.wait_for_selector("text=Restaurants today"); pg.wait_for_timeout(500); pg.screenshot(path=S+"p-dash.png"); step("pwani dashboard")
    # Mwangaza
    logout(); pg.goto(URL+"#/site/mwangaza"); pg.wait_for_selector("text=Selected work"); pg.wait_for_timeout(300); pg.screenshot(path=S+"m-site.png", full_page=True)
    pg.goto(URL+"#/site/mwangaza/login"); pg.click("button:has-text('Wairimu Kamau')"); pg.wait_for_selector("text=Production pipeline"); pg.wait_for_timeout(500); pg.screenshot(path=S+"m-dash.png"); step("mwangaza dashboard")
    apps=pg.inner_text("section[aria-labelledby=apps-h]"); print("mwangaza apps:", apps.replace("\n"," | ")[:200])
    b.close()
print("PASSED", len(ok), ok); print("ERRORS", errs)
