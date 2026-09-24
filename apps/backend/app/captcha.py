"""Captcha del alta online con Cloudflare Turnstile (opcional).

Se activa definiendo TURNSTILE_SITE_KEY y TURNSTILE_SECRET_KEY en el .env (panel
de Cloudflare > Turnstile, es gratis). Sin las claves el alta funciona como
siempre (honeypot + rate limit de Nginx).
"""
import json
import logging
import urllib.error
import urllib.parse
import urllib.request

from .config import TURNSTILE_SECRET_KEY

logger = logging.getLogger(__name__)

VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def enabled() -> bool:
    return bool(TURNSTILE_SECRET_KEY)


def verify(token: str | None, remote_ip: str | None = None) -> bool:
    """True si Cloudflare valida el token. Ante un error de red se rechaza:
    es preferible pedir que reintente a dejar pasar altas sin verificar."""
    if not token:
        return False
    data = {"secret": TURNSTILE_SECRET_KEY, "response": token}
    if remote_ip:
        data["remoteip"] = remote_ip
    request = urllib.request.Request(
        VERIFY_URL, data=urllib.parse.urlencode(data).encode(), method="POST"
    )
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            return bool(json.loads(response.read()).get("success"))
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        logger.warning("No se pudo verificar el captcha con Cloudflare: %s", exc)
        return False
