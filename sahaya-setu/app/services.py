"""The main workflow. Every channel (app, SMS, mesh, voice, SOS) ends up in submit_report()."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import config, dedup, geo, imaging, rules, sms
from .models import ACTIVE_STATUSES, Incident, Report, StatusEvent, utcnow


class WorkflowError(ValueError):
    """A request that breaks the ticket rules (shown to the caller as HTTP 400/409)."""


@dataclass
class SubmitResult:
    report: Report
    incident: Incident
    decision: str
    detail: str


def _parse_time(value) -> Optional[datetime]:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        try:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            return None
    if dt.tzinfo:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _log(db: Session, inc: Incident, status: str, note: str, actor: str = "system") -> None:
    db.add(StatusEvent(incident=inc, status=status, note=note[:500], actor=actor))


def _refresh_priority(inc: Incident) -> None:
    inc.priority = rules.priority_score(inc, utcnow())


def _attach_photo(report: Report, photo: bytes, meta: dict) -> None:
    img = imaging.load_image(photo)
    report.photo_sha256 = imaging.sha256_hex(photo)
    report.photo_path = imaging.save_image(img, "reports")
    report.phash = imaging.phash_hex(img)
    report.sharpness = imaging.sharpness(img)
    report.embedding = imaging.embedding(img)
    signature, captured = meta.get("signature"), meta.get("captured_at")
    if signature and report.lat is not None and captured:
        ok = imaging.verify_signature(report.photo_sha256, report.lat, report.lon, str(captured), signature)
        report.integrity = "verified" if ok else "failed"


def _maybe_best_photo(inc: Incident, report: Report) -> None:
    if report.photo_path and (inc.best_photo_sharpness is None or (report.sharpness or 0) >= inc.best_photo_sharpness):
        inc.best_photo_path = report.photo_path
        inc.best_photo_sharpness = report.sharpness


def submit_report(db: Session, meta: dict, photo: Optional[bytes] = None, *, channel: str = "app",
                  is_sos: bool = False) -> SubmitResult:
    try:
        return _submit_report(db, meta, photo, channel=channel, is_sos=is_sos)
    except IntegrityError:
        # The same report arrived twice at the same moment (app retry + background sync): count it once.
        db.rollback()
        cid = (meta.get("client_report_id") or "").strip().upper() or None
        existing = db.scalar(select(Report).where(Report.client_report_id == cid)) if cid else None
        if not existing:
            raise
        return SubmitResult(existing, existing.incident, "duplicate_submission", "This report was already received")


def _submit_report(db: Session, meta: dict, photo: Optional[bytes], *, channel: str, is_sos: bool) -> SubmitResult:
    now = utcnow()
    cid = (meta.get("client_report_id") or "").strip().upper() or None

    # 1. Same report already arrived through another channel? Count it once.
    if cid:
        existing = db.scalar(select(Report).where(Report.client_report_id == cid))
        if existing:
            inc = existing.incident
            if photo and not existing.photo_path:
                _attach_photo(existing, photo, meta)
                _maybe_best_photo(inc, existing)
                _log(db, inc, inc.status, f"Photo for report #{existing.id} arrived later via {channel}")
                db.commit()
                return SubmitResult(existing, inc, "photo_attached", "Photo added to the earlier SMS/mesh report")
            return SubmitResult(existing, inc, "duplicate_submission", "This report was already received")

    # 2. Work out what the problem is.
    text = meta.get("description") or ""
    found = rules.classify_text(text)
    if is_sos:
        category = (meta.get("sos_type") or "OTHER").upper()
        if category not in rules.SOS_TYPES:
            category = "OTHER"
        department, severity = rules.SOS_TYPES[category], 5
        people = max(int(meta.get("people_count") or 1), 1)
    else:
        raw = (meta.get("category") or "").upper()
        category, _, subtype_from_code = raw.partition("-")
        if category not in rules.CATEGORIES:
            category, subtype_from_code = found["category"], ""
        department, base_severity, _ = rules.CATEGORIES[category]
        severity = min(5, int(meta.get("severity") or base_severity) + found["severity_boost"])
        people = int(meta.get("people_count") or 0)

    report = Report(
        client_report_id=cid,
        channel=channel,
        phone=sms.normalize_phone(meta.get("phone")),
        relayed_by=sms.normalize_phone(meta.get("relayed_by")),
        lat=meta.get("lat"),
        lon=meta.get("lon"),
        gps_accuracy_m=meta.get("gps_accuracy_m"),
        captured_at=_parse_time(meta.get("captured_at_dt") or meta.get("captured_at")),
        received_at=now,
        address=meta.get("address"),
        category=category,
        subtype=(meta.get("subtype") or (None if is_sos else subtype_from_code) or None),
        severity=severity,
        people_count=people,
        description=text or meta.get("medical_notes"),
        battery_pct=meta.get("battery_pct"),
        is_sos=is_sos,
        is_mocked=bool(meta.get("is_mocked")),
    )

    # 3. Location: GPS first, else a village name found in the text.
    if report.lat is None or report.lon is None:
        report.lat = report.lon = None
        place = geo.find_place_in_text(text)
        if place:
            report.lat, report.lon = place["lat"], place["lon"]
            report.gps_accuracy_m = config.TEXT_PLACE_ACCURACY_M
            report.location_source = "text"
            report.address = report.address or f"Approximate: {place['name']}, {place['district']} district"
        else:
            report.location_source = "none"
    if report.lat is not None and not report.address:
        report.address = geo.reverse_geocode(report.lat, report.lon)

    # 4. Photo fingerprints and tamper check.
    if photo:
        _attach_photo(report, photo, meta)

    # 5. Decide: new ticket, merge, review, suspicious or SOS area.
    decision = dedup.decide(db, report)
    problems = []
    if report.is_mocked:
        problems.append("Fake GPS app detected on the phone")
    if report.integrity == "failed":
        problems.append("Photo or location was changed after capture")
    if config.REQUIRE_SIGNATURE and photo and report.integrity != "verified":
        problems.append("Photo is not signed by the app")
    if problems and decision.action != "suspicious":
        linked = decision.incident_id if decision.action in ("merge", "review") else None
        decision = dedup.Decision("suspicious", linked, "; ".join(problems))

    report.dedup_decision, report.dedup_detail = decision.action, decision.reason[:300]

    if decision.action == "merge":
        inc = db.get(Incident, decision.incident_id)
        report.incident = inc
        db.add(report)
        inc.report_count += 1
        inc.people_count = max(inc.people_count, report.people_count)
        inc.severity = max(inc.severity, report.severity)
        inc.vulnerable = inc.vulnerable or found["vulnerable"]
        if report.gps_accuracy_m is not None and (inc.gps_accuracy_m is None or report.gps_accuracy_m < inc.gps_accuracy_m):
            inc.lat, inc.lon, inc.gps_accuracy_m = report.lat, report.lon, report.gps_accuracy_m
        _maybe_best_photo(inc, report)
        _log(db, inc, inc.status, f"Duplicate merged via {channel} ({decision.reason}); {inc.report_count} reports")
        _refresh_priority(inc)
        db.flush()
        sms.send(db, report.phone, sms.render("merged", inc), inc.id)
    else:
        flagged = decision.action in ("review", "suspicious") or (report.location_source == "none" and not is_sos)
        inc = Incident(
            category=category,
            department=department,
            status="review" if flagged else "received",
            lat=report.lat,
            lon=report.lon,
            gps_accuracy_m=report.gps_accuracy_m,
            address=report.address,
            is_sos=is_sos,
            severity=severity,
            vulnerable=found["vulnerable"] or bool(meta.get("medical_notes")),
            people_count=people,
            report_count=1,
            created_at=now,
            sla_due_at=rules.sla_due(category, is_sos, now),
        )
        if decision.action in ("review", "suspicious"):
            inc.needs_review, inc.review_reason = True, decision.reason[:300]
            inc.possible_duplicate_of = decision.incident_id
        elif report.location_source == "none":
            inc.needs_review = True
            inc.review_reason = "No location. Call back or wait for the village name."
        if decision.action == "sos_area":
            inc.sos_area_id = decision.incident_id
        report.incident = inc
        db.add_all([inc, report])
        _maybe_best_photo(inc, report)
        db.flush()  # gives the incident its ID / ticket code
        if is_sos and inc.sos_area_id is None:
            inc.sos_area_id = inc.id
        _log(db, inc, inc.status, f"Report received via {channel}. {decision.reason}")
        _refresh_priority(inc)
        if is_sos:
            key = "sos"
        elif report.location_source == "none":
            key = "ask_location"
        elif flagged:
            key = "review"
        else:
            key = "received"
        sms.send(db, report.phone, sms.render(key, inc), inc.id)

    db.commit()
    return SubmitResult(report, inc, decision.action, decision.reason)


# Ticket lifecycle -------------------------------------------------------------------------
TRANSITIONS = {
    "review": {"received", "assigned", "rejected"},
    "received": {"assigned", "in_progress", "resolved", "rejected"},
    "assigned": {"in_progress", "resolved", "received"},
    "in_progress": {"resolved", "assigned"},
    "escalated": {"assigned", "in_progress", "resolved"},
    "resolved": {"closed", "escalated"},
}
STATUS_MESSAGES = {s: s for s in ("received", "assigned", "in_progress", "resolved", "rejected", "closed", "escalated")}


def change_status(db: Session, inc: Incident, new_status: str, *, actor: str = "official",
                  note: Optional[str] = None, proof_photo: Optional[bytes] = None) -> Incident:
    allowed = TRANSITIONS.get(inc.status, set())
    if new_status not in allowed:
        raise WorkflowError(f"Cannot move {inc.ticket_code} from '{inc.status}' to '{new_status}'. "
                            f"Allowed: {sorted(allowed) or 'none (ticket is finished)'}")
    now = utcnow()
    if new_status == "resolved":
        inc.resolved_at = now
        if proof_photo:
            inc.resolution_photo_path = imaging.save_image(imaging.load_image(proof_photo), "resolutions")
    if new_status in ("received", "assigned"):
        inc.needs_review = False
    if new_status in ("rejected", "closed"):
        inc.closed_at = now
    if new_status == "escalated":
        inc.escalation_level += 1
    inc.status = new_status
    _log(db, inc, new_status, note or f"Status changed to {new_status}", actor)
    _refresh_priority(inc)
    sms.notify_reporters(db, inc, sms.render(STATUS_MESSAGES[new_status], inc))
    db.commit()
    return inc


def citizen_confirm(db: Session, inc: Incident, fixed: bool, phone: Optional[str] = None) -> Incident:
    if inc.status != "resolved":
        raise WorkflowError(f"{inc.ticket_code} is '{inc.status}', not waiting for confirmation")
    phone = sms.normalize_phone(phone)
    if phone and phone not in {r.phone for r in inc.reports}:
        raise WorkflowError("Only people who reported this problem can confirm it")
    now = utcnow()
    if fixed:
        inc.status, inc.closed_at = "closed", now
        _log(db, inc, "closed", f"Citizen {phone or ''} confirmed the fix".strip(), "citizen")
        sms.notify_reporters(db, inc, sms.render("closed", inc))
    else:
        inc.status = "escalated"
        inc.escalation_level += 1
        inc.resolved_at = None
        inc.sla_due_at = now + timedelta(hours=max(1, rules.sla_hours(inc.category, inc.is_sos) / 2))
        _log(db, inc, "escalated", f"Citizen {phone or ''} said NOT fixed; escalation level {inc.escalation_level}", "citizen")
        sms.notify_reporters(db, inc, sms.render("escalated", inc))
    _refresh_priority(inc)
    db.commit()
    return inc


def merge_incidents(db: Session, source: Incident, target: Incident, actor: str = "official") -> Incident:
    if source.id == target.id:
        raise WorkflowError("Cannot merge a ticket into itself")
    if source.is_sos or target.is_sos:
        raise WorkflowError("SOS tickets are never merged; each person is counted separately")
    if source.status not in ACTIVE_STATUSES or target.status not in ACTIVE_STATUSES:
        raise WorkflowError("Both tickets must be open to merge")
    for r in list(source.reports):
        r.incident = target
        r.dedup_decision, r.dedup_detail = "merge", f"Merged by {actor} from {source.ticket_code}"
    target.report_count += source.report_count
    target.people_count = max(target.people_count, source.people_count)
    target.severity = max(target.severity, source.severity)
    target.vulnerable = target.vulnerable or source.vulnerable
    if source.best_photo_sharpness and (target.best_photo_sharpness or 0) < source.best_photo_sharpness:
        target.best_photo_path, target.best_photo_sharpness = source.best_photo_path, source.best_photo_sharpness
    source.status, source.merged_into, source.needs_review = "merged", target.id, False
    source.closed_at = utcnow()
    _log(db, source, "merged", f"Merged into {target.ticket_code}", actor)
    _log(db, target, target.status, f"{source.ticket_code} merged in; {target.report_count} reports", actor)
    _refresh_priority(target)
    db.flush()
    sms.notify_reporters(db, target, sms.render("merged_by_official", target, old=source.ticket_code))
    db.commit()
    return target


def run_escalations(db: Session) -> list[str]:
    """Call every few minutes (cron). Overdue tickets go up one escalation level."""
    now = utcnow()
    escalated = []
    for inc in db.scalars(select(Incident).where(Incident.status.in_(ACTIVE_STATUSES))):
        if rules.is_overdue(inc, now):
            inc.escalation_level += 1
            inc.sla_due_at = now + timedelta(hours=max(1, rules.sla_hours(inc.category, inc.is_sos) / 2))
            _log(db, inc, inc.status, f"Deadline missed; escalation level {inc.escalation_level}")
            _refresh_priority(inc)
            escalated.append(inc.ticket_code)
    db.commit()
    return escalated


# SOS location pings and pre-registration ----------------------------------------------------
def sos_update(db: Session, client_report_id: str, lat=None, lon=None, accuracy=None, battery=None) -> Incident:
    report = db.scalar(select(Report).where(Report.client_report_id == client_report_id.strip().upper()))
    if not report or not report.is_sos:
        raise WorkflowError("No SOS found with that ID")
    inc = report.incident
    parts = []
    if lat is not None and lon is not None:
        report.lat, report.lon, report.gps_accuracy_m = lat, lon, accuracy
        report.location_source = "gps"
        inc.lat, inc.lon, inc.gps_accuracy_m = lat, lon, accuracy
        parts.append(f"location {lat:.5f},{lon:.5f}" + (f" ±{accuracy:.0f} m" if accuracy is not None else ""))
    if battery is not None:
        report.battery_pct = battery
        parts.append(f"battery {battery}%")
    _log(db, inc, inc.status, "SOS update: " + (", ".join(parts) or "still waiting"))
    _refresh_priority(inc)
    db.commit()
    return inc


def register_citizen(db: Session, data: dict):
    from .models import Citizen

    phone = sms.normalize_phone(data["phone"])
    if not phone:
        raise WorkflowError("A valid phone number is needed")
    data = {**data, "family_contacts": [p for p in map(sms.normalize_phone, data.get("family_contacts") or []) if p]}
    citizen = db.scalar(select(Citizen).where(Citizen.phone == phone))
    if citizen is None:
        citizen = Citizen(phone=phone)
        db.add(citizen)
    for key in ("name", "village", "lat", "lon", "household_size", "needs", "medical_notes",
                "family_contacts", "consent"):
        setattr(citizen, key, data.get(key))
    if citizen.lat is None and citizen.village:
        place = geo.find_place_in_text(citizen.village)
        if place:
            citizen.lat, citizen.lon = place["lat"], place["lon"]
    db.commit()
    return citizen
