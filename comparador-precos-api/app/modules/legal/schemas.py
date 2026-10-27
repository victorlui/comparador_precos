from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class LegalDocumentResponse(BaseModel):
    id: UUID
    document_type: str
    version: str
    title: str
    html: str
    is_active: bool
    published_at: datetime
    created_at: datetime
    updated_at: datetime


class CurrentLegalDocumentsResponse(BaseModel):
    terms_of_use: LegalDocumentResponse
    privacy_policy: LegalDocumentResponse


class LegalDocumentUpsertRequest(BaseModel):
    version: str | None = None
    title: str | None = None
    html: str
    is_active: bool | None = None


class LegalConsentCreateRequest(BaseModel):
    terms_of_use_document_id: UUID
    privacy_policy_document_id: UUID
    accepted_terms_of_use: bool
    accepted_privacy_policy: bool


class LegalConsentResponse(BaseModel):
    id: UUID
    user_id: UUID
    terms_of_use_document_id: UUID
    privacy_policy_document_id: UUID
    terms_of_use_version: str
    privacy_policy_version: str
    accepted_terms_of_use: bool
    accepted_privacy_policy: bool
    responded_at: datetime
    created_at: datetime


class LegalConsentListResponse(BaseModel):
    items: list[LegalConsentResponse]
    limit: int
    offset: int
