from .conftest import add_user, make_project, register


def flags(client, h, **params):
    return client.get("/api/flags", headers=h, params=params).json()["items"]


def training(client, h, c, title, due, values=None, done=False, owner=None):
    a = client.post("/api/activities", headers=h, json={"commitment_id": c, "title": title, "due_on": due,
                                                        "activity_type": "training_session", "owner_id": owner}).json()
    req = {r["label"]: r["id"] for r in a["requirements"]}
    if values is not None:
        client.post(f"/api/activities/{a['id']}/evidence", headers=h, json={"requirement_id": req["Attendance count"], "kind": "value", "value_number": values})
    if done:
        client.post(f"/api/activities/{a['id']}/evidence/file", headers=h, data={"requirement_id": req["Signed attendance sheet"]},
                    files={"file": ("sheet.jpg", b"\xff\xd8\xff\xe0fake-jpeg-body", "image/jpeg")})
        r = client.post(f"/api/activities/{a['id']}/complete", headers=h)
        assert r.status_code == 200, r.text
    return a, req


def test_template_copies_proof_requirements(client):
    h = register(client)
    p = make_project(client, h)
    a, req = training(client, h, p["commitments"][0]["id"], "Session 1", "2026-10-20")
    assert set(req) == {"Attendance count", "Signed attendance sheet", "Session note"}
    counted = [r for r in a["requirements"] if r["counts_toward_target"]]
    assert [r["label"] for r in counted] == ["Attendance count"]


def test_completion_refused_without_required_proof(client):
    h = register(client)
    p = make_project(client, h)
    a, req = training(client, h, p["commitments"][0]["id"], "Session 1", "2026-10-20", values=21)
    r = client.post(f"/api/activities/{a['id']}/complete", headers=h)
    assert r.status_code == 422
    assert r.json()["detail"]["missing"] == ["Signed attendance sheet"]
    assert any(f["rule"] == "missing_proof" for f in flags(client, h))
    detail = client.get(f"/api/activities/{a['id']}", headers=h).json()
    assert detail["status"] == "in_progress" and detail["completion_refused_at"]
    assert any(h_["action"] == "completion_refused" for h_ in detail["history"])


def test_pace_and_behind_pace_flag_close_itself(client):
    h = register(client)
    p = make_project(client, h)
    c = p["commitments"][0]["id"]
    # 13 Oct: 73 of 97 days elapsed -> 75.3 expected. Nothing done yet -> behind pace.
    pace = client.get(f"/api/projects/{p['id']}", headers=h).json()["commitments"][0]["pace"]
    assert pace["expected"] == 75.3 and pace["status"] == "at_risk"
    assert any(f["rule"] == "behind_pace" for f in flags(client, h))
    training(client, h, c, "Big session", "2026-10-12", values=70, done=True)
    pace = client.get(f"/api/projects/{p['id']}", headers=h).json()["commitments"][0]["pace"]
    assert pace["actual"] == 70 and pace["status"] == "on_track"
    assert not any(f["rule"] == "behind_pace" for f in flags(client, h))
    resolved = flags(client, h, state="resolved")
    assert any(f["rule"] == "behind_pace" and "automatically" in f["resolution_note"] for f in resolved)


def test_values_only_count_once_activity_is_done(client):
    h = register(client)
    p = make_project(client, h)
    training(client, h, p["commitments"][0]["id"], "Pending session", "2026-10-20", values=40)
    assert client.get(f"/api/projects/{p['id']}", headers=h).json()["commitments"][0]["pace"]["actual"] == 0


def test_dependency_blocks_and_unblocks(client):
    h = register(client)
    p = make_project(client, h)
    c = p["commitments"][0]["id"]
    venue = client.post("/api/activities", headers=h, json={"commitment_id": c, "title": "Book venue", "due_on": "2026-10-11"}).json()
    session = client.post("/api/activities", headers=h, json={"commitment_id": c, "title": "Session", "due_on": "2026-10-25",
                                                              "depends_on_id": venue["id"]}).json()
    assert session["status"] == "blocked"
    assert client.post(f"/api/activities/{session['id']}/complete", headers=h).status_code == 409
    assert client.post(f"/api/activities/{venue['id']}/complete", headers=h).status_code == 200
    assert client.get(f"/api/activities/{session['id']}", headers=h).json()["status"] == "not_started"
    # cycles are refused
    r = client.patch(f"/api/activities/{venue['id']}", headers=h, json={"depends_on_id": session["id"]})
    assert r.status_code == 422


def test_overdue_escalates_to_manager_after_two_days(client):
    admin = register(client)
    mid, _ = add_user(client, admin, "m@test.example", "member", "Mary Member")
    p = make_project(client, admin)
    c = p["commitments"][0]["id"]
    client.post("/api/activities", headers=admin, json={"commitment_id": c, "title": "Two days late", "due_on": "2026-10-11", "owner_id": mid})
    client.post("/api/activities", headers=admin, json={"commitment_id": c, "title": "Five days late", "due_on": "2026-10-08", "owner_id": mid})
    over = {f["title"]: f for f in flags(client, admin, rule="overdue")}
    assert over["Two days late"]["owner"]["id"] == mid and over["Two days late"]["severity"] == "medium"
    assert over["Five days late"]["owner"]["full_name"] == "Ada Admin" and over["Five days late"]["severity"] == "high"


def test_manual_resolve_is_respected_and_follow_up_created(client):
    h = register(client)
    p = make_project(client, h)
    f = next(f for f in flags(client, h) if f["rule"] == "behind_pace")
    fu = client.post(f"/api/flags/{f['id']}/follow-up", headers=h, json={"title": "Extra catch-up session", "due_on": "2026-10-20"})
    assert fu.status_code == 201
    assert client.post(f"/api/flags/{f['id']}/resolve", headers=h, json={"note": "Funder agreed to a revised schedule."}).status_code == 200
    assert not any(x["rule"] == "behind_pace" for x in flags(client, h))  # not reopened straight away


def test_report_snapshot_is_built_from_records_and_frozen(client):
    h = register(client)
    p = make_project(client, h)
    c = p["commitments"][0]["id"]
    training(client, h, c, "Session A", "2026-10-05", values=30, done=True)
    r = client.post(f"/api/projects/{p['id']}/reports", headers=h, json={"period_start": "2026-08-01", "period_end": "2026-10-13"})
    assert r.status_code == 201, r.text
    snap = r.json()["snapshot"]
    row = snap["rows"][0]
    assert row["actual"] == 30 and row["expected"] == 75.3 and row["status"] == "at_risk"
    assert snap["evidence"]["total"] == 2
    assert "1 pieces" not in snap["summary"] and "0 of 1 commitments" in snap["summary"]
    # later work does not change a saved report
    training(client, h, c, "Session B", "2026-10-12", values=50, done=True)
    again = client.get(f"/api/reports/{r.json()['id']}", headers=h).json()["snapshot"]
    assert again["rows"][0]["actual"] == 30


def test_file_upload_rejects_unsupported_types(client):
    h = register(client)
    p = make_project(client, h)
    a, req = training(client, h, p["commitments"][0]["id"], "Session S", "2026-10-20")
    r = client.post(f"/api/activities/{a['id']}/evidence/file", headers=h, data={"requirement_id": req["Signed attendance sheet"]},
                    files={"file": ("virus.exe", b"MZ", "application/octet-stream")})
    assert r.status_code == 422
    wrong_kind = client.post(f"/api/activities/{a['id']}/evidence", headers=h,
                             json={"requirement_id": req["Signed attendance sheet"], "kind": "value", "value_number": 3})
    assert wrong_kind.status_code == 422
