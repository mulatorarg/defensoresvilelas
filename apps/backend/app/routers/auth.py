from fastapi import APIRouter
from sqlalchemy import select

from .. import models
from ..audit import audit
from ..deps import DbDep, StaffDep
from ..errors import bad_request, unauthorized
from ..schemas import ChangePasswordDto, LoginDto
from ..security import hash_password, sign_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _session(user: models.User) -> dict:
    payload = {
        "sub": user.id,
        "email": user.email,
        "role": user.role,
        "tv": user.tokenVersion or 0,
    }
    return {
        "accessToken": sign_token(payload),
        "user": {
            "id": user.id,
            "email": user.email,
            "firstName": user.firstName,
            "lastName": user.lastName,
            "role": user.role,
        },
    }


@router.post("/login")
def login(dto: LoginDto, db: DbDep):
    user = db.scalar(select(models.User).where(models.User.email == dto.email))

    if not user or not user.isActive or not verify_password(dto.password, user.passwordHash):
        raise unauthorized("Credenciales inválidas")

    return _session(user)


@router.post("/logout-all")
def logout_all(db: DbDep, ctx: StaffDep):
    """Invalida todos los tokens del usuario (en todos los dispositivos)."""
    user = db.get(models.User, ctx.user["sub"])
    user.tokenVersion = (user.tokenVersion or 0) + 1
    audit(db, ctx, "LOGOUT_ALL", "user", user.id)
    db.commit()
    return {"ok": True}


@router.post("/change-password")
def change_password(dto: ChangePasswordDto, db: DbDep, ctx: StaffDep):
    """Cambia la contraseña propia; cierra las demás sesiones y devuelve un token nuevo."""
    user = db.get(models.User, ctx.user["sub"])
    if not verify_password(dto.currentPassword, user.passwordHash):
        raise bad_request("La contraseña actual no es correcta")

    user.passwordHash = hash_password(dto.newPassword)
    user.tokenVersion = (user.tokenVersion or 0) + 1
    audit(db, ctx, "CHANGE_PASSWORD", "user", user.id)
    db.commit()
    return _session(user)
