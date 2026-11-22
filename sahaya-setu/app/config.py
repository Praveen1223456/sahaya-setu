"""All settings in one place. Override any of them with environment variables."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _env_float(name: str, default: float) -> float:
    return float(os.getenv(name, default))


# Storage ---------------------------------------------------------------------
# SQLite works out of the box. For deployment, point this at PostgreSQL, e.g.
# postgresql+psycopg://user:pass@localhost/sahaya
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'sahaya_setu.db'}")
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(BASE_DIR / "uploads")))
PLACES_CSV = Path(os.getenv("PLACES_CSV", str(BASE_DIR / "data" / "places_sample.csv")))

# Photo integrity -------------------------------------------------------------
# The app signs (photo SHA-256 + GPS + time) with this key. Prototype only:
# in production use Android Play Integrity / key attestation instead.
APP_SIGNING_SECRET = os.getenv("APP_SIGNING_SECRET", "change-me-hackathon-secret")
REQUIRE_SIGNATURE = os.getenv("REQUIRE_SIGNATURE", "0") == "1"

# Duplicate detection ---------------------------------------------------------
DUP_RADIUS_M = _env_float("DUP_RADIUS_M", 100)               # same place if closer than this
DUP_RADIUS_TEXT_ONLY_M = _env_float("DUP_RADIUS_TEXT_ONLY_M", 50)  # SMS/voice reports (no photo)
DUP_RADIUS_MAX_M = _env_float("DUP_RADIUS_MAX_M", 300)       # cap when GPS accuracy is poor
PHASH_MAX_DISTANCE = int(os.getenv("PHASH_MAX_DISTANCE", 8))  # same photo if hash distance <= this
CLIP_MIN_SIMILARITY = _env_float("CLIP_MIN_SIMILARITY", 0.85)  # same scene if cosine >= this
FORWARDED_PHOTO_MIN_KM = _env_float("FORWARDED_PHOTO_MIN_KM", 1.0)  # same photo this far away = suspicious
ENABLE_CLIP = os.getenv("ENABLE_CLIP", "0") == "1"           # needs: pip install open_clip_torch torch

# SOS -------------------------------------------------------------------------
SOS_AREA_RADIUS_M = _env_float("SOS_AREA_RADIUS_M", 50)
SOS_AREA_WINDOW_HOURS = _env_float("SOS_AREA_WINDOW_HOURS", 6)

# GPS quality -----------------------------------------------------------------
LOW_CONFIDENCE_ACCURACY_M = _env_float("LOW_CONFIDENCE_ACCURACY_M", 100)
TEXT_PLACE_ACCURACY_M = 3000  # location guessed from a village name in the text

# Outgoing SMS ----------------------------------------------------------------
# "console": messages are only stored in the outbox table (good for demos).
# "http": also POST {"to", "message"} to SMS_GATEWAY_URL (e.g. an Android SMS gateway app).
SMS_SENDER = os.getenv("SMS_SENDER", "console")
SMS_GATEWAY_URL = os.getenv("SMS_GATEWAY_URL", "")

# Address lookup ----------------------------------------------------------------
# "offline": nearest place from PLACES_CSV (works with no internet).
# "nominatim": OpenStreetMap Nominatim, falls back to offline on failure.
GEOCODER = os.getenv("GEOCODER", "offline")
NOMINATIM_URL = os.getenv("NOMINATIM_URL", "https://nominatim.openstreetmap.org/reverse")

# Staff logins ------------------------------------------------------------------
# JSON map of token -> {"name", "department" ("*" = all), "role" ("control" | "department")}.
# The demo tokens below are for the hackathon only; set STAFF_TOKENS_JSON for anything real.
STAFF_TOKENS_JSON = os.getenv("STAFF_TOKENS_JSON", "")

# Citizen app ---------------------------------------------------------------------
# Number of the phone running the SMS gateway app (used for "Send by SMS" when there is no data).
SMS_INBOUND_NUMBER = os.getenv("SMS_INBOUND_NUMBER", "")
SHELTERS_CSV = Path(os.getenv("SHELTERS_CSV", str(BASE_DIR / "data" / "shelters_sample.csv")))
STATIC_DIR = BASE_DIR / "static"

# AI (optional) --------------------------------------------------------------------
# With a key, photos get an AI category suggestion and the situation report is written by Claude.
# Without a key everything still works with rule-based fallbacks.
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-haiku-5-5")
ANTHROPIC_VERSION = os.getenv("ANTHROPIC_VERSION", "2023-06-01")
ANTHROPIC_URL = os.getenv("ANTHROPIC_URL", "https://api.anthropic.com/v1/messages")

# Background jobs ------------------------------------------------------------------
ESCALATION_INTERVAL_S = int(os.getenv("ESCALATION_INTERVAL_S", 300))  # 0 = off
