from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Path
from fastapi import Query

from app.modules.favorites.schemas import FavoriteDeleteResponse
from app.modules.favorites.schemas import FavoriteItemResponse
from app.modules.favorites.schemas import FavoriteListResponse
from app.modules.favorites.schemas import FavoriteUpsertRequest
from app.modules.favorites.service import delete_favorite_by_product_key
from app.modules.favorites.service import get_favorite_by_product_key
from app.modules.favorites.service import list_favorites
from app.modules.favorites.service import upsert_favorite
from app.modules.users.service import AuthenticatedUser
from app.security.clerk_auth import require_authenticated_user
from app.store_names import normalize_result_store_names
from app.store_names import normalize_store_name

router = APIRouter()


@router.get("/favorites", tags=["Favorites"], response_model=FavoriteListResponse)
def get_favorites(
    current_user: AuthenticatedUser = Depends(require_authenticated_user),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> FavoriteListResponse:
    favorites = list_favorites(user_id=current_user.id, limit=limit, offset=offset)
    return FavoriteListResponse(
        items=[_serialize_favorite(item) for item in favorites],
        limit=limit,
        offset=offset,
    )


@router.get(
    "/favorites/{product_key}",
    tags=["Favorites"],
    response_model=FavoriteItemResponse,
)
def get_favorite_item(
    current_user: AuthenticatedUser = Depends(require_authenticated_user),
    product_key: str = Path(...),
) -> FavoriteItemResponse:
    favorite = get_favorite_by_product_key(
        user_id=current_user.id,
        product_key=product_key,
    )
    if favorite is None:
        raise HTTPException(status_code=404, detail="Favorito nao encontrado.")

    return _serialize_favorite(favorite)


@router.put("/favorites", tags=["Favorites"], response_model=FavoriteItemResponse)
def put_favorite_item(
    payload: FavoriteUpsertRequest,
    current_user: AuthenticatedUser = Depends(require_authenticated_user),
) -> FavoriteItemResponse:
    favorite = upsert_favorite(
        user_id=current_user.id,
        result=payload.result,
        product_name=payload.product_name,
        source_type=payload.source_type,
    )
    return _serialize_favorite(favorite)


@router.delete(
    "/favorites/{product_key}",
    tags=["Favorites"],
    response_model=FavoriteDeleteResponse,
)
def delete_favorite_item(
    current_user: AuthenticatedUser = Depends(require_authenticated_user),
    product_key: str = Path(...),
) -> FavoriteDeleteResponse:
    deleted = delete_favorite_by_product_key(
        user_id=current_user.id,
        product_key=product_key,
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Favorito nao encontrado.")

    return FavoriteDeleteResponse(status="sucesso", product_key=product_key)


def _serialize_favorite(item) -> FavoriteItemResponse:
    return FavoriteItemResponse(
        id=item.id,
        product_key=item.product_key,
        product_name=item.product_name,
        source_type=item.source_type,
        best_price=item.best_price,
        best_store=normalize_store_name(item.best_store, default="Loja")
        if item.best_store
        else None,
        image=item.image_url,
        created_at=item.created_at,
        updated_at=item.updated_at,
        result=normalize_result_store_names(item.result),
    )
