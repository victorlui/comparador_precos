from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Path
from fastapi import Query

from app.modules.legal.schemas import CurrentLegalDocumentsResponse
from app.modules.legal.schemas import LegalConsentCreateRequest
from app.modules.legal.schemas import LegalConsentListResponse
from app.modules.legal.schemas import LegalConsentResponse
from app.modules.legal.schemas import LegalDocumentResponse
from app.modules.legal.schemas import LegalDocumentUpsertRequest
from app.modules.legal.service import InvalidLegalDocumentTypeError
from app.modules.legal.service import LegalDocumentNotFoundError
from app.modules.legal.service import create_legal_consent
from app.modules.legal.service import get_current_legal_documents
from app.modules.legal.service import get_latest_legal_document
from app.modules.legal.service import get_latest_user_legal_consent
from app.modules.legal.service import list_user_legal_consents
from app.modules.legal.service import upsert_legal_document
from app.modules.users.service import AuthenticatedUser
from app.security.clerk_auth import require_authenticated_user

router = APIRouter()


@router.get(
    "/legal/documents",
    tags=["Legal"],
    response_model=CurrentLegalDocumentsResponse,
)
def get_public_legal_documents() -> CurrentLegalDocumentsResponse:
    documents = get_current_legal_documents()
    return CurrentLegalDocumentsResponse(
        terms_of_use=_serialize_legal_document(documents["terms_of_use"]),
        privacy_policy=_serialize_legal_document(documents["privacy_policy"]),
    )


@router.get(
    "/legal/documents/{document_type}",
    tags=["Legal"],
    response_model=LegalDocumentResponse,
)
def get_public_legal_document_by_type(
    document_type: str = Path(...),
) -> LegalDocumentResponse:
    try:
        document = get_latest_legal_document(document_type=document_type)
    except InvalidLegalDocumentTypeError as error:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de documento invalido: '{error.args[0]}'.",
        ) from error
    except LegalDocumentNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=f"Documento legal nao encontrado para o tipo '{error.args[0]}'.",
        ) from error

    return _serialize_legal_document(document)


@router.put(
    "/legal/documents/{document_type}",
    tags=["Legal"],
    response_model=LegalDocumentResponse,
)
def put_legal_document_by_type(
    payload: LegalDocumentUpsertRequest,
    document_type: str = Path(...),
    
) -> LegalDocumentResponse:
    try:
        document = upsert_legal_document(
            document_type=document_type,
            version=payload.version,
            title=payload.title,
            html=payload.html,
            is_active=payload.is_active,
        )
    except InvalidLegalDocumentTypeError as error:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de documento invalido: '{error.args[0]}'.",
        ) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    return _serialize_legal_document(document)


@router.post(
    "/legal/consents",
    tags=["Legal"],
    response_model=LegalConsentResponse,
)
def create_user_legal_consent(
    payload: LegalConsentCreateRequest,
    current_user: AuthenticatedUser = Depends(require_authenticated_user),
) -> LegalConsentResponse:
    try:
        consent = create_legal_consent(
            user_id=current_user.id,
            terms_of_use_document_id=payload.terms_of_use_document_id,
            privacy_policy_document_id=payload.privacy_policy_document_id,
            accepted_terms_of_use=payload.accepted_terms_of_use,
            accepted_privacy_policy=payload.accepted_privacy_policy,
        )
    except LegalDocumentNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=f"Documento legal invalido para '{error.args[0]}'.",
        ) from error

    return _serialize_legal_consent(consent)


@router.get(
    "/legal/consents/me",
    tags=["Legal"],
    response_model=LegalConsentResponse | None,
)
def get_my_latest_legal_consent(
    current_user: AuthenticatedUser = Depends(require_authenticated_user),
) -> LegalConsentResponse | None:
    consent = get_latest_user_legal_consent(user_id=current_user.id)
    if consent is None:
        return None

    return _serialize_legal_consent(consent)


@router.get(
    "/legal/consents/history",
    tags=["Legal"],
    response_model=LegalConsentListResponse,
)
def get_my_legal_consent_history(
    current_user: AuthenticatedUser = Depends(require_authenticated_user),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> LegalConsentListResponse:
    consents = list_user_legal_consents(
        user_id=current_user.id,
        limit=limit,
        offset=offset,
    )
    return LegalConsentListResponse(
        items=[_serialize_legal_consent(item) for item in consents],
        limit=limit,
        offset=offset,
    )


def _serialize_legal_document(document) -> LegalDocumentResponse:
    return LegalDocumentResponse(
        id=document.id,
        document_type=document.document_type,
        version=document.version,
        title=document.title,
        html=document.html_content,
        is_active=document.is_active,
        published_at=document.published_at,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


def _serialize_legal_consent(consent) -> LegalConsentResponse:
    return LegalConsentResponse(
        id=consent.id,
        user_id=consent.user_id,
        terms_of_use_document_id=consent.terms_of_use_document_id,
        privacy_policy_document_id=consent.privacy_policy_document_id,
        terms_of_use_version=consent.terms_of_use_document.version,
        privacy_policy_version=consent.privacy_policy_document.version,
        accepted_terms_of_use=consent.accepted_terms_of_use,
        accepted_privacy_policy=consent.accepted_privacy_policy,
        responded_at=consent.responded_at,
        created_at=consent.created_at,
    )
