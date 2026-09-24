"""Exportación CSV para Excel en español: separador ";", BOM UTF-8 y fin de línea CRLF."""
import csv
import io
from collections.abc import Iterable
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi.responses import StreamingResponse

from . import clock

_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _cell(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, Decimal):
        # Coma decimal: Excel en español la interpreta como número
        return f"{value:.2f}".replace(".", ",")
    if isinstance(value, datetime):
        # Instantes guardados en UTC: se exportan en hora del club
        local = value.replace(tzinfo=timezone.utc).astimezone(clock.CLUB_TZ)
        return local.strftime("%d/%m/%Y %H:%M")
    if isinstance(value, date):
        return value.strftime("%d/%m/%Y")
    if isinstance(value, bool):
        return "Sí" if value else "No"
    text = str(value)
    # Inyección de fórmulas: un texto que empieza con "=" se ejecutaría en Excel
    if text.startswith(_FORMULA_PREFIXES):
        return "'" + text
    return text


def csv_response(filename: str, header: list[str], rows: Iterable[Iterable[Any]]) -> StreamingResponse:
    def generate():
        buffer = io.StringIO()
        writer = csv.writer(buffer, delimiter=";", lineterminator="\r\n")
        yield "\ufeff"
        writer.writerow(header)
        for row in rows:
            writer.writerow([_cell(v) for v in row])
            if buffer.tell() > 64_000:
                yield buffer.getvalue()
                buffer.seek(0)
                buffer.truncate()
        yield buffer.getvalue()

    return StreamingResponse(
        generate(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
