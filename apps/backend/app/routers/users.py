"""Usuarios del staff (solo ADMIN)."""
from fastapi import APIRouter, Depends
from sqlalchemy import func, select

from .. import models
from ..audit import audit
from ..deps import DbDep, StaffContext, require_roles
from ..errors import bad_request, conflict, not_found
from ..ids import new_id
from ..schemas import CreateUserDto, ResetPasswordDto, UpdateUserDto
from ..security import hash_password

router = APIRouter(prefix="/api/users", tags=["users"])

Admin = Depends(require_roles("ADMIN"))


def user_public(u: models.User) -> dict:
    from ..serializers import iso

    return {
        "id": u.id,
        "email": u.email,
        "firstName": u.firstName,
        "lastName": u.lastName,
        "phone": u.phone,
        "role": u.role,
        "isActive": u.isActive,
        "createdAt": iso(u.createdAt),
        "updatedAt": iso(u.updatedAt),
    }


def _get_user(db, user_id: str) -> models.User:
    user = db.get(models.User, user_id)
    if not user:
        raise not_found("Usuario no encontrado")
    return user


def _ensure_email_available(db, email: str, exclude_id: str | None = None) -> None:
    query = select(models.User.id).where(func.lower(models.User.email) == email.lower())
    if exclude_id:
        query = query.where(models.User.id != exclude_id)
    if db.scalar(query):
        raise conflict("Ya existe un usuario con ese email")


def _active_admins(db) -> int:
    return db.scalar(
        select(func.count()).select_from(models.User).where(
            models.User.role == "ADMIN", models.User.isActive.is_(True)
        )
    )


@router.get("")
def find_all(db: DbDep, ctx: StaffContext = Admin):
    users = db.scalars(
        select(models.User).order_by(models.User.isActive.desc(), models.User.lastName, models.User.firstName)
    ).all()
    return [user_public(u) for u in users]


@router.post("", status_code=201)
def create(dto: CreateUserDto, db: DbDep, ctx: StaffContext = Admin):
    email = dto.email.strip().lower()
    _ensure_email_available(db, email)
    user = models.User(
        id=new_id(),
        email=email,
        passwordHash=hash_password(dto.password),
        firstName=dto.firstName.strip(),
        lastName=dto.lastName.strip(),
        phone=dto.phone,
        role=dto.role,
        isActive=True,
    )
    db.add(user)
    audit(db, ctx, "CREATE", "user", user.id, {"email": email, "role": dto.role})
    db.commit()
    return user_public(user)


@router.patch("/{user_id}")
def update(user_id: str, dto: UpdateUserDto, db: DbDep, ctx: StaffContext = Admin):
    user = _get_user(db, user_id)
    fields = dto.model_dump(exclude_unset=True)
    is_self = user.id == ctx.user.get("sub")

    if "email" in fields:
        fields["email"] = fields["email"].strip().lower()
        _ensure_email_available(db, fields["email"], exclude_id=user.id)

    losing_admin = user.role == "ADMIN" and user.isActive and (
        fields.get("role", "ADMIN") != "ADMIN" or fields.get("isActive", True) is False
    )
    if losing_admin:
        if is_self:
            raise bad_request("No podés quitarte el rol de administrador ni desactivarte a vos mismo")
        if _active_admins(db) <= 1:
            raise bad_request("Tiene que quedar al menos un administrador activo")

    access_changed = (
        ("role" in fields and fields["role"] != user.role)
        or ("isActive" in fields and fields["isActive"] != user.isActive)
    )
    for key, value in fields.items():
        if value is not None:
            setattr(user, key, value)
    if access_changed:
        # Cambió lo que puede hacer: se cierran sus sesiones abiertas
        user.tokenVersion = (user.tokenVersion or 0) + 1

    audit(db, ctx, "UPDATE", "user", user.id, sorted(dto.model_fields_set))
    db.commit()
    return user_public(user)


@router.post("/{user_id}/reset-password")
def reset_password(user_id: str, dto: ResetPasswordDto, db: DbDep, ctx: StaffContext = Admin):
    """Asigna una contraseña nueva (el usuario la cambia después desde su cuenta)."""
    user = _get_user(db, user_id)
    user.passwordHash = hash_password(dto.newPassword)
    user.tokenVersion = (user.tokenVersion or 0) + 1
    audit(db, ctx, "RESET_PASSWORD", "user", user.id)
    db.commit()
    return {"ok": True}
