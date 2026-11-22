"""Simple token logins for officials. Each token belongs to the control room or one department.

Send the token as the `X-Staff-Token` header (or `Authorization: Bearer <token>`).
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional

from fastapi import Depends, Header, HTTPException

from . import config

DEMO_TOKENS = {
    "control-demo": {"name": "District control room", "department": "*", "role": "control"},
    "elec-demo": {"name": "Electricity section", "department": "electricity", "role": "department"},
    "health-demo": {"name": "Health / 108", "department": "health", "role": "department"},
    "transport-demo": {"name": "RTC depot", "department": "transport", "role": "department"},
    "rescue-demo": {"name": "SDRF / Fire", "department": "rescue", "role": "department"},
    "roads-demo": {"name": "Roads & drainage", "department": "roads", "role": "department"},
}


@dataclass(frozen=True)
class Staff:
    token: str
    name: str
    department: str
    role: str

    @property
    def is_control(self) -> bool:
        return self.role == "control"

    def can_access(self, incident) -> bool:
        return self.is_control or self.department in ("*", incident.department)


@lru_cache(maxsize=1)
def _tokens() -> dict:
    return json.loads(config.STAFF_TOKENS_JSON) if config.STAFF_TOKENS_JSON else DEMO_TOKENS


def current_staff(x_staff_token: Optional[str] = Header(None),
                  authorization: Optional[str] = Header(None)) -> Staff:
    token = x_staff_token or (authorization[7:] if authorization and authorization.lower().startswith("bearer ") else None)
    info = _tokens().get(token or "")
    if not info:
        raise HTTPException(401, "Sign in with a valid staff token")
    return Staff(token=token, name=info["name"], department=info.get("department", "*"),
                 role=info.get("role", "department"))


def control_staff(staff: Staff = Depends(current_staff)) -> Staff:
    if not staff.is_control:
        raise HTTPException(403, "Only the control room can do this")
    return staff


def check_access(staff: Staff, incident) -> None:
    if not staff.can_access(incident):
        raise HTTPException(403, f"{incident.ticket_code} belongs to another department")
