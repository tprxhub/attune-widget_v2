from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models  # noqa: F401 - registers declarative metadata
from app.api import router
from app.config import get_settings
from app.database import Base, engine, get_db
from app.storage import CACHE_CONTROL, StorageUnavailable, get_storage

settings = get_settings()


class LocalMediaFiles(StaticFiles):
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = CACHE_CONTROL
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Development convenience only; production must be upgraded with Alembic.
    if settings.environment == "development":
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
if settings.storage_backend == "local" or settings.environment.lower() == "development":
    app.mount(
        settings.storage_local_url_prefix,
        LocalMediaFiles(directory=settings.storage_local_root, check_dir=False),
        name="uploads",
    )
app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.app_name}


@app.get("/ready")
def ready(db: Session = Depends(get_db)):
    db.execute(select(1))
    storage = get_storage()
    try:
        storage.check_health()
    except StorageUnavailable as exc:
        raise HTTPException(status_code=503, detail="Media storage is unavailable") from exc
    return {"status": "ready", "service": settings.app_name, "storage": settings.storage_backend}
