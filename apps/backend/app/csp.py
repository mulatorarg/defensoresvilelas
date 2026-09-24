"""Content-Security-Policy sin 'unsafe-inline' en scripts.

El export estático de Next mete scripts inline en cada HTML (el payload de React
Server Components). En lugar de habilitar cualquier script inline, cada página
se sirve con los hashes SHA-256 de SUS scripts inline: un script inyectado por
un XSS no coincide con ningún hash y el navegador no lo ejecuta.

Los estilos siguen con 'unsafe-inline': React escribe atributos style="..." en
el HTML y un estilo inyectado no ejecuta código.
"""
import base64
import hashlib
from html.parser import HTMLParser
from pathlib import Path

from .config import TURNSTILE_SECRET_KEY, TURNSTILE_SITE_KEY

# Cloudflare Turnstile (captcha del alta online) carga su script y un iframe
_CAPTCHA_ORIGIN = "https://challenges.cloudflare.com"
_CAPTCHA_ENABLED = bool(TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY)


def build_policy(script_hashes: list[str] | tuple[str, ...] = ()) -> str:
    script_src = ["'self'", *(f"'sha256-{h}'" for h in script_hashes)]
    frame_src = ["'none'"]
    if _CAPTCHA_ENABLED:
        script_src.append(_CAPTCHA_ORIGIN)
        frame_src = [_CAPTCHA_ORIGIN]
    return "; ".join([
        "default-src 'self'",
        "script-src " + " ".join(script_src),
        "style-src 'self' 'unsafe-inline'",
        # https: porque logos, fotos y la landing pueden usar imágenes externas
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "frame-src " + " ".join(frame_src),
        "worker-src 'self'",
        "manifest-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
    ])


# Política para todo lo que no es una página HTML (API JSON, archivos estáticos)
DEFAULT_POLICY = build_policy()


class _InlineScripts(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.scripts: list[str] = []
        self._current: list[str] | None = None

    def handle_starttag(self, tag, attrs):
        if tag == "script" and not any(name == "src" for name, _ in attrs):
            self._current = []

    def handle_data(self, data):
        if self._current is not None:
            self._current.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self._current is not None:
            self.scripts.append("".join(self._current))
            self._current = None


_cache: dict[Path, tuple[float, str]] = {}


def policy_for_html(path: Path) -> str:
    """Política con los hashes de los scripts inline de ese HTML (cacheada por archivo)."""
    mtime = path.stat().st_mtime
    cached = _cache.get(path)
    if cached and cached[0] == mtime:
        return cached[1]
    parser = _InlineScripts()
    parser.feed(path.read_text(encoding="utf-8"))
    hashes = sorted({
        base64.b64encode(hashlib.sha256(script.encode("utf-8")).digest()).decode()
        for script in parser.scripts
        if script.strip()
    })
    policy = build_policy(hashes)
    _cache[path] = (mtime, policy)
    return policy
