"""DTOs de entrada (Pydantic) equivalentes a los class-validator del backend Nest."""
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

# email-validator rechaza dominios reservados (.local, usados en dev/seed);
# se usa un patrón permisivo equivalente al @IsEmail de class-validator
EmailStr = Annotated[
    str, StringConstraints(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
]

MemberStatusLiteral = str  # ACTIVE | INACTIVE | SUSPENDED (validado en runtime)

MEMBER_STATUSES = {"ACTIVE", "INACTIVE", "SUSPENDED"}
GENDERS = {"MALE", "FEMALE", "MIXED"}
PAYMENT_METHODS = {"CASH", "TRANSFER", "MERCADO_PAGO", "DEBIT", "CREDIT", "OTHER"}
TRANSACTION_TYPES = {"INCOME", "EXPENSE"}


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
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    birthDate: str | None = None
    photoUrl: str | None = None
    status: str | None = None
    notes: str | None = None
    playerProfile: PlayerProfileDto | None = None


class UpdateMemberDto(BaseModel):
    firstName: str | None = None
    lastName: str | None = None
    dni: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    birthDate: str | None = None
    photoUrl: str | None = None
    status: str | None = None
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
    gender: str | None = None
    feeAmount: str | None = None
    schedule: str | None = None
    isActive: bool | None = None


class UpdateCategoryDto(BaseModel):
    disciplineId: str | None = None
    name: str | None = None
    ageFrom: int | None = None
    ageTo: int | None = None
    gender: str | None = None
    feeAmount: str | None = None
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
    period: str = Field(min_length=1)  # YYYY-MM
    feeTypeId: str = Field(min_length=1)
    categoryId: str | None = None
    amount: str | None = None
    dueDate: str | None = None
    memberIds: list[str] | None = None


class CreatePaymentDto(BaseModel):
    feeId: str = Field(min_length=1)
    amount: str = Field(min_length=1)
    method: str
    reference: str | None = None
    paidAt: str | None = None


class CreatePreferenceDto(BaseModel):
    feeId: str = Field(min_length=1)


class CreateTransactionDto(BaseModel):
    type: str
    category: str = Field(min_length=1)
    amount: str = Field(min_length=1)
    description: str | None = None
    date: str | None = None


class LoginMemberDto(BaseModel):
    dni: str = Field(min_length=1)
    birthDate: str = Field(min_length=1)  # YYYY-MM-DD


class ScanMemberDto(BaseModel):
    qrPayload: str = Field(min_length=1)


class RegisterAttendanceDto(BaseModel):
    memberId: str = Field(min_length=1)
    categoryId: str = Field(min_length=1)
    date: str = Field(min_length=1)
    notes: str | None = None
