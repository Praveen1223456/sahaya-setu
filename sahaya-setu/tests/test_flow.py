from app import imaging, sms
from tests.conftest import BASE_LAT, BASE_LON, make_photo, offset

P1, P2, P3 = "9000000001", "9000000002", "9000000003"


def outbox_for(client, phone):
    return [m["body"] for m in client.get("/outbox", params={"phone": phone}).json()]


# Photos and duplicates --------------------------------------------------------------------
def test_new_report_gets_ticket_address_and_sms(client, post_report):
    res = post_report(make_photo(1), phone=P1, lat=BASE_LAT, lon=BASE_LON, gps_accuracy_m=8)
    assert res["decision"] == "new" and res["ticket_code"] == "SS-0001" and res["status"] == "received"
    inc = client.get("/incidents/1").json()
    assert "Amalapuram" in inc["address"]
    assert inc["photo_url"].startswith("/uploads/reports/")
    assert any("SS-0001" in m for m in outbox_for(client, P1))


def test_same_photo_nearby_is_merged(client, post_report):
    post_report(make_photo(1), phone=P1, lat=BASE_LAT, lon=BASE_LON, gps_accuracy_m=8)
    lat, lon = offset(BASE_LAT, BASE_LON, north_m=30)
    res = post_report(make_photo(1, resized=True), phone=P2, lat=lat, lon=lon, gps_accuracy_m=10)
    assert res["decision"] == "merge" and res["ticket_code"] == "SS-0001" and res["report_count"] == 2
    assert any("2 people reported" in m for m in outbox_for(client, P2))


def test_different_photo_nearby_goes_to_review(client, post_report):
    post_report(make_photo(1), phone=P1, lat=BASE_LAT, lon=BASE_LON, gps_accuracy_m=8)
    lat, lon = offset(BASE_LAT, BASE_LON, east_m=40)
    res = post_report(make_photo(2), phone=P2, lat=lat, lon=lon, gps_accuracy_m=8)
    assert res["decision"] == "review" and res["ticket_code"] == "SS-0002"
    inc = client.get("/incidents/2").json()
    assert inc["needs_review"] and inc["possible_duplicate_of"] == 1


def test_same_photo_far_away_is_flagged_as_forwarded(client, post_report):
    post_report(make_photo(1), phone=P1, lat=BASE_LAT, lon=BASE_LON)
    lat, lon = offset(BASE_LAT, BASE_LON, north_m=5000)
    res = post_report(make_photo(1, resized=True), phone=P2, lat=lat, lon=lon)
    assert res["decision"] == "suspicious" and res["status"] == "review"
    assert "forwarded" in client.get("/incidents/2").json()["review_reason"]


def test_far_apart_same_category_creates_separate_tickets(client, post_report):
    post_report(make_photo(1), phone=P1, lat=BASE_LAT, lon=BASE_LON)
    lat, lon = offset(BASE_LAT, BASE_LON, north_m=800)
    assert post_report(make_photo(2), phone=P2, lat=lat, lon=lon)["decision"] == "new"


def test_fake_gps_and_bad_signature_are_suspicious(client, post_report):
    res = post_report(make_photo(3), phone=P1, lat=BASE_LAT, lon=BASE_LON, is_mocked=True)
    assert res["decision"] == "suspicious"
    lat, lon = offset(BASE_LAT, BASE_LON, north_m=2000)
    res = post_report(make_photo(4), phone=P2, lat=lat, lon=lon, captured_at="2026-11-16T10:00:00+05:30",
                      signature="0" * 64)
    assert res["decision"] == "suspicious"
    assert client.get(f"/incidents/{res['incident_id']}").json()["reports"][0]["integrity"] == "failed"


def test_valid_signature_is_verified(client, post_report):
    photo, captured = make_photo(5), "2026-11-16T10:00:00+05:30"
    sig = imaging.sign(imaging.signature_payload(imaging.sha256_hex(photo), BASE_LAT, BASE_LON, captured))
    res = post_report(photo, phone=P1, lat=BASE_LAT, lon=BASE_LON, captured_at=captured, signature=sig)
    assert res["decision"] == "new"
    assert client.get("/incidents/1").json()["reports"][0]["integrity"] == "verified"


# SMS, mesh and voice ----------------------------------------------------------------------
def test_coded_sms_near_photo_ticket_merges(client, post_report):
    post_report(make_photo(1), phone=P1, lat=BASE_LAT, lon=BASE_LON, gps_accuracy_m=8)
    lat, lon = offset(BASE_LAT, BASE_LON, north_m=20)
    body = sms.encode_coded(category="ELEC-POLE", lat=lat, lon=lon, report_id="AB12CD34", severity=4,
                            people=3, accuracy_m=15, hhmm="0930")
    res = client.post("/sms/inbound", json={"from": P2, "message": body}).json()
    assert res["type"] == "coded_report" and res["decision"] == "merge" and res["ticket_code"] == "SS-0001"


def test_sms_first_then_photo_later_counts_once(client, post_report):
    body = sms.encode_coded(category="TREE", lat=BASE_LAT, lon=BASE_LON, report_id="ZZ99YY88")
    first = client.post("/sms/inbound", data={"from": P1, "message": body}).json()
    assert first["decision"] == "new"
    later = post_report(make_photo(7), client_report_id="zz99yy88", phone=P1, lat=BASE_LAT, lon=BASE_LON,
                        category="TREE")
    assert later["decision"] == "photo_attached" and later["report_count"] == 1
    assert client.get("/incidents/1").json()["photo_url"]
    again = post_report(make_photo(7), client_report_id="ZZ99YY88", phone=P1, lat=BASE_LAT, lon=BASE_LON)
    assert again["decision"] == "duplicate_submission"


def test_mesh_relay_batch(client):
    lat, lon = offset(BASE_LAT, BASE_LON, east_m=300)
    msgs = [
        sms.encode_coded(category="FLOOD", lat=lat, lon=lon, report_id="MESH0001", phone=P2, people=6),
        sms.encode_coded(category="TRAPPED", lat=lat, lon=lon, report_id="MESH0002", phone=P3, sos=True,
                         people=4, battery_pct=22),
        "hello this is not coded",
    ]
    res = client.post("/mesh/relay", json={"relayed_by": P1, "messages": msgs}).json()
    assert res["processed"] == 3
    ok = [r for r in res["results"] if r["ok"]]
    assert len(ok) == 2 and not res["results"][2]["ok"]
    assert outbox_for(client, P3) and "SOS received" in outbox_for(client, P3)[0]
    sos = client.get(f"/incidents/{ok[1]['incident_id']}").json()
    assert sos["is_sos"] and sos["reports"][0]["relayed_by"] == P1 and sos["reports"][0]["battery_pct"] == 22


def test_telugu_voice_report_is_classified_and_located(client):
    res = client.post("/voice/transcript",
                      json={"phone": P1, "text": "అమలాపురం దగ్గర కరెంటు స్తంభం పడిపోయింది, తీగలు రోడ్డు మీద ఉన్నాయి"}).json()
    assert res["type"] == "text_report" and res["status"] == "received"
    inc = client.get(f"/incidents/{res['incident_id']}").json()
    assert inc["category"] == "ELEC" and inc["department"] == "electricity"
    assert inc["reports"][0]["location_source"] == "text"


def test_text_without_location_asks_for_village_then_updates(client):
    res = client.post("/sms/inbound", json={"from": P1, "message": "Big tree fell on our street, road blocked"}).json()
    assert res["status"] == "review"
    assert "village name" in outbox_for(client, P1)[0]
    res2 = client.post("/sms/inbound", json={"from": P1, "message": "Kakinada"}).json()
    assert res2["type"] == "location_update" and res2["place"] == "Kakinada"
    inc = client.get("/incidents/1").json()
    assert inc["status"] == "received" and inc["lat"] is not None


# SOS ---------------------------------------------------------------------------------------
def test_sos_is_never_merged_but_grouped_and_on_top(client, post_report):
    post_report(make_photo(1), phone=P1, lat=BASE_LAT, lon=BASE_LON, people_count=50)
    a = client.post("/sos", json={"phone": P2, "lat": BASE_LAT, "lon": BASE_LON, "sos_type": "TRAPPED",
                                  "people_count": 3}).json()
    lat, lon = offset(BASE_LAT, BASE_LON, north_m=20)
    b = client.post("/sos", json={"phone": P3, "lat": lat, "lon": lon, "sos_type": "MEDICAL",
                                  "medical_notes": "Pregnant, 8 months"}).json()
    assert a["incident_id"] != b["incident_id"] and b["decision"] == "sos_area"
    sos_b = client.get(f"/incidents/{b['incident_id']}").json()
    assert sos_b["sos_area_id"] == a["incident_id"] and sos_b["department"] == "health" and sos_b["vulnerable"]
    queue = client.get("/incidents").json()["items"]
    assert queue[0]["is_sos"] and queue[1]["is_sos"] and not queue[2]["is_sos"]


# Ticket lifecycle --------------------------------------------------------------------------
def test_full_lifecycle_with_escalation_by_sms(client, post_report):
    post_report(make_photo(1), phone=P1, lat=BASE_LAT, lon=BASE_LON)
    lat, lon = offset(BASE_LAT, BASE_LON, north_m=10)
    post_report(make_photo(1, resized=True), phone=P2, lat=lat, lon=lon)

    for status in ("assigned", "in_progress"):
        assert client.post("/incidents/1/status", data={"status": status, "actor": "AE Amalapuram"}).status_code == 200
    r = client.post("/incidents/1/status", data={"status": "resolved", "actor": "Lineman Ravi"},
                    files={"proof": ("fix.jpg", make_photo(9), "image/jpeg")})
    assert r.json()["resolution_photo_url"]
    assert any("Reply 'SS-0001 1'" in m for m in outbox_for(client, P2))  # both reporters are told

    res = client.post("/sms/inbound", json={"from": P2, "message": "SS-0001 2"}).json()
    assert res["status"] == "escalated"
    assert client.get("/incidents/1").json()["escalation_level"] == 1

    client.post("/incidents/1/status", data={"status": "resolved"})
    res = client.post("/sms/inbound", json={"from": P1, "message": "ss-1 అవును"}).json()
    assert res["status"] == "closed"
    timeline = client.get("/incidents/1").json()["timeline"]
    assert [e["status"] for e in timeline][-1] == "closed"


def test_invalid_transition_and_stranger_confirmation_are_refused(client, post_report):
    post_report(make_photo(1), phone=P1, lat=BASE_LAT, lon=BASE_LON)
    assert client.post("/incidents/1/status", data={"status": "closed"}).status_code == 409
    client.post("/incidents/1/status", data={"status": "resolved"})
    r = client.post("/incidents/1/confirm", json={"fixed": True, "phone": "9999999999"})
    assert r.status_code == 409


def test_official_merges_a_review_ticket(client, post_report):
    post_report(make_photo(1), phone=P1, lat=BASE_LAT, lon=BASE_LON)
    lat, lon = offset(BASE_LAT, BASE_LON, east_m=40)
    post_report(make_photo(2), phone=P2, lat=lat, lon=lon)
    merged = client.post("/incidents/2/merge-into/1", json={"actor": "Control room"}).json()
    assert merged["report_count"] == 2 and len(merged["reports"]) == 2
    assert client.get("/incidents/2").json()["status"] == "merged"
    assert any("Combined with ticket SS-0001" in m for m in outbox_for(client, P2))


def test_public_endpoints_hide_phones_and_sos(client, post_report):
    post_report(make_photo(1), phone=P1, lat=BASE_LAT, lon=BASE_LON)
    client.post("/sos", json={"phone": P2, "lat": BASE_LAT, "lon": BASE_LON})
    public = client.get("/public/incidents").json()
    assert len(public) == 1 and "phone" not in public[0]
    summary = client.get("/public/summary").json()
    assert summary["open_tickets"] == 2 and summary["open_sos"] == 1


def test_bad_image_is_rejected(client):
    r = client.post("/reports", data={"meta": '{"category": "ELEC"}'},
                    files={"photo": ("x.jpg", b"not an image", "image/jpeg")})
    assert r.status_code == 400
