import enum
from datetime import datetime
from uuid import UUID
from uuid import uuid4

from sqlalchemy import Boolean
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import Index
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy import UniqueConstraint
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship


class Base(DeclarativeBase):
    pass


class SearchSource(str, enum.Enum):
    IMAGE_SCAN = "image_scan"
    TEXT_SEARCH = "text_search"


class LegalDocumentType(str, enum.Enum):
    TERMS_OF_USE = "terms_of_use"
    PRIVACY_POLICY = "privacy_policy"


class AppUser(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    clerk_user_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    primary_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    first_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_sign_in_session_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    claims: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    last_active_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    search_history: Mapped[list["SearchHistory"]] = relationship(
        back_populates="user",
    )
    favorite_products: Mapped[list["FavoriteProduct"]] = relationship(
        back_populates="user",
    )
    legal_consents: Mapped[list["UserLegalConsent"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="UserLegalConsent.responded_at.desc()",
    )

    __table_args__ = (
        Index("ix_users_primary_email", "primary_email"),
        Index("ix_users_updated_at", "updated_at"),
    )


class LegalDocument(Base):
    __tablename__ = "legal_document"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    document_type: Mapped[str] = mapped_column(String(32), nullable=False)
    version: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    html_content: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    published_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    terms_consents: Mapped[list["UserLegalConsent"]] = relationship(
        foreign_keys="UserLegalConsent.terms_of_use_document_id",
        back_populates="terms_of_use_document",
    )
    privacy_consents: Mapped[list["UserLegalConsent"]] = relationship(
        foreign_keys="UserLegalConsent.privacy_policy_document_id",
        back_populates="privacy_policy_document",
    )

    __table_args__ = (
        Index(
            "ix_legal_document_type_active_published_at",
            "document_type",
            "is_active",
            "published_at",
        ),
        UniqueConstraint(
            "document_type",
            "version",
            name="uq_legal_document_type_version",
        ),
    )


class UserLegalConsent(Base):
    __tablename__ = "user_legal_consent"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    terms_of_use_document_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("legal_document.id"),
        nullable=False,
    )
    privacy_policy_document_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("legal_document.id"),
        nullable=False,
    )
    accepted_terms_of_use: Mapped[bool] = mapped_column(Boolean, nullable=False)
    accepted_privacy_policy: Mapped[bool] = mapped_column(Boolean, nullable=False)
    responded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    user: Mapped[AppUser] = relationship(back_populates="legal_consents")
    terms_of_use_document: Mapped[LegalDocument] = relationship(
        foreign_keys=[terms_of_use_document_id],
        back_populates="terms_consents",
    )
    privacy_policy_document: Mapped[LegalDocument] = relationship(
        foreign_keys=[privacy_policy_document_id],
        back_populates="privacy_consents",
    )

    __table_args__ = (
        Index("ix_user_legal_consent_user_responded_at", "user_id", "responded_at"),
        Index(
            "ix_user_legal_consent_terms_privacy_responded_at",
            "terms_of_use_document_id",
            "privacy_policy_document_id",
            "responded_at",
        ),
    )


class SearchHistory(Base):
    __tablename__ = "search_history"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
    )
    source_type: Mapped[str] = mapped_column(String(24), nullable=False)
    input_query: Mapped[str | None] = mapped_column(Text, nullable=True)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    candidates: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    source_file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_file_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    offers_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cheapest_total_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    raw_response: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    offers: Mapped[list["SearchHistoryOffer"]] = relationship(
        back_populates="history",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="SearchHistoryOffer.position",
    )
    user: Mapped[AppUser | None] = relationship(back_populates="search_history")

    __table_args__ = (
        Index("ix_search_history_user_created_at", "user_id", "created_at"),
        Index("ix_search_history_source_created_at", "source_type", "created_at"),
        Index("ix_search_history_product_created_at", "product_name", "created_at"),
        Index("ix_search_history_input_query_created_at", "input_query", "created_at"),
        Index("ix_search_history_cheapest_total", "cheapest_total_cents", "created_at"),
    )


class SearchHistoryOffer(Base):
    __tablename__ = "search_history_offer"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    history_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("search_history.id", ondelete="CASCADE"),
        nullable=False,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    store_name: Mapped[str] = mapped_column(String(160), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    price_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    shipping_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    offer_url: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    history: Mapped[SearchHistory] = relationship(back_populates="offers")

    __table_args__ = (
        UniqueConstraint(
            "history_id",
            "store_name",
            "title",
            "offer_url",
            name="uq_search_history_offer_identity",
        ),
        Index("ix_search_history_offer_history_total", "history_id", "total_cents"),
        Index("ix_search_history_offer_store_total", "store_name", "total_cents"),
    )


class FavoriteProduct(Base):
    __tablename__ = "favorite_product"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
    )
    product_key: Mapped[str] = mapped_column(String(255), nullable=False)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[str | None] = mapped_column(String(24), nullable=True)
    best_price: Mapped[str | None] = mapped_column(String(80), nullable=True)
    best_store: Mapped[str | None] = mapped_column(String(160), nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    result: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    user: Mapped[AppUser | None] = relationship(back_populates="favorite_products")

    __table_args__ = (
        UniqueConstraint("user_id", "product_key", name="uq_favorite_product_user_key"),
        Index("ix_favorite_product_user_updated_at", "user_id", "updated_at"),
        Index("ix_favorite_product_name_updated_at", "product_name", "updated_at"),
        Index("ix_favorite_product_updated_at", "updated_at"),
    )
