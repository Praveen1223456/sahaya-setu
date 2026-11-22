"""Request bodies. FastAPI shows these on /docs so the app and dashboard teams know what to send."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class ReportMeta(BaseModel):
    """Sent as the `meta` form field (a JSON string) together with the `photo` file."""

    client_report_id: Optional[str] = Field(None, max_length=64, description="Unique ID made on the phone; reuse it in the SMS copy")
    channel: Literal["app", "mesh"] = "app"
    phone: Optional[str] = Field(None, max_length=20)
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lon: Optional[float] = Field(None, ge=-180, le=180)
    gps_accuracy_m: Optional[float] = Field(None, ge=0)
    captured_at: Optional[str] = Field(None, description="ISO time from the phone, e.g. 2026-11-16T09:30:00+05:30")
    address: Optional[str] = Field(None, max_length=300, description="Address the phone stamped on the photo, if any")
    category: Optional[str] = Field(None, description="ELEC, TREE, ROAD, FLOOD, HOUSE, HEALTH, TRANSPORT, OTHER (optionally ELEC-POLE)")
    subtype: Optional[str] = Field(None, max_length=40)
    severity: Optional[int] = Field(None, ge=1, le=5)
    people_count: int = Field(0, ge=0, le=500)
    description: Optional[str] = Field(None, max_length=1000)
    is_mocked: bool = Field(False, description="Android Location.isMock / geolocator position.isMocked")
    signature: Optional[str] = Field(None, description="HMAC-SHA256 of 'sha256|lat|lon|captured_at'")
    relayed_by: Optional[str] = Field(None, max_length=20, description="Phone that forwarded this over the mesh")


class SOSIn(BaseModel):
    client_report_id: Optional[str] = Field(None, max_length=64)
    phone: Optional[str] = Field(None, max_length=20)
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lon: Optional[float] = Field(None, ge=-180, le=180)
    gps_accuracy_m: Optional[float] = Field(None, ge=0)
    captured_at: Optional[str] = None
    sos_type: Literal["TRAPPED", "MEDICAL", "FLOODING", "FIRE", "OTHER"] = "OTHER"
    people_count: int = Field(1, ge=1, le=500)
    battery_pct: Optional[int] = Field(None, ge=0, le=100)
    medical_notes: Optional[str] = Field(None, max_length=300, description="Registered in advance: blood group, pregnancy, dialysis...")
    description: Optional[str] = Field(None, max_length=1000)
    is_mocked: bool = False
    relayed_by: Optional[str] = Field(None, max_length=20)


class MeshRelayIn(BaseModel):
    relayed_by: Optional[str] = Field(None, max_length=20, description="Phone with internet that uploads the batch")
    messages: list[str] = Field(..., min_length=1, max_length=200, description="Coded messages collected over Bluetooth")


class VoiceIn(BaseModel):
    phone: Optional[str] = Field(None, max_length=20)
    text: str = Field(..., min_length=1, max_length=2000, description="Speech-to-text output (Telugu or English)")
    language: Optional[str] = "te"
    lat: Optional[float] = Field(None, ge=-90, le=90, description="Phone GPS, if the app sends it")
    lon: Optional[float] = Field(None, ge=-180, le=180)
    gps_accuracy_m: Optional[float] = Field(None, ge=0)


class ConfirmIn(BaseModel):
    fixed: bool
    phone: Optional[str] = Field(None, max_length=20)


class ActorIn(BaseModel):
    actor: str = Field("official", max_length=40)


class SOSUpdateIn(BaseModel):
    client_report_id: str = Field(..., max_length=64)
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lon: Optional[float] = Field(None, ge=-180, le=180)
    gps_accuracy_m: Optional[float] = Field(None, ge=0)
    battery_pct: Optional[int] = Field(None, ge=0, le=100)


NEEDS = Literal["elderly", "pregnant", "disabled", "infant", "dialysis", "bedridden", "oxygen"]


class CitizenIn(BaseModel):
    phone: str = Field(..., min_length=10, max_length=20)
    name: Optional[str] = Field(None, max_length=80)
    village: Optional[str] = Field(None, max_length=80)
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lon: Optional[float] = Field(None, ge=-180, le=180)
    household_size: int = Field(1, ge=1, le=50)
    needs: list[NEEDS] = Field(default_factory=list)
    medical_notes: Optional[str] = Field(None, max_length=300)
    family_contacts: list[str] = Field(default_factory=list, max_length=5)
    consent: bool = Field(..., description="Citizen agreed to share this with disaster officials")


class AlertIn(BaseModel):
    level: Literal["red", "orange", "yellow"] = "orange"
    hazard: str = Field("Cyclone", max_length=40)
    title: str = Field(..., min_length=3, max_length=200)
    message: str = Field(..., min_length=3, max_length=2000)
    message_te: Optional[str] = Field(None, max_length=2000)
    area_name: Optional[str] = Field(None, max_length=200)
    center_lat: Optional[float] = Field(None, ge=-90, le=90)
    center_lon: Optional[float] = Field(None, ge=-180, le=180)
    radius_km: Optional[float] = Field(None, gt=0, le=1000)
    expires_in_hours: Optional[float] = Field(48, gt=0, le=720)


class CapIn(BaseModel):
    xml: str = Field(..., min_length=20, max_length=200_000)
