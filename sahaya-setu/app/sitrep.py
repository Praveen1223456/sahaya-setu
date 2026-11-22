"""Situation report for the District Collector, generated from live ticket data."""
from __future__ import annotations

from collections import defaultdict
from datetime import timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import ai, alerts, rules
from .models import ACTIVE_STATUSES, Incident, utcnow

IST = timezone(timedelta(hours=5, minutes=30))


def build_facts(db: Session) -> dict:
    now = utcnow()
    incidents = [i for i in db.scalars(select(Incident)) if i.status != "merged"]
    open_ = [i for i in incidents if i.status in ACTIVE_STATUSES]
    since = now - timedelta(hours=24)
    dept = defaultdict(lambda: {"open": 0, "overdue": 0, "fixed_24h": 0, "fix_hours": []})
    for i in incidents:
        d = dept[rules.DEPARTMENTS.get(i.department, i.department)]
        if i.status in ACTIVE_STATUSES:
            d["open"] += 1
            d["overdue"] += int(rules.is_overdue(i, now))
        if i.resolved_at:
            d["fix_hours"].append((i.resolved_at - i.created_at).total_seconds() / 3600)
            if i.resolved_at >= since:
                d["fixed_24h"] += 1
    by_department = {
        k: {"open": v["open"], "overdue": v["overdue"], "fixed_last_24h": v["fixed_24h"],
            "avg_fix_hours": round(sum(v["fix_hours"]) / len(v["fix_hours"]), 1) if v["fix_hours"] else None}
        for k, v in sorted(dept.items())
    }
    urgent = sorted(open_, key=lambda i: rules.priority_score(i, now), reverse=True)[:5]
    live_alerts = alerts.active_alerts(db)
    vulnerable = sum(
        len(alerts.vulnerable_in_area(db, a.center_lat, a.center_lon, a.radius_km)) for a in live_alerts
    ) if live_alerts else 0
    return {
        "time_ist": now.replace(tzinfo=timezone.utc).astimezone(IST).strftime("%d %b %Y, %H:%M IST"),
        "open_tickets": len(open_),
        "open_sos": sum(1 for i in open_ if i.is_sos),
        "sos_people": sum(i.people_count for i in open_ if i.is_sos),
        "needs_review": sum(1 for i in open_ if i.needs_review),
        "overdue": sum(1 for i in open_ if rules.is_overdue(i, now)),
        "reports_received": sum(i.report_count for i in incidents),
        "duplicates_merged": sum(max(i.report_count - 1, 0) for i in incidents),
        "by_department": by_department,
        "most_urgent": [
            {"ticket": i.ticket_code, "what": ("SOS " if i.is_sos else "") + i.category, "where": i.address,
             "people": i.people_count, "status": i.status, "overdue": rules.is_overdue(i, now)}
            for i in urgent
        ],
        "active_alerts": [{"level": a.level, "title": a.title, "area": a.area_name} for a in live_alerts],
        "vulnerable_people_in_alert_areas": vulnerable,
    }


def rule_text(f: dict) -> str:
    lines = [f"Situation report, {f['time_ist']}", ""]
    lines.append(f"Open tickets: {f['open_tickets']} (SOS {f['open_sos']} covering {f['sos_people']} people; "
                 f"waiting for review {f['needs_review']}; past deadline {f['overdue']}).")
    lines.append(f"Reports received: {f['reports_received']}, of which {f['duplicates_merged']} were duplicates merged automatically.")
    if f["active_alerts"]:
        names = "; ".join(f"{a['level'].upper()} {a['title']}" for a in f["active_alerts"])
        lines.append(f"Active alerts: {names}. Registered vulnerable people inside alert areas: "
                     f"{f['vulnerable_people_in_alert_areas']}.")
    lines += ["", "By department:"]
    for name, d in f["by_department"].items():
        avg = f", average fix {d['avg_fix_hours']} h" if d["avg_fix_hours"] is not None else ""
        lines.append(f"  {name}: {d['open']} open, {d['overdue']} past deadline, "
                     f"{d['fixed_last_24h']} fixed in 24 h{avg}.")
    if f["most_urgent"]:
        lines += ["", "Most urgent now:"]
        for u in f["most_urgent"]:
            late = ", PAST DEADLINE" if u["overdue"] else ""
            lines.append(f"  {u['ticket']} {u['what']} at {u['where'] or 'unknown location'}, "
                         f"{u['people']} people, {u['status']}{late}.")
    return "\n".join(lines)


def generate(db: Session) -> dict:
    facts = build_facts(db)
    text = ai.write_sitrep(facts) if ai.enabled() else None
    return {"facts": facts, "text": text or rule_text(facts), "written_by": "claude" if text else "rules"}
