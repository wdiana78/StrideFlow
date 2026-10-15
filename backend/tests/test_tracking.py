"""Field tracking: skip logic, location, offline retries, live polling, tracker, imports and Google Sheets sync."""
import httpx

from .conftest import add_user, register

FIELDS = [
    {"id": "ward", "label": "Ward", "type": "select", "required": True, "options": ["Sokoni", "Watamu"]},
    {"id": "reached", "label": "Young people reached", "type": "number", "required": True, "min": 0, "max": 500},
    {"id": "referred", "label": "Any referrals?", "type": "yesno"},
    {"id": "referrals", "label": "How many referrals", "type": "number", "required": True, "show_if": {"field": "referred", "equals": "yes"}},
    {"id": "where", "label": "Location", "type": "gps"},
]


def make(client, h, **extra):
    r = client.post("/api/forms", headers=h, json={"title": "Outreach tracker", "is_public": True, "target": 10, "fields": FIELDS, **extra})
    assert r.status_code == 201, r.text
    return r.json()


def test_skip_logic_only_requires_visible_questions(client):
    h = register(client)
    f = make(client, h)
    assert client.post(f"/api/forms/{f['id']}/submissions", headers=h, json={"ward": "Sokoni", "reached": 40, "referred": "no"}).status_code == 201
    r = client.post(f"/api/forms/{f['id']}/submissions", headers=h, json={"ward": "Sokoni", "reached": 40, "referred": "yes"})
    assert r.status_code == 422 and "How many referrals" in r.json()["detail"]["message"]
    # an answer to a hidden question is dropped, not stored
    client.post(f"/api/forms/{f['id']}/submissions", headers=h, json={"ward": "Watamu", "reached": 5, "referred": "no", "referrals": 9})
    items = client.get(f"/api/forms/{f['id']}/submissions", headers=h).json()["items"]
    assert all("referrals" not in i["data"] for i in items)


def test_skip_logic_must_point_backwards(client):
    h = register(client)
    bad = [FIELDS[3], FIELDS[2]]
    assert client.post("/api/forms", headers=h, json={"title": "Bad", "fields": [FIELDS[0], *bad]}).status_code == 422


def test_location_and_offline_retries_are_safe(client):
    h = register(client)
    f = make(client, h)
    body = {"data": {"ward": "Watamu", "reached": 12, "where": {"lat": -3.354, "lng": 40.024, "accuracy": 8}}, "client_id": "phone-1-0001", "collector": "Neema"}
    first = client.post(f"/api/public/forms/{f['id']}", json=body).json()
    again = client.post(f"/api/public/forms/{f['id']}", json=body).json()
    assert first["duplicate"] is False and again["duplicate"] is True and first["id"] == again["id"]
    assert client.post(f"/api/public/forms/{f['id']}", json={"data": {"ward": "Watamu", "reached": 1, "where": {"lat": 200, "lng": 0}}}).status_code == 422
    item = client.get(f"/api/forms/{f['id']}/submissions", headers=h).json()["items"][0]
    assert item["location"]["lat"] == -3.354 and item["collector"] == "Neema" and item["source"] == "public"


def test_live_polling_and_tracker(client):
    h = register(client)
    f = make(client, h)
    first = client.get(f"/api/forms/{f['id']}/submissions", headers=h).json()
    client.post(f"/api/public/forms/{f['id']}", json={"data": {"ward": "Sokoni", "reached": 30, "where": "-3.63, 39.85"}, "collector": "Baraka"})
    new = client.get(f"/api/forms/{f['id']}/submissions", headers=h, params={"since": first["server_time"]}).json()
    assert new["total"] == 1
    t = client.get(f"/api/forms/{f['id']}/tracker", headers=h).json()
    assert t["total"] == 1 and t["today"] == 1 and t["target"] == 10 and t["with_location"] == 1
    assert t["collectors"][0] == {"name": "Baraka", "total": 1, "today": 1}
    assert t["breakdown"][0]["label"] == "Sokoni" and len(t["per_day"]) == 14


def test_import_saves_valid_rows_reports_the_rest_and_ignores_repeats(client):
    h = register(client)
    _, member = add_user(client, h, "m@test.example", "member")
    f = make(client, h)
    rows = [{"ward": "sokoni", "reached": "25", "_collector": "Juma"}, {"ward": "Mombasa", "reached": "3"}, {"ward": "Watamu", "reached": "7", "where": "-3.35, 40.02"}]
    assert client.post(f"/api/forms/{f['id']}/import", headers=member, json={"rows": rows}).status_code == 403
    r = client.post(f"/api/forms/{f['id']}/import", headers=h, json={"rows": rows}).json()
    assert r["created"] == 2 and r["failed"] == 1 and r["errors"][0]["row"] == 2
    again = client.post(f"/api/forms/{f['id']}/import", headers=h, json={"rows": rows}).json()
    assert again["created"] == 0 and again["skipped_duplicates"] == 2


def test_sheet_link_cannot_be_used_to_reach_other_hosts(client):
    h = register(client)
    f = make(client, h)
    for bad in ("http://docs.google.com/spreadsheets/d/abc/edit", "https://169.254.169.254/latest/meta-data", "https://evil.example/spreadsheets/d/x",
                "https://docs.google.com.evil.example/spreadsheets/d/x", "https://docs.google.com/document/d/abc"):
        assert client.put(f"/api/forms/{f['id']}/sheet", headers=h, json={"url": bad}).status_code == 422, bad


def test_sheet_sync_imports_new_rows_once(client, monkeypatch):
    h = register(client)
    f = make(client, h)
    assert client.put(f"/api/forms/{f['id']}/sheet", headers=h, json={"url": "https://docs.google.com/spreadsheets/d/AbC123/edit#gid=0"}).status_code == 200
    csv_text = "Ward,Young people reached,Location,Collector\nSokoni,40,\"-3.63, 39.85\",Baraka\nWatamu,12,,Neema\nNowhere,1,,X\n"
    seen = {}

    class FakeClient:
        def __init__(self, *a, **k): pass
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def get(self, url):
            seen["url"] = url
            return httpx.Response(200, content=csv_text.encode(), request=httpx.Request("GET", url))
    monkeypatch.setattr("app.routers.forms.httpx.Client", FakeClient)
    r = client.post(f"/api/forms/{f['id']}/sheet-sync", headers=h).json()
    assert seen["url"] == "https://docs.google.com/spreadsheets/d/AbC123/export?format=csv&gid=0"
    assert r["created"] == 2 and r["failed"] == 1
    assert client.post(f"/api/forms/{f['id']}/sheet-sync", headers=h).json()["created"] == 0
    t = client.get(f"/api/forms/{f['id']}/tracker", headers=h).json()
    assert {c["name"] for c in t["collectors"]} == {"Baraka", "Neema"}
