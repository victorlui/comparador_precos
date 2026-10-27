from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import func
from sqlalchemy import select

from app.db.models import AppUser
from app.db.session import get_session_factory


@dataclass(frozen=True)
class AuthenticatedUser:
    id: UUID
    clerk_user_id: str
    session_id: str | None
    email: str | None


class DuplicateUserEmailError(ValueError):
    pass


def upsert_user_from_clerk_session(
    *,
    clerk_user_id: str,
    session_id: str | None,
    email: str | None,
    first_name: str | None,
    last_name: str | None,
    image_url: str | None,
    claims: dict[str, object] | None,
) -> AuthenticatedUser:
    session_factory = get_session_factory()
    normalized_email = email.strip().lower() if isinstance(email, str) and email.strip() else None

    with session_factory() as session:
        user = session.scalar(
            select(AppUser).where(AppUser.clerk_user_id == clerk_user_id)
        )

        if normalized_email is not None:
            existing_user_with_same_email = session.scalar(
                select(AppUser).where(
                    func.lower(AppUser.primary_email) == normalized_email,
                    AppUser.clerk_user_id != clerk_user_id,
                )
            )
            if existing_user_with_same_email is not None:
                raise DuplicateUserEmailError(normalized_email)

        if user is None:
            user = AppUser(clerk_user_id=clerk_user_id)
            session.add(user)

        user.primary_email = normalized_email
        user.first_name = first_name
        user.last_name = last_name
        user.image_url = image_url
        user.last_sign_in_session_id = session_id
        user.claims = claims

        session.commit()
        session.refresh(user)

        return AuthenticatedUser(
            id=user.id,
            clerk_user_id=user.clerk_user_id,
            session_id=user.last_sign_in_session_id,
            email=user.primary_email,
        )
