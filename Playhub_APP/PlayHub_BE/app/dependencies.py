from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Child, Role, User
from app.security import decode_access_token

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    subject = decode_access_token(credentials.credentials)
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired access token")
    user = db.get(User, subject)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is unavailable")
    if user.organisation_id and (not user.organisation or not user.organisation.is_active):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organisation is suspended")
    return user


def require_roles(*roles: Role) -> Callable:
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission for this action")
        return user
    return checker


def require_child_access(child: Child, user: User) -> None:
    if user.role == Role.SUPER_ADMIN:
        return
    if child.organisation_id and child.organisation_id == user.organisation_id:
        if user.role == Role.ADMIN or child.moderator_id == user.id or child.owner_id == user.id:
            return
    if child.account_scope.value == "individual" and (child.owner_id == user.id or child.admin_id == user.id or child.moderator_id == user.id):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot access this child's data")
