from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import get_settings


def _connect_args(url: str) -> dict:
    return {"check_same_thread": False} if url.startswith("sqlite") else {}


settings = get_settings()
def _pool_args(url: str) -> dict:
    """A larger, self-healing pool on Postgres so many requests at once don't queue for a connection."""
    if url.startswith("sqlite"):
        return {}
    return {"pool_size": settings.db_pool_size, "max_overflow": settings.db_max_overflow,
            "pool_recycle": 1800, "pool_timeout": 30}


engine = create_engine(settings.database_url, pool_pre_ping=True, connect_args=_connect_args(settings.database_url),
                       **_pool_args(settings.database_url))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


async def get_db():
    """One session per request. An async dependency, so FastAPI closes the session on the event loop
    instead of borrowing a worker thread for it: under heavy load every thread can be busy waiting
    for a database connection, and a cleanup that also needs a thread would never return one."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
