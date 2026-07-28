from fastapi import APIRouter
from sqlalchemy import select

from .. import models
from ..deps import DbDep
from ..errors import unauthorized
from ..schemas import LoginDto
from ..security import sign_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(dto: LoginDto, db: DbDep):
    user = db.scalar(select(models.User).where(models.User.email == dto.email))

    if not user or not user.isActive or not verify_password(dto.password, user.passwordHash):
        raise unauthorized("Credenciales inválidas")

    payload = {"sub": user.id, "email": user.email, "role": user.role}

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
