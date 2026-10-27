import re
from uuid import UUID

from sqlalchemy import select

from app.db.models import FavoriteProduct
from app.db.models import SearchSource
from app.db.session import get_session_factory
from app.store_names import normalize_store_name


_WHITESPACE_PATTERN = re.compile(r"\s+")


def list_favorites(*, user_id: UUID, limit: int, offset: int) -> list[FavoriteProduct]:
    session_factory = get_session_factory()

    with session_factory() as session:
        statement = (
            select(FavoriteProduct)
            .where(FavoriteProduct.user_id == user_id)
            .order_by(FavoriteProduct.updated_at.desc(), FavoriteProduct.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(session.scalars(statement).all())


def get_favorite_by_product_key(*, user_id: UUID, product_key: str) -> FavoriteProduct | None:
    session_factory = get_session_factory()
    normalized_product_key = build_product_key(product_key)

    with session_factory() as session:
        statement = select(FavoriteProduct).where(
            FavoriteProduct.user_id == user_id,
            FavoriteProduct.product_key == normalized_product_key,
        )
        return session.scalar(statement)


def upsert_favorite(
    *,
    user_id: UUID,
    result: dict[str, object],
    product_name: str | None,
    source_type: SearchSource | None,
) -> FavoriteProduct:
    resolved_product_name = _resolve_product_name(result, product_name)
    product_key = build_product_key(resolved_product_name)
    best_offer = _extract_best_offer(result)

    session_factory = get_session_factory()

    with session_factory() as session:
        favorite = session.scalar(
            select(FavoriteProduct).where(
                FavoriteProduct.user_id == user_id,
                FavoriteProduct.product_key == product_key,
            )
        )

        if favorite is None:
            favorite = FavoriteProduct(
                user_id=user_id,
                product_key=product_key,
                product_name=resolved_product_name,
            )
            session.add(favorite)

        favorite.product_name = resolved_product_name
        favorite.source_type = source_type.value if source_type is not None else None
        favorite.best_price = best_offer.get("preco")
        favorite.best_store = normalize_store_name(best_offer.get("loja"), default="Loja")
        favorite.image_url = best_offer.get("imagem")
        favorite.result = result
        session.commit()
        session.refresh(favorite)
        return favorite


def delete_favorite_by_product_key(*, user_id: UUID, product_key: str) -> bool:
    session_factory = get_session_factory()
    normalized_product_key = build_product_key(product_key)

    with session_factory() as session:
        favorite = session.scalar(
            select(FavoriteProduct).where(
                FavoriteProduct.user_id == user_id,
                FavoriteProduct.product_key == normalized_product_key
            )
        )
        if favorite is None:
            return False

        session.delete(favorite)
        session.commit()
        return True


def build_product_key(product_name: str) -> str:
    return _WHITESPACE_PATTERN.sub(" ", product_name.strip().lower())


def _resolve_product_name(
    result: dict[str, object],
    fallback_product_name: str | None,
) -> str:
    for candidate in (
        result.get("produto_principal"),
        result.get("produto"),
        fallback_product_name,
    ):
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()

    return "Produto"


def _extract_best_offer(result: dict[str, object]) -> dict[str, str | None]:
    offers = result.get("precos")
    if not isinstance(offers, list) or not offers:
        return {"preco": None, "loja": None, "imagem": None}

    first_offer = offers[0]
    if not isinstance(first_offer, dict):
        return {"preco": None, "loja": None, "imagem": None}

    return {
        "preco": _get_optional_string(first_offer.get("preco")),
        "loja": _get_optional_string(first_offer.get("loja")),
        "imagem": _get_optional_string(first_offer.get("imagem")),
    }


def _get_optional_string(value: object) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()

    return None
