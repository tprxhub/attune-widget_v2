"""REST API routes consumed by the Play Hub frontend."""
from __future__ import annotations
import calendar
import hashlib
from datetime import date, datetime, timedelta, timezone

import logging
from secrets import token_urlsafe

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import and_, false, func, not_, or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user, require_child_access, require_permission, require_roles
from app.models import AUDIT_CATEGORIES, AUDIT_CATEGORY_PREFIXES, AccountScope, Activity, Attempt, AuditEvent, Child, Invitation, InvitationStatus, Organisation, PasswordResetToken, PlanLevel, PlanPublicationStatus, PlayDose, PlayPlan, Role, SiteContent, StripeEvent, Subscription, SubscriptionStatus, User, VideoSourceType
from app.config import get_settings
from app.billing import BillingError, create_checkout, create_refund, paid_in_full, parse_webhook, plan_price
from app.google_identity import GoogleIdentityError, verify_google_credential
from app.overview import Overview, build_overview
from app.oidc_identity import (
    PROVIDER_LABEL,
    OidcIdentity,
    OidcIdentityError,
    Provider,
    verify_apple_credential,
    verify_microsoft_credential,
)
from app.schemas import (
    ActivityCreate, ActivityRead, ActivityUpdate, AttemptCreate, FreePlayPlanChoice, AttemptRead, AvatarStickerUpdate, ChildCreate, ChildRead, ChildUpdate,
    AuditEventRead, CheckoutCreate, CheckoutCreated, FamilyRegistration, GoogleFamilyRegistration, GoogleLoginRequest, SocialFamilyRegistration, SocialLoginRequest, InvitationAccept, InvitationCreate, InvitationCreated, InvitationRead,
    LoginRequest, OrganisationCreate, OrganisationRead, OrganisationUpdate, PasswordChange, PasswordForgot, PasswordReset, PlayDoseCreate, PlayDoseRead,
    PlayDoseUpdate, OrderUpdate, PlayPlanCreate, PlayPlanRead, PlayPlanUpdate, ProgressSummary, SubscriptionRead,
    SubscriptionUpsert, Token, UserCreate, UserRead, UserUpdate, PersonaRead, HomepageContent, SiteContentRead,
)
from app.security import create_access_token, hash_password, verify_password
from app.services import audit, progress_summary
from app import notifications
from app.mailer import OutgoingEmail, send_email
from app.storage import StorageService, StorageUnavailable, UploadRejected, get_storage

router = APIRouter(prefix="/api/v1")
logger = logging.getLogger(__name__)


def one_or_404(db: Session, model, item_id: str):
    item = db.get(model, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Resource not found")
    return item


def commit(db: Session, obj):
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def commit_audited(
    db: Session,
    obj,
    *,
    actor_id: str | None,
    action: str,
    resource_type: str,
    metadata: dict | None = None,
):
    """Persist a mutation and its audit event in the same transaction."""
    db.add(obj)
    db.flush()
    audit(db, actor_id, action, resource_type, obj.id, metadata)
    db.commit()
    db.refresh(obj)
    return obj


def store_upload(upload: UploadFile, category: str, storage: StorageService) -> str:
    try:
        return storage.upload(upload, category)
    except UploadRejected as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    except StorageUnavailable as exc:
        raise HTTPException(status_code=503, detail="Media storage is temporarily unavailable") from exc


def discard_stored_asset(storage: StorageService, url: str | None) -> None:
    """Best-effort cleanup after a DB commit or rollback; never hide the primary result."""
    try:
        storage.delete_url(url)
    except StorageUnavailable:
        logger.exception("Unable to delete stored media object", extra={"asset_url": url})


def validate_user_values(
    db: Session,
    *,
    role: Role,
    account_scope: AccountScope,
    organisation_id: str | None,
    require_active_organisation: bool = True,
) -> None:
    """Keep role, account scope and organisation membership internally consistent."""
    if role in (Role.SUPER_ADMIN, Role.TTP_EMPLOYEE):
        if account_scope != AccountScope.PLATFORM or organisation_id is not None:
            raise HTTPException(status_code=422, detail="Super Admin and TTP employee accounts must use platform scope")
        return
    if account_scope == AccountScope.PLATFORM:
        raise HTTPException(status_code=422, detail="Platform scope is reserved for Super Admin accounts")
    if account_scope == AccountScope.ORGANISATION:
        if not organisation_id:
            raise HTTPException(status_code=422, detail="Organisation accounts require organisation_id")
        organisation = db.get(Organisation, organisation_id)
        if not organisation:
            raise HTTPException(status_code=422, detail="Organisation does not exist")
        if require_active_organisation and not organisation.is_active:
            raise HTTPException(status_code=409, detail="Cannot add an account to a suspended organisation")
    elif organisation_id is not None:
        raise HTTPException(status_code=422, detail="Individual accounts cannot belong to an organisation")


def validate_invitation_child(db: Session, payload: InvitationCreate) -> Child | None:
    if not payload.child_id:
        return None
    child = one_or_404(db, Child, payload.child_id)
    if not child.is_active:
        raise HTTPException(status_code=409, detail="Cannot invite a user to an inactive child")
    if payload.role not in {Role.MEMBER, Role.MODERATOR}:
        raise HTTPException(status_code=422, detail="Child invitations must use the Member or Moderator role")
    if child.account_scope != payload.account_scope or child.organisation_id != payload.organisation_id:
        raise HTTPException(status_code=422, detail="Invitation account scope must match the child")
    return child


def validate_child_values(db: Session, values: dict, child_id: str | None = None) -> None:
    scope = values.get("account_scope")
    organisation_id = values.get("organisation_id")
    if scope not in {AccountScope.INDIVIDUAL, AccountScope.ORGANISATION}:
        raise HTTPException(status_code=422, detail="Children must use individual or organisation scope")
    if scope == AccountScope.ORGANISATION and not organisation_id:
        raise HTTPException(status_code=422, detail="Organisation children require organisation_id")
    if scope == AccountScope.INDIVIDUAL and organisation_id:
        raise HTTPException(status_code=422, detail="Individual children cannot belong to an organisation")

    organisation = one_or_404(db, Organisation, organisation_id) if organisation_id else None
    if organisation and not organisation.is_active:
        raise HTTPException(status_code=409, detail="Cannot enrol a child into a suspended organisation")
    if organisation and values.get("is_active", True) and organisation.seat_limit:
        license_query = select(func.count(Child.id)).where(
            Child.organisation_id == organisation.id,
            Child.is_active.is_(True),
        )
        if child_id:
            license_query = license_query.where(Child.id != child_id)
        if (db.scalar(license_query) or 0) >= organisation.seat_limit:
            raise HTTPException(status_code=409, detail="Organisation license limit has been reached")

    dose_id = values.get("current_play_dose_id")
    if dose_id:
        dose = one_or_404(db, PlayDose, dose_id)
        if (
            not dose.is_active
            or not dose.play_plan.is_active
            or dose.play_plan.publication_status != PlanPublicationStatus.PUBLISHED
        ):
            raise HTTPException(status_code=422, detail="Assign a published Play Dose")

    assignments = {
        "owner_id": {Role.ADMIN, Role.MEMBER},
        "admin_id": {Role.ADMIN},
        "moderator_id": {Role.MODERATOR},
    }
    for field, roles in assignments.items():
        assignee_id = values.get(field)
        if not assignee_id:
            continue
        assignee = one_or_404(db, User, assignee_id)
        if not assignee.is_active or assignee.role not in roles:
            raise HTTPException(status_code=422, detail=f"Invalid {field.removesuffix('_id')} assignment")
        if scope == AccountScope.ORGANISATION and assignee.organisation_id != organisation_id:
            raise HTTPException(status_code=422, detail=f"{field.removesuffix('_id').title()} must belong to the same organisation")
        if scope == AccountScope.INDIVIDUAL and assignee.organisation_id is not None:
            raise HTTPException(status_code=422, detail=f"{field.removesuffix('_id').title()} must belong to the family account")


def default_starter_dose(db: Session) -> PlayDose | None:
    """Return the first active Starter dose, the default starting level for a new child."""
    return db.scalar(
        select(PlayDose)
        .join(PlayPlan)
        .where(
            PlayDose.level == PlanLevel.STARTER,
            PlayDose.is_active.is_(True),
            PlayPlan.is_active.is_(True),
            PlayPlan.publication_status == PlanPublicationStatus.PUBLISHED,
        )
        .order_by(PlayPlan.created_at, PlayDose.sort_order, PlayDose.created_at)
    )


@router.post("/auth/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    settings = get_settings()
    if settings.environment != "test" and (
        payload.role != Role.MEMBER or payload.account_scope != AccountScope.INDIVIDUAL
    ):
        raise HTTPException(status_code=403, detail="Organisation and privileged accounts must be created through an invitation")
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(status_code=409, detail="Email is already registered")
    validate_user_values(
        db,
        role=payload.role,
        account_scope=payload.account_scope,
        organisation_id=payload.organisation_id,
    )
    return commit(db, User(**payload.model_dump(exclude={"password"}), password_hash=hash_password(payload.password)))


@router.post("/auth/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.strip().lower()))
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if user.organisation_id and (not user.organisation or not user.organisation.is_active):
        raise HTTPException(status_code=403, detail="Organisation is suspended")
    return Token(access_token=create_access_token(user.id))


@router.post("/auth/refresh", response_model=Token)
def refresh_token(user: User = Depends(get_current_user)):
    """Sliding session: a still-valid token can be swapped for a fresh one."""
    return Token(access_token=create_access_token(user.id))


@router.post("/auth/google", response_model=Token)
def google_login(payload: GoogleLoginRequest, db: Session = Depends(get_db)):
    try:
        identity = verify_google_credential(payload.credential, get_settings())
    except GoogleIdentityError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    user = db.scalar(select(User).where(User.google_subject == identity.subject))
    if not user:
        user = db.scalar(select(User).where(User.email == identity.email))
        if not user:
            raise HTTPException(
                status_code=404,
                detail="No Play Hub account uses this Google email. Create or accept an account first.",
            )
        if user.google_subject and user.google_subject != identity.subject:
            raise HTTPException(status_code=409, detail="This account is linked to another Google identity")
        if not identity.authoritative_email:
            raise HTTPException(
                status_code=409,
                detail="Sign in with your password first; this Google address cannot be linked automatically.",
            )
        user.google_subject = identity.subject
        audit(db, user.id, "user.google_linked", "user", user.id)
        db.commit()
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account is unavailable")
    if user.organisation_id and (not user.organisation or not user.organisation.is_active):
        raise HTTPException(status_code=403, detail="Organisation is suspended")
    return Token(access_token=create_access_token(user.id))


@router.post("/auth/google/register-family", response_model=Token, status_code=status.HTTP_201_CREATED)
def google_register_family(payload: GoogleFamilyRegistration, db: Session = Depends(get_db)):
    """First-time Google sign-in: create the family administrator, their child and a free subscription."""
    try:
        identity = verify_google_credential(payload.credential, get_settings())
    except GoogleIdentityError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    if db.scalar(select(User).where((User.google_subject == identity.subject) | (User.email == identity.email))):
        raise HTTPException(status_code=409, detail="A Play Hub account already uses this Google email. Log in instead.")
    first_dose = default_starter_dose(db)
    user = User(
        email=identity.email,
        display_name=identity.name[:120],
        # Google accounts have no password; this random hash can never be guessed or used to log in.
        password_hash=hash_password(token_urlsafe(32)),
        google_subject=identity.subject,
        role=Role.ADMIN,
        account_scope=AccountScope.INDIVIDUAL,
    )
    db.add(user)
    db.flush()
    child = Child(
        name=payload.child_name,
        date_of_birth=payload.child_date_of_birth,
        colour_token="blue",
        account_scope=AccountScope.INDIVIDUAL,
        owner_id=user.id,
        admin_id=user.id,
        current_play_dose_id=first_dose.id if first_dose else None,
        plan_started_at=date.today() if first_dose else None,
    )
    db.add(child)
    db.flush()
    db.add(Subscription(child_id=child.id, status=SubscriptionStatus.FREE))
    audit(db, user.id, "family.registered", "user", user.id, {"child_id": child.id, "via": "google"})
    db.commit()
    notifications.welcome(user, child.name)
    return Token(access_token=create_access_token(user.id))


SOCIAL_COLUMN = {"apple": User.apple_subject, "microsoft": User.microsoft_subject}


def _verify_social(provider: Provider, payload: SocialLoginRequest) -> OidcIdentity:
    try:
        if provider == "apple":
            return verify_apple_credential(payload.credential, get_settings(), payload.name)
        return verify_microsoft_credential(payload.credential, get_settings())
    except OidcIdentityError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


def social_login(provider: Provider, payload: SocialLoginRequest, db: Session) -> Token:
    """Sign in with Apple or Microsoft. Same linking rules as Google: an existing account is only
    linked automatically when the provider owns the mailbox (e.g. iCloud or Outlook.com)."""
    identity = _verify_social(provider, payload)
    label = PROVIDER_LABEL[provider]
    column = SOCIAL_COLUMN[provider]
    attr = column.key
    user = db.scalar(select(User).where(column == identity.subject))
    if not user:
        user = db.scalar(select(User).where(User.email == identity.email))
        if not user:
            raise HTTPException(
                status_code=404,
                detail=f"No Play Hub account uses this {label} email. Create or accept an account first.",
            )
        if getattr(user, attr) and getattr(user, attr) != identity.subject:
            raise HTTPException(status_code=409, detail=f"This account is linked to another {label} identity")
        if not identity.authoritative_email:
            raise HTTPException(
                status_code=409,
                detail=f"Sign in with your password first; this {label} address cannot be linked automatically.",
            )
        setattr(user, attr, identity.subject)
        audit(db, user.id, f"user.{provider}_linked", "user", user.id)
        db.commit()
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account is unavailable")
    if user.organisation_id and (not user.organisation or not user.organisation.is_active):
        raise HTTPException(status_code=403, detail="Organisation is suspended")
    return Token(access_token=create_access_token(user.id))


def social_register_family(provider: Provider, payload: SocialFamilyRegistration, db: Session) -> Token:
    """First-time Apple or Microsoft sign-in: create the family administrator, their child and a free subscription."""
    identity = _verify_social(provider, payload)
    column = SOCIAL_COLUMN[provider]
    if db.scalar(select(User).where((column == identity.subject) | (User.email == identity.email))):
        raise HTTPException(
            status_code=409,
            detail=f"A Play Hub account already uses this {PROVIDER_LABEL[provider]} email. Log in instead.",
        )
    first_dose = default_starter_dose(db)
    user = User(
        email=identity.email,
        display_name=identity.name[:120],
        # No password; this random hash can never be guessed or used to log in.
        password_hash=hash_password(token_urlsafe(32)),
        role=Role.ADMIN,
        account_scope=AccountScope.INDIVIDUAL,
    )
    setattr(user, column.key, identity.subject)
    db.add(user)
    db.flush()
    child = Child(
        name=payload.child_name,
        date_of_birth=payload.child_date_of_birth,
        colour_token="blue",
        account_scope=AccountScope.INDIVIDUAL,
        owner_id=user.id,
        admin_id=user.id,
        current_play_dose_id=first_dose.id if first_dose else None,
        plan_started_at=date.today() if first_dose else None,
    )
    db.add(child)
    db.flush()
    db.add(Subscription(child_id=child.id, status=SubscriptionStatus.FREE))
    audit(db, user.id, "family.registered", "user", user.id, {"child_id": child.id, "via": provider})
    db.commit()
    notifications.welcome(user, child.name)
    return Token(access_token=create_access_token(user.id))


@router.post("/auth/apple", response_model=Token)
def apple_login(payload: SocialLoginRequest, db: Session = Depends(get_db)):
    return social_login("apple", payload, db)


@router.post("/auth/apple/register-family", response_model=Token, status_code=status.HTTP_201_CREATED)
def apple_register_family(payload: SocialFamilyRegistration, db: Session = Depends(get_db)):
    return social_register_family("apple", payload, db)


@router.post("/auth/microsoft", response_model=Token)
def microsoft_login(payload: SocialLoginRequest, db: Session = Depends(get_db)):
    return social_login("microsoft", payload, db)


@router.post("/auth/microsoft/register-family", response_model=Token, status_code=status.HTTP_201_CREATED)
def microsoft_register_family(payload: SocialFamilyRegistration, db: Session = Depends(get_db)):
    return social_register_family("microsoft", payload, db)


@router.post("/auth/register-family", response_model=Token, status_code=status.HTTP_201_CREATED)
def register_family(payload: FamilyRegistration, db: Session = Depends(get_db)):
    """Create the family administrator, their child, and a free subscription atomically."""
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(status_code=409, detail="Email is already registered")
    first_dose = default_starter_dose(db)
    user = User(
        email=payload.email,
        display_name=payload.guardian_name,
        password_hash=hash_password(payload.password),
        role=Role.ADMIN,
        account_scope=AccountScope.INDIVIDUAL,
    )
    db.add(user)
    db.flush()
    child = Child(
        name=payload.child_name,
        date_of_birth=payload.child_date_of_birth,
        colour_token="blue",
        account_scope=AccountScope.INDIVIDUAL,
        owner_id=user.id,
        admin_id=user.id,
        current_play_dose_id=first_dose.id if first_dose else None,
        plan_started_at=date.today() if first_dose else None,
    )
    db.add(child)
    db.flush()
    db.add(Subscription(child_id=child.id, status=SubscriptionStatus.FREE))
    audit(db, user.id, "family.registered", "user", user.id, {"child_id": child.id})
    db.commit()
    notifications.welcome(user, child.name)
    return Token(access_token=create_access_token(user.id))


@router.post("/auth/change-password")
def change_password(payload: PasswordChange, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=422, detail="Current password is incorrect")
    user.password_hash = hash_password(payload.new_password)
    audit(db, user.id, "user.password_changed", "user", user.id)
    db.commit()
    notifications.password_changed(user)
    return {"detail": "Password updated"}


RESET_TTL = timedelta(hours=1)
RESET_REQUESTS_PER_HOUR = 3


def _reset_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@router.post("/auth/password/forgot", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(payload: PasswordForgot, db: Session = Depends(get_db)):
    """Emails a one-time reset link. The reply is the same whether or not the email has an account."""
    reply = {"detail": "If an account uses that email, a reset link is on its way."}
    user = db.scalar(select(User).where(User.email == payload.email.strip().lower()))
    if not user or not user.is_active:
        return reply
    now = datetime.now(timezone.utc)
    recent = db.scalar(
        select(func.count(PasswordResetToken.id)).where(
            PasswordResetToken.user_id == user.id, PasswordResetToken.created_at >= now - timedelta(hours=1)
        )
    ) or 0
    if recent >= RESET_REQUESTS_PER_HOUR:
        return reply
    # Only the newest link works.
    for old in db.scalars(
        select(PasswordResetToken).where(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))
    ):
        old.used_at = now
    token = token_urlsafe(32)
    db.add(PasswordResetToken(user_id=user.id, token_hash=_reset_hash(token), expires_at=now + RESET_TTL, created_at=now))
    audit(db, user.id, "user.password_reset_requested", "user", user.id)
    db.commit()
    link = f"{get_settings().frontend_base_url.rstrip('/')}/reset-password?token={token}"
    send_email(
        OutgoingEmail(
            to=user.email,
            subject="Reset your Play Hub password",
            text=(
                f"Hi {user.display_name},\n\n"
                f"Someone asked to reset the password for your Play Hub account. Use this link within one hour:\n\n"
                f"{link}\n\n"
                "If you didn't ask for this, you can ignore this email; your password stays the same.\n\n"
                "The Play Hub team"
            ),
        )
    )
    return reply


@router.post("/auth/password/reset")
def reset_password(payload: PasswordReset, db: Session = Depends(get_db)):
    row = db.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == _reset_hash(payload.token)))
    now = datetime.now(timezone.utc)
    expires_at = row.expires_at if row and row.expires_at.tzinfo else (row.expires_at.replace(tzinfo=timezone.utc) if row else None)
    if not row or row.used_at is not None or expires_at < now:
        raise HTTPException(status_code=400, detail="This reset link has expired or was already used. Ask for a new one.")
    user = db.get(User, row.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="This reset link has expired or was already used. Ask for a new one.")
    user.password_hash = hash_password(payload.new_password)
    row.used_at = now
    audit(db, user.id, "user.password_reset", "user", user.id)
    db.commit()
    notifications.password_changed(user)
    return {"detail": "Password updated. You can log in with your new password."}


@router.get("/auth/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/auth/me/avatar", response_model=UserRead)
def upload_my_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
):
    old_url = user.avatar_url
    new_url = store_upload(file, "avatars", storage)
    user.avatar_url = new_url
    user.avatar_sticker = None
    try:
        audit(db, user.id, "user.avatar_uploaded", "user", user.id)
        saved = commit(db, user)
    except Exception:
        db.rollback()
        discard_stored_asset(storage, new_url)
        raise
    discard_stored_asset(storage, old_url)
    return saved


@router.put("/auth/me/avatar", response_model=UserRead)
def choose_my_avatar_sticker(
    payload: AvatarStickerUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
):
    old_url = user.avatar_url
    user.avatar_url = None
    user.avatar_sticker = payload.sticker
    audit(db, user.id, "user.avatar_sticker_selected", "user", user.id, {"sticker": payload.sticker})
    saved = commit(db, user)
    discard_stored_asset(storage, old_url)
    return saved


@router.delete("/auth/me/avatar", status_code=status.HTTP_204_NO_CONTENT)
def remove_my_avatar(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
):
    old_url = user.avatar_url
    user.avatar_url = None
    user.avatar_sticker = None
    audit(db, user.id, "user.avatar_removed", "user", user.id)
    db.commit()
    discard_stored_asset(storage, old_url)


@router.get("/users", response_model=list[UserRead])
def list_users(user: User = Depends(require_permission("team", "children", "organisations", roles=(Role.ADMIN,))), db: Session = Depends(get_db)):
    query = select(User).order_by(User.display_name)
    if user.role == Role.TTP_EMPLOYEE:
        # Platform staff accounts are managed by the Super Admin only.
        query = query.where(User.role.notin_([Role.SUPER_ADMIN, Role.TTP_EMPLOYEE]))
    if user.role == Role.ADMIN:
        if user.organisation_id:
            query = query.where(User.organisation_id == user.organisation_id)
        else:
            child_rows = db.scalars(
                select(Child).where((Child.owner_id == user.id) | (Child.admin_id == user.id))
            ).all()
            related_ids = {user.id}
            for child in child_rows:
                related_ids.update(filter(None, (child.owner_id, child.admin_id, child.moderator_id)))
            query = query.where(User.id.in_(related_ids))
    return db.scalars(query).all()


@router.patch("/users/{user_id}", response_model=UserRead)
def update_user(user_id: str, payload: UserUpdate, actor: User = Depends(require_permission("team", roles=(Role.ADMIN,))), db: Session = Depends(get_db)):
    target = one_or_404(db, User, user_id)
    if target.is_platform and actor.role != Role.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Only a Super Admin can manage platform staff")
    if payload.permissions is not None and target.role != Role.TTP_EMPLOYEE:
        raise HTTPException(status_code=422, detail="Permissions apply to TTP employees only")
    if payload.permissions is not None and actor.role != Role.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Only a Super Admin can change permissions")
    if actor.role == Role.ADMIN:
        if actor.organisation_id and target.organisation_id != actor.organisation_id:
            raise HTTPException(status_code=403, detail="You can manage only your organisation's users")
        if not actor.organisation_id:
            accessible_ids = {actor.id}
            for child in db.scalars(
                select(Child).where((Child.owner_id == actor.id) | (Child.admin_id == actor.id))
            ).all():
                accessible_ids.update(filter(None, (child.owner_id, child.admin_id, child.moderator_id)))
            if target.id not in accessible_ids:
                raise HTTPException(status_code=403, detail="You can manage only users linked to your family account")
    if actor.id == target.id and payload.is_active is False:
        raise HTTPException(status_code=422, detail="You cannot deactivate your own account")
    if payload.role is not None and actor.role != Role.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Only a platform administrator can change roles")
    if payload.role == Role.SUPER_ADMIN and target.account_scope != AccountScope.PLATFORM:
        raise HTTPException(status_code=422, detail="Super Admin accounts must have platform scope")
    validate_user_values(
        db,
        role=payload.role or target.role,
        account_scope=target.account_scope,
        organisation_id=target.organisation_id,
        require_active_organisation=False,
    )
    was_active = target.is_active
    for key, value in payload.model_dump(exclude_unset=True).items(): setattr(target, key, value)
    audit(db, actor.id, "user.updated", "user", target.id)
    target = commit(db, target)
    if target.is_active != was_active:
        notifications.account_status(target, target.is_active)
    return target


@router.post("/invitations", response_model=InvitationCreated, status_code=201)
def create_invitation(payload: InvitationCreate, actor: User = Depends(require_permission("team", roles=(Role.ADMIN,))), db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(status_code=409, detail="This email already belongs to an account")
    if payload.role in (Role.SUPER_ADMIN, Role.TTP_EMPLOYEE) and actor.role != Role.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Only a Super Admin can add platform staff")
    if payload.role != Role.TTP_EMPLOYEE:
        payload = payload.model_copy(update={"permissions": []})
    if actor.role == Role.ADMIN:
        if actor.organisation_id:
            if payload.organisation_id != actor.organisation_id or payload.account_scope != AccountScope.ORGANISATION:
                raise HTTPException(status_code=403, detail="Admins can invite only to their own organisation")
        elif payload.organisation_id is not None or payload.account_scope != AccountScope.INDIVIDUAL:
            raise HTTPException(status_code=403, detail="Individual Admins can invite only to their own family account")
        if payload.role == Role.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Only a platform administrator can create this role")
    validate_user_values(
        db,
        role=payload.role,
        account_scope=payload.account_scope,
        organisation_id=payload.organisation_id,
    )
    invited_child = validate_invitation_child(db, payload)
    if invited_child and actor.role == Role.ADMIN:
        require_child_access(invited_child, actor)
    if db.scalar(
        select(Invitation).where(
            Invitation.email == payload.email,
            Invitation.status == InvitationStatus.PENDING,
        )
    ):
        raise HTTPException(status_code=409, detail="A pending invitation already exists for this email")
    invitation = Invitation(**payload.model_dump(exclude={"expires_in_days"}), token=token_urlsafe(32),
                            invited_by_id=actor.id, expires_at=datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days))
    db.add(invitation)
    db.flush()
    audit(db, actor.id, "invitation.created", "invitation", invitation.id, {"role": invitation.role.value})
    invitation = commit(db, invitation)
    _email_invitation(db, invitation, actor)
    # This is the only response that exposes the one-time token. Authenticated
    # account creators can copy the activation link, while list endpoints never
    # expose it again.
    return InvitationCreated.model_validate(invitation).model_copy(
        update={"acceptance_token": invitation.token}
    )


def _email_invitation(db: Session, invitation: Invitation, actor: User) -> None:
    """Email the activation link; the admin can still copy it from the screen as before."""
    organisation = db.get(Organisation, invitation.organisation_id) if invitation.organisation_id else None
    notifications.invitation(invitation, invitation.token, actor, organisation.name if organisation else None)


@router.get("/invitations", response_model=list[InvitationRead])
def list_invitations(actor: User = Depends(require_permission("team", roles=(Role.ADMIN,))), db: Session = Depends(get_db)):
    query = select(Invitation).order_by(Invitation.created_at.desc())
    if actor.role == Role.TTP_EMPLOYEE:
        query = query.where(Invitation.role.notin_([Role.SUPER_ADMIN, Role.TTP_EMPLOYEE]))
    if actor.role == Role.ADMIN:
        query = (
            query.where(Invitation.organisation_id == actor.organisation_id)
            if actor.organisation_id
            else query.where(Invitation.invited_by_id == actor.id)
        )
    return db.scalars(query).all()


@router.post("/invitations/{invitation_id}/activation", response_model=InvitationCreated)
def regenerate_invitation_activation(
    invitation_id: str,
    actor: User = Depends(require_permission("team", roles=(Role.ADMIN,))),
    db: Session = Depends(get_db),
):
    invitation = one_or_404(db, Invitation, invitation_id)
    if invitation.status != InvitationStatus.PENDING:
        raise HTTPException(status_code=409, detail="Only pending invitations can receive a new activation link")
    if invitation.role in (Role.SUPER_ADMIN, Role.TTP_EMPLOYEE) and actor.role != Role.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Only a Super Admin can manage platform staff invitations")
    if actor.role == Role.ADMIN:
        if actor.organisation_id:
            if invitation.organisation_id != actor.organisation_id:
                raise HTTPException(status_code=403, detail="You can manage only your organisation's invitations")
        elif invitation.invited_by_id != actor.id:
            raise HTTPException(status_code=403, detail="You can manage only invitations you created")

    # Rotate the credential so a previously copied link can no longer be used.
    invitation.token = token_urlsafe(32)
    invitation.expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    invitation = commit_audited(
        db,
        invitation,
        actor_id=actor.id,
        action="invitation.activation_regenerated",
        resource_type="invitation",
        metadata={"role": invitation.role.value},
    )
    _email_invitation(db, invitation, actor)
    return InvitationCreated.model_validate(invitation).model_copy(
        update={"acceptance_token": invitation.token}
    )


@router.post("/invitations/accept", response_model=Token)
def accept_invitation(payload: InvitationAccept, db: Session = Depends(get_db)):
    invitation = db.scalar(select(Invitation).where(Invitation.token == payload.token))
    now = datetime.now(timezone.utc)
    if not invitation or invitation.status != InvitationStatus.PENDING or invitation.expires_at.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(status_code=422, detail="Invitation is invalid or has expired")
    if db.scalar(select(User).where(User.email == invitation.email)):
        raise HTTPException(status_code=409, detail="This email already belongs to an account")
    validate_user_values(
        db,
        role=invitation.role,
        account_scope=invitation.account_scope,
        organisation_id=invitation.organisation_id,
    )
    child = None
    if invitation.child_id:
        invitation_payload = InvitationCreate(
            email=invitation.email,
            display_name=invitation.display_name,
            role=invitation.role,
            account_scope=invitation.account_scope,
            organisation_id=invitation.organisation_id,
            child_id=invitation.child_id,
        )
        child = validate_invitation_child(db, invitation_payload)
    user = User(email=invitation.email, display_name=payload.display_name or invitation.display_name or invitation.email.split("@", 1)[0],
                password_hash=hash_password(payload.password), role=invitation.role, account_scope=invitation.account_scope,
                organisation_id=invitation.organisation_id,
                permissions=list(invitation.permissions or []) if invitation.role == Role.TTP_EMPLOYEE else [])
    invitation.status = InvitationStatus.ACCEPTED
    invitation.accepted_at = now
    db.add(user); db.flush()
    if child:
        if invitation.role == Role.MODERATOR:
            child.moderator_id = user.id
        elif invitation.role == Role.MEMBER:
            child.owner_id = user.id
    audit(db, user.id, "invitation.accepted", "invitation", invitation.id)
    db.commit()
    return Token(access_token=create_access_token(user.id))


def audit_filter_for(user: User):
    """SQL condition limiting audit events to the categories this user was given; None means all."""
    if user.role == Role.SUPER_ADMIN:
        return None
    all_prefixes = [prefix for prefixes in AUDIT_CATEGORY_PREFIXES.values() for prefix in prefixes]
    clauses = []
    for category in AUDIT_CATEGORIES:
        if not user.can(f"audit_{category}"):
            continue
        if category == "system":
            clauses.append(and_(*[not_(AuditEvent.action.startswith(prefix)) for prefix in all_prefixes]))
        else:
            clauses.append(or_(*[AuditEvent.action.startswith(prefix) for prefix in AUDIT_CATEGORY_PREFIXES[category]]))
    return or_(*clauses) if clauses else false()


@router.get("/audit-events", response_model=list[AuditEventRead])
def list_audit_events(limit: int = Query(default=100, ge=1, le=500), user: User = Depends(require_permission("audit")), db: Session = Depends(get_db)):
    query = select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(limit)
    condition = audit_filter_for(user)
    if condition is not None:
        query = query.where(condition)
    events = db.scalars(query).all()
    names = {
        row.id: row.display_name
        for row in db.scalars(select(User).where(User.id.in_({e.actor_id for e in events if e.actor_id}))).all()
    } if events else {}
    return [
        AuditEventRead.model_validate(event).model_copy(update={"actor_name": names.get(event.actor_id) if event.actor_id else None})
        for event in events
    ]


@router.get("/admin/overview", response_model=Overview)
def get_admin_overview(
    scope: str = Query(default="all", max_length=80),
    user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.TTP_EMPLOYEE)),
    db: Session = Depends(get_db),
):
    """Key figures for the platform Overview, limited to the areas this person may see."""
    return build_overview(db, user, scope, audit_filter_for(user))


@router.get("/admin/progress", response_model=list[ProgressSummary])
def get_platform_progress(_: User = Depends(require_permission("progress")), db: Session = Depends(get_db)):
    children = db.scalars(select(Child).order_by(Child.name)).all()
    attempts_by_child: dict[str, list[Attempt]] = {child.id: [] for child in children}
    for attempt in db.scalars(select(Attempt).order_by(Attempt.occurred_on, Attempt.created_at)).all():
        attempts_by_child.setdefault(attempt.child_id, []).append(attempt)
    return [progress_summary(child.id, attempts_by_child[child.id]) for child in children]


@router.get("/organisations", response_model=list[OrganisationRead])
def list_organisations(_: User = Depends(require_permission("organisations", "team", "children")), db: Session = Depends(get_db)):
    return db.scalars(select(Organisation).order_by(Organisation.name)).all()


@router.get("/organisations/{organisation_id}", response_model=OrganisationRead)
def get_organisation(organisation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user.is_platform and user.organisation_id != organisation_id:
        raise HTTPException(status_code=403, detail="You cannot access this organisation")
    return one_or_404(db, Organisation, organisation_id)


@router.post("/organisations", response_model=OrganisationRead, status_code=201)
def create_organisation(payload: OrganisationCreate, actor: User = Depends(require_permission("organisations")), db: Session = Depends(get_db)):
    if db.scalar(select(Organisation).where(Organisation.name == payload.name)):
        raise HTTPException(status_code=409, detail="Organisation name already exists")
    return commit_audited(
        db,
        Organisation(**payload.model_dump()),
        actor_id=actor.id,
        action="organisation.created",
        resource_type="organisation",
    )


@router.patch("/organisations/{organisation_id}", response_model=OrganisationRead)
def update_organisation(organisation_id: str, payload: OrganisationUpdate, actor: User = Depends(require_permission("organisations")), db: Session = Depends(get_db)):
    item = one_or_404(db, Organisation, organisation_id)
    if payload.name is not None and db.scalar(
        select(Organisation).where(Organisation.name == payload.name, Organisation.id != item.id)
    ):
        raise HTTPException(status_code=409, detail="Organisation name already exists")
    changes = payload.model_dump(exclude_unset=True)
    if changes.get("seat_limit"):
        in_use = db.scalar(
            select(func.count(Child.id)).where(Child.organisation_id == item.id, Child.is_active.is_(True))
        ) or 0
        if changes["seat_limit"] < in_use:
            raise HTTPException(
                status_code=409,
                detail=f"{in_use} licenses are in use. Deactivate children first, or choose {in_use} or more.",
            )
    for key, value in changes.items(): setattr(item, key, value)
    return commit_audited(
        db,
        item,
        actor_id=actor.id,
        action="organisation.updated",
        resource_type="organisation",
        metadata={"fields": sorted(changes)},
    )


@router.get("/play-plans", response_model=list[PlayPlanRead])
def list_plans(include_inactive: bool = False, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role == Role.TTP_EMPLOYEE and not user.can("plans"):
        raise HTTPException(status_code=403, detail="You do not have permission to view Play Plans")
    if include_inactive and not user.can("plans"):
        raise HTTPException(status_code=403, detail="Only a platform administrator can view inactive content")
    query = select(PlayPlan).options(selectinload(PlayPlan.play_doses).selectinload(PlayDose.activities)).order_by(PlayPlan.sort_order, PlayPlan.name)
    if not include_inactive:
        query = query.where(
            PlayPlan.is_active.is_(True),
            PlayPlan.publication_status != PlanPublicationStatus.INVISIBLE,
        )
    rows = db.scalars(query).unique().all()
    if include_inactive:
        return rows

    # Every signed-in account can browse the catalog. A family whose children are all on the free
    # tier gets the steps and videos only for the first Play Dose (Rookie) of the Play Plan they
    # chose; every other dose and plan shows its name and summary, so they can still pick one or
    # decide to subscribe.
    open_ids = _open_play_plan_ids(db, user)
    plans: list[PlayPlanRead] = []
    for row in rows:
        plan = PlayPlanRead.model_validate(row)
        doses = [dose for dose in plan.play_doses if dose.is_active]
        free_id = _free_dose_id(doses)
        doses = [dose.model_copy(update={"is_free_dose": dose.id == free_id}) for dose in doses]
        if open_ids is not None:
            plan_open = plan.id in open_ids
            doses = [
                dose if plan_open and dose.id == free_id else _without_content(dose)
                for dose in doses
            ]
            if not plan_open:
                plan = plan.model_copy(update={"access_locked": True})
        plans.append(plan.model_copy(update={"play_doses": doses}))
    return plans


LEVEL_ORDER = {PlanLevel.ROOKIE: 0, PlanLevel.STARTER: 1, PlanLevel.PRO: 2}


def _free_dose_id(doses) -> str | None:
    """The Play Dose the free tier opens in a family's chosen plan: its first level."""
    if not doses:
        return None
    return min(doses, key=lambda dose: (LEVEL_ORDER.get(dose.level, 9), dose.sort_order)).id


def _open_play_plan_ids(db: Session, user: User) -> set[str] | None:
    """The Play Plans a family may open in full, or None when every plan is open to them."""
    if user.is_platform or user.account_scope != AccountScope.INDIVIDUAL:
        return None
    children = db.scalars(
        select(Child)
        .options(selectinload(Child.subscription))
        .where((Child.owner_id == user.id) | (Child.admin_id == user.id) | (Child.moderator_id == user.id))
    ).all()
    if any(child.has_full_access for child in children):
        return None
    return {child.free_play_plan_id for child in children if child.free_play_plan_id}


def _without_content(dose: PlayDoseRead) -> PlayDoseRead:
    activities = [
        activity.model_copy(
            update={"instructions": [], "instructions_html": None, "video_url": None, "video_source_type": None}
        )
        for activity in dose.activities
    ]
    return dose.model_copy(update={"activities": activities, "access_locked": True})


def _apply_order(rows: list, ids: list[str]) -> None:
    """Number rows in the order given; rows the caller did not list (e.g. hidden ones) follow in their old order."""
    known = {row.id for row in rows}
    if len(set(ids)) != len(ids) or not set(ids) <= known:
        raise HTTPException(status_code=422, detail="Send each known item at most once")
    rest = sorted((row for row in rows if row.id not in set(ids)), key=lambda row: row.sort_order)
    by_id = {row.id: row for row in rows}
    for index, row in enumerate([by_id[i] for i in ids] + rest):
        row.sort_order = index


@router.put("/play-plans/order", response_model=list[PlayPlanRead])
def reorder_plans(payload: OrderUpdate, actor: User = Depends(require_permission("plans")), db: Session = Depends(get_db)):
    rows = db.scalars(select(PlayPlan)).unique().all()
    _apply_order(rows, payload.ids)
    audit(db, actor.id, "play_plan.reordered", "play_plan", payload.ids[0])
    db.commit()
    return db.scalars(
        select(PlayPlan)
        .options(selectinload(PlayPlan.play_doses).selectinload(PlayDose.activities))
        .order_by(PlayPlan.sort_order, PlayPlan.name)
    ).unique().all()


@router.put("/play-plans/{plan_id}/play-doses/order", response_model=PlayPlanRead)
def reorder_doses(plan_id: str, payload: OrderUpdate, actor: User = Depends(require_permission("plans")), db: Session = Depends(get_db)):
    plan = one_or_404(db, PlayPlan, plan_id)
    _apply_order(list(plan.play_doses), payload.ids)
    audit(db, actor.id, "play_dose.reordered", "play_plan", plan.id)
    db.commit()
    db.refresh(plan)
    return plan


@router.post("/play-plans", response_model=PlayPlanRead, status_code=201)
def create_plan(payload: PlayPlanCreate, actor: User = Depends(require_permission("plans")), db: Session = Depends(get_db)):
    if db.scalar(select(PlayPlan).where((PlayPlan.slug == payload.slug) | (PlayPlan.name == payload.name))):
        raise HTTPException(status_code=409, detail="Play Plan name or slug already exists")
    data = payload.model_dump()
    credit = (data.pop("created_by_name", None) or "").strip()
    last = db.scalar(select(func.max(PlayPlan.sort_order)))
    return commit_audited(
        db,
        PlayPlan(**data, sort_order=0 if last is None else last + 1, created_by_id=actor.id, created_by_label=credit or actor.display_name),
        actor_id=actor.id,
        action="play_plan.created",
        resource_type="play_plan",
    )


@router.patch("/play-plans/{plan_id}", response_model=PlayPlanRead)
def update_plan(plan_id: str, payload: PlayPlanUpdate, actor: User = Depends(require_permission("plans")), db: Session = Depends(get_db)):
    item = one_or_404(db, PlayPlan, plan_id)
    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes or "slug" in changes:
        name = changes.get("name", item.name)
        slug = changes.get("slug", item.slug)
        if db.scalar(
            select(PlayPlan).where(
                PlayPlan.id != item.id,
                (PlayPlan.name == name) | (PlayPlan.slug == slug),
            )
        ):
            raise HTTPException(status_code=409, detail="Play Plan name or slug already exists")
    if "created_by_name" in changes:
        item.created_by_label = (changes.pop("created_by_name") or "").strip() or None
    for key, value in changes.items(): setattr(item, key, value)
    return commit_audited(
        db,
        item,
        actor_id=actor.id,
        action="play_plan.updated",
        resource_type="play_plan",
        metadata={"fields": sorted(changes)},
    )


@router.post("/play-plans/{plan_id}/play-doses", response_model=PlayDoseRead, status_code=201)
def create_dose(plan_id: str, payload: PlayDoseCreate, actor: User = Depends(require_permission("plans")), db: Session = Depends(get_db)):
    one_or_404(db, PlayPlan, plan_id)
    if db.scalar(select(PlayDose).where(PlayDose.play_plan_id == plan_id, PlayDose.level == payload.level)):
        raise HTTPException(status_code=409, detail="This Play Plan already has a Play Dose at this level")
    data = payload.model_dump()
    credit = (data.pop("created_by_name", None) or "").strip()
    # New doses join the end; admins reorder them afterwards.
    last = db.scalar(select(func.max(PlayDose.sort_order)).where(PlayDose.play_plan_id == plan_id))
    data["sort_order"] = 0 if last is None else last + 1
    return commit_audited(
        db,
        PlayDose(play_plan_id=plan_id, **data, created_by_id=actor.id, created_by_label=credit or actor.display_name),
        actor_id=actor.id,
        action="play_dose.created",
        resource_type="play_dose",
        metadata={"play_plan_id": plan_id},
    )


@router.patch("/play-doses/{dose_id}", response_model=PlayDoseRead)
def update_dose(dose_id: str, payload: PlayDoseUpdate, actor: User = Depends(require_permission("plans")), db: Session = Depends(get_db)):
    item = one_or_404(db, PlayDose, dose_id)
    old_thumbnail_url = item.thumbnail_url
    changes = payload.model_dump(exclude_unset=True)
    if "level" in changes and db.scalar(
        select(PlayDose).where(
            PlayDose.play_plan_id == item.play_plan_id,
            PlayDose.level == changes["level"],
            PlayDose.id != item.id,
        )
    ):
        raise HTTPException(status_code=409, detail="This Play Plan already has a Play Dose at this level")
    if "created_by_name" in changes:
        item.created_by_label = (changes.pop("created_by_name") or "").strip() or None
    for key, value in changes.items(): setattr(item, key, value)
    updated = commit_audited(
        db,
        item,
        actor_id=actor.id,
        action="play_dose.updated",
        resource_type="play_dose",
        metadata={"fields": sorted(changes)},
    )
    if old_thumbnail_url != updated.thumbnail_url:
        discard_stored_asset(get_storage(), old_thumbnail_url)
    return updated


@router.delete("/play-doses/{dose_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dose(dose_id: str, actor: User = Depends(require_roles(Role.SUPER_ADMIN)), db: Session = Depends(get_db)):
    item = one_or_404(db, PlayDose, dose_id)
    if item.children or item.attempts:
        raise HTTPException(status_code=409, detail="Move children and retain attempt history before deleting this Play Dose")
    stored_urls = [item.thumbnail_url, *(activity.video_url for activity in item.activities)]
    db.delete(item)
    audit(db, actor.id, "play_dose.deleted", "play_dose", dose_id)
    db.commit()
    storage = get_storage()
    for url in stored_urls:
        discard_stored_asset(storage, url)


@router.post("/play-doses/{dose_id}/activities", response_model=ActivityRead, status_code=201)
def create_activity(dose_id: str, payload: ActivityCreate, actor: User = Depends(require_permission("plans")), db: Session = Depends(get_db)):
    one_or_404(db, PlayDose, dose_id)
    if db.scalar(
        select(Activity).where(Activity.play_dose_id == dose_id, Activity.sequence == payload.sequence)
    ):
        raise HTTPException(status_code=409, detail="This Play Dose already has an Activity at this sequence")
    return commit_audited(
        db,
        Activity(play_dose_id=dose_id, **payload.model_dump()),
        actor_id=actor.id,
        action="activity.created",
        resource_type="activity",
        metadata={"play_dose_id": dose_id},
    )


@router.patch("/activities/{activity_id}", response_model=ActivityRead)
def update_activity(activity_id: str, payload: ActivityUpdate, actor: User = Depends(require_permission("plans")), db: Session = Depends(get_db)):
    item = one_or_404(db, Activity, activity_id)
    old_video_url = item.video_url
    values = payload.model_dump(exclude_unset=True)
    if "sequence" in values and db.scalar(
        select(Activity).where(
            Activity.play_dose_id == item.play_dose_id,
            Activity.sequence == values["sequence"],
            Activity.id != item.id,
        )
    ):
        raise HTTPException(status_code=409, detail="This Play Dose already has an Activity at this sequence")
    # A client can intentionally clear both video fields to make an instruction-only activity.
    if ("video_source_type" in values) ^ ("video_url" in values):
        raise HTTPException(status_code=422, detail="Update both video fields together, or clear both")
    if "video_source_type" in values and bool(values["video_source_type"]) != bool(values["video_url"]):
        raise HTTPException(status_code=422, detail="Update both video fields together, or clear both")
    for key, value in values.items(): setattr(item, key, value)
    updated = commit_audited(
        db,
        item,
        actor_id=actor.id,
        action="activity.updated",
        resource_type="activity",
        metadata={"fields": sorted(values)},
    )
    if old_video_url != updated.video_url:
        discard_stored_asset(get_storage(), old_video_url)
    return updated


@router.delete("/activities/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity(activity_id: str, actor: User = Depends(require_roles(Role.SUPER_ADMIN)), db: Session = Depends(get_db)):
    item = one_or_404(db, Activity, activity_id)
    if item.attempts:
        raise HTTPException(status_code=409, detail="Activities with attempt history cannot be deleted")
    stored_url = item.video_url
    db.delete(item)
    audit(db, actor.id, "activity.deleted", "activity", activity_id)
    db.commit()
    discard_stored_asset(get_storage(), stored_url)


@router.get("/children", response_model=list[ChildRead])
def list_children(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user = _
    query = select(Child).options(selectinload(Child.subscription), selectinload(Child.owner)).order_by(Child.name)
    if not user.can("children", "progress"):
        if user.organisation_id and user.role == Role.ADMIN:
            query = query.where(Child.organisation_id == user.organisation_id)
        else:
            query = query.where((Child.owner_id == user.id) | (Child.admin_id == user.id) | (Child.moderator_id == user.id))
    return db.scalars(query).all()


@router.post("/children", response_model=ChildRead, status_code=201)
def create_child(payload: ChildCreate, user: User = Depends(require_permission("children", roles=(Role.ADMIN,))), db: Session = Depends(get_db)):
    data = payload.model_dump()
    if user.role == Role.ADMIN:
        if user.organisation_id:
            data["organisation_id"] = user.organisation_id
            data["account_scope"] = AccountScope.ORGANISATION
            data["admin_id"] = user.id
        else:
            data["account_scope"] = AccountScope.INDIVIDUAL
            data["organisation_id"] = None
            data["owner_id"] = user.id
            data["admin_id"] = user.id
    if not data.get("current_play_dose_id"):
        starter = default_starter_dose(db)
        if starter:
            data["current_play_dose_id"] = starter.id
            data["plan_started_at"] = data.get("plan_started_at") or date.today()
    data["is_active"] = True
    validate_child_values(db, data)
    data.pop("is_active")
    return commit_audited(
        db,
        Child(**data),
        actor_id=user.id,
        action="child.created",
        resource_type="child",
    )


@router.put("/children/{child_id}/free-play-plan", response_model=ChildRead)
def choose_free_play_plan(child_id: str, payload: FreePlayPlanChoice, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """A free family picks the one Play Plan their child can open. It can't be changed afterwards,
    except by platform staff (who can also clear it)."""
    child = one_or_404(db, Child, child_id); require_child_access(child, user)
    staff = user.can("children")
    if not staff and not (child.owner_id == user.id or child.admin_id == user.id):
        raise HTTPException(status_code=403, detail="Only the family's account holder can choose the free Play Plan")
    if child.account_scope != AccountScope.INDIVIDUAL:
        raise HTTPException(status_code=409, detail="Organisation children already have every Play Plan")
    if payload.play_plan_id is None:
        if not staff:
            raise HTTPException(status_code=403, detail="Only platform staff can clear the free Play Plan")
    else:
        if child.free_play_plan_id and child.free_play_plan_id != payload.play_plan_id and not staff:
            raise HTTPException(status_code=409, detail="The free Play Plan has already been chosen")
        plan = one_or_404(db, PlayPlan, payload.play_plan_id)
        if not plan.is_active or plan.publication_status != PlanPublicationStatus.PUBLISHED:
            raise HTTPException(status_code=409, detail="Choose a published Play Plan")
    child.free_play_plan_id = payload.play_plan_id
    return commit_audited(
        db,
        child,
        actor_id=user.id,
        action="child.free_play_plan_chosen",
        resource_type="child",
        metadata={"play_plan_id": payload.play_plan_id},
    )


@router.patch("/children/{child_id}", response_model=ChildRead)
def update_child(child_id: str, payload: ChildUpdate, user: User = Depends(require_permission("children", roles=(Role.ADMIN,))), db: Session = Depends(get_db)):
    child = one_or_404(db, Child, child_id); require_child_access(child, user)
    if not user.is_platform and (payload.account_scope is not None or payload.organisation_id is not None):
        raise HTTPException(status_code=403, detail="Only a platform administrator can move a child between account scopes")
    changes = payload.model_dump(exclude_unset=True)
    proposed = {
        "account_scope": child.account_scope,
        "organisation_id": child.organisation_id,
        "owner_id": child.owner_id,
        "admin_id": child.admin_id,
        "moderator_id": child.moderator_id,
        "current_play_dose_id": child.current_play_dose_id,
        "is_active": child.is_active,
        **changes,
    }
    validate_child_values(db, proposed, child.id)
    for key, value in changes.items(): setattr(child, key, value)
    return commit_audited(
        db,
        child,
        actor_id=user.id,
        action="child.updated",
        resource_type="child",
        metadata={"fields": sorted(changes)},
    )


@router.put("/children/{child_id}/subscription", response_model=SubscriptionRead)
def upsert_subscription(child_id: str, payload: SubscriptionUpsert, user: User = Depends(require_permission("billing", roles=(Role.ADMIN,))), db: Session = Depends(get_db)):
    child = one_or_404(db, Child, child_id)
    # Billing staff manage any family's subscription without needing the Children area too.
    if not user.can("billing"):
        require_child_access(child, user)
    if (
        get_settings().environment == "production"
        and not user.is_platform
        and child.account_scope == AccountScope.INDIVIDUAL
    ):
        raise HTTPException(status_code=503, detail="Paid subscriptions must be activated by the payment provider")
    subscription = child.subscription or Subscription(child_id=child.id)
    for key, value in payload.model_dump().items(): setattr(subscription, key, value)
    subscription.stripe_checkout_session_id = None
    subscription.stripe_payment_intent_id = None
    subscription.stripe_customer_id = None
    subscription.stripe_refund_id = None
    db.add(subscription)
    db.flush()
    audit(db, user.id, "subscription.manually_updated", "subscription", subscription.id)
    return commit(db, subscription)


def add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    return date(year, month, min(value.day, calendar.monthrange(year, month)[1]))


@router.post("/billing/checkout", response_model=CheckoutCreated, status_code=201)
def create_billing_checkout(
    payload: CheckoutCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    child = one_or_404(db, Child, payload.child_id)
    require_child_access(child, user)
    if child.account_scope != AccountScope.INDIVIDUAL:
        raise HTTPException(status_code=422, detail="Organisation children are billed by license")
    if user.role != Role.SUPER_ADMIN and child.owner_id != user.id and child.admin_id != user.id:
        raise HTTPException(status_code=403, detail="Only the family account owner can purchase this plan")
    current = child.subscription
    if current and current.status == SubscriptionStatus.ACTIVE and (
        current.ends_on is None or current.ends_on >= date.today()
    ) and not current.renewal_open:
        raise HTTPException(status_code=409, detail="This child already has an active subscription")
    try:
        checkout = create_checkout(
            get_settings(),
            user_id=user.id,
            email=user.email,
            child_id=child.id,
            plan=payload.plan,
        )
    except BillingError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    audit(db, user.id, "billing.checkout_created", "child", child.id, {"plan": payload.plan})
    db.commit()
    return CheckoutCreated(checkout_url=checkout.url)


@router.post("/billing/refund/{child_id}", response_model=SubscriptionRead)
def refund_billing_payment(
    child_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    child = one_or_404(db, Child, child_id)
    require_child_access(child, user)
    if user.role != Role.SUPER_ADMIN and child.owner_id != user.id and child.admin_id != user.id:
        raise HTTPException(status_code=403, detail="Only the family account owner can request a refund")
    subscription = child.subscription
    if not subscription or not subscription.stripe_payment_intent_id:
        raise HTTPException(status_code=422, detail="This subscription was not purchased through Stripe")
    if subscription.status != SubscriptionStatus.ACTIVE:
        raise HTTPException(status_code=409, detail="This subscription is not active")
    if not subscription.refundable_until or date.today() > subscription.refundable_until:
        raise HTTPException(status_code=422, detail="The 7-day refund window has closed")
    try:
        subscription.stripe_refund_id = create_refund(
            get_settings(), subscription.stripe_payment_intent_id, child.id
        )
    except BillingError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if subscription.previous_ends_on and subscription.previous_ends_on >= date.today():
        # Refunding a renewal: the child keeps the period that was already paid for.
        # Nothing is left to refund or restore, so later refund webhooks must not touch it.
        refund_id = subscription.stripe_refund_id
        subscription.ends_on = subscription.previous_ends_on
        subscription.previous_ends_on = None
        subscription.stripe_payment_intent_id = None
        subscription.stripe_refund_id = None
        audit(db, user.id, "billing.renewal_refunded", "subscription", subscription.id, {"refund_id": refund_id})
        subscription = commit(db, subscription)
        notifications.refund_started(child.owner, child.name, subscription.ends_on)
        return subscription
    subscription.status = SubscriptionStatus.CANCELLED
    subscription.ends_on = date.today()
    audit(db, user.id, "billing.refunded", "subscription", subscription.id)
    subscription = commit(db, subscription)
    notifications.refund_started(child.owner, child.name, None)
    return subscription


def stripe_field(value, key: str, default=None):
    if isinstance(value, dict):
        return value.get(key, default)
    return getattr(value, key, default)


@router.post("/billing/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")
    try:
        event = parse_webhook(get_settings(), payload, signature)
    except BillingError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    event_type = stripe_field(event, "type", "")
    event_id = stripe_field(event, "id")
    if not event_id:
        raise HTTPException(status_code=422, detail="Stripe event ID is missing")
    if db.get(StripeEvent, event_id):
        return {"received": True}
    if event_type in {"refund.updated", "refund.failed"}:
        refund_data = stripe_field(stripe_field(event, "data", {}), "object", {})
        refund_id = stripe_field(refund_data, "id")
        refund_status = stripe_field(refund_data, "status")
        subscription = db.scalar(
            select(Subscription).where(Subscription.stripe_refund_id == refund_id)
        )
        if subscription:
            outcome = None
            if event_type == "refund.failed" or refund_status in {"failed", "canceled"}:
                subscription.status = SubscriptionStatus.ACTIVE
                audit(db, None, "billing.refund_failed", "subscription", subscription.id)
                outcome = notifications.refund_failed
            elif refund_status == "succeeded":
                subscription.status = SubscriptionStatus.CANCELLED
                subscription.ends_on = date.today()
                audit(db, None, "billing.refund_completed", "subscription", subscription.id)
                outcome = notifications.refund_completed
            db.add(StripeEvent(id=event_id, event_type=event_type))
            db.commit()
            if outcome and subscription.child:
                outcome(subscription.child.owner, subscription.child.name)
        return {"received": True}
    if event_type not in {"checkout.session.completed", "checkout.session.async_payment_succeeded"}:
        return {"received": True}
    data = stripe_field(stripe_field(event, "data", {}), "object", {})
    if stripe_field(data, "payment_status") != "paid":
        return {"received": True}
    metadata = stripe_field(data, "metadata", {}) or {}
    child_id = stripe_field(metadata, "child_id")
    plan = stripe_field(metadata, "plan")
    selected = plan_price(get_settings(), plan)
    child = db.get(Child, child_id) if child_id else None
    if not child or not selected:
        logger.error("Stripe webhook has invalid metadata", extra={"child_id": child_id, "plan": plan})
        raise HTTPException(status_code=422, detail="Stripe metadata does not match a purchase")
    if not paid_in_full(data, selected, stripe_field):
        raise HTTPException(status_code=422, detail="Stripe payment amount does not match the selected plan")
    session_id = stripe_field(data, "id")
    payment_intent_id = stripe_field(data, "payment_intent")
    if not session_id or not payment_intent_id:
        raise HTTPException(status_code=422, detail="Stripe payment references are incomplete")
    subscription = child.subscription or Subscription(child_id=child.id)
    if subscription.stripe_checkout_session_id == session_id:
        return {"received": True}
    paid_at = datetime.fromtimestamp(
        int(stripe_field(data, "created", datetime.now(timezone.utc).timestamp())),
        tz=timezone.utc,
    ).date()
    # A renewal bought during the last days carries on from the current last day, so no paid day is lost.
    renewing_from = (
        subscription.ends_on
        if subscription.status == SubscriptionStatus.ACTIVE and subscription.ends_on and subscription.ends_on >= paid_at
        else None
    )
    subscription.status = SubscriptionStatus.ACTIVE
    subscription.plan_name = plan
    subscription.started_on = paid_at
    subscription.ends_on = add_months(renewing_from or paid_at, selected["months"])
    subscription.previous_ends_on = renewing_from
    subscription.stripe_checkout_session_id = session_id
    subscription.stripe_payment_intent_id = payment_intent_id
    subscription.stripe_customer_id = stripe_field(data, "customer")
    subscription.stripe_refund_id = None
    db.add(subscription)
    db.flush()
    audit(db, None, "billing.payment_completed", "subscription", subscription.id, {"plan": plan})
    db.add(StripeEvent(id=event_id, event_type=event_type))
    db.commit()
    notifications.payment_confirmed(
        child.owner, child.name, selected["name"], selected["amount"], subscription.ends_on, renewing_from is not None
    )
    return {"received": True}


@router.get("/children/{child_id}/attempts", response_model=list[AttemptRead])
def list_attempts(child_id: str, play_plan_id: str | None = None, from_date: date | None = None, to_date: date | None = None,
                  user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    child = one_or_404(db, Child, child_id); require_child_access(child, user)
    if from_date and to_date and from_date > to_date:
        raise HTTPException(status_code=422, detail="from_date must be on or before to_date")
    query = select(Attempt).options(selectinload(Attempt.logged_by)).where(Attempt.child_id == child_id)
    if play_plan_id: query = query.where(Attempt.play_plan_id == play_plan_id)
    if from_date: query = query.where(Attempt.occurred_on >= from_date)
    if to_date: query = query.where(Attempt.occurred_on <= to_date)
    return db.scalars(query.order_by(Attempt.occurred_on.desc(), Attempt.created_at.desc())).all()


@router.post("/children/{child_id}/attempts", response_model=AttemptRead, status_code=201)
def create_attempt(child_id: str, payload: AttemptCreate, user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MODERATOR)), db: Session = Depends(get_db)):
    child = one_or_404(db, Child, child_id); require_child_access(child, user)
    if not child.is_active:
        raise HTTPException(status_code=409, detail="Attempts cannot be logged for an inactive child")
    if child.organisation and not child.organisation.is_active:
        raise HTTPException(status_code=409, detail="Attempts cannot be logged for a suspended organisation")
    if user.role != Role.SUPER_ADMIN and not child.has_full_access:
        raise HTTPException(status_code=403, detail="An active subscription is required to log attempts")
    dose = one_or_404(db, PlayDose, payload.play_dose_id)
    if (
        not dose.is_active
        or not dose.play_plan.is_active
        or dose.play_plan.publication_status != PlanPublicationStatus.PUBLISHED
    ):
        raise HTTPException(status_code=409, detail="Attempts can only be logged against published content")
    activity = one_or_404(db, Activity, payload.activity_id) if payload.activity_id else None
    if activity and activity.play_dose_id != dose.id: raise HTTPException(status_code=422, detail="Activity does not belong to Play Dose")
    if activity and not activity.is_loggable:
        raise HTTPException(status_code=422, detail="This Activity is not loggable")
    existing_attempts = db.scalars(
        select(Attempt).where(
            Attempt.child_id == child.id,
            Attempt.play_dose_id == dose.id,
            Attempt.run_number == payload.run_number,
        )
    ).all()
    week_anchor = min([payload.occurred_on, *(item.occurred_on for item in existing_attempts)])
    for existing in existing_attempts:
        existing.week_number = (existing.occurred_on - week_anchor).days // 7 + 1
    week_number = (payload.occurred_on - week_anchor).days // 7 + 1
    attempt = Attempt(
        child_id=child.id,
        play_plan_id=dose.play_plan_id,
        play_dose_id=dose.id,
        activity_id=activity.id if activity else None,
        logged_by_id=user.id,
        is_real_life_try=bool(activity and activity.is_real_life_try),
        week_number=week_number,
        **payload.model_dump(exclude={"play_dose_id", "activity_id"}),
    )
    db.add(attempt)
    db.flush()
    audit(db, user.id, "attempt.created", "attempt", attempt.id, {"child_id": child.id, "play_plan_id": dose.play_plan_id})
    return commit(db, attempt)


@router.patch("/children/{child_id}/attempts/{attempt_id}", response_model=AttemptRead)
def correct_attempt(child_id: str, attempt_id: str, payload: AttemptCreate,
                    user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MODERATOR)),
                    db: Session = Depends(get_db)):
    child = one_or_404(db, Child, child_id)
    require_child_access(child, user)
    attempt = one_or_404(db, Attempt, attempt_id)
    if attempt.child_id != child.id:
        raise HTTPException(status_code=404, detail="Session not found")
    if not child.is_active or (child.organisation and not child.organisation.is_active):
        raise HTTPException(status_code=409, detail="Sessions cannot be edited for an inactive child or organisation")
    if user.role != Role.SUPER_ADMIN and not child.has_full_access:
        raise HTTPException(status_code=403, detail="An active subscription is required to edit sessions")
    if payload.play_dose_id != attempt.play_dose_id or payload.activity_id != attempt.activity_id:
        raise HTTPException(status_code=422, detail="A correction cannot change the session's activity or Play Dose")
    fields = ("occurred_on", "completion_status", "help_level", "completion_score", "mood_score", "big_win", "notes")
    before = {field: getattr(attempt, field) for field in fields}
    after = payload.model_dump(include=set(fields))
    for field, value in after.items():
        setattr(attempt, field, value)
    # Keep the original author and preserve every changed value in the append-only audit trail.
    def serialise(values):
        return {key: value.isoformat() if isinstance(value, date) else value for key, value in values.items()}
    audit(db, user.id, "attempt.corrected", "attempt", attempt.id,
          {"child_id": child.id, "before": serialise(before), "after": serialise(after)})
    siblings = db.scalars(select(Attempt).where(Attempt.child_id == child.id,
                         Attempt.play_dose_id == attempt.play_dose_id,
                         Attempt.run_number == attempt.run_number)).all()
    anchor = min(item.occurred_on for item in siblings)
    for item in siblings:
        item.week_number = (item.occurred_on - anchor).days // 7 + 1
    return commit(db, attempt)


@router.get("/children/{child_id}/progress", response_model=ProgressSummary)
def get_progress(child_id: str, play_plan_id: str | None = Query(default=None), from_date: date | None = None,
                 to_date: date | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    child = one_or_404(db, Child, child_id); require_child_access(child, user)
    if from_date and to_date and from_date > to_date:
        raise HTTPException(status_code=422, detail="from_date must be on or before to_date")
    query = select(Attempt).where(Attempt.child_id == child_id)
    if play_plan_id: query = query.where(Attempt.play_plan_id == play_plan_id)
    if from_date: query = query.where(Attempt.occurred_on >= from_date)
    if to_date: query = query.where(Attempt.occurred_on <= to_date)
    return progress_summary(child.id, db.scalars(query).all())


@router.post("/play-doses/{dose_id}/thumbnail", response_model=PlayDoseRead)
def upload_dose_thumbnail(dose_id: str, file: UploadFile = File(...), actor: User = Depends(require_permission("plans")), db: Session = Depends(get_db), storage: StorageService = Depends(get_storage)):
    dose = one_or_404(db, PlayDose, dose_id)
    old_url = dose.thumbnail_url
    new_url = store_upload(file, "thumbnails", storage)
    dose.thumbnail_url = new_url
    try:
        audit(db, actor.id, "play_dose.thumbnail_uploaded", "play_dose", dose.id)
        saved = commit(db, dose)
    except Exception:
        db.rollback()
        discard_stored_asset(storage, new_url)
        raise
    discard_stored_asset(storage, old_url)
    return saved


@router.post("/activities/{activity_id}/video", response_model=ActivityRead)
def upload_activity_video(activity_id: str, file: UploadFile = File(...), actor: User = Depends(require_permission("plans")), db: Session = Depends(get_db), storage: StorageService = Depends(get_storage)):
    activity = one_or_404(db, Activity, activity_id)
    old_url = activity.video_url
    new_url = store_upload(file, "videos", storage)
    activity.video_source_type = VideoSourceType.UPLOAD
    activity.video_url = new_url
    try:
        audit(db, actor.id, "activity.video_uploaded", "activity", activity.id)
        saved = commit(db, activity)
    except Exception:
        db.rollback()
        discard_stored_asset(storage, new_url)
        raise
    discard_stored_asset(storage, old_url)
    return saved


def require_test_persona(user: User) -> None:
    settings = get_settings()
    if settings.environment == "production" or not settings.enable_test_personas:
        raise HTTPException(status_code=404, detail="Test personas are disabled")
    if user.role != Role.SUPER_ADMIN or user.email not in {"tester@playhub.local", "tester@playhub.test"}:
        raise HTTPException(status_code=403, detail="Only the seeded tester account can switch personas")


@router.get("/developer/personas", response_model=list[PersonaRead])
def list_test_personas(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_test_persona(user)
    return db.scalars(select(User).where((User.email.like("%@playhub.local")) | (User.email.like("%@playhub.test"))).order_by(User.display_name)).all()


@router.post("/developer/personas/{persona_id}/switch", response_model=Token)
def switch_test_persona(persona_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_test_persona(user)
    persona = one_or_404(db, User, persona_id)
    if not persona.is_active or not (persona.email.endswith("@playhub.local") or persona.email.endswith("@playhub.test")):
        raise HTTPException(status_code=422, detail="That account is not a test persona")
    audit(db, user.id, "developer.persona_switched", "user", persona.id)
    db.commit()
    return Token(access_token=create_access_token(persona.id))


HOMEPAGE_KEY = "homepage"


def _site_content_read(row: SiteContent | None) -> SiteContentRead:
    return SiteContentRead(content=row.content if row else None, updated_at=row.updated_at if row else None)


@router.get("/site-content/homepage", response_model=SiteContentRead)
def get_homepage_content(db: Session = Depends(get_db)):
    """Public: the landing page reads its copy from here and falls back to its own defaults."""
    return _site_content_read(db.get(SiteContent, HOMEPAGE_KEY))


@router.put("/site-content/homepage", response_model=SiteContentRead)
def save_homepage_content(
    payload: HomepageContent,
    actor: User = Depends(require_permission("homepage")),
    db: Session = Depends(get_db),
):
    row = db.get(SiteContent, HOMEPAGE_KEY) or SiteContent(key=HOMEPAGE_KEY, content={})
    row.content = payload.model_dump(mode="json")
    row.updated_by_id = actor.id
    db.add(row)
    db.flush()
    audit(db, actor.id, "site_content.updated", "site_content", HOMEPAGE_KEY)
    db.commit()
    db.refresh(row)
    return _site_content_read(row)


@router.post("/site-content/homepage/image")
def upload_homepage_image(
    file: UploadFile = File(...),
    actor: User = Depends(require_permission("homepage")),
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
):
    """Stores a picture for the home page and returns its address; it goes live once the page is saved."""
    url = store_upload(file, "homepage", storage)
    audit(db, actor.id, "site_content.image_uploaded", "site_content", HOMEPAGE_KEY)
    db.commit()
    return {"url": url}


@router.delete("/site-content/homepage", status_code=status.HTTP_204_NO_CONTENT)
def reset_homepage_content(actor: User = Depends(require_permission("homepage")), db: Session = Depends(get_db)):
    """Removes the saved copy so the landing page shows its built-in defaults again."""
    row = db.get(SiteContent, HOMEPAGE_KEY)
    if row:
        db.delete(row)
        audit(db, actor.id, "site_content.reset", "site_content", HOMEPAGE_KEY)
        db.commit()


@router.get("/site-content/branding", response_model=SiteContentRead)
def get_branding(db: Session = Depends(get_db)):
    return _site_content_read(db.get(SiteContent, "branding"))


@router.post("/site-content/branding/logo", response_model=SiteContentRead)
def upload_application_logo(
    file: UploadFile = File(...),
    actor: User = Depends(require_roles(Role.SUPER_ADMIN)),
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
):
    url = store_upload(file, "branding", storage)
    row = db.get(SiteContent, "branding") or SiteContent(key="branding", content={})
    old_url = row.content.get("logo_url")
    row.content = {"logo_url": url}
    row.updated_by_id = actor.id
    db.add(row)
    try:
        audit(db, actor.id, "site_content.updated", "site_content", "branding")
        db.commit()
        db.refresh(row)
    except Exception:
        db.rollback()
        discard_stored_asset(storage, url)
        raise
    discard_stored_asset(storage, old_url)
    return _site_content_read(row)


@router.delete("/site-content/branding/logo", status_code=status.HTTP_204_NO_CONTENT)
def reset_application_logo(
    actor: User = Depends(require_roles(Role.SUPER_ADMIN)),
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
):
    row = db.get(SiteContent, "branding")
    if row:
        old_url = row.content.get("logo_url")
        db.delete(row)
        audit(db, actor.id, "site_content.reset", "site_content", "branding")
        db.commit()
        discard_stored_asset(storage, old_url)
