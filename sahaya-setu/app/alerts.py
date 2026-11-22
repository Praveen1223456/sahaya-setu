"""Early warnings ("red alert before anything happens") and cyclone shelters.

India's official alerts (NDMA SACHET) use the Common Alerting Protocol (CAP 1.2). import_cap() reads a CAP
XML message so the same alert the government sends can appear in the app with the nearest shelter.
"""
from __future__ import annotations

import csv
import math
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from functools import lru_cache
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import config, geo
from .models import Alert, Citizen, utcnow

CAP_LEVEL = {"extreme": "red", "severe": "orange", "moderate": "yellow", "minor": "yellow"}


class CapError(ValueError):
    pass


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _child(el, name):
    return next((c for c in el if _local(c.tag) == name), None)


def _children(el, name):
    return [c for c in el if _local(c.tag) == name]


def _text(el, name) -> Optional[str]:
    c = _child(el, name)
    return c.text.strip() if c is not None and c.text else None


def _parse_time(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt.astimezone(timezone.utc).replace(tzinfo=None) if dt.tzinfo else dt


def _area_geometry(area) -> tuple[Optional[float], Optional[float], Optional[float]]:
    circle = _text(area, "circle")
    if circle:  # "lat,lon radius_km"
        point, radius = circle.split()
        lat, lon = (float(x) for x in point.split(","))
        return lat, lon, float(radius)
    polygon = _text(area, "polygon")
    if polygon:  # "lat,lon lat,lon ..." -> centre and the radius that covers every corner
        pts = [tuple(float(x) for x in p.split(",")) for p in polygon.split()]
        lat = sum(p[0] for p in pts) / len(pts)
        lon = sum(p[1] for p in pts) / len(pts)
        radius = max(geo.haversine_m(lat, lon, p[0], p[1]) for p in pts) / 1000
        return lat, lon, round(radius, 1)
    return None, None, None


def parse_cap(xml_text: str) -> dict:
    try:
        root = ET.fromstring(xml_text.encode("utf-8") if isinstance(xml_text, str) else xml_text)
    except ET.ParseError as exc:
        raise CapError(f"Not valid XML: {exc}") from exc
    if _local(root.tag) != "alert":
        raise CapError("Not a CAP <alert> message")
    infos = _children(root, "info")
    if not infos:
        raise CapError("CAP message has no <info> block")
    english = next((i for i in infos if (_text(i, "language") or "en").lower().startswith("en")), infos[0])
    telugu = next((i for i in infos if (_text(i, "language") or "").lower().startswith("te")), None)

    def message(info):
        parts = [_text(info, "description"), _text(info, "instruction")]
        return "\n\n".join(p for p in parts if p) or _text(info, "headline") or ""

    area = _child(english, "area")
    lat, lon, radius = _area_geometry(area) if area is not None else (None, None, None)
    return {
        "cap_identifier": _text(root, "identifier"),
        "status": (_text(root, "status") or "Actual"),
        "level": CAP_LEVEL.get((_text(english, "severity") or "").lower(), "orange"),
        "hazard": _text(english, "event") or "Alert",
        "title": _text(english, "headline") or _text(english, "event") or "Alert",
        "message": message(english),
        "message_te": message(telugu) if telugu is not None else None,
        "area_name": _text(area, "areaDesc") if area is not None else None,
        "center_lat": lat,
        "center_lon": lon,
        "radius_km": radius,
        "expires_at": _parse_time(_text(english, "expires")),
    }


def import_cap(db: Session, xml_text: str, created_by: str) -> tuple[Alert, bool]:
    data = parse_cap(xml_text)
    data.pop("status")
    existing = None
    if data["cap_identifier"]:
        existing = db.scalar(select(Alert).where(Alert.cap_identifier == data["cap_identifier"]))
    if existing:
        for k, v in data.items():
            setattr(existing, k, v)
        db.commit()
        return existing, False
    alert = Alert(source="cap", created_by=created_by, **data)
    db.add(alert)
    db.commit()
    return alert, True


def is_live(alert: Alert, now: datetime) -> bool:
    return alert.active and (alert.expires_at is None or alert.expires_at > now)


def covers(alert: Alert, lat: Optional[float], lon: Optional[float]) -> bool:
    if alert.center_lat is None or alert.radius_km is None:
        return True  # whole-state alert
    if lat is None or lon is None:
        return True  # unknown location: show it rather than hide it
    return geo.haversine_m(lat, lon, alert.center_lat, alert.center_lon) <= alert.radius_km * 1000


def active_alerts(db: Session, lat: Optional[float] = None, lon: Optional[float] = None) -> list[Alert]:
    now = utcnow()
    order = {"red": 0, "orange": 1, "yellow": 2}
    rows = [a for a in db.scalars(select(Alert).where(Alert.active.is_(True))) if is_live(a, now) and covers(a, lat, lon)]
    return sorted(rows, key=lambda a: (order.get(a.level, 3), -a.id))


@lru_cache(maxsize=1)
def _shelters() -> list[dict]:
    path = config.SHELTERS_CSV
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        r["lat"], r["lon"], r["capacity"] = float(r["lat"]), float(r["lon"]), int(r["capacity"])
    return rows


def nearest_shelters(lat: float, lon: float, limit: int = 3) -> list[dict]:
    ranked = sorted(_shelters(), key=lambda s: geo.haversine_m(lat, lon, s["lat"], s["lon"]))
    return [{**s, "distance_km": round(geo.haversine_m(lat, lon, s["lat"], s["lon"]) / 1000, 1)} for s in ranked[:limit]]


def all_shelters() -> list[dict]:
    return list(_shelters())


def vulnerable_in_area(db: Session, lat: Optional[float], lon: Optional[float], radius_km: Optional[float]) -> list[Citizen]:
    people = [c for c in db.scalars(select(Citizen).where(Citizen.consent.is_(True))) if c.needs]
    if lat is None or lon is None or radius_km is None:
        return people
    return [c for c in people if c.lat is not None and geo.haversine_m(lat, lon, c.lat, c.lon) <= radius_km * 1000]


def bearing_label(lat1, lon1, lat2, lon2) -> str:
    """Rough direction for 'Shelter 1.2 km north-east'."""
    angle = (math.degrees(math.atan2(lon2 - lon1, lat2 - lat1)) + 360) % 360
    names = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"]
    return names[int((angle + 22.5) // 45) % 8]
