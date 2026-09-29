from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import get_settings


def _connect_args(url: str) -> dict:
    return {"check_same_thread": False} if url.startswith("sqlite") else {}


settings = get_settings()
engine = create_engine(settings.database_url, pool_pre_ping=True, connect_args=_connect_args(settings.database_url))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
