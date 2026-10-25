import json
import logging
import time

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.routers.auth import router as auth_router
from app.routers.assignments import router as assignments_router
from app.routers.coordinator_applications import router as coordinator_applications_router
from app.routers.incidents import router as incidents_router
from app.routers.inventory import router as inventory_router
from app.routers.locations import router as locations_router
from app.routers.teams import router as teams_router
from app.routers.users import router as users_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("disaster_relief")

development_docs = settings.environment.lower() == "development"
app = FastAPI(
    title="Real-Time Disaster Emergency & Relief Coordinator",
    version="0.1.0",
    description="Academic prototype using simulated disaster data; not an official emergency response service.",
    docs_url="/docs" if development_docs else None,
    redoc_url="/redoc" if development_docs else None,
    openapi_url="/openapi.json" if development_docs else None,
)
app.add_middleware(CORSMiddleware, allow_origins=settings.allowed_origins, allow_credentials=True, allow_methods=["GET", "POST", "PATCH", "OPTIONS"], allow_headers=["Authorization", "Content-Type"])
app.include_router(incidents_router)
app.include_router(auth_router)
app.include_router(teams_router)
app.include_router(assignments_router)
app.include_router(coordinator_applications_router)
app.include_router(inventory_router)
app.include_router(locations_router)
app.include_router(users_router)


@app.middleware("http")
async def structured_request_log(request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    logger.info(json.dumps({"event": "http_request", "method": request.method, "path": request.url.path, "status_code": response.status_code, "duration_ms": round((time.perf_counter() - started) * 1000, 2)}))
    return response


@app.get("/health", tags=["operations"])
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        logger.exception("Database health check failed")
        raise HTTPException(status_code=503, detail="Database unavailable")
    return {"status": "ok", "database": "ok", "environment": settings.environment}
