"""Subida de imágenes (fotos de socios, logo del club, imágenes de noticias)."""
from fastapi import APIRouter, Depends, File, Form, UploadFile

from ..audit import audit
from ..deps import DbDep, StaffContext, require_roles
from ..uploads import MAX_UPLOAD_BYTES, save_image

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


@router.post("", status_code=201)
async def upload_image(
    db: DbDep,
    file: UploadFile = File(...),
    folder: str = Form(...),
    ctx: StaffContext = Depends(require_roles("ADMIN", "OPERATOR")),
):
    # Se lee con tope: un archivo más grande no llega a cargarse entero en memoria
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    url = save_image(data, folder)
    audit(db, ctx, "UPLOAD", "image", None, {"url": url, "folder": folder})
    db.commit()
    return {"url": url}
