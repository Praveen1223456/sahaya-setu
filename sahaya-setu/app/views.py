"""How objects are turned into JSON for each audience (officials, citizens, public)."""
from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

from . import alerts as alerts_mod
from . import rules
from .models import Alert, Citizen, Incident, Report, utcnow


def iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() + "Z" if dt else None


def mask_phone(phone: Optional[str]) -> Optional[str]:
    return phone and ("*" * max(len(phone) - 4, 0) + phone[-4:])


def hide_numbers(text: Optional[str]) -> Optional[str]:
    """Remove phone numbers from notes before showing them to the public."""
    return re.sub(r"\d{6,}", lambda m: mask_phone(m.group(0)), text) if text else text


def upload_url(path: Optional[str]) -> Optional[str]:
    return f"/uploads/{path}" if path else None


def incident_out(inc: Incident, now: Optional[datetime] = None, detail: bool = False) -> dict:
    now = now or utcnow()
    out = {
        "id": inc.id,
        "ticket_code": inc.ticket_code,
        "category": inc.category,
        "department": inc.department,
        "department_name": rules.DEPARTMENTS.get(inc.department, inc.department),
        "status": inc.status,
        "is_sos": inc.is_sos,
        "sos_area_id": inc.sos_area_id,
        "lat": inc.lat,
        "lon": inc.lon,
        "gps_accuracy_m": inc.gps_accuracy_m,
        "address": inc.address,
        "severity": inc.severity,
        "vulnerable": inc.vulnerable,
        "people_count": inc.people_count,
        "report_count": inc.report_count,
        "priority": rules.priority_score(inc, now),
        "escalation_level": inc.escalation_level,
        "overdue": rules.is_overdue(inc, now),
        "needs_review": inc.needs_review,
        "review_reason": inc.review_reason,
        "possible_duplicate_of": inc.possible_duplicate_of,
        "merged_into": inc.merged_into,
        "photo_url": upload_url(inc.best_photo_path),
        "resolution_photo_url": upload_url(inc.resolution_photo_path),
        "created_at": iso(inc.created_at),
        "updated_at": iso(inc.updated_at),
        "sla_due_at": iso(inc.sla_due_at),
        "resolved_at": iso(inc.resolved_at),
        "closed_at": iso(inc.closed_at),
    }
    if inc.is_sos and inc.reports:
        last = inc.reports[-1]
        out["battery_pct"] = last.battery_pct
        out["sos_phone"] = last.phone
        out["medical_notes"] = last.description
    if detail:
        out["reports"] = [report_out(r) for r in inc.reports]
        out["timeline"] = [
            {"status": e.status, "note": e.note, "actor": e.actor, "at": iso(e.created_at)} for e in inc.events
        ]
    return out


def report_out(r: Report) -> dict:
    return {
        "id": r.id,
        "client_report_id": r.client_report_id,
        "channel": r.channel,
        "phone": r.phone,  # officials need it to call back; never shown on public endpoints
        "relayed_by": r.relayed_by,
        "lat": r.lat,
        "lon": r.lon,
        "gps_accuracy_m": r.gps_accuracy_m,
        "location_source": r.location_source,
        "address": r.address,
        "category": r.category,
        "subtype": r.subtype,
        "severity": r.severity,
        "people_count": r.people_count,
        "description": r.description,
        "battery_pct": r.battery_pct,
        "is_mocked": r.is_mocked,
        "integrity": r.integrity,
        "photo_url": upload_url(r.photo_path),
        "dedup_decision": r.dedup_decision,
        "dedup_detail": r.dedup_detail,
        "captured_at": iso(r.captured_at),
        "received_at": iso(r.received_at),
    }


def citizen_ticket_out(inc: Incident) -> dict:
    """What a citizen sees when tracking a ticket: no other people's phone numbers."""
    return {
        "id": inc.id,
        "ticket_code": inc.ticket_code,
        "category": inc.category,
        "is_sos": inc.is_sos,
        "department_name": rules.DEPARTMENTS.get(inc.department, inc.department),
        "status": inc.status,
        "merged_into": inc.merged_into,
        "report_count": inc.report_count,
        "address": inc.address,
        "created_at": iso(inc.created_at),
        "resolved_at": iso(inc.resolved_at),
        "resolution_photo_url": upload_url(inc.resolution_photo_path),
        "waiting_for_confirmation": inc.status == "resolved",
        "timeline": [{"status": e.status, "note": hide_numbers(e.note), "at": iso(e.created_at)} for e in inc.events],
    }


def result_out(res, now: Optional[datetime] = None) -> dict:
    inc = res.incident
    return {
        "decision": res.decision,
        "detail": res.detail,
        "ticket_code": inc.ticket_code,
        "incident_id": inc.id,
        "report_id": res.report.id,
        "status": inc.status,
        "report_count": inc.report_count,
        "priority": rules.priority_score(inc, now or utcnow()),
    }


def alert_out(a: Alert, lat: Optional[float] = None, lon: Optional[float] = None) -> dict:
    out = {
        "id": a.id, "level": a.level, "hazard": a.hazard, "title": a.title, "message": a.message,
        "message_te": a.message_te, "area_name": a.area_name, "center_lat": a.center_lat,
        "center_lon": a.center_lon, "radius_km": a.radius_km, "source": a.source,
        "created_by": a.created_by, "created_at": iso(a.created_at), "expires_at": iso(a.expires_at),
        "active": alerts_mod.is_live(a, utcnow()),
    }
    if lat is not None and lon is not None:
        shelters = alerts_mod.nearest_shelters(lat, lon)
        for s in shelters:
            s["direction"] = alerts_mod.bearing_label(lat, lon, s["lat"], s["lon"])
        out["nearest_shelters"] = shelters
    return out


def citizen_out(c: Citizen, full: bool = True) -> dict:
    out = {"id": c.id, "name": c.name, "village": c.village, "lat": c.lat, "lon": c.lon,
           "household_size": c.household_size, "needs": c.needs or [], "updated_at": iso(c.updated_at)}
    if full:
        out.update({"phone": c.phone, "medical_notes": c.medical_notes, "family_contacts": c.family_contacts or []})
    return out
