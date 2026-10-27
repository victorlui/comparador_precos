from uuid import UUID

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Path
from fastapi import Query

from app.db.models import SearchHistory
from app.db.models import SearchSource
from app.modules.history.schemas import HistoryDeleteAllResponse
from app.modules.history.schemas import HistoryDeleteResponse
from app.modules.history.schemas import HistoryItemResponse
from app.modules.history.schemas import HistoryListResponse
from app.modules.history.schemas import HistoryOfferResponse
from app.modules.history.service import delete_all_search_history
from app.modules.history.service import delete_search_history_by_id
from app.modules.history.service import get_search_history_by_id
from app.modules.history.service import list_search_history
from app.modules.users.service import AuthenticatedUser
from app.security.clerk_auth import require_authenticated_user
from app.store_names import normalize_result_store_names
from app.store_names import normalize_store_name

router = APIRouter()


@router.get("/history", tags=["History"], response_model=HistoryListResponse)
def get_search_history(
    current_user: AuthenticatedUser = Depends(require_authenticated_user),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    source_type: SearchSource | None = Query(default=None),
) -> HistoryListResponse:
    history_items = list_search_history(
        user_id=current_user.id,
        limit=limit,
        offset=offset,
        source_type=source_type,
    )

    return HistoryListResponse(
        items=[_serialize_history_item(item) for item in history_items],
        limit=limit,
        offset=offset,
    )


@router.get("/history/{history_id}", tags=["History"], response_model=HistoryItemResponse)
def get_search_history_item(
    current_user: AuthenticatedUser = Depends(require_authenticated_user),
    history_id: UUID = Path(...),
) -> HistoryItemResponse:
    history_item = get_search_history_by_id(
        user_id=current_user.id,
        history_id=history_id,
    )
    if history_item is None:
        raise HTTPException(status_code=404, detail="Item de historico nao encontrado.")

    return _serialize_history_item(history_item)


@router.delete(
    "/history/{history_id}",
    tags=["History"],
    response_model=HistoryDeleteResponse,
)
def delete_search_history_item(
    current_user: AuthenticatedUser = Depends(require_authenticated_user),
    history_id: UUID = Path(...),
) -> HistoryDeleteResponse:
    deleted = delete_search_history_by_id(
        user_id=current_user.id,
        history_id=history_id,
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Item de historico nao encontrado.")

    return HistoryDeleteResponse(status="sucesso", id=history_id)


@router.delete("/history", tags=["History"], response_model=HistoryDeleteAllResponse)
def delete_all_history_items(
    current_user: AuthenticatedUser = Depends(require_authenticated_user),
) -> HistoryDeleteAllResponse:
    deleted_count = delete_all_search_history(user_id=current_user.id)
    return HistoryDeleteAllResponse(status="sucesso", deleted_count=deleted_count)


def _serialize_history_item(item: SearchHistory) -> HistoryItemResponse:
    return HistoryItemResponse(
        id=item.id,
        source_type=item.source_type,
        input_query=item.input_query,
        product_name=item.product_name,
        candidates=item.candidates,
        source_file_name=item.source_file_name,
        source_file_path=item.source_file_path,
        offers_count=item.offers_count,
        cheapest_total_cents=item.cheapest_total_cents,
        created_at=item.created_at,
        offers=[
            HistoryOfferResponse(
                id=offer.id,
                position=offer.position,
                loja=normalize_store_name(offer.store_name, default="Loja"),
                titulo=offer.title,
                preco_centavos=offer.price_cents,
                frete_centavos=offer.shipping_cents,
                total_centavos=offer.total_cents,
                link=offer.offer_url,
                imagem=offer.image_url,
            )
            for offer in item.offers
        ],
        raw_response=normalize_result_store_names(item.raw_response),
    )
