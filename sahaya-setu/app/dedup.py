"""Decides what to do with each new report.

Actions:
  new        -> open a new ticket
  merge      -> same problem as an open ticket; add this report to it
  review     -> probably the same problem, but an official should confirm
  suspicious -> same photo seen far away (forwarded/fake), fake GPS, or tampered photo
  sos_area   -> an SOS near another recent SOS; kept separate (each person counts) but grouped

Rules for normal reports (checked against open tickets, nearest first):
  1. Same category and close enough (radius grows with poor GPS accuracy, up to a cap).
  2. Same photo (perceptual hash) or same scene (CLIP, if enabled) -> merge.
  3. One side has no photo (SMS/voice) and very close -> merge.
  4. Both have photos that look different -> review (could be two different poles).
SOS reports are never merged into anything.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import config, geo, imaging
from .models import ACTIVE_STATUSES, Incident, Report, utcnow


@dataclass
class Decision:
    action: str
    incident_id: Optional[int] = None
    reason: str = ""
    distance_m: Optional[float] = None


def _forwarded_photo(db: Session, report: Report) -> Optional[Decision]:
    """Same photo already reported from a far-away place = likely forwarded or fake."""
    if not report.phash or report.lat is None:
        return None
    since = utcnow() - timedelta(days=7)
    rows = db.scalars(
        select(Report).where(Report.phash.is_not(None), Report.received_at >= since, Report.lat.is_not(None))
    )
    for other in rows:
        if imaging.phash_distance(report.phash, other.phash) > config.PHASH_MAX_DISTANCE:
            continue
        dist = geo.haversine_m(report.lat, report.lon, other.lat, other.lon)
        if dist >= config.FORWARDED_PHOTO_MIN_KM * 1000:
            return Decision(
                "suspicious",
                other.incident_id,
                f"Same photo was already reported {dist / 1000:.1f} km away (possibly forwarded)",
                dist,
            )
    return None


def _sos_area(db: Session, report: Report) -> Decision:
    if report.lat is None:
        return Decision("new", reason="SOS without GPS location")
    since = utcnow() - timedelta(hours=config.SOS_AREA_WINDOW_HOURS)
    lat0, lat1, lon0, lon1 = geo.bounding_box(report.lat, report.lon, config.SOS_AREA_RADIUS_M)
    rows = db.scalars(
        select(Incident).where(
            Incident.is_sos.is_(True),
            Incident.created_at >= since,
            Incident.lat.between(lat0, lat1),
            Incident.lon.between(lon0, lon1),
        ).order_by(Incident.id)
    )
    for inc in rows:
        dist = geo.haversine_m(report.lat, report.lon, inc.lat, inc.lon)
        if dist <= config.SOS_AREA_RADIUS_M:
            area = inc.sos_area_id or inc.id
            return Decision("sos_area", area, f"Another SOS {dist:.0f} m away; grouped as one area", dist)
    return Decision("new", reason="New SOS")


def _photo_fingerprints(inc: Incident) -> tuple[list[str], list[list[float]]]:
    hashes = [r.phash for r in inc.reports if r.phash]
    embeds = [r.embedding for r in inc.reports if r.embedding]
    return hashes, embeds


def decide(db: Session, report: Report) -> Decision:
    forwarded = _forwarded_photo(db, report)
    if forwarded:
        return forwarded

    if report.is_sos:
        return _sos_area(db, report)

    if report.lat is None:
        return Decision("new", reason="No location, cannot check for duplicates")

    lat0, lat1, lon0, lon1 = geo.bounding_box(report.lat, report.lon, config.DUP_RADIUS_MAX_M)
    candidates = db.scalars(
        select(Incident).where(
            Incident.status.in_(ACTIVE_STATUSES),
            Incident.is_sos.is_(False),
            Incident.category == report.category,
            Incident.lat.between(lat0, lat1),
            Incident.lon.between(lon0, lon1),
        )
    ).all()
    scored = sorted(
        ((geo.haversine_m(report.lat, report.lon, c.lat, c.lon), c) for c in candidates),
        key=lambda pair: pair[0],
    )

    review: Optional[Decision] = None
    for dist, inc in scored:
        accuracy_sum = (report.gps_accuracy_m or 0) + (inc.gps_accuracy_m or 0)
        radius = min(config.DUP_RADIUS_MAX_M, max(config.DUP_RADIUS_M, accuracy_sum))
        if dist > radius:
            continue

        hashes, embeds = _photo_fingerprints(inc)
        if report.phash and any(
            imaging.phash_distance(report.phash, h) <= config.PHASH_MAX_DISTANCE for h in hashes
        ):
            return Decision("merge", inc.id, f"Same photo, {dist:.0f} m apart", dist)
        if report.embedding and embeds:
            best = max(imaging.cosine(report.embedding, e) for e in embeds)
            if best >= config.CLIP_MIN_SIMILARITY:
                return Decision("merge", inc.id, f"Same scene (similarity {best:.2f}), {dist:.0f} m apart", dist)

        no_photo_to_compare = not report.phash or not hashes
        if no_photo_to_compare and dist <= config.DUP_RADIUS_TEXT_ONLY_M:
            return Decision("merge", inc.id, f"Same problem type {dist:.0f} m away (no photo to compare)", dist)

        if review is None:
            review = Decision(
                "review", inc.id, f"Same problem type {dist:.0f} m away but photos differ; please confirm", dist
            )

    return review or Decision("new", reason="No open ticket nearby")
