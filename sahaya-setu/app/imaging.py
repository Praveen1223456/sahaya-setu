"""Photo processing: storage, fingerprints for duplicate detection, and tamper checks."""
from __future__ import annotations

import hashlib
import hmac
import io
import logging
import uuid
from typing import Optional

import imagehash
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

from . import config

log = logging.getLogger(__name__)


class BadImage(ValueError):
    pass


def load_image(data: bytes) -> Image.Image:
    try:
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img)
        return img.convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise BadImage("File is not a readable image") from exc


def save_image(img: Image.Image, subdir: str) -> str:
    """Save a web-sized JPEG copy and return its path relative to UPLOAD_DIR."""
    folder = config.UPLOAD_DIR / subdir
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}.jpg"
    copy = img.copy()
    copy.thumbnail((1600, 1600))
    copy.save(folder / name, "JPEG", quality=85)
    return f"{subdir}/{name}"


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def phash_hex(img: Image.Image) -> str:
    """Perceptual hash: survives resizing, compression and small edits (catches re-sent photos)."""
    return str(imagehash.phash(img))


def phash_distance(a: str, b: str) -> int:
    return imagehash.hex_to_hash(a) - imagehash.hex_to_hash(b)


def sharpness(img: Image.Image) -> float:
    """Variance of the Laplacian. Higher = sharper. Used to pick the best photo of an incident."""
    g = np.asarray(img.convert("L").resize((256, 256)), dtype=np.float32)
    lap = -4 * g[1:-1, 1:-1] + g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:]
    return float(lap.var())


# Optional "same scene, different angle" check with CLIP --------------------------------
_clip = None


def embedding(img: Image.Image) -> Optional[list[float]]:
    if not config.ENABLE_CLIP:
        return None
    global _clip
    try:
        if _clip is None:
            import open_clip
            import torch

            model, _, preprocess = open_clip.create_model_and_transforms(
                "ViT-B-32", pretrained="laion2b_s34b_b79k"
            )
            model.eval()
            _clip = (model, preprocess, torch)
        model, preprocess, torch = _clip
        with torch.no_grad():
            vec = model.encode_image(preprocess(img).unsqueeze(0))
            vec = vec / vec.norm(dim=-1, keepdim=True)
        return [round(float(x), 5) for x in vec[0]]
    except Exception as exc:
        log.warning("CLIP embedding unavailable (%s); using photo hash only", exc)
        return None


def cosine(a: list[float], b: list[float]) -> float:
    va, vb = np.asarray(a, dtype=np.float32), np.asarray(b, dtype=np.float32)
    denom = float(np.linalg.norm(va) * np.linalg.norm(vb)) or 1.0
    return float(va @ vb) / denom


# Tamper check -------------------------------------------------------------------------
def signature_payload(photo_sha256: str, lat: float, lon: float, captured_at: str) -> str:
    """The exact string the app must sign. Coordinates always use 6 decimals."""
    return f"{photo_sha256}|{lat:.6f}|{lon:.6f}|{captured_at}"


def sign(payload: str, secret: str = None) -> str:
    key = (secret or config.APP_SIGNING_SECRET).encode()
    return hmac.new(key, payload.encode(), hashlib.sha256).hexdigest()


def verify_signature(photo_sha256: str, lat: float, lon: float, captured_at: str, signature: str) -> bool:
    expected = sign(signature_payload(photo_sha256, lat, lon, captured_at))
    return hmac.compare_digest(expected, (signature or "").lower())
