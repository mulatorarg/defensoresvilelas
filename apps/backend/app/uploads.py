"""Imágenes subidas por el staff (fotos de socios, logo, noticias) en recursos/.

Toda imagen se abre con Pillow y se vuelve a codificar como WEBP: se descartan
metadatos (EXIF con GPS incluido) y cualquier contenido que no sea imagen, y se
achica al tamaño máximo de su carpeta. El archivo original nunca se guarda.
"""
import io
import logging
import uuid
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from .config import RECURSOS_DIR
from .errors import bad_request

logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 8 * 1024 * 1024
# Tope de píxeles antes de decodificar (evita "bombas" de descompresión)
Image.MAX_IMAGE_PIXELS = 40_000_000

# Carpeta -> lado máximo en píxeles
FOLDERS = {"socios": 800, "club": 1024, "noticias": 1600}
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "GIF"}


def save_image(data: bytes, folder: str) -> str:
    """Valida, normaliza y guarda la imagen. Devuelve la URL pública (/recursos/...)."""
    if folder not in FOLDERS:
        raise bad_request("Carpeta de destino inválida")
    if not data:
        raise bad_request("El archivo está vacío")
    if len(data) > MAX_UPLOAD_BYTES:
        raise bad_request("La imagen supera los 8 MB")

    try:
        with Image.open(io.BytesIO(data)) as probe:
            if probe.format not in ALLOWED_FORMATS:
                raise bad_request("Formato no soportado: usar JPG, PNG o WEBP")
            probe.verify()
        image = Image.open(io.BytesIO(data))
        image.load()
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, SyntaxError):
        raise bad_request("El archivo no es una imagen válida")

    # Respeta la orientación de la cámara y descarta el resto de los metadatos
    image = ImageOps.exif_transpose(image)
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA" if "A" in image.getbands() or image.mode == "P" else "RGB")
    image.thumbnail((FOLDERS[folder], FOLDERS[folder]))

    target_dir = Path(RECURSOS_DIR) / folder
    target_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}.webp"
    image.save(target_dir / name, "WEBP", quality=85, method=4)
    return f"/recursos/{folder}/{name}"


def delete_upload(url: str | None) -> None:
    """Borra un archivo subido por la app (solo /recursos/<carpeta>/<nombre>.webp)."""
    if not url or not url.startswith("/recursos/"):
        return
    parts = url.removeprefix("/recursos/").split("/")
    if len(parts) != 2 or parts[0] not in FOLDERS or not parts[1].endswith(".webp"):
        return  # URLs externas o cargadas a mano no se tocan
    path = Path(RECURSOS_DIR) / parts[0] / parts[1]
    try:
        path.unlink(missing_ok=True)
    except OSError as exc:
        logger.warning("No se pudo borrar %s: %s", path, exc)
