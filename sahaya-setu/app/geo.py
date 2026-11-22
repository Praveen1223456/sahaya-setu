"""Distances and addresses. Everything here works without internet by default."""
from __future__ import annotations

import csv
import logging
import math
from functools import lru_cache
from typing import Optional

from . import config

log = logging.getLogger(__name__)
EARTH_RADIUS_M = 6_371_000


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def bounding_box(lat: float, lon: float, radius_m: float) -> tuple[float, float, float, float]:
    """Cheap pre-filter for SQL before the exact distance check."""
    dlat = math.degrees(radius_m / EARTH_RADIUS_M)
    dlon = math.degrees(radius_m / (EARTH_RADIUS_M * max(math.cos(math.radians(lat)), 0.01)))
    return lat - dlat, lat + dlat, lon - dlon, lon + dlon


@lru_cache(maxsize=1)
def _places() -> list[dict]:
    """Load the place list. Columns: name, name_te, district, lat, lon."""
    path = config.PLACES_CSV
    if not path.exists():
        log.warning("Places file %s not found; offline addresses disabled", path)
        return []
    with path.open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        r["lat"], r["lon"] = float(r["lat"]), float(r["lon"])
    return rows


def nearest_place(lat: float, lon: float) -> Optional[tuple[dict, float]]:
    best = None
    for p in _places():
        d = haversine_m(lat, lon, p["lat"], p["lon"])
        if best is None or d < best[1]:
            best = (p, d)
    return best


def offline_address(lat: float, lon: float) -> Optional[str]:
    found = nearest_place(lat, lon)
    if not found:
        return None
    place, dist = found
    where = "At" if dist < 1500 else f"{dist / 1000:.1f} km from"
    return f"{where} {place['name']}, {place['district']} district"


def find_place_in_text(text: str) -> Optional[dict]:
    """Find a known village/town name (English or Telugu) inside free text."""
    if not text:
        return None
    lowered = text.lower()
    for p in _places():
        names = [p["name"].lower()] + [n for n in (p.get("name_te") or "").split(";") if n]
        if any(n and n in lowered for n in names):
            return p
    return None


def reverse_geocode(lat: float, lon: float) -> Optional[str]:
    if config.GEOCODER == "nominatim":
        try:
            import httpx

            r = httpx.get(
                config.NOMINATIM_URL,
                params={"lat": lat, "lon": lon, "format": "jsonv2", "accept-language": "en"},
                headers={"User-Agent": "sahaya-setu-prototype/0.1"},
                timeout=4,
            )
            r.raise_for_status()
            name = r.json().get("display_name")
            if name:
                return name[:300]
        except Exception as exc:  # network down is normal during a cyclone
            log.info("Online geocoding failed (%s); using offline list", exc)
    return offline_address(lat, lon)
