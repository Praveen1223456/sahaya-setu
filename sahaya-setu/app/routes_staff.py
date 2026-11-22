"""Endpoints for the control room, department dashboards and field teams. Login required."""
from __future__ import annotations

from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import alerts, services, sitrep, sms
from .auth import Staff, check_access, control_staff, current_staff
from .db import get_db
from .models import ACTIVE_STATUSES, Alert, Incident, OutboxMessage, utcnow
from .routes_citizen import get_incident, read_photo
from .schemas import ActorIn, AlertIn, CapIn
from .views import alert_out, citizen_out, incident_out, iso

router = APIRouter(tags=["officials"])


@router.get("/auth/me")
def me(staff: Staff = Depends(current_staff)):
    return {"name": staff.name, "department": staff.department, "role": staff.role}


@router.get("/incidents", summary="Queue, most urgent first (departments only see their own)")
def list_incidents(department: Optional[str] = None,
                   status: Optional[str] = Query(None, description="Comma-separated, e.g. received,assigned"),
                   sos: Optional[bool] = None, needs_review: Optional[bool] = None,
                   open_only: bool = True, limit: int = Query(300, le=1000),
                   staff: Staff = Depends(current_staff), db: Session = Depends(get_db)):
    q = select(Incident)
    if not staff.is_control:
        department = staff.department
    if department:
        q = q.where(Incident.department == department)
    if status:
        q = q.where(Incident.status.in_([s.strip() for s in status.split(",") if s.strip()]))
    elif open_only:
        q = q.where(Incident.status.in_(ACTIVE_STATUSES + ("resolved",)))
    if sos is not None:
        q = q.where(Incident.is_sos.is_(sos))
    if needs_review is not None:
        q = q.where(Incident.needs_review.is_(needs_review))
    now = utcnow()
    items = sorted((incident_out(i, now) for i in db.scalars(q)), key=lambda d: d["priority"], reverse=True)
    return {"count": len(items[:limit]), "items": items[:limit], "server_time": iso(now)}


@router.get("/incidents/{incident_id}")
def get_one(incident_id: int, staff: Staff = Depends(current_staff), db: Session = Depends(get_db)):
    inc = get_incident(db, incident_id)
    check_access(staff, inc)
    return incident_out(inc, detail=True)


@router.post("/incidents/{incident_id}/status", summary="Assign / on the way / fixed (with proof photo) / reject")
async def update_status(incident_id: int, status: str = Form(...), note: Optional[str] = Form(None),
                        actor: Optional[str] = Form(None), proof: Optional[UploadFile] = File(None),
                        staff: Staff = Depends(current_staff), db: Session = Depends(get_db)):
    inc = get_incident(db, incident_id)
    check_access(staff, inc)
    if status == "rejected" and not staff.is_control:
        raise HTTPException(403, "Only the control room can reject a report")
    who = f"{actor} ({staff.name})" if actor and actor != staff.name else staff.name
    inc = services.change_status(db, inc, status, actor=who[:40], note=note, proof_photo=await read_photo(proof))
    return incident_out(inc, detail=True)


@router.post("/incidents/{incident_id}/merge-into/{target_id}", summary="Confirm a possible duplicate")
def merge(incident_id: int, target_id: int, body: Optional[ActorIn] = None,
          staff: Staff = Depends(control_staff), db: Session = Depends(get_db)):
    target = services.merge_incidents(db, get_incident(db, incident_id), get_incident(db, target_id), staff.name)
    return incident_out(target, detail=True)


@router.post("/admin/run-escalations", summary="Escalate tickets past their deadline")
def escalations(staff: Staff = Depends(control_staff), db: Session = Depends(get_db)):
    return {"escalated": services.run_escalations(db)}


@router.get("/outbox", summary="SMS log (in demo mode this is where 'sent' SMS appear)")
def outbox(phone: Optional[str] = None, limit: int = Query(50, le=500),
           staff: Staff = Depends(control_staff), db: Session = Depends(get_db)):
    q = select(OutboxMessage).order_by(OutboxMessage.id.desc()).limit(limit)
    if phone:
        q = q.where(OutboxMessage.to_phone == sms.normalize_phone(phone))
    return [{"id": m.id, "to": m.to_phone, "body": m.body, "incident_id": m.incident_id,
             "delivered": m.delivered, "at": iso(m.created_at)} for m in db.scalars(q)]


@router.get("/sitrep", summary="Situation report for the Collector (Claude-written if a key is set)")
def get_sitrep(staff: Staff = Depends(control_staff), db: Session = Depends(get_db)):
    return sitrep.generate(db)


# Early warnings ----------------------------------------------------------------------------
@router.get("/alerts", summary="All alerts, newest first")
def list_alerts(staff: Staff = Depends(current_staff), db: Session = Depends(get_db)):
    return [alert_out(a) for a in db.scalars(select(Alert).order_by(Alert.id.desc()))]


@router.post("/alerts", summary="Send a warning to citizens in an area")
def create_alert(body: AlertIn, staff: Staff = Depends(control_staff), db: Session = Depends(get_db)):
    data = body.model_dump()
    hours = data.pop("expires_in_hours")
    alert = Alert(**data, source="manual", created_by=staff.name,
                  expires_at=utcnow() + timedelta(hours=hours) if hours else None)
    db.add(alert)
    db.commit()
    return alert_out(alert)


@router.post("/alerts/import-cap", summary="Import a CAP 1.2 alert (the format NDMA SACHET uses)")
async def import_cap(request: Request, staff: Staff = Depends(control_staff), db: Session = Depends(get_db)):
    if "json" in request.headers.get("content-type", ""):
        xml = CapIn.model_validate(await request.json()).xml
    else:
        xml = (await request.body()).decode("utf-8", errors="replace")
    try:
        alert, created = alerts.import_cap(db, xml, staff.name)
    except alerts.CapError as exc:
        raise HTTPException(400, str(exc))
    return {"created": created, **alert_out(alert)}


@router.post("/alerts/{alert_id}/end", summary="Stop showing an alert")
def end_alert(alert_id: int, staff: Staff = Depends(control_staff), db: Session = Depends(get_db)):
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(404, "Alert not found")
    alert.active = False
    db.commit()
    return alert_out(alert)


@router.get("/citizens/vulnerable", summary="Registered people who need help to evacuate, inside an area")
def vulnerable(alert_id: Optional[int] = None, lat: Optional[float] = None, lon: Optional[float] = None,
               radius_km: Optional[float] = None, staff: Staff = Depends(current_staff),
               db: Session = Depends(get_db)):
    if not (staff.is_control or staff.department in ("rescue", "health", "transport")):
        raise HTTPException(403, "Only control room, rescue, health and transport can see this list")
    if alert_id:
        alert = db.get(Alert, alert_id)
        if not alert:
            raise HTTPException(404, "Alert not found")
        lat, lon, radius_km = alert.center_lat, alert.center_lon, alert.radius_km
    people = alerts.vulnerable_in_area(db, lat, lon, radius_km)
    needs = {}
    for c in people:
        for n in c.needs:
            needs[n] = needs.get(n, 0) + 1
    return {"count": len(people), "people_in_households": sum(c.household_size for c in people),
            "by_need": needs, "people": [citizen_out(c) for c in people]}


@router.get("/shelters/all", summary="All shelters (for the dashboard map)")
def shelters_all(staff: Staff = Depends(current_staff)):
    return alerts.all_shelters()
