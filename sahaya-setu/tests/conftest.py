import io
import json
import os
import random
import tempfile

import pytest

_tmp = tempfile.mkdtemp(prefix="sahaya_test_")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["UPLOAD_DIR"] = f"{_tmp}/uploads"
os.environ["SMS_SENDER"] = "console"
os.environ["GEOCODER"] = "offline"
os.environ["ESCALATION_INTERVAL_S"] = "0"
os.environ["ANTHROPIC_API_KEY"] = ""

from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402

# Amalapuram town centre (from the sample places file)
BASE_LAT, BASE_LON = 16.5787, 82.0061


def offset(lat, lon, north_m=0.0, east_m=0.0):
    """Move a point by a few metres (good enough for tests)."""
    return lat + north_m / 111_320, lon + east_m / (111_320 * 0.9585)


def make_photo(seed: int, resized: bool = False) -> bytes:
    """A synthetic 'scene'. Same seed = same scene; resized=True mimics a re-sent, compressed copy."""
    rnd = random.Random(seed)
    img = Image.new("RGB", (640, 480), (rnd.randint(0, 255), rnd.randint(0, 255), rnd.randint(0, 255)))
    draw = ImageDraw.Draw(img)
    for _ in range(12):
        x0, y0 = rnd.randint(0, 560), rnd.randint(0, 400)
        box = [x0, y0, x0 + rnd.randint(40, 200), y0 + rnd.randint(40, 200)]
        colour = (rnd.randint(0, 255), rnd.randint(0, 255), rnd.randint(0, 255))
        (draw.ellipse if rnd.random() < 0.5 else draw.rectangle)(box, fill=colour)
    if resized:
        img = img.resize((400, 300))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=55 if resized else 90)
    return buf.getvalue()


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    # Default: signed in as the control room. Use anon() or as_staff() for other roles.
    with TestClient(app, headers={"X-Staff-Token": "control-demo"}) as c:
        yield c


@pytest.fixture()
def anon(client):
    return TestClient(app)


def as_staff(token):
    return TestClient(app, headers={"X-Staff-Token": token})


@pytest.fixture()
def post_report(client):
    def _post(photo=None, **meta):
        meta.setdefault("category", "ELEC")
        files = {"photo": ("p.jpg", photo, "image/jpeg")} if photo else None
        r = client.post("/reports", data={"meta": json.dumps(meta)}, files=files)
        assert r.status_code == 200, r.text
        return r.json()

    return _post
