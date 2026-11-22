"""Public transparency data: what was reported, who is handling it, how fast it gets fixed.

No phone numbers, no SOS calls, and locations are rounded to about 100 m.
"""
from __future__ import annotations

from collections import Counter, defaultdict

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import rules
from .db import get_db
from .models import ACTIVE_STATUSES, Incident, utcnow
from .views import iso, upload_url

router = APIRouter(prefix="/public", tags=["public"])
HIDDEN = ("merged", "rejected")


def _visible(db: Session):
    return [i for i in db.scalars(select(Incident).where(Incident.is_sos.is_(False))) if i.status not in HIDDEN]


@router.get("/incidents", summary="Map data")
def public_incidents(db: Session = Depends(get_db)):
    return [{
        "ticket_code": i.ticket_code, "category": i.category,
        "department": rules.DEPARTMENTS.get(i.department, i.department), "status": i.status,
        "lat": round(i.lat, 3) if i.lat is not None else None,
        "lon": round(i.lon, 3) if i.lon is not None else None,
        "report_count": i.report_count, "reported_at": iso(i.created_at),
        "fixed_at": iso(i.resolved_at), "proof_photo_url": upload_url(i.resolution_photo_path),
    } for i in _visible(db)]


@router.get("/summary", summary="Counts and average fix time per department")
def public_summary(db: Session = Depends(get_db)):
    incidents = [i for i in db.scalars(select(Incident)) if i.status != "merged"]
    by_status = Counter(i.status for i in incidents)
    per_dept = defaultdict(lambda: {"open": 0, "fixed": 0, "fix_hours": []})
    for i in incidents:
        d = per_dept[rules.DEPARTMENTS.get(i.department, i.department)]
        if i.status in ACTIVE_STATUSES:
            d["open"] += 1
        if i.resolved_at:
            d["fixed"] += 1
            d["fix_hours"].append((i.resolved_at - i.created_at).total_seconds() / 3600)
    departments = {
        name: {"open": d["open"], "fixed": d["fixed"],
               "avg_fix_hours": round(sum(d["fix_hours"]) / len(d["fix_hours"]), 1) if d["fix_hours"] else None}
        for name, d in sorted(per_dept.items())
    }
    return {
        "generated_at": iso(utcnow()),
        "open_tickets": sum(by_status[s] for s in ACTIVE_STATUSES),
        "open_sos": sum(1 for i in incidents if i.is_sos and i.status in ACTIVE_STATUSES),
        "fixed": sum(1 for i in incidents if i.resolved_at),
        "reports_received": sum(i.report_count for i in incidents),
        "by_status": dict(by_status),
        "by_department": departments,
    }


@router.get("/fixes", summary="Recently fixed problems with the field team's proof photo")
def recent_fixes(limit: int = Query(12, le=50), db: Session = Depends(get_db)):
    fixed = sorted((i for i in _visible(db) if i.resolved_at), key=lambda i: i.resolved_at, reverse=True)
    return [{
        "ticket_code": i.ticket_code, "category": i.category,
        "department": rules.DEPARTMENTS.get(i.department, i.department), "status": i.status,
        "address": i.address, "report_count": i.report_count,
        "hours_to_fix": round((i.resolved_at - i.created_at).total_seconds() / 3600, 1),
        "before_photo_url": upload_url(i.best_photo_path), "proof_photo_url": upload_url(i.resolution_photo_path),
        "confirmed_by_citizen": i.status == "closed",
    } for i in fixed[:limit]]
