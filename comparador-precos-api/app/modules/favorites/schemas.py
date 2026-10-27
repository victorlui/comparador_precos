from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.db.models import SearchSource


class FavoriteUpsertRequest(BaseModel):
    result: dict[str, object]
    product_name: str | None = None
    source_type: SearchSource | None = None


class FavoriteItemResponse(BaseModel):
    id: UUID
    product_key: str
    product_name: str
    source_type: str | None
    best_price: str | None
    best_store: str | None
    image: str | None
    created_at: datetime
    updated_at: datetime
    result: dict[str, object]


class FavoriteListResponse(BaseModel):
    items: list[FavoriteItemResponse]
    limit: int
    offset: int


class FavoriteDeleteResponse(BaseModel):
    status: str
    product_key: str
