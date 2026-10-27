import re
from decimal import Decimal
from decimal import InvalidOperation
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.models import SearchHistory
from app.db.models import SearchHistoryOffer
from app.db.models import SearchSource
from app.db.session import get_session_factory
from app.store_names import normalize_store_name


_NON_NUMERIC_PRICE_CHARS = re.compile(r"[^0-9,.-]+")


def save_search_history(
    *,
    user_id: UUID,
    source_type: SearchSource,
    input_query: str | None,
    product_name: str,
    candidates: list[str],
    offers: list[dict[str, str]],
    source_file_name: str | None,
    source_file_path: str | None,
    raw_response: dict[str, object],
) -> None:
    session_factory = get_session_factory()
    normalized_offers = _normalize_offers(offers)
    cheapest_total_cents = min(
        (
            offer["total_cents"]
            for offer in normalized_offers
            if offer["total_cents"] is not None
        ),
        default=None,
    )

    with session_factory() as session:
        history = SearchHistory(
            user_id=user_id,
            source_type=source_type.value,
            input_query=input_query,
            product_name=product_name,
            candidates=candidates,
            source_file_name=source_file_name,
            source_file_path=source_file_path,
            offers_count=len(normalized_offers),
            cheapest_total_cents=cheapest_total_cents,
            raw_response=raw_response,
        )
        session.add(history)
        session.flush()

        for offer in normalized_offers:
            session.add(
                SearchHistoryOffer(
                    history_id=history.id,
                    position=offer["position"],
                    store_name=offer["store_name"],
                    title=offer["title"],
                    price_cents=offer["price_cents"],
                    shipping_cents=offer["shipping_cents"],
                    total_cents=offer["total_cents"],
                    offer_url=offer["offer_url"],
                    image_url=offer["image_url"],
                )
            )

        session.commit()


def list_search_history(
    *,
    user_id: UUID,
    limit: int,
    offset: int,
    source_type: SearchSource | None = None,
) -> list[SearchHistory]:
    session_factory = get_session_factory()

    with session_factory() as session:
        statement = (
            select(SearchHistory)
            .options(selectinload(SearchHistory.offers))
            .where(SearchHistory.user_id == user_id)
            .order_by(SearchHistory.created_at.desc())
            .limit(limit)
            .offset(offset)
        )

        if source_type is not None:
            statement = statement.where(SearchHistory.source_type == source_type.value)

        return list(session.scalars(statement).all())


def get_search_history_by_id(*, user_id: UUID, history_id: UUID) -> SearchHistory | None:
    session_factory = get_session_factory()

    with session_factory() as session:
        statement = (
            select(SearchHistory)
            .options(selectinload(SearchHistory.offers))
            .where(SearchHistory.id == history_id, SearchHistory.user_id == user_id)
        )
        return session.scalar(statement)


def delete_search_history_by_id(*, user_id: UUID, history_id: UUID) -> bool:
    session_factory = get_session_factory()

    with session_factory() as session:
        statement = select(SearchHistory).where(
            SearchHistory.id == history_id,
            SearchHistory.user_id == user_id,
        )
        history_item = session.scalar(statement)
        if history_item is None:
            return False

        session.delete(history_item)
        session.commit()
        return True


def delete_all_search_history(*, user_id: UUID) -> int:
    session_factory = get_session_factory()

    with session_factory() as session:
        history_items = session.scalars(
            select(SearchHistory).where(SearchHistory.user_id == user_id)
        ).all()
        deleted_count = len(history_items)

        for history_item in history_items:
            session.delete(history_item)

        session.commit()
        return deleted_count


def _normalize_offers(offers: list[dict[str, str]]) -> list[dict[str, object]]:
    normalized: list[dict[str, object]] = []

    for index, offer in enumerate(offers, start=1):
        price_cents = _parse_brl_to_cents(offer.get("preco"))
        shipping_cents = _parse_shipping_to_cents(offer.get("frete"))
        total_cents = None
        if price_cents is not None:
            total_cents = price_cents + (shipping_cents or 0)

        normalized.append(
            {
                "position": index,
                "store_name": normalize_store_name(
                    offer.get("loja"),
                    default="Loja desconhecida",
                ),
                "title": (offer.get("titulo") or "").strip() or "Oferta sem titulo",
                "price_cents": price_cents,
                "shipping_cents": shipping_cents,
                "total_cents": total_cents,
                "offer_url": (offer.get("link") or "").strip(),
                "image_url": (offer.get("imagem") or "").strip() or None,
            }
        )

    return normalized


def _parse_shipping_to_cents(value: str | None) -> int | None:
    if value is None:
        return None

    normalized_value = value.strip().lower()
    if not normalized_value:
        return None
    if "gratis" in normalized_value or "gratis" in normalized_value.replace("á", "a"):
        return 0

    return _parse_brl_to_cents(value)


def _parse_brl_to_cents(value: str | None) -> int | None:
    if value is None:
        return None

    cleaned = _NON_NUMERIC_PRICE_CHARS.sub("", value).strip()
    if not cleaned:
        return None

    if "," in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")

    try:
        amount = Decimal(cleaned)
    except InvalidOperation:
        return None

    return int(amount * 100)
