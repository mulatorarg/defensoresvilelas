"""Noticias y eventos del sitio del club (ABM del admin)."""
import re
import unicodedata

from fastapi import APIRouter, Depends
from sqlalchemy import select

from .. import clock, models, serializers
from ..audit import audit
from ..deps import DbDep, StaffContext, require_roles
from ..errors import not_found
from ..ids import new_id
from ..models import utcnow
from ..pagination import paginate
from ..schemas import EventDto, NewsDto, UpdateEventDto, UpdateNewsDto
from ..uploads import delete_upload

router = APIRouter(tags=["content"])

Roles = Depends(require_roles("ADMIN", "OPERATOR"))


def news_admin(n: models.News) -> dict:
    return {
        "id": n.id,
        "title": n.title,
        "slug": n.slug,
        "excerpt": n.excerpt,
        "content": n.content,
        "imageUrl": n.imageUrl,
        "published": n.published,
        "publishedAt": serializers.iso(n.publishedAt),
        "createdAt": serializers.iso(n.createdAt),
        "updatedAt": serializers.iso(n.updatedAt),
    }


def event_admin(e: models.Event) -> dict:
    return {
        "id": e.id,
        "title": e.title,
        "description": e.description,
        "eventDate": serializers.iso(e.eventDate),
        "location": e.location,
        "isPublic": e.isPublic,
        "createdAt": serializers.iso(e.createdAt),
        "updatedAt": serializers.iso(e.updatedAt),
    }


def _slugify(text: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
    return slug[:150] or "noticia"


def _unique_slug(db, title: str, exclude_id: str | None = None) -> str:
    base = _slugify(title)
    slug, n = base, 2
    while True:
        query = select(models.News.id).where(models.News.slug == slug)
        if exclude_id:
            query = query.where(models.News.id != exclude_id)
        if not db.scalar(query):
            return slug
        slug, n = f"{base}-{n}", n + 1


# ------------------------------------------------------------------ Noticias


@router.get("/api/news")
def list_news(db: DbDep, ctx: StaffContext = Roles, page: int = 1, limit: int = 20):
    return paginate(
        db, select(models.News), page, limit, news_admin,
        order_by=(models.News.createdAt.desc(),),
    )


@router.post("/api/news", status_code=201)
def create_news(dto: NewsDto, db: DbDep, ctx: StaffContext = Roles):
    news = models.News(
        id=new_id(),
        title=dto.title.strip(),
        slug=_unique_slug(db, dto.title),
        excerpt=dto.excerpt,
        content=dto.content,
        imageUrl=dto.imageUrl,
        published=dto.published,
        publishedAt=utcnow() if dto.published else None,
    )
    db.add(news)
    audit(db, ctx, "CREATE", "news", news.id, {"title": news.title})
    db.commit()
    return news_admin(news)


def _get_news(db, news_id: str) -> models.News:
    news = db.get(models.News, news_id)
    if not news:
        raise not_found("Noticia no encontrada")
    return news


@router.patch("/api/news/{news_id}")
def update_news(news_id: str, dto: UpdateNewsDto, db: DbDep, ctx: StaffContext = Roles):
    news = _get_news(db, news_id)
    previous_image = news.imageUrl
    fields = dto.model_dump(exclude_unset=True)
    if fields.get("title"):
        fields["title"] = fields["title"].strip()
        news.slug = _unique_slug(db, fields["title"], exclude_id=news.id)
    if fields.get("published") and not news.published:
        news.publishedAt = utcnow()  # primera publicación
    for key, value in fields.items():
        setattr(news, key, value)
    audit(db, ctx, "UPDATE", "news", news.id, sorted(dto.model_fields_set))
    db.commit()
    if news.imageUrl != previous_image:
        delete_upload(previous_image)
    return news_admin(news)


@router.delete("/api/news/{news_id}")
def delete_news(news_id: str, db: DbDep, ctx: StaffContext = Roles):
    news = _get_news(db, news_id)
    image = news.imageUrl
    db.delete(news)
    audit(db, ctx, "DELETE", "news", news_id, {"title": news.title})
    db.commit()
    delete_upload(image)
    return {"ok": True}


# ------------------------------------------------------------------- Eventos


@router.get("/api/events")
def list_events(db: DbDep, ctx: StaffContext = Roles, page: int = 1, limit: int = 20):
    return paginate(
        db, select(models.Event), page, limit, event_admin,
        order_by=(models.Event.eventDate.desc(),),
    )


@router.post("/api/events", status_code=201)
def create_event(dto: EventDto, db: DbDep, ctx: StaffContext = Roles):
    event = models.Event(
        id=new_id(),
        title=dto.title.strip(),
        description=dto.description,
        eventDate=clock.parse_local_datetime(dto.eventDate),
        location=dto.location,
        isPublic=dto.isPublic,
    )
    db.add(event)
    audit(db, ctx, "CREATE", "event", event.id, {"title": event.title})
    db.commit()
    return event_admin(event)


def _get_event(db, event_id: str) -> models.Event:
    event = db.get(models.Event, event_id)
    if not event:
        raise not_found("Evento no encontrado")
    return event


@router.patch("/api/events/{event_id}")
def update_event(event_id: str, dto: UpdateEventDto, db: DbDep, ctx: StaffContext = Roles):
    event = _get_event(db, event_id)
    fields = dto.model_dump(exclude_unset=True)
    if fields.get("eventDate"):
        fields["eventDate"] = clock.parse_local_datetime(fields["eventDate"])
    for key, value in fields.items():
        if value is not None or key in ("description", "location"):
            setattr(event, key, value)
    audit(db, ctx, "UPDATE", "event", event.id, sorted(dto.model_fields_set))
    db.commit()
    return event_admin(event)


@router.delete("/api/events/{event_id}")
def delete_event(event_id: str, db: DbDep, ctx: StaffContext = Roles):
    event = _get_event(db, event_id)
    db.delete(event)
    audit(db, ctx, "DELETE", "event", event_id, {"title": event.title})
    db.commit()
    return {"ok": True}
