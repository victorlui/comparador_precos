from fastapi import APIRouter
from fastapi import Depends

from app.modules.users.service import AuthenticatedUser
from app.security.clerk_auth import require_authenticated_user

router = APIRouter()


@router.get("/auth/me", tags=["Auth"])
def get_authenticated_user(
    current_user: AuthenticatedUser = Depends(require_authenticated_user),
) -> dict[str, str | None]:
    return {
        "id": str(current_user.id),
        "clerk_user_id": current_user.clerk_user_id,
        "session_id": current_user.session_id,
        "email": current_user.email,
    }
