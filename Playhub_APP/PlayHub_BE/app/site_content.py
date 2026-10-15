"""Persist a validated public content document with its audit trail."""
from sqlalchemy.orm import Session

from app.models import SiteContent
from app.services import audit


def save_content(db: Session, actor_id: str, key: str, content: dict, action: str) -> SiteContent:
    row = db.get(SiteContent, key)
    if row is None:
        row = SiteContent(key=key, content=content)
    else:
        row.content = content
    row.updated_by_id = actor_id
    db.add(row)
    db.flush()
    audit(db, actor_id, action, "site_content", key)
    db.commit()
    db.refresh(row)
    return row
