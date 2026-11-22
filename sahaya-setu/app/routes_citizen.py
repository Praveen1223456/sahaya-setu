"""Endpoints used by the citizen app, the SMS gateway and the voice line. No login needed."""
from __future__ import annotations

import json
import re
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import ai, alerts, config, geo, rules, services, sms
from .db import get_db
from .models import Incident, Report
from .schemas import CitizenIn, ConfirmIn, MeshRelayIn, ReportMeta, SOSIn, SOSUpdateIn, VoiceIn
from .views import alert_out, citizen_ticket_out, result_out

router = APIRouter(tags=["citizen"])
MAX_PHOTO_BYTES = 15 * 1024 * 1024


async def read_photo(photo: Optional[UploadFile]) -> Optional[bytes]:
    if not photo:
        return None
    data = await photo.read()
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(413, "Photo is larger than 15 MB")
    return data or None


def get_incident(db: Session, incident_id: int) -> Incident:
    inc = db.get(Incident, incident_id)
    if not inc:
        raise HTTPException(404, f"Ticket {incident_id} not found")
    return inc


@router.get("/app/config", summary="Settings the citizen app caches for offline use")
def app_config():
    return {
        "version": "0.2.0",
        "signing_secret": config.APP_SIGNING_SECRET,  # prototype only, see README
        "sms_number": config.SMS_INBOUND_NUMBER,
        "categories": {k: {"department": v[0], "severity": v[1]} for k, v in rules.CATEGORIES.items()},
        "sos_types": list(rules.SOS_TYPES),
        "departments": rules.DEPARTMENTS,
        "ai_photo_check": ai.enabled(),
    }


@router.get("/geo/places", summary="Village list for offline addresses on the phone")
def places():
    return [{"name": p["name"], "name_te": p.get("name_te"), "district": p["district"],
             "lat": p["lat"], "lon": p["lon"]} for p in geo._places()]


@router.get("/geo/reverse", summary="Address for the photo stamp")
def reverse(lat: float, lon: float):
    return {"address": geo.reverse_geocode(lat, lon)}


@router.post("/ai/classify-photo", summary="Suggest category from a photo (needs ANTHROPIC_API_KEY)")
async def classify(photo: UploadFile = File(...)):
    data = await read_photo(photo)
    if not data:
        raise HTTPException(400, "Empty photo")
    return {"suggestion": ai.classify_photo(data), "ai_enabled": ai.enabled()}


@router.post("/reports", summary="App or mesh report with a live photo")
async def create_report(meta: str = Form(..., description="ReportMeta as a JSON string"),
                        photo: Optional[UploadFile] = File(None), db: Session = Depends(get_db)):
    try:
        m = ReportMeta.model_validate_json(meta)
    except ValidationError as exc:
        raise HTTPException(422, json.loads(exc.json()))
    return result_out(services.submit_report(db, m.model_dump(), await read_photo(photo), channel=m.channel))


@router.post("/sos", summary="Emergency SOS (never merged, always top priority)")
def create_sos(body: SOSIn, db: Session = Depends(get_db)):
    channel = "mesh" if body.relayed_by else "app"
    return result_out(services.submit_report(db, body.model_dump(), None, channel=channel, is_sos=True))


@router.post("/sos/update", summary="Repeat ping from an active SOS: new location and battery")
def update_sos(body: SOSUpdateIn, db: Session = Depends(get_db)):
    inc = services.sos_update(db, body.client_report_id, body.lat, body.lon, body.gps_accuracy_m, body.battery_pct)
    return {"ticket_code": inc.ticket_code, "status": inc.status,
            "acknowledged": inc.status not in ("received", "review")}


def handle_text(db: Session, phone: Optional[str], text: str, channel: str, location: Optional[dict] = None) -> dict:
    phone = sms.normalize_phone(phone)
    # 1. "SS-0012 1" style reply to a "fixed?" message
    reply = sms.parse_confirmation(text)
    if reply and not text.strip().upper().startswith(("SS|", "SOS|")):
        ticket_id, fixed = reply
        inc = db.get(Incident, ticket_id)
        if not inc:
            sms.send(db, phone, f"Sahaya Setu: ticket SS-{ticket_id:04d} not found.")
            db.commit()
            return {"type": "confirmation", "ok": False, "detail": "ticket not found"}
        try:
            services.citizen_confirm(db, inc, fixed, phone)
        except services.WorkflowError as exc:
            sms.send(db, phone, f"Sahaya Setu {inc.ticket_code}: {exc}", inc.id)
            db.commit()
            return {"type": "confirmation", "ok": False, "detail": str(exc)}
        return {"type": "confirmation", "ok": True, "ticket_code": inc.ticket_code, "status": inc.status}

    # 2. Coded report from the app's SMS fallback
    coded = sms.parse_coded(text)
    if coded:
        coded["phone"] = coded.get("phone") or phone
        res = services.submit_report(db, coded, None, channel=channel, is_sos=coded["is_sos"])
        return {"type": "coded_report", **result_out(res)}

    # 3. Reply with a village name after we asked for one
    if phone:
        pending = db.scalar(select(Report).where(Report.phone == phone, Report.location_source == "none")
                            .order_by(Report.id.desc()))
        place = geo.find_place_in_text(text)
        if pending and place and pending.incident and pending.incident.status == "review":
            inc = pending.incident
            pending.lat = inc.lat = place["lat"]
            pending.lon = inc.lon = place["lon"]
            pending.gps_accuracy_m = inc.gps_accuracy_m = config.TEXT_PLACE_ACCURACY_M
            pending.location_source = "text"
            pending.address = inc.address = f"Approximate: {place['name']}, {place['district']} district"
            inc.needs_review, inc.review_reason, inc.status = False, None, "received"
            services._log(db, inc, "received", f"Citizen sent village name: {place['name']}")
            sms.send(db, phone, sms.render("received", inc), inc.id)
            db.commit()
            return {"type": "location_update", "ticket_code": inc.ticket_code, "place": place["name"]}

    # 4. Plain text report (Telugu or English)
    res = services.submit_report(db, {"phone": phone, "description": text, **(location or {})}, None, channel=channel)
    return {"type": "text_report", **result_out(res)}


@router.post("/sms/inbound", summary="Webhook for the SMS gateway (JSON or form)")
async def sms_inbound(request: Request, db: Session = Depends(get_db)):
    if "application/json" in request.headers.get("content-type", ""):
        data = await request.json()
    else:
        data = dict(await request.form())
    phone = next((str(data[k]) for k in ("from", "phone", "sender", "number") if data.get(k)), None)
    text = next((str(data[k]) for k in ("message", "body", "text", "content") if data.get(k)), "")
    if not text.strip():
        raise HTTPException(400, "Empty message")
    return handle_text(db, phone, text.strip(), "sms")


@router.post("/mesh/relay", summary="Upload coded reports collected from phones without signal")
def mesh_relay(body: MeshRelayIn, db: Session = Depends(get_db)):
    results = []
    for message in body.messages:
        coded = sms.parse_coded(message)
        if not coded:
            results.append({"message": message[:40], "ok": False, "detail": "Not a Sahaya Setu coded message"})
            continue
        coded["relayed_by"] = body.relayed_by
        res = services.submit_report(db, coded, None, channel="mesh", is_sos=coded["is_sos"])
        results.append({"ok": True, **result_out(res)})
    return {"processed": len(results), "results": results}


@router.post("/voice/transcript", summary="Text from the Telugu voice line or the app's Speak button")
def voice_transcript(body: VoiceIn, db: Session = Depends(get_db)):
    location = None
    if body.lat is not None and body.lon is not None:
        location = {"lat": body.lat, "lon": body.lon, "gps_accuracy_m": body.gps_accuracy_m}
    return handle_text(db, body.phone, body.text, "voice", location)


@router.get("/track/{code}", summary="Citizen view of a ticket (works with SS-0012 or 12)")
def track(code: str, db: Session = Depends(get_db)):
    m = re.fullmatch(r"(?i)\s*(?:SS-?)?0*(\d+)\s*", code)
    if not m:
        raise HTTPException(400, "Use a ticket code like SS-0012")
    inc = get_incident(db, int(m.group(1)))
    return citizen_ticket_out(inc)


@router.post("/incidents/{incident_id}/confirm", summary="Citizen says fixed / not fixed (also works by SMS)")
def confirm(incident_id: int, body: ConfirmIn, db: Session = Depends(get_db)):
    inc = services.citizen_confirm(db, get_incident(db, incident_id), body.fixed, body.phone)
    return citizen_ticket_out(inc)


@router.post("/citizens/register", summary="Register a household before a cyclone (elderly, pregnant...)")
def register(body: CitizenIn, db: Session = Depends(get_db)):
    if not body.consent:
        raise HTTPException(400, "Consent is needed to share these details with officials")
    c = services.register_citizen(db, body.model_dump())
    return {"ok": True, "id": c.id, "village": c.village, "located": c.lat is not None}


@router.get("/alerts/active", summary="Warnings for this location, with nearest shelters")
def active(lat: Optional[float] = None, lon: Optional[float] = None, db: Session = Depends(get_db)):
    return [alert_out(a, lat, lon) for a in alerts.active_alerts(db, lat, lon)]


@router.get("/shelters", summary="Nearest cyclone shelters")
def shelters(lat: float, lon: float, limit: int = 3):
    return alerts.nearest_shelters(lat, lon, min(max(limit, 1), 20))
