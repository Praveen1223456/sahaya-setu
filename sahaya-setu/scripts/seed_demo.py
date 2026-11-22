"""Fill a running server with demo data for the dashboard team and the judges' demo.

    uvicorn app.main:app --reload          (in one terminal)
    python scripts/seed_demo.py            (in another)
"""
import argparse
import io
import json
import random
import sys
from pathlib import Path

import httpx
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app import imaging, sms  # noqa: E402

STAFF = {"X-Staff-Token": "control-demo"}
CAP_FILE = Path(__file__).resolve().parent.parent / "data" / "sample_cap_alert.xml"
AMALAPURAM = (16.5787, 82.0061)
KAKINADA = (16.9891, 82.2475)


def move(point, north_m=0, east_m=0):
    return point[0] + north_m / 111_320, point[1] + east_m / (111_320 * 0.96)


def photo(seed, label, small=False):
    rnd = random.Random(seed)
    img = Image.new("RGB", (800, 600), (rnd.randint(60, 200), rnd.randint(60, 200), rnd.randint(60, 200)))
    d = ImageDraw.Draw(img)
    for _ in range(10):
        x, y = rnd.randint(0, 700), rnd.randint(0, 500)
        d.rectangle([x, y, x + rnd.randint(40, 220), y + rnd.randint(40, 220)],
                    fill=(rnd.randint(0, 255), rnd.randint(0, 255), rnd.randint(0, 255)))
    d.rectangle([0, 560, 800, 600], fill=(0, 0, 0))
    d.text((10, 570), f"DEMO PHOTO: {label}", fill=(255, 255, 255))
    if small:
        img = img.resize((480, 360))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=60 if small else 88)
    return buf.getvalue()


def report(c, phone, point, category, seed, label, small=False, **extra):
    data = photo(seed, label, small)
    captured = "2026-11-16T09:30:00+05:30"
    sig = imaging.sign(imaging.signature_payload(imaging.sha256_hex(data), point[0], point[1], captured))
    meta = {"phone": phone, "lat": point[0], "lon": point[1], "gps_accuracy_m": 9, "category": category,
            "captured_at": captured, "signature": sig, **extra}
    r = c.post("/reports", data={"meta": json.dumps(meta)}, files={"photo": ("p.jpg", data, "image/jpeg")})
    r.raise_for_status()
    out = r.json()
    print(f"{label:<38} -> {out['ticket_code']}  {out['decision']:<11} {out['detail']}")
    return out


def main(base):
    with httpx.Client(base_url=base, timeout=30) as c:
        c.get("/health").raise_for_status()
        print("Seeding demo data...\n")
        report(c, "9000000001", AMALAPURAM, "ELEC-POLE", 1, "Pole down (citizen 1)", severity=4,
               description="Electric pole fell, live wire on road")
        report(c, "9000000002", move(AMALAPURAM, 30), "ELEC-POLE", 1, "Same pole, re-sent photo (citizen 2)", small=True)
        report(c, "9000000003", move(AMALAPURAM, east_m=45), "ELEC", 2, "Different photo nearby (citizen 3)")
        report(c, "9000000004", move(AMALAPURAM, 6000), "ELEC", 1, "Same photo 6 km away (forwarded)", small=True)
        report(c, "9000000005", move(KAKINADA, 120), "TREE", 11, "Tree blocking road, Kakinada")
        report(c, "9000000006", move(KAKINADA, -400, 250), "FLOOD", 12, "Water entering houses", people_count=12,
               description="Water inside houses, elderly people here")

        coded = sms.encode_coded(category="ELEC-POLE", lat=AMALAPURAM[0] + 0.0001, lon=AMALAPURAM[1],
                                 report_id="DEMO0SMS", severity=4, people=2, accuracy_m=20, hhmm="0935")
        r = c.post("/sms/inbound", json={"from": "9000000007", "message": coded}).json()
        print(f"{'Coded SMS (no internet)':<38} -> {r['ticket_code']}  {r['decision']}")

        r = c.post("/voice/transcript", json={"phone": "9000000008",
                                              "text": "కాకినాడ లో వరద నీరు ఇళ్ళలోకి వస్తోంది, పిల్లలు ఉన్నారు"}).json()
        print(f"{'Telugu voice call':<38} -> {r['ticket_code']}  {r['decision']}")

        mesh = [sms.encode_coded(category="TRAPPED", lat=move(KAKINADA, -380, 260)[0], lon=move(KAKINADA, -380, 260)[1],
                                 report_id="DEMOSOS1", sos=True, people=4, battery_pct=18, phone="9000000009")]
        r = c.post("/mesh/relay", json={"relayed_by": "9000000010", "messages": mesh}).json()
        print(f"{'SOS relayed over Bluetooth mesh':<38} -> {r['results'][0]['ticket_code']}  {r['results'][0]['decision']}")

        r = c.post("/sos", json={"phone": "9000000011", "lat": move(KAKINADA, -390, 255)[0],
                                 "lon": move(KAKINADA, -390, 255)[1], "sos_type": "MEDICAL", "battery_pct": 35,
                                 "medical_notes": "Pregnant, 8 months"}).json()
        print(f"{'SOS medical (same building)':<38} -> {r['ticket_code']}  {r['decision']}")

        c.post("/incidents/1/status", data={"status": "assigned", "actor": "AE Electricity"}, headers=STAFF)
        c.post("/incidents/1/status", data={"status": "in_progress", "actor": "Lineman team"}, headers=STAFF)

        # A fixed ticket with a proof photo, confirmed by the citizen over SMS (for the public board)
        c.post("/incidents/4/status", data={"status": "resolved", "note": "Tree cut and cleared"}, headers=STAFF,
               files={"proof": ("fix.jpg", photo(99, "CLEARED ROAD"), "image/jpeg")})
        c.post("/sms/inbound", json={"from": "+919000000005", "message": "SS-0004 1"})
        print(f"{'Tree ticket fixed and confirmed':<38} -> SS-0004  closed")

        # Early warning from a (demo) CAP alert, and households that need help to evacuate
        r = c.post("/alerts/import-cap", json={"xml": CAP_FILE.read_text(encoding="utf-8")}, headers=STAFF).json()
        print(f"{'CAP warning imported':<38} -> {r['level']} {r['title'][:40]}")
        for phone, name, needs, size in [("9000000021", "Lakshmi", ["elderly", "bedridden"], 3),
                                         ("9000000022", "Ramya", ["pregnant"], 4), ("9000000023", "Suresh", ["dialysis"], 2)]:
            c.post("/citizens/register", json={"phone": phone, "name": name, "village": "Amalapuram", "needs": needs,
                                               "household_size": size, "consent": True,
                                               "lat": AMALAPURAM[0] + random.uniform(-.02, .02), "lon": AMALAPURAM[1] + random.uniform(-.02, .02)})
        print(f"{'Vulnerable households registered':<38} -> 3")

        print("\nQueue (most urgent first):")
        for i in c.get("/incidents", headers=STAFF).json()["items"]:
            tag = "SOS " if i["is_sos"] else ""
            print(f"  {i['ticket_code']}  {tag}{i['category']:<9} {i['status']:<12} priority {i['priority']:>6}  "
                  f"reports {i['report_count']}  {i['address'] or ''}")
        print(f"\nOpen {base}/ for the apps. Demo staff tokens: control-demo, elec-demo, health-demo, rescue-demo, roads-demo, transport-demo")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000")
    main(ap.parse_args().base)
