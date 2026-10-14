from .conftest import add_user, register


def reg(client, industry, email, slug=None):
    body = {"organization_name": f"{industry.title()} Org", "full_name": "Ada Admin", "email": email, "password": "Coastal-Breeze-2026", "industry": industry}
    if slug:
        body["site_slug"] = slug
    r = client.post("/api/auth/register", json=body)
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}, r.json()["user"]["organization"]


def test_industry_installs_the_right_apps_and_site(client):
    h, org = reg(client, "retail", "shop@test.example", slug="my-shop")
    assert {"sales", "inventory", "website"} <= set(org["installed_apps"]) and "participants" not in org["installed_apps"]
    assert client.get("/api/public/my-shop").json()["brand"]["primary"] == "#2F5BE8"  # royal palette by default
    assert client.post("/api/auth/register", json={"organization_name": "Copy Org", "full_name": "Bo Bee", "email": "b@test.example",
                                                   "password": "Coastal-Breeze-2026", "site_slug": "my-shop"}).status_code == 409


def test_uninstalled_apps_are_closed_and_admins_can_install(client):
    h, _ = reg(client, "retail", "shop@test.example")
    r = client.get("/api/m/participants", headers=h)
    assert r.status_code == 404 and "Install" in r.json()["detail"]
    assert client.post("/api/apps/participants/install", headers=h).status_code == 200
    assert client.get("/api/m/participants", headers=h).status_code == 200
    client.post("/api/apps/participants/uninstall", headers=h)
    assert client.get("/api/m/participants", headers=h).status_code == 404
    _, member = add_user(client, h, "m@test.example", "member")
    assert client.post("/api/apps/bookings/install", headers=member).status_code == 403


def test_platform_catalogue_is_public(client):
    p = client.get("/api/platform").json()
    assert len(p["apps"]) >= 14 and any(i["key"] == "hospitality" for i in p["industries"])


def test_event_gets_its_own_form_and_attendance_fills_in(client):
    h = register(client)
    ev = client.post("/api/m/events", headers=h, json={"title": "Youth forum", "date": "2026-10-20", "kind": "outreach"}).json()
    got = client.get(f"/api/m/events/{ev['id']}", headers=h).json()
    form = got["_form"]
    assert form and form["is_public"] and form["responses"] == 0
    for _ in range(3):
        assert client.post(f"/api/public/forms/{form['id']}", json={"gender": "Female", "age": "15-19", "rating": 5}).status_code == 201
    held = client.post(f"/api/m/events/{ev['id']}/transition", headers=h, json={"to": "held"}).json()
    assert held["status"] == "held" and held["attended"] == 3


def test_bookings_prevent_double_booking(client):
    h, _ = reg(client, "hospitality", "stay@test.example")
    room = client.post("/api/m/resources", headers=h, json={"name": "Cottage 1", "kind": "room"}).json()
    ok = client.post("/api/m/bookings", headers=h, json={"guest": "Asha", "resource_id": room["id"], "starts_on": "2026-11-01", "ends_on": "2026-11-05"})
    assert ok.status_code == 201
    clash = client.post("/api/m/bookings", headers=h, json={"guest": "Ben", "resource_id": room["id"], "starts_on": "2026-11-04", "ends_on": "2026-11-08"})
    assert clash.status_code == 409 and "Already booked by Asha" in clash.json()["detail"]
    client.post(f"/api/m/bookings/{ok.json()['id']}/transition", headers=h, json={"to": "cancelled", "note": "Guest cancelled"})
    assert client.post("/api/m/bookings", headers=h, json={"guest": "Ben", "resource_id": room["id"], "starts_on": "2026-11-04", "ends_on": "2026-11-08"}).status_code == 201


def test_invoices_overdue_flag_and_income_on_payment(client):
    h, _ = reg(client, "agency", "studio@test.example")
    c = client.post("/api/m/customers", headers=h, json={"name": "Kilele Coffee"}).json()
    inv = client.post("/api/m/invoices", headers=h, json={"number": "INV-1", "customer_id": c["id"], "description": "Campaign", "amount": 50000,
                                                          "issued_on": "2026-09-01", "due_on": "2026-09-15"}).json()
    client.post(f"/api/m/invoices/{inv['id']}/transition", headers=h, json={"to": "sent"})
    assert any(f["rule"] == "invoice_overdue" for f in client.get("/api/flags", headers=h).json()["items"])
    assert client.get(f"/api/m/customers/{c['id']}", headers=h).json()["outstanding"] == 50000
    client.post(f"/api/m/invoices/{inv['id']}/transition", headers=h, json={"to": "paid"})
    assert client.get("/api/m/income", headers=h).status_code == 404  # agency has no Funding app...
    client.post("/api/apps/funding/install", headers=h)
    assert client.get("/api/m/income", headers=h).json()["items"][0]["source"] == "Invoice INV-1: Kilele Coffee"  # ...but the income was recorded
    assert not any(f["rule"] == "invoice_overdue" for f in client.get("/api/flags", headers=h).json()["items"])


def test_search_respects_apps_and_organizations(client):
    h, _ = reg(client, "retail", "shop@test.example")
    client.post("/api/m/customers", headers=h, json={"name": "Junction Boutique"})
    other, _ = reg(client, "retail", "other@test.example")
    assert [r["title"] for r in client.get("/api/search", headers=h, params={"q": "junction"}).json()] == ["Junction Boutique"]
    assert client.get("/api/search", headers=other, params={"q": "junction"}).json() == []
