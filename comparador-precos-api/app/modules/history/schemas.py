from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class HistoryOfferResponse(BaseModel):
    id: UUID
    position: int
    loja: str
    titulo: str
    preco_centavos: int | None
    frete_centavos: int | None
    total_centavos: int | None
    link: str
    imagem: str | None


class HistoryItemResponse(BaseModel):
    id: UUID
    source_type: str
    input_query: str | None
    product_name: str
    candidates: list[str]
    source_file_name: str | None
    source_file_path: str | None
    offers_count: int
    cheapest_total_cents: int | None
    created_at: datetime
    offers: list[HistoryOfferResponse]
    raw_response: dict[str, object]


class HistoryListResponse(BaseModel):
    items: list[HistoryItemResponse]
    limit: int
    offset: int


class HistoryDeleteResponse(BaseModel):
    status: str
    id: UUID


class HistoryDeleteAllResponse(BaseModel):
    status: str
    deleted_count: int
