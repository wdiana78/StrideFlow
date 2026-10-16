from playwright.sync_api import sync_playwright
import os
URL=os.environ.get("KEPT_URL", "file://" + os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "kept-live-preview.html"))); errs=[]; ok=[]
def step(n): ok.append(n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":800}); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); pg.wait_for_selector("text=One system for the work"); step("kept home")
    pg.goto(URL+"#/solutions"); pg.wait_for_selector("text=Retail chains"); step("industry tabs")
    # Timiza public site
    pg.goto(URL+"#/site/timiza"); pg.wait_for_selector("text=All Communities Deserve"); step("timiza home")
    for path,t in [("/about-us","Our Objectives"),("/our-work","WHAT WE FOCUS ON."),("/gallery","GALLERY"),("/contact-us","Send Message")]:
        pg.goto(URL+"#/site/timiza"+path); pg.wait_for_selector(f"text={t}")
    step("timiza pages")
    pg.goto(URL+"#/site/timiza/our-work"); pg.click(".tz-prog:has-text('Climate Change')"); pg.wait_for_selector("text=Progress this year"); step("programme page")
    pg.goto(URL+"#/site/timiza/gallery"); pg.locator(".tz-photo").first.click(); pg.wait_for_selector(".tz-lightbox"); pg.keyboard.press("Escape"); step("gallery lightbox")
    pg.goto(URL+"#/site/timiza/contact-us"); pg.fill("input[placeholder='Enter your Full Name']", "Amina Hassan"); pg.fill("input[placeholder='Enter your Email or Phone']", "amina@example.org"); pg.fill("input[placeholder='Subject']", "Partnership"); pg.fill("textarea[placeholder='Type your message']", "We would like to support the climate programme.")
    pg.click("button:has-text('Send Message')"); pg.wait_for_selector(".tz-ok"); step("contact message")
    pg.goto(URL+"#/site/timiza/volunteer"); pg.fill("input[placeholder='Full name']", "Kahindi Baya"); pg.fill("input[placeholder='Phone number']", "0712345678"); pg.click("button:has-text('Apply')"); pg.wait_for_selector(".tz-ok"); step("volunteer")
    pg.goto(URL+"#/site/timiza/donate"); pg.click(".tz-amounts button:has-text('2,500')"); pg.fill("input[placeholder='Full name']", "Grace Mwamba"); pg.fill("input[placeholder^='M-Pesa number']", "0712345678")
    pg.click("button:has-text('Donate KES 2,500')"); pg.wait_for_selector("text=Check your phone"); pg.click("text=Simulate PIN entered"); pg.wait_for_selector("text=Asante sana"); step("donation")
    # staff login -> dashboard
    pg.goto(URL+"#/site/timiza"); pg.click(".tz-staff"); pg.wait_for_selector("text=Staff sign in"); pg.click(".tz-demo button:has-text('Zawadi Kahindi')"); pg.wait_for_selector("text=Good to see you"); step("staff login to dashboard")
    pg.goto(URL+"#/app/m/donations"); pg.wait_for_selector("text=Grace Mwamba"); pg.goto(URL+"#/app/m/inquiries"); pg.wait_for_selector("text=Amina Hassan"); pg.goto(URL+"#/app/m/volunteers"); pg.wait_for_selector("text=Kahindi Baya"); step("website data in dashboard")
    pg.goto(URL+"#/app/m/vendors"); pg.wait_for_selector("td >> text=Kilifi Print Hub"); pg.click("button[aria-label='Edit Kilifi Print Hub']"); pg.wait_for_selector(".dialog"); pg.fill(".dialog input >> nth=2", "0722 999 000"); pg.click(".dialog button:has-text('Save changes')"); pg.wait_for_selector("text=Saved"); step("edit record")
    pg.goto(URL+"#/app/m/items"); pg.wait_for_selector("td >> text=Event T-shirts"); pg.click("button[aria-label='Delete Event T-shirts']"); pg.wait_for_selector("text=Deleted"); step("delete with movements")
    pg.goto(URL+"#/app/forms"); pg.wait_for_selector("text=Outreach exit survey"); pg.click(".tile:has-text('Outreach exit survey') >> text=Analyse"); pg.click("button[role=tab]:has-text('Analytics')"); pg.wait_for_selector("text=How useful was the session?"); step("form analytics")
    pg.goto(URL+"#/app/analytics"); pg.wait_for_selector("text=Reach by ward"); step("insights")
    pg.keyboard.press("Control+k"); pg.fill("input[aria-label='Search everything']", "kaloleni"); pg.wait_for_selector("button[role=option]"); pg.keyboard.press("Escape"); step("search")
    pg.click("button[aria-label='Sign out']"); pg.wait_for_selector(".tz-staff"); step("sign out to site")
    # retail and hospitality
    pg.goto(URL+"#/site/hatua/shop"); pg.wait_for_selector("text=Add to bag"); pg.locator("button:has-text('Add to bag')").first.click(); pg.fill(".site-drawer input >> nth=0", "Asha Mwende"); pg.fill(".site-drawer input >> nth=1", "0712345678"); pg.fill(".site-drawer input >> nth=2", "Kilimani"); pg.click("button:has-text('Place order')"); pg.wait_for_selector("text=received"); step("shop order")
    pg.goto(URL+"#/site/pwani/rooms?start=2026-10-20&end=2026-10-22&guests=2"); pg.wait_for_selector("button:has-text('Request 2 nights')"); pg.locator("button:has-text('Request 2 nights')").first.click(); pg.fill(".site-drawer input >> nth=0", "Ben Otieno"); pg.fill(".site-drawer input >> nth=1", "0712345678"); pg.click("button:has-text('Hold these dates')"); pg.wait_for_selector("text=Request received"); step("booking request")
    # sign up: one short form, no industry, then choose capabilities, then the getting-started home
    pg.evaluate("localStorage.removeItem('kept_token')"); pg.goto(URL+"#/register"); pg.reload(); pg.wait_for_selector("text=Create your workspace")
    pg.fill("input[autocomplete=name]", "Fatma Ali"); pg.fill("input[autocomplete=organization]", "Lamu Dhow Lodge"); pg.fill("input[type=email]", "fatma@lamu.example")
    pg.fill(".pw-wrap input", "Lamu-Dhow-2026"); pg.click(".pw-toggle"); assert pg.get_attribute(".pw-wrap input", "type") == "text"
    pg.click("text=Create workspace"); pg.wait_for_selector("text=What do you want to manage first?")
    pg.click(".welcome-opt:has-text('Rooms and bookings')"); pg.click("text=Continue to my workspace"); pg.wait_for_selector("text=Get started")
    assert pg.locator("text=Add a bookable resource").count() == 1 and pg.locator("text=Grants").count() == 0; step("sign up")
    pg.goto(URL+"#/app/apps"); pg.click(".tile:has-text('Events') >> button:has-text('Install')"); pg.wait_for_selector("text=Events installed"); step("install app")
    b.close()
print("PASSED:", len(ok), "|", ", ".join(ok)); print("ERRORS:", errs)
