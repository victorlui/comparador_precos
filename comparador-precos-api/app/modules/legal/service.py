from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.models import LegalDocument
from app.db.models import LegalDocumentType
from app.db.models import UserLegalConsent
from app.db.session import get_session_factory


class LegalDocumentNotFoundError(ValueError):
    pass


class InvalidLegalDocumentTypeError(ValueError):
    pass


def get_current_legal_documents() -> dict[str, LegalDocument]:
    return {
        LegalDocumentType.TERMS_OF_USE.value: get_latest_legal_document(
            document_type=LegalDocumentType.TERMS_OF_USE.value
        ),
        LegalDocumentType.PRIVACY_POLICY.value: get_latest_legal_document(
            document_type=LegalDocumentType.PRIVACY_POLICY.value
        ),
    }


def get_latest_legal_document(*, document_type: str) -> LegalDocument:
    normalized_document_type = _normalize_legal_document_type(document_type)
    session_factory = get_session_factory()

    with session_factory() as session:
        statement = (
            select(LegalDocument)
            .where(
                LegalDocument.document_type == normalized_document_type,
                LegalDocument.is_active.is_(True),
            )
            .order_by(LegalDocument.published_at.desc(), LegalDocument.created_at.desc())
            .limit(1)
        )
        document = session.scalar(statement)

    if document is None:
        raise LegalDocumentNotFoundError(normalized_document_type)

    return document


def upsert_legal_document(
    *,
    document_type: str,
    version: str | None,
    title: str | None,
    html: str,
    is_active: bool | None,
) -> LegalDocument:
    normalized_document_type = _normalize_legal_document_type(document_type)
    normalized_version = version.strip() if isinstance(version, str) else None
    normalized_title = title.strip() if isinstance(title, str) else None

    if not html.strip():
        raise ValueError("O HTML do documento e obrigatorio.")

    session_factory = get_session_factory()
    
    with session_factory() as session:
        current_document = session.scalar(
            select(LegalDocument)
            .where(
                LegalDocument.document_type == normalized_document_type,
                LegalDocument.is_active.is_(True),
            )
            .order_by(LegalDocument.published_at.desc(), LegalDocument.created_at.desc())
            .limit(1)
        )

        document = None
        if normalized_version:
            document = session.scalar(
                select(LegalDocument).where(
                    LegalDocument.document_type == normalized_document_type,
                    LegalDocument.version == normalized_version,
                )
            )
        elif current_document is not None:
            document = current_document

        if document is None and not normalized_version:
            raise ValueError(
                "A versao do documento e obrigatoria para criar um novo documento."
            )

        resolved_version = (
            normalized_version
            if normalized_version is not None
            else document.version if document is not None else None
        )
        resolved_title = (
            normalized_title
            if normalized_title is not None
            else document.title
            if document is not None
            else current_document.title if current_document is not None else None
        )
        resolved_is_active = (
            is_active
            if is_active is not None
            else document.is_active
            if document is not None
            else current_document.is_active if current_document is not None else True
        )

        if not resolved_version:
            raise ValueError("A versao do documento e obrigatoria.")
        if not resolved_title:
            raise ValueError("O titulo do documento e obrigatorio.")

        if resolved_is_active:
            active_documents = session.scalars(
                select(LegalDocument).where(
                    LegalDocument.document_type == normalized_document_type,
                    LegalDocument.is_active.is_(True),
                )
            ).all()
            for active_document in active_documents:
                active_document.is_active = False

        if document is None:
            document = LegalDocument(
                document_type=normalized_document_type,
                version=resolved_version,
                title=resolved_title,
                html_content=html,
                is_active=resolved_is_active,
            )
            session.add(document)
        else:
            document.version = resolved_version
            document.title = resolved_title
            document.html_content = html
            document.is_active = resolved_is_active

        session.commit()
        session.refresh(document)
        return document
        


def create_legal_consent(
    *,
    user_id: UUID,
    terms_of_use_document_id: UUID,
    privacy_policy_document_id: UUID,
    accepted_terms_of_use: bool,
    accepted_privacy_policy: bool,
) -> UserLegalConsent:
    session_factory = get_session_factory()

    with session_factory() as session:
        terms_document = session.get(LegalDocument, terms_of_use_document_id)
        if (
            terms_document is None
            or terms_document.document_type != LegalDocumentType.TERMS_OF_USE.value
        ):
            raise LegalDocumentNotFoundError("terms_of_use")

        privacy_document = session.get(LegalDocument, privacy_policy_document_id)
        if (
            privacy_document is None
            or privacy_document.document_type != LegalDocumentType.PRIVACY_POLICY.value
        ):
            raise LegalDocumentNotFoundError("privacy_policy")

        latest_consent = session.scalar(
            select(UserLegalConsent)
            .options(
                selectinload(UserLegalConsent.terms_of_use_document),
                selectinload(UserLegalConsent.privacy_policy_document),
            )
            .where(UserLegalConsent.user_id == user_id)
            .order_by(UserLegalConsent.responded_at.desc(), UserLegalConsent.created_at.desc())
            .limit(1)
        )
        if (
            latest_consent is not None
            and latest_consent.terms_of_use_document_id == terms_document.id
            and latest_consent.privacy_policy_document_id == privacy_document.id
            and latest_consent.accepted_terms_of_use == accepted_terms_of_use
            and latest_consent.accepted_privacy_policy == accepted_privacy_policy
        ):
            return latest_consent

        consent = UserLegalConsent(
            user_id=user_id,
            terms_of_use_document_id=terms_document.id,
            privacy_policy_document_id=privacy_document.id,
            accepted_terms_of_use=accepted_terms_of_use,
            accepted_privacy_policy=accepted_privacy_policy,
        )
        session.add(consent)
        session.commit()
        statement = (
            select(UserLegalConsent)
            .options(
                selectinload(UserLegalConsent.terms_of_use_document),
                selectinload(UserLegalConsent.privacy_policy_document),
            )
            .where(UserLegalConsent.id == consent.id)
        )
        created_consent = session.scalar(statement)
        if created_consent is None:
            raise RuntimeError("Nao foi possivel carregar o consentimento criado.")

        return created_consent


def get_latest_user_legal_consent(*, user_id: UUID) -> UserLegalConsent | None:
    session_factory = get_session_factory()

    with session_factory() as session:
        statement = (
            select(UserLegalConsent)
            .options(
                selectinload(UserLegalConsent.terms_of_use_document),
                selectinload(UserLegalConsent.privacy_policy_document),
            )
            .where(UserLegalConsent.user_id == user_id)
            .order_by(UserLegalConsent.responded_at.desc(), UserLegalConsent.created_at.desc())
            .limit(1)
        )
        consent = session.scalar(statement)
        return consent


def list_user_legal_consents(
    *,
    user_id: UUID,
    limit: int,
    offset: int,
) -> list[UserLegalConsent]:
    session_factory = get_session_factory()

    with session_factory() as session:
        statement = (
            select(UserLegalConsent)
            .options(
                selectinload(UserLegalConsent.terms_of_use_document),
                selectinload(UserLegalConsent.privacy_policy_document),
            )
            .where(UserLegalConsent.user_id == user_id)
            .order_by(UserLegalConsent.responded_at.desc(), UserLegalConsent.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(session.scalars(statement).all())


def _normalize_legal_document_type(document_type: str) -> str:
    normalized_document_type = document_type.strip().lower()
    allowed_document_types = {
        LegalDocumentType.TERMS_OF_USE.value,
        LegalDocumentType.PRIVACY_POLICY.value,
    }
    if normalized_document_type not in allowed_document_types:
        raise InvalidLegalDocumentTypeError(normalized_document_type)

    return normalized_document_type
