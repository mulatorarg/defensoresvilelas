"""DTOs de entrada (Pydantic) equivalentes a los class-validator del backend Nest."""
from decimal import Decimal, InvalidOperation
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, BeforeValidator, Field, StringConstraints


def _blank_to_none(value):
    # Los formularios mandan "" en los campos opcionales vacíos
    if isinstance(value, str) and value.strip() == "":
        return None
    return value


def _decimal_validator(*, allow_zero: bool):
    def check(value: str | None) -> str | None:
        if value is None:
            return None
        try:
            amount = Decimal(str(value).strip())
        except InvalidOperation:
            raise ValueError("debe ser un número válido")
        if not amount.is_finite() or amount < 0 or (amount == 0 and not allow_zero):
            raise ValueError("debe ser un monto positivo")
        return str(amount)

    return check


# email-validator rechaza dominios reservados (.local, usados en dev/seed);
# se usa un patrón permisivo equivalente al @IsEmail de class-validator.
# Un string vacío se interpreta como "sin email".
EmailStr = Annotated[
    str, StringConstraints(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
]
OptionalEmail = Annotated[EmailStr | None, BeforeValidator(_blank_to_none)]

# Montos: llegan como string (contrato del frontend) y se validan como decimales
Amount = Annotated[str, AfterValidator(_decimal_validator(allow_zero=False))]
OptionalAmount = Annotated[
    str | None, BeforeValidator(_blank_to_none), AfterValidator(_decimal_validator(allow_zero=True))
]

Period = Annotated[str, StringConstraints(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")]

MemberStatus = Literal["ACTIVE", "INACTIVE", "SUSPENDED"]
Gender = Literal["MALE", "FEMALE", "MIXED"]
PaymentMethod = Literal["CASH", "TRANSFER", "MERCADO_PAGO", "DEBIT", "CREDIT", "OTHER"]
TransactionType = Literal["INCOME", "EXPENSE"]


class LoginDto(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class PlayerProfileDto(BaseModel):
    position: str | None = None
    jerseyNumber: int | None = None
    federationId: str | None = None
    medicalPassDue: str | None = None
    notes: str | None = None


class CreateMemberDto(BaseModel):
    firstName: str = Field(min_length=1)
    lastName: str = Field(min_length=1)
    dni: str = Field(min_length=1)
    email: OptionalEmail = None
    phone: str | None = None
    address: str | None = None
    birthDate: str | None = None
    photoUrl: str | None = None
    status: MemberStatus | None = None
    notes: str | None = None
    playerProfile: PlayerProfileDto | None = None


class UpdateMemberDto(BaseModel):
    firstName: str | None = None
    lastName: str | None = None
    dni: str | None = None
    email: OptionalEmail = None
    phone: str | None = None
    address: str | None = None
    birthDate: str | None = None
    photoUrl: str | None = None
    status: MemberStatus | None = None
    notes: str | None = None
    playerProfile: PlayerProfileDto | None = None


class CreateDisciplineDto(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = None
    icon: str | None = None
    isActive: bool | None = None


class UpdateDisciplineDto(BaseModel):
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    isActive: bool | None = None


class CreateCategoryDto(BaseModel):
    disciplineId: str = Field(min_length=1)
    name: str = Field(min_length=1)
    ageFrom: int | None = None
    ageTo: int | None = None
    gender: Gender | None = None
    feeAmount: OptionalAmount = None
    schedule: str | None = None
    isActive: bool | None = None


class UpdateCategoryDto(BaseModel):
    disciplineId: str | None = None
    name: str | None = None
    ageFrom: int | None = None
    ageTo: int | None = None
    gender: Gender | None = None
    feeAmount: OptionalAmount = None
    schedule: str | None = None
    isActive: bool | None = None


class CreateEnrollmentDto(BaseModel):
    memberId: str = Field(min_length=1)
    categoryId: str = Field(min_length=1)
    enrolledAt: str | None = None


class CreateAttendanceDto(BaseModel):
    categoryId: str = Field(min_length=1)
    memberId: str = Field(min_length=1)
    date: str = Field(min_length=1)
    present: bool | None = None
    notes: str | None = None


class AttendanceRecordDto(BaseModel):
    memberId: str = Field(min_length=1)
    present: bool
    notes: str | None = None


class BulkAttendanceDto(BaseModel):
    categoryId: str = Field(min_length=1)
    date: str = Field(min_length=1)
    records: list[AttendanceRecordDto]


class CreateFeeTypeDto(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = None
    isActive: bool | None = None


class UpdateFeeTypeDto(BaseModel):
    name: str | None = None
    description: str | None = None
    isActive: bool | None = None


class GenerateFeesDto(BaseModel):
    period: Period  # YYYY-MM
    feeTypeId: str = Field(min_length=1)
    categoryId: str | None = None
    amount: OptionalAmount = None
    dueDate: str | None = None
    memberIds: list[str] | None = None


class CreatePaymentDto(BaseModel):
    feeId: str = Field(min_length=1)
    amount: Amount
    method: PaymentMethod
    reference: str | None = None
    paidAt: str | None = None


class CreatePreferenceDto(BaseModel):
    feeId: str = Field(min_length=1)


class CreateTransactionDto(BaseModel):
    type: TransactionType
    category: str = Field(min_length=1)
    amount: Amount
    description: str | None = None
    date: str | None = None


class VoidTransactionDto(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


Pin = Annotated[str, Field(pattern=r"^\d{4,6}$")]


class LoginMemberDto(BaseModel):
    dni: str = Field(min_length=1)
    birthDate: str = Field(min_length=1)  # YYYY-MM-DD
    pin: str | None = Field(default=None, max_length=6)
    # Solo en el primer ingreso (socio sin PIN): el PIN que define
    newPin: Pin | None = None


class ChangePinDto(BaseModel):
    currentPin: str = Field(min_length=1, max_length=6)
    newPin: Pin


class ChangePasswordDto(BaseModel):
    currentPassword: str = Field(min_length=1)
    newPassword: str = Field(min_length=8, max_length=128)


class ScanMemberDto(BaseModel):
    qrPayload: str = Field(min_length=1)


class RegisterAttendanceDto(BaseModel):
    memberId: str = Field(min_length=1)
    categoryId: str = Field(min_length=1)
    date: str = Field(min_length=1)
    notes: str | None = None
