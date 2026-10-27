import os
from functools import lru_cache

from clerk_backend_api import AuthenticateRequestOptions
from clerk_backend_api import Clerk
from clerk_backend_api import authenticate_request
from fastapi import HTTPException
from fastapi import Request

from app.modules.users.service import AuthenticatedUser
from app.modules.users.service import DuplicateUserEmailError
from app.modules.users.service import upsert_user_from_clerk_session


def _get_optional_env(name: str) -> str | None:
    value = os.getenv(name, "").strip()
    if not value:
        return None

    placeholder_markers = (
        "SUA_CHAVE_PUBLICA_JWT_AQUI",
        "sua_clerk_secret_key_aqui",
    )
    if any(marker in value for marker in placeholder_markers):
        return None

    return value or None


def _get_authorized_parties() -> list[str] | None:
    raw_value = os.getenv("CLERK_AUTHORIZED_PARTIES", "").strip()
    if not raw_value:
        return None

    values = [value.strip() for value in raw_value.split(",")]
    authorized_parties = [value for value in values if value]
    return authorized_parties or None


@lru_cache(maxsize=1)
def get_clerk_auth_options() -> AuthenticateRequestOptions:
    secret_key = _get_optional_env("CLERK_SECRET_KEY")
    jwt_key = _get_optional_env("CLERK_JWT_KEY")

    if secret_key and not secret_key.startswith(("sk_test_", "sk_live_")):
        print(
            "Ignorando CLERK_SECRET_KEY invalida no backend. "
            "Use sk_test_/sk_live_ ou deixe em branco para autenticar com CLERK_JWT_KEY.",
            flush=True,
        )
        secret_key = None

    if jwt_key is None and secret_key is None:
        raise RuntimeError(
            "Configure CLERK_JWT_KEY ou uma CLERK_SECRET_KEY valida no backend.",
        )

    return AuthenticateRequestOptions(
        secret_key=secret_key,
        jwt_key=jwt_key,
        authorized_parties=_get_authorized_parties(),
        accepts_token=["session_token"],
    )


@lru_cache(maxsize=1)
def get_clerk_client() -> Clerk | None:
    secret_key = _get_optional_env("CLERK_SECRET_KEY")
    if not secret_key or not secret_key.startswith(("sk_test_", "sk_live_")):
        return None

    return Clerk(bearer_auth=secret_key)


def require_authenticated_user(request: Request) -> AuthenticatedUser:
    try:
        state = authenticate_request(request, get_clerk_auth_options())
    except RuntimeError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=401,
            detail="Nao foi possivel validar sua sessao.",
        ) from error

    if not state.is_signed_in:
        detail = state.reason.name if state.reason is not None else "unauthorized"
        print(
            (
                "Falha ao validar sessao Clerk: "
                f"detail={detail} "
                f"has_authorization={bool(request.headers.get('authorization'))}"
            ),
            flush=True,
        )
        raise HTTPException(status_code=401, detail=detail)

    claims = state.payload or {}
    auth = state.to_auth()
    clerk_user_id = _get_optional_claim(claims, "sub") or getattr(auth, "user_id", None)
    if not clerk_user_id:
        raise HTTPException(
            status_code=401,
            detail="Token autenticado, mas sem identificacao de usuario.",
        )

    try:
        clerk_profile = _get_clerk_profile(clerk_user_id)
        resolved_first_name = (
            _get_optional_claim(claims, "first_name")
            or _get_optional_claim(claims, "given_name")
            or _get_profile_value(clerk_profile, "first_name")
        )
        resolved_last_name = (
            _get_optional_claim(claims, "last_name")
            or _get_optional_claim(claims, "family_name")
            or _get_profile_value(clerk_profile, "last_name")
        )
        resolved_email = (
            _get_optional_claim(claims, "email")
            or getattr(auth, "email", None)
            or _get_primary_email_from_profile(clerk_profile)
        )
        if resolved_first_name is None and resolved_last_name is None:
            full_name = _get_optional_claim(claims, "name")
            if full_name:
                resolved_first_name, resolved_last_name = _split_full_name(full_name)

        return upsert_user_from_clerk_session(
            clerk_user_id=clerk_user_id,
            session_id=_get_optional_claim(claims, "sid")
            or getattr(auth, "session_id", None),
            email=resolved_email,
            first_name=resolved_first_name,
            last_name=resolved_last_name,
            image_url=_get_optional_claim(claims, "image_url")
            or _get_profile_value(clerk_profile, "image_url"),
            claims=claims,
        )
    except DuplicateUserEmailError as error:
        raise HTTPException(
            status_code=409,
            detail="Ja existe uma conta cadastrada com este e-mail. Entre pela tela de login.",
        ) from error


def _get_optional_claim(claims: dict[str, object], key: str) -> str | None:
    value = claims.get(key)
    if isinstance(value, str) and value.strip():
        return value.strip()

    return None


def _get_clerk_profile(clerk_user_id: str):
    client = get_clerk_client()
    if client is None:
        return None

    try:
        return client.users.get(user_id=clerk_user_id)
    except Exception as error:
        print(
            f"Nao foi possivel buscar perfil completo do Clerk para {clerk_user_id}: {error}",
            flush=True,
        )
        return None


def _get_profile_value(profile, key: str) -> str | None:
    if profile is None:
        return None

    value = getattr(profile, key, None)
    if isinstance(value, str) and value.strip():
        return value.strip()

    return None


def _get_primary_email_from_profile(profile) -> str | None:
    if profile is None:
        return None

    primary_email_address_id = getattr(profile, "primary_email_address_id", None)
    email_addresses = getattr(profile, "email_addresses", None) or []
    for email_address in email_addresses:
        if getattr(email_address, "id", None) == primary_email_address_id:
            value = getattr(email_address, "email_address", None)
            if isinstance(value, str) and value.strip():
                return value.strip().lower()

    for email_address in email_addresses:
        value = getattr(email_address, "email_address", None)
        if isinstance(value, str) and value.strip():
            return value.strip().lower()

    return None


def _split_full_name(full_name: str) -> tuple[str | None, str | None]:
    normalized_name = full_name.strip()
    if not normalized_name:
        return None, None

    parts = normalized_name.split()
    if not parts:
        return None, None

    first_name = parts[0]
    last_name = " ".join(parts[1:]) if len(parts) > 1 else None
    return first_name, last_name
