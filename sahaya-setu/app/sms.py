"""The tiny message format that works over SMS, Bluetooth mesh, LoRa and satellite.

Normal report:  SS|ELEC-POLE|SEV3|PPL4|16.578700,82.006100|ACC12|1430|ID7F3A9K2Q
SOS:            SOS|TRAPPED|PPL3|16.578700,82.006100|ACC8|BAT41|1432|IDQ2W8E4R1|PH9876543210

Fields after the first two can be in any order:
  SEV<1-5>  severity        PPL<n>  people affected     ACC<m>  GPS accuracy in metres
  BAT<pct>  battery level   HHMM    capture time (IST)   or a 10-digit Unix time
  ID<code>  the report's unique ID (same ID the app uses for the photo upload later)
  PH<num>   reporter's phone (needed over mesh/LoRa, where the sender number is unknown)
  lat,lon   decimal degrees
Citizens reply to a "fixed?" SMS with:  SS-0012 1  (yes)  or  SS-0012 2  (no)
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, time, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from . import config
from .models import Incident, OutboxMessage

log = logging.getLogger(__name__)
IST = timezone(timedelta(hours=5, minutes=30))


def normalize_phone(phone) -> Optional[str]:
    """'+91 90000 00001' and '9000000001' are the same person: keep the last 10 digits for Indian numbers."""
    if not phone:
        return None
    digits = re.sub(r"\D", "", str(phone))
    if len(digits) > 10 and digits.startswith("91"):
        digits = digits[-10:]
    return digits or None


def _hhmm_to_utc(hhmm: str, now: Optional[datetime] = None) -> Optional[datetime]:
    hh, mm = int(hhmm[:2]), int(hhmm[2:])
    if hh > 23 or mm > 59:
        return None
    now_ist = (now or datetime.now(timezone.utc)).astimezone(IST)
    captured = datetime.combine(now_ist.date(), time(hh, mm), tzinfo=IST)
    if captured > now_ist + timedelta(minutes=5):  # time is from yesterday
        captured -= timedelta(days=1)
    return captured.astimezone(timezone.utc).replace(tzinfo=None)


def parse_coded(body: str) -> Optional[dict]:
    parts = [p.strip() for p in (body or "").strip().split("|")]
    if len(parts) < 2 or parts[0].upper() not in ("SS", "SOS"):
        return None
    out: dict = {"is_sos": parts[0].upper() == "SOS", "people_count": 0}
    code = parts[1].upper()
    if out["is_sos"]:
        out["sos_type"] = code
        out["people_count"] = 1
    else:
        category, _, subtype = code.partition("-")
        out["category"], out["subtype"] = category, subtype or None

    for raw in parts[2:]:
        p = raw.upper()
        if p.startswith("SEV") and p[3:].isdigit():
            out["severity"] = max(1, min(5, int(p[3:])))
        elif p.startswith("PPL") and p[3:].isdigit():
            out["people_count"] = int(p[3:])
        elif p.startswith("ACC") and p[3:].isdigit():
            out["gps_accuracy_m"] = float(p[3:])
        elif p.startswith("BAT") and p[3:].isdigit():
            out["battery_pct"] = int(p[3:])
        elif p.startswith("ID") and len(p) > 2:
            out["client_report_id"] = p[2:]
        elif p.startswith("PH") and p[2:].lstrip("+").isdigit():
            out["phone"] = p[2:]
        elif "," in p:
            try:
                lat, lon = (float(x) for x in p.split(",", 1))
                if -90 <= lat <= 90 and -180 <= lon <= 180:
                    out["lat"], out["lon"] = lat, lon
            except ValueError:
                pass
        elif p.isdigit() and len(p) == 4:
            out["captured_at_dt"] = _hhmm_to_utc(p)
        elif p.isdigit() and len(p) >= 9:
            out["captured_at_dt"] = datetime.fromtimestamp(int(p), timezone.utc).replace(tzinfo=None)
    return out


def encode_coded(*, category: str, lat: float, lon: float, report_id: str, severity: int = 3,
                 people: int = 0, accuracy_m: Optional[float] = None, hhmm: Optional[str] = None,
                 sos: bool = False, battery_pct: Optional[int] = None, phone: Optional[str] = None) -> str:
    """Reference encoder. The mobile app should build exactly this string (keep it under 160 chars)."""
    parts = ["SOS" if sos else "SS", category.upper()]
    if not sos:
        parts.append(f"SEV{severity}")
    parts.append(f"PPL{people}")
    parts.append(f"{lat:.6f},{lon:.6f}")
    if accuracy_m is not None:
        parts.append(f"ACC{int(accuracy_m)}")
    if battery_pct is not None:
        parts.append(f"BAT{battery_pct}")
    if hhmm:
        parts.append(hhmm)
    parts.append(f"ID{report_id.upper()}")
    if phone:
        parts.append(f"PH{phone}")
    return "|".join(parts)


def parse_confirmation(body: str) -> Optional[tuple[int, bool]]:
    """'SS-0012 1' -> (12, True). Also accepts yes/no and Telugu అవును / కాదు / లేదు."""
    m = re.search(r"SS-?0*(\d+)", body or "", re.IGNORECASE)
    if not m:
        return None
    rest = body[m.end():].strip(" :-.,").lower()
    if rest.startswith(("1", "yes", "అవును")):
        return int(m.group(1)), True
    if rest.startswith(("2", "no", "కాదు", "లేదు")):
        return int(m.group(1)), False
    return None


# Message templates (English + Telugu). Telugu SMS use more segments; keep them short.
TEMPLATES = {
    "received": "Sahaya Setu {code}: Report received ({dept}). Updates will come by SMS. / మీ ఫిర్యాదు అందింది.",
    "merged": "Sahaya Setu {code}: {n} people reported this same problem. Your report is added. / ఇదే సమస్యపై మీ ఫిర్యాదు జోడించబడింది.",
    "review": "Sahaya Setu {code}: Report received and being verified. / మీ ఫిర్యాదు పరిశీలనలో ఉంది.",
    "sos": "Sahaya Setu {code}: SOS received. Help is being arranged. Stay safe; call 112 if you can. / మీ SOS అందింది. సహాయం ఏర్పాటు చేస్తున్నాం.",
    "ask_location": "Sahaya Setu {code}: We could not find your location. Reply with your village name. / మీ గ్రామం పేరు పంపండి.",
    "assigned": "Sahaya Setu {code}: Assigned to {dept}. / సంబంధిత శాఖకు అప్పగించబడింది.",
    "in_progress": "Sahaya Setu {code}: Team is on the way. / బృందం బయలుదేరింది.",
    "resolved": "Sahaya Setu {code}: Marked as fixed. Is it fixed? Reply '{code} 1' for YES or '{code} 2' for NO. / సమస్య పరిష్కారమైతే 1, కాకపోతే 2 పంపండి.",
    "closed": "Sahaya Setu {code}: Closed. Thank you. / ఫిర్యాదు మూసివేయబడింది. ధన్యవాదాలు.",
    "escalated": "Sahaya Setu {code}: Sent to a senior officer for action. / ఉన్నతాధికారికి పంపబడింది.",
    "rejected": "Sahaya Setu {code}: Closed after verification. For emergencies call 112.",
    "merged_by_official": "Sahaya Setu {old}: Combined with ticket {code}. Updates will come for {code}.",
}


def render(key: str, incident: Incident, **extra) -> str:
    from .rules import DEPARTMENTS

    return TEMPLATES[key].format(
        code=incident.ticket_code,
        dept=DEPARTMENTS.get(incident.department, incident.department),
        n=incident.report_count,
        **extra,
    )


def send(db: Session, to_phone: Optional[str], body: str, incident_id: Optional[int] = None) -> None:
    if not to_phone:
        return
    msg = OutboxMessage(to_phone=to_phone, body=body, incident_id=incident_id)
    db.add(msg)
    if config.SMS_SENDER == "http" and config.SMS_GATEWAY_URL:
        try:
            import httpx

            httpx.post(config.SMS_GATEWAY_URL, json={"to": to_phone, "message": body}, timeout=5).raise_for_status()
            msg.delivered = True
        except Exception as exc:
            log.warning("SMS gateway failed for %s: %s", to_phone, exc)


def notify_reporters(db: Session, incident: Incident, body: str) -> None:
    for phone in sorted({r.phone for r in incident.reports if r.phone}):
        send(db, phone, body, incident.id)
