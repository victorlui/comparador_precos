import os
from functools import lru_cache

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy import inspect
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

load_dotenv()


def get_database_url() -> str:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)

    return database_url


@lru_cache(maxsize=1)
def get_engine():
    database_url = get_database_url()
    if not database_url:
        raise RuntimeError("DATABASE_URL nao configurada.")

    return create_engine(
        database_url,
        pool_pre_ping=True,
    )


@lru_cache(maxsize=1)
def get_session_factory():
    return sessionmaker(
        bind=get_engine(),
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )


def init_db() -> None:
    from app.db.models import Base

    Base.metadata.create_all(bind=get_engine())
    _run_lightweight_migrations()
    _seed_default_legal_documents()


def _run_lightweight_migrations() -> None:
    engine = get_engine()
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    with engine.begin() as connection:
        if "legal_document" in tables:
            legal_document_columns = {
                column["name"] for column in inspector.get_columns("legal_document")
            }
            if (
                "content" in legal_document_columns
                and "html_content" not in legal_document_columns
            ):
                connection.execute(
                    text(
                        """
                        ALTER TABLE legal_document
                        RENAME COLUMN content TO html_content
                        """
                    )
                )

        if "search_history" in tables:
            search_history_columns = {
                column["name"] for column in inspector.get_columns("search_history")
            }
            if "user_id" not in search_history_columns:
                connection.execute(
                    text(
                        """
                        ALTER TABLE search_history
                        ADD COLUMN user_id UUID NULL REFERENCES users(id) ON DELETE CASCADE
                        """
                    )
                )

            connection.execute(
                text(
                    """
                    CREATE INDEX IF NOT EXISTS ix_search_history_user_created_at
                    ON search_history (user_id, created_at)
                    """
                )
            )

        if "favorite_product" in tables:
            favorite_columns = {
                column["name"] for column in inspector.get_columns("favorite_product")
            }
            if "user_id" not in favorite_columns:
                connection.execute(
                    text(
                        """
                        ALTER TABLE favorite_product
                        ADD COLUMN user_id UUID NULL REFERENCES users(id) ON DELETE CASCADE
                        """
                    )
                )

            unique_constraints = {
                constraint["name"]
                for constraint in inspector.get_unique_constraints("favorite_product")
                if constraint.get("name")
            }
            if "uq_favorite_product_key" in unique_constraints:
                connection.execute(
                    text(
                        """
                        ALTER TABLE favorite_product
                        DROP CONSTRAINT uq_favorite_product_key
                        """
                    )
                )
                unique_constraints.remove("uq_favorite_product_key")

            if "uq_favorite_product_user_key" not in unique_constraints:
                connection.execute(
                    text(
                        """
                        ALTER TABLE favorite_product
                        ADD CONSTRAINT uq_favorite_product_user_key
                        UNIQUE (user_id, product_key)
                        """
                    )
                )

            connection.execute(
                text(
                    """
                    CREATE INDEX IF NOT EXISTS ix_favorite_product_user_updated_at
                    ON favorite_product (user_id, updated_at)
                    """
                )
            )


def _seed_default_legal_documents() -> None:
    from sqlalchemy import select

    from app.db.models import LegalDocument
    from app.db.models import LegalDocumentType

    session_factory = get_session_factory()

    default_documents = {
        LegalDocumentType.TERMS_OF_USE.value: {
            "version": "1.0",
            "title": "Termos de Uso",
            "html_content": (
                "<h1>Termos de Uso</h1>"
                "<p>Este e o HTML inicial dos Termos de Uso. "
                "Atualize este conteudo com as regras oficiais do seu aplicativo.</p>"
            ),
        },
        LegalDocumentType.PRIVACY_POLICY.value: {
            "version": "1.0",
            "title": "Politica de Privacidade",
            "html_content": (
                "<h1>Politica de Privacidade</h1>"
                "<p>Este e o HTML inicial da Politica de Privacidade. "
                "Atualize este conteudo com as informacoes oficiais sobre coleta e uso de dados.</p>"
            ),
        },
    }

    with session_factory() as session:
        for document_type, defaults in default_documents.items():
            existing_document = session.scalar(
                select(LegalDocument).where(LegalDocument.document_type == document_type)
            )
            if existing_document is not None:
                continue

            session.add(
                LegalDocument(
                    document_type=document_type,
                    version=defaults["version"],
                    title=defaults["title"],
                    html_content=defaults["html_content"],
                    is_active=True,
                )
            )

        session.commit()
