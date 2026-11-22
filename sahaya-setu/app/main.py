"""Sahaya Setu. Run:  uvicorn app.main:app --reload   then open http://localhost:8000

Web apps served by this server:
  /citizen/    citizen app (installable, works offline)
  /dashboard/  control room and department dashboard
  /field/      field team app (on the way / fixed with proof photo)
  /board/      public transparency board
  /docs        API reference
"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import config, routes_citizen, routes_public, routes_staff, services
from .db import SessionLocal, init_db
from .imaging import BadImage
from .models import utcnow
from .views import iso

log = logging.getLogger("sahaya")


async def _escalation_loop(interval: int) -> None:
    while True:
        await asyncio.sleep(interval)
        try:
            with SessionLocal() as db:
                done = services.run_escalations(db)
            if done:
                log.info("Escalated overdue tickets: %s", ", ".join(done))
        except Exception:  # keep the loop alive
            log.exception("Escalation job failed")


@asynccontextmanager
async def lifespan(_: FastAPI):
    config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    init_db()
    interval = config.ESCALATION_INTERVAL_S
    task = asyncio.create_task(_escalation_loop(interval)) if interval > 0 else None
    yield
    if task:
        task.cancel()


app = FastAPI(title="Sahaya Setu API", version="0.2.0", lifespan=lifespan,
              description="Disaster reporting: any channel in, tracked ticket out. "
                          "Officials' endpoints need the X-Staff-Token header.")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(services.WorkflowError)
async def _workflow_error(_: Request, exc: services.WorkflowError):
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.exception_handler(BadImage)
async def _bad_image(_: Request, exc: BadImage):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.get("/health", tags=["system"])
def health():
    return {"ok": True, "time": iso(utcnow())}


app.include_router(routes_citizen.router)
app.include_router(routes_staff.router)
app.include_router(routes_public.router)

config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(config.UPLOAD_DIR)), name="uploads")
for _name in ("citizen", "dashboard", "field", "board", "shared", "vendor"):
    app.mount(f"/{_name}", StaticFiles(directory=str(config.STATIC_DIR / _name), html=True), name=_name)


@app.get("/", include_in_schema=False)
def landing():
    return FileResponse(config.STATIC_DIR / "index.html")
