"""Account lifecycle in a real browser against the real FastAPI backend (not the offline preview).

Start the API (EMAIL_TRANSPORT=log, writing to API_LOG) on an empty database, start `npx vite` (it proxies /api), then:
    APP=http://localhost:5173 API_LOG=/tmp/api.log python tests-e2e/real_backend.py
Emails are read from the API log, the way a person would read their inbox.
"""
import os
import re
import time

from playwright.sync_api import sync_playwright

APP = os.environ.get("APP", "http://localhost:5173")
LOG = os.environ.get("API_LOG", "/tmp/api.log")
stamp = str(int(time.time()))
OWNER = f"owner{stamp}@acme.example"
MATE = f"mate{stamp}@acme.example"
PW, PW2 = "Coastal-Breeze-2026", "Harbour-Lights-2027"
ok, errs = [], []


def step(n):
    ok.append(n)
    print("ok:", n)


def link_for(email, kind, after):
    """Newest link of a kind (reset-password / accept-invitation) mailed to an address, from the API log."""
    for _ in range(40):
        text = open(LOG).read()[after:]
        blocks = [b for b in text.split("EMAIL (log transport)") if f"to={email}" in b]
        for b in reversed(blocks):
            m = re.search(rf"(https?://\S+/{kind}\?token=[\w-]+)", b)
            if m:
                return m.group(1).replace("http://localhost:5173", APP)
        time.sleep(0.25)
    raise AssertionError(f"no {kind} email for {email}")


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1280, "height": 860})
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errs.append(str(e)))

    # 1. Sign-up with a long organization name (used to break the old address generator)
    pg.goto(f"{APP}/register")
    pg.get_by_label("Your name").fill("Jane Wanjiku")
    pg.get_by_label("Organization or business name").fill("Mombasa Road Electronics, Appliances and Home Solutions Limited")
    pg.get_by_label("Work email").fill(OWNER)
    pg.get_by_label("Password", exact=True).fill("short1")
    pg.get_by_role("button", name="Show password").first.click()
    assert pg.get_by_label("Password", exact=True).get_attribute("type") == "text"
    step("password visibility toggle shows the password")
    pg.get_by_role("button", name="Create workspace").click()
    pg.wait_for_selector("text=10 characters")
    step("weak password explained before or after submit")
    pg.get_by_label("Password", exact=True).fill(PW)
    pg.get_by_role("button", name="Create workspace").click()
    pg.wait_for_selector("text=What do you want to manage first?")
    step("registration against the real API")

    cookies = {c["name"]: c for c in ctx.cookies()}
    assert cookies["sf_session"]["httpOnly"] and not cookies["sf_csrf"]["httpOnly"]
    assert pg.evaluate("document.cookie").find("sf_session") == -1
    assert pg.evaluate("Object.keys(localStorage).filter(k => k.includes('token')).length") == 0
    step("session is an HttpOnly cookie, invisible to page scripts and absent from storage")

    # 2. Onboarding: choose capabilities, land on an empty, guided home
    pg.get_by_role("button", name="Continue to my workspace").click()
    pg.wait_for_url(re.compile(r"/app$"))
    pg.wait_for_selector("text=Create your first project")
    body = pg.inner_text("main")
    for leaked in ("Timiza", "Hatua", "Pwani", "Mwangaza", "Tumaini", "grant", "beneficiar"):
        assert leaked.lower() not in body.lower(), leaked
    step("new workspace is empty, neutral and shows next steps")

    # 3. CSRF: a change without the header is refused even with a valid cookie
    status = pg.evaluate("fetch('/api/auth/logout-everywhere', {method: 'POST', credentials: 'include'}).then(r => r.status)")
    assert status == 403, status
    step("cookie request without CSRF token refused")

    # 4. Invite a teammate; they accept in a separate browser
    mark = os.path.getsize(LOG)
    pg.goto(f"{APP}/app/settings")
    pg.get_by_role("button", name="Invite someone").click()
    dlg = pg.get_by_role("dialog")
    dlg.get_by_label("Email").fill(MATE)
    dlg.get_by_label("Role").select_option("manager")
    dlg.get_by_role("button", name="Send invitation").click()
    pg.wait_for_selector(f"text={MATE}")
    url = link_for(MATE, "accept-invitation", mark)
    step("invitation emailed")
    ctx2 = b.new_context()
    p2 = ctx2.new_page()
    p2.goto(url)
    p2.wait_for_selector("text=manager")
    p2.get_by_label("Your name").fill("Otieno Mwangi")
    p2.get_by_label("Choose a password").fill(PW2)
    p2.get_by_role("button", name=re.compile("Join|Accept")).click()
    p2.wait_for_url(re.compile(r"/app"))
    p2.wait_for_selector("text=Otieno")
    step("invitation accepted; teammate signed in with the invited role")
    p2.goto(url)
    p2.wait_for_selector("text=expired or is no longer valid")
    step("invitation link cannot be reused")
    ctx2.close()

    # 5. Sign out, forget the password, reset it, sign in with the new one
    pg.goto(f"{APP}/app")
    pg.get_by_role("button", name="Account").click()
    pg.get_by_role("menuitem", name="Sign out").click()
    pg.wait_for_url(re.compile(r"/(login)?$"))
    assert "sf_session" not in {c["name"] for c in ctx.cookies()} or pg.evaluate("fetch('/api/auth/me').then(r => r.status)") == 401
    step("sign out ends the session")
    mark = os.path.getsize(LOG)
    pg.goto(f"{APP}/forgot-password")
    pg.get_by_label("Email").fill(OWNER)
    try:
        pg.get_by_role("button", name="Send reset link").click(timeout=8000)
    except Exception:
        pg.screenshot(path="/tmp/fail.png")
        print("URL", pg.url, "|", pg.inner_text("body")[:300].replace("\n", " | "))
        raise
    pg.wait_for_selector("text=If an account exists")
    url = link_for(OWNER, "reset-password", mark)
    pg.goto(url)
    pg.get_by_label("New password").fill(PW2)
    pg.get_by_role("button", name="Save new password").click()
    pg.wait_for_selector("text=Sign in with your new password")
    step("password reset by emailed link")
    pg.goto(url)
    pg.get_by_label("New password").fill("Another-Strong-2028")
    pg.get_by_role("button", name="Save new password").click()
    pg.wait_for_selector("text=expired or was already used")
    step("reset link works only once")
    pg.goto(f"{APP}/login")
    pg.get_by_label("Email").fill(OWNER)
    pg.get_by_label("Password", exact=True).fill(PW)
    pg.get_by_role("button", name="Sign in").click()
    pg.wait_for_selector("text=Email or password is incorrect")
    pg.get_by_label("Password", exact=True).fill(PW2)
    pg.get_by_role("button", name="Sign in").click()
    pg.wait_for_url(re.compile(r"/app"))
    step("old password refused, new password accepted")

    # 6. Phone layout of the empty home
    m = b.new_context(viewport={"width": 390, "height": 844}, storage_state=ctx.storage_state()).new_page()
    m.goto(f"{APP}/app")
    m.wait_for_selector("text=Create your first project")
    assert m.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth") <= 0
    step("empty home fits a phone screen")
    b.close()

print(f"PASSED {len(ok)} | " + ", ".join(ok))
print("ERRORS", errs)
