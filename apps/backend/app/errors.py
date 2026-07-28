"""Excepciones HTTP con el mismo formato de respuesta que NestJS:
{ "statusCode": 404, "message": "...", "error": "Not Found" }
"""
from fastapi import HTTPException


def _exc(status_code: int, message, error: str) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"statusCode": status_code, "message": message, "error": error},
    )


def bad_request(message) -> HTTPException:
    return _exc(400, message, "Bad Request")


def unauthorized(message="Unauthorized") -> HTTPException:
    return _exc(401, message, "Unauthorized")


def forbidden(message="Forbidden") -> HTTPException:
    return _exc(403, message, "Forbidden")


def not_found(message="Not Found") -> HTTPException:
    return _exc(404, message, "Not Found")


def conflict(message="Conflict") -> HTTPException:
    return _exc(409, message, "Conflict")
