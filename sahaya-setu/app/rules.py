"""Business rules: what goes to which department, how urgent it is, and deadlines.

Edit these tables to match your district's real departments and response times.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Optional

DEPARTMENTS = {
    "electricity": "Electricity",
    "health": "Health (108 / PHC)",
    "transport": "Transport (RTC buses)",
    "rescue": "Rescue (SDRF / Fire)",
    "roads": "Roads & drainage",
}

# code: (department, base severity 1-5, hours allowed before escalation)
CATEGORIES: dict[str, tuple[str, int, int]] = {
    "ELEC": ("electricity", 3, 12),
    "TREE": ("roads", 2, 24),
    "ROAD": ("roads", 2, 24),
    "FLOOD": ("rescue", 4, 3),
    "HOUSE": ("rescue", 3, 6),
    "HEALTH": ("health", 4, 2),
    "TRANSPORT": ("transport", 3, 4),
    "OTHER": ("rescue", 1, 24),
}

SOS_TYPES = {"TRAPPED": "rescue", "MEDICAL": "health", "FLOODING": "rescue", "FIRE": "rescue", "OTHER": "rescue"}
SOS_SLA_HOURS = 1

# English and Telugu keywords used for SMS and voice reports (photos are classified on the phone).
KEYWORDS: dict[str, list[str]] = {
    "HEALTH": ["injur", "bleeding", "fever", "ambulance", "hospital", "doctor", "snake", "unconscious",
               "గాయ", "జ్వరం", "అంబులెన్స్", "ఆసుపత్రి", "డాక్టర్", "పాము", "స్పృహ"],
    "FLOOD": ["flood", "water entering", "water inside", "inundat", "submerged",
              "వరద", "నీరు", "నీళ్ళు", "మునిగ"],
    "ELEC": ["current", "electric", "power", "pole", "wire", "transformer", "shock",
             "కరెంటు", "కరెంట్", "విద్యుత్", "స్తంభం", "తీగ", "వైరు", "ట్రాన్స్‌ఫార్మర్"],
    "HOUSE": ["house collapsed", "wall collapsed", "roof", "hut", "ఇల్లు", "గోడ", "పైకప్పు", "గుడిసె"],
    "TRANSPORT": ["bus", "stranded", "evacuat", "vehicle", "బస్సు", "తరలింపు"],
    "TREE": ["tree", "branch", "చెట్టు", "చెట్లు", "కొమ్మ"],
    "ROAD": ["road", "bridge", "culvert", "pothole", "రోడ్డు", "రహదారి", "వంతెన"],
}
VULNERABLE_WORDS = ["pregnant", "elderly", "old man", "old woman", "old age", "child", "baby", "infant",
                    "disabled", "wheelchair", "dialysis", "bedridden", "injur", "trapped",
                    "గర్భిణి", "వృద్ధ", "ముసలి", "పిల్ల", "పసి", "వికలాంగ", "గాయ", "చిక్కుకు"]
DANGER_WORDS = ["live wire", "shock", "fire", "collapsed", "drowning", "trapped", "unconscious", "bleeding",
                "షాక్", "మంటలు", "కూలి", "మునిగి", "చిక్కుకు"]


def classify_text(text: Optional[str]) -> dict:
    """Keyword classifier for text reports. Returns category, vulnerability and a severity boost."""
    t = (text or "").lower()
    scores = {cat: sum(1 for w in words if w in t) for cat, words in KEYWORDS.items()}
    best = max(scores, key=lambda c: scores[c])  # dict order breaks ties (most urgent first)
    category = best if scores[best] > 0 else "OTHER"
    return {
        "category": category,
        "vulnerable": any(w in t for w in VULNERABLE_WORDS),
        "severity_boost": 1 if any(w in t for w in DANGER_WORDS) else 0,
    }


def sla_hours(category: str, is_sos: bool) -> int:
    if is_sos:
        return SOS_SLA_HOURS
    return CATEGORIES.get(category, CATEGORIES["OTHER"])[2]


def sla_due(category: str, is_sos: bool, start: datetime) -> datetime:
    return start + timedelta(hours=sla_hours(category, is_sos))


def is_overdue(incident, now: datetime) -> bool:
    from .models import ACTIVE_STATUSES

    return bool(incident.sla_due_at and incident.status in ACTIVE_STATUSES and now > incident.sla_due_at)


def priority_score(incident, now: datetime) -> float:
    """Higher = handle first. Life-threatening first, then by impact and waiting time."""
    score = incident.severity * 10
    if incident.is_sos:
        score += 60
    if incident.vulnerable:
        score += 15
    score += min(incident.people_count or 0, 20) * 2
    score += 8 * math.log2(max(incident.report_count or 1, 1))
    waited_h = max((now - incident.created_at).total_seconds() / 3600, 0) if incident.created_at else 0
    score += min(waited_h, 24)
    if is_overdue(incident, now):
        score += 20
    score += 10 * (incident.escalation_level or 0)
    return round(score, 1)
