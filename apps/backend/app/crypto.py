"""Cifrado en reposo de secretos guardados en la base (credenciales de Mercado Pago).

Clave: SECRETS_KEY del .env (una clave Fernet, generar con
`python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`).
Si no está definida se deriva de JWT_SECRET, así la app funciona sin configuración
extra; en ese caso rotar JWT_SECRET vuelve ilegibles los secretos guardados
(hay que volver a cargarlos desde el admin).

Los valores cifrados llevan el prefijo "enc:"; un valor sin prefijo es texto
plano heredado y se sigue leyendo tal cual (se cifra al volver a guardarlo).
"""
import base64
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from .config import JWT_SECRET, SECRETS_KEY

logger = logging.getLogger(__name__)

_PREFIX = "enc:"


def _derived_key() -> bytes:
    digest = hashlib.sha256(f"clubes-secrets:{JWT_SECRET}".encode()).digest()
    return base64.urlsafe_b64encode(digest)


def _fernet() -> MultiFernet:
    keys = [Fernet(SECRETS_KEY.encode())] if SECRETS_KEY else []
    # La clave derivada queda como respaldo para leer lo cifrado antes de definir SECRETS_KEY
    keys.append(Fernet(_derived_key()))
    return MultiFernet(keys)


def encrypt(value: str | None) -> str | None:
    if not value:
        return None
    return _PREFIX + _fernet().encrypt(value.encode()).decode()


def decrypt(value: str | None) -> str | None:
    if not value:
        return None
    if not value.startswith(_PREFIX):
        return value
    try:
        return _fernet().decrypt(value[len(_PREFIX):].encode()).decode()
    except InvalidToken:
        logger.error("No se pudo descifrar un secreto guardado: ¿cambió SECRETS_KEY o JWT_SECRET?")
        return None


def mask(value: str | None) -> str | None:
    """APP_USR-1234...abcd -> APP_USR-****abcd (nunca se devuelve el valor completo)."""
    if not value:
        return None
    prefix = value.split("-", 1)[0] + "-" if "-" in value[:12] else ""
    return f"{prefix}****{value[-4:]}"


def is_masked(value: str | None) -> bool:
    return bool(value) and "****" in value
