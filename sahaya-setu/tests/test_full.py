from pathlib import Path

from app import sms
from tests.conftest import BASE_LAT, BASE_LON, as_staff, make_photo, offset

P1, P2 = "9000000001", "9000000002"
CAP_FILE = Path(__file__).resolve().parent.parent / "data" / "sample_cap_alert.xml"


# Logins and department scoping ---------------------------------------------------------------
def test_staff_endpoints_need_login(anon):
    assert anon.get("/incidents").status_code == 401
    assert anon.get("/outbox").status_code == 401
    assert anon.get("/public/summary").status_code == 200


def test_departments_only_see_and_change_their_own_tickets(client, post_report):
    post_report(make_photo(1), phone=P1, lat=BASE_LAT, lon=BASE_LON, category="ELEC")
    lat, lon = offset(BASE_LAT, BASE_LON, north_m=900)
    post_report(make_photo(2), phone=P2, lat=lat, lon=lon, category="TREE")

    elec = as_staff("elec-demo")
    assert elec.get("/auth/me").json()["department"] == "electricity"
    items = elec.get("/incidents").json()["items"]
    assert [i["category"] for i in items] == ["ELEC"]
    assert elec.get("/incidents/2").status_code == 403
    assert elec.post("/incidents/2/status", data={"status": "assigned"}).status_code == 403
    r = elec.post("/incidents/1/status", data={"status": "in_progress", "actor": "Lineman Ravi"})
    assert r.status_code == 200 and "Lineman Ravi" in r.json()["timeline"][-1]["actor"]
    assert elec.post("/incidents/2/merge-into/1").status_code == 403
    assert elec.post("/incidents/1/status", data={"status": "rejected"}).status_code == 403


# Early warnings -------------------------------------------------------------------------------
def test_manual_alert_reaches_people_inside_the_area_with_shelters(client, anon):
    body = {"level": "red", "title": "Cyclone crossing tonight", "message": "Move to shelters by 6 PM",
            "center_lat": BASE_LAT, "center_lon": BASE_LON, "radius_km": 20, "area_name": "Konaseema coast"}
    assert as_staff("elec-demo").post("/alerts", json=body).status_code == 403
    assert client.post("/alerts", json=body).status_code == 200

    inside = anon.get("/alerts/active", params={"lat": BASE_LAT + 0.05, "lon": BASE_LON}).json()
    assert len(inside) == 1 and inside[0]["level"] == "red"
    shelter = inside[0]["nearest_shelters"][0]
    assert "Amalapuram" in shelter["name"] and shelter["distance_km"] < 10 and shelter["direction"]
    outside = anon.get("/alerts/active", params={"lat": 17.6868, "lon": 83.2185}).json()
    assert outside == []

    alert_id = client.get("/alerts").json()[0]["id"]
    client.post(f"/alerts/{alert_id}/end")
    assert anon.get("/alerts/active", params={"lat": BASE_LAT, "lon": BASE_LON}).json() == []


def test_cap_import_reads_english_and_telugu(client, anon):
    xml = CAP_FILE.read_text(encoding="utf-8")
    first = client.post("/alerts/import-cap", content=xml, headers={"content-type": "application/xml"}).json()
    assert first["created"] and first["level"] == "red" and first["radius_km"] == 25
    assert "తుఫాను" in first["message_te"] and "shelter" in first["message"]
    again = client.post("/alerts/import-cap", json={"xml": xml}).json()
    assert again["created"] is False and again["id"] == first["id"]
    assert client.post("/alerts/import-cap", json={"xml": "<not-cap>hello there friend</not-cap>"}).status_code == 400
    assert len(anon.get("/alerts/active", params={"lat": BASE_LAT, "lon": BASE_LON}).json()) == 1


def test_vulnerable_people_register_and_show_up_in_alert_area(client, anon):
    r = anon.post("/citizens/register", json={"phone": P1, "name": "Lakshmi", "village": "Amalapuram",
                                              "household_size": 4, "needs": ["elderly", "pregnant"],
                                              "family_contacts": [P2], "consent": True})
    assert r.json()["located"]
    anon.post("/citizens/register", json={"phone": P2, "village": "Kakinada", "needs": [], "consent": True})
    assert anon.post("/citizens/register", json={"phone": "9000000003", "consent": False}).status_code == 400

    xml = CAP_FILE.read_text(encoding="utf-8")
    alert_id = client.post("/alerts/import-cap", json={"xml": xml}).json()["id"]
    res = client.get("/citizens/vulnerable", params={"alert_id": alert_id}).json()
    assert res["count"] == 1 and res["people_in_households"] == 4 and res["by_need"]["pregnant"] == 1
    assert as_staff("elec-demo").get("/citizens/vulnerable").status_code == 403
    assert as_staff("rescue-demo").get("/citizens/vulnerable", params={"alert_id": alert_id}).status_code == 200


# Citizen tracking, SOS pings --------------------------------------------------------------------
def test_track_ticket_hides_phone_numbers(client, anon, post_report):
    post_report(make_photo(1), phone=P1, lat=BASE_LAT, lon=BASE_LON)
    client.post("/incidents/1/status", data={"status": "resolved"})
    client.post("/sms/inbound", json={"from": P1, "message": "SS-0001 2"})
    t = anon.get("/track/SS-0001").json()
    assert t["status"] == "escalated"
    assert all(P1 not in (e["note"] or "") for e in t["timeline"])
    assert anon.get("/track/ss1").json()["ticket_code"] == "SS-0001"
    assert anon.get("/track/hello").status_code == 400


def test_sos_pings_update_location_until_acknowledged(client, anon):
    sos = anon.post("/sos", json={"client_report_id": "SOSPING1", "phone": P1, "lat": BASE_LAT, "lon": BASE_LON,
                                  "sos_type": "TRAPPED", "people_count": 3, "battery_pct": 60}).json()
    lat, lon = offset(BASE_LAT, BASE_LON, north_m=60)
    r = anon.post("/sos/update", json={"client_report_id": "sosping1", "lat": lat, "lon": lon,
                                       "gps_accuracy_m": 12, "battery_pct": 41}).json()
    assert r["acknowledged"] is False
    inc = client.get(f"/incidents/{sos['incident_id']}").json()
    assert abs(inc["lat"] - lat) < 1e-9 and inc["battery_pct"] == 41 and inc["sos_phone"] == P1
    client.post(f"/incidents/{sos['incident_id']}/status", data={"status": "assigned"})
    assert anon.post("/sos/update", json={"client_report_id": "SOSPING1"}).json()["acknowledged"] is True
    assert anon.post("/sos/update", json={"client_report_id": "NOPE"}).status_code == 409


# Reports for officials ---------------------------------------------------------------------------
def test_sitrep_without_ai_key_uses_rules(client, post_report):
    post_report(make_photo(1), phone=P1, lat=BASE_LAT, lon=BASE_LON, people_count=5)
    client.post("/sos", json={"phone": P2, "lat": BASE_LAT, "lon": BASE_LON, "people_count": 2})
    rep = client.get("/sitrep").json()
    assert rep["written_by"] == "rules"
    assert rep["facts"]["open_sos"] == 1 and "Open tickets: 2" in rep["text"]
    assert as_staff("elec-demo").get("/sitrep").status_code == 403


def test_public_fixes_show_before_and_after_photos(client, anon, post_report):
    post_report(make_photo(1), phone=P1, lat=BASE_LAT, lon=BASE_LON)
    client.post("/incidents/1/status", data={"status": "resolved"}, files={"proof": ("f.jpg", make_photo(8), "image/jpeg")})
    fixes = anon.get("/public/fixes").json()
    assert fixes[0]["before_photo_url"] and fixes[0]["proof_photo_url"] and fixes[0]["hours_to_fix"] >= 0
    assert anon.get("/public/summary").json()["fixed"] == 1


# Citizen app support ----------------------------------------------------------------------------
def test_app_config_places_reverse_and_ai_fallback(anon):
    cfg = anon.get("/app/config").json()
    assert "ELEC" in cfg["categories"] and cfg["ai_photo_check"] is False
    assert any(p["name"] == "Kakinada" for p in anon.get("/geo/places").json())
    assert "Amalapuram" in anon.get("/geo/reverse", params={"lat": BASE_LAT, "lon": BASE_LON}).json()["address"]
    r = anon.post("/ai/classify-photo", files={"photo": ("p.jpg", make_photo(1), "image/jpeg")}).json()
    assert r == {"suggestion": None, "ai_enabled": False}


def test_qr_relay_messages_go_through_mesh_endpoint(anon):
    code = sms.encode_coded(category="HOUSE", lat=BASE_LAT, lon=BASE_LON, report_id="QRRELAY1", phone=P2, people=5)
    r = anon.post("/mesh/relay", json={"relayed_by": P1, "messages": [code]}).json()
    assert r["results"][0]["ok"] and r["results"][0]["decision"] == "new"


def test_web_apps_are_served(anon):
    for path in ("/", "/citizen/", "/dashboard/", "/field/", "/board/", "/citizen/sw.js",
                 "/citizen/manifest.webmanifest", "/vendor/leaflet/leaflet.js", "/shared/base.css"):
        assert anon.get(path).status_code == 200, path


def test_phone_formats_match_across_app_and_sms(client, post_report):
    post_report(make_photo(1), phone="90000 00001", lat=BASE_LAT, lon=BASE_LON)
    client.post("/incidents/1/status", data={"status": "resolved"})
    res = client.post("/sms/inbound", json={"from": "+919000000001", "message": "SS-0001 1"}).json()
    assert res["ok"] and res["status"] == "closed"


def test_voice_report_uses_phone_gps_when_sent(anon):
    r = anon.post("/voice/transcript", json={"phone": P1, "text": "చెట్టు కూలింది, రోడ్డు బ్లాక్ అయింది",
                                             "lat": BASE_LAT, "lon": BASE_LON, "gps_accuracy_m": 15}).json()
    assert r["status"] == "received" and r["decision"] == "new"


def test_same_report_id_twice_at_once_is_counted_once(client):
    """Simulates the race: the duplicate check passed, but another request saved the same ID first."""
    from app import services
    from app.db import SessionLocal

    meta = {"client_report_id": "RACE0001", "phone": P1, "lat": BASE_LAT, "lon": BASE_LON, "sos_type": "TRAPPED"}
    with SessionLocal() as db:
        first = services.submit_report(db, dict(meta), None, channel="app", is_sos=True)
    original = services.select
    from sqlalchemy import false
    calls = {"n": 0}

    def blind_select(*a, **kw):  # the first duplicate check misses, like a concurrent request would
        q = original(*a, **kw)
        if a and getattr(a[0], "__name__", "") == "Report" and calls["n"] == 0:
            calls["n"] += 1
            return q.where(false())
        return q
    services.select = blind_select
    try:
        with SessionLocal() as db:
            second = services.submit_report(db, dict(meta), None, channel="app", is_sos=True)
    finally:
        services.select = original
    assert second.decision == "duplicate_submission" and second.incident.id == first.incident.id
