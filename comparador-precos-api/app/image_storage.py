from __future__ import annotations

import mimetypes
import os
import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote
from uuid import uuid4

import boto3
from botocore.config import Config
from dotenv import load_dotenv

load_dotenv()

DEFAULT_LOCAL_UPLOAD_DIR = "uploads"
DEFAULT_OBJECT_PREFIX = "scans"
SUPPORTED_PROVIDERS = {"auto", "local", "backblaze"}
_FILENAME_SANITIZER = re.compile(r"[^A-Za-z0-9._-]+")
_ENDPOINT_REGION_PATTERN = re.compile(r"https?://s3\.([a-z0-9-]+)\.backblazeb2\.com/?$")


class StorageError(Exception):
    pass


@dataclass(slots=True)
class StoredImage:
    provider: str
    file_name: str
    reference: str
    object_key: str | None = None


@dataclass(slots=True)
class BackblazeConfig:
    endpoint_url: str
    region: str
    bucket_name: str
    key_id: str
    application_key: str
    public_base_url: str
    object_prefix: str


def store_uploaded_image(
    *,
    file_bytes: bytes,
    original_filename: str | None,
    content_type: str | None,
) -> StoredImage:
    provider = _resolve_storage_provider()
    if provider == "backblaze":
        return _store_image_in_backblaze(
            file_bytes=file_bytes,
            original_filename=original_filename,
            content_type=content_type,
        )

    return _store_image_locally(
        file_bytes=file_bytes,
        original_filename=original_filename,
        content_type=content_type,
    )


def upload_existing_local_file_to_backblaze(
    file_path: str | Path,
    *,
    object_prefix: str | None = None,
) -> StoredImage:
    path = Path(file_path)
    if not path.is_file():
        raise StorageError(f"Arquivo nao encontrado para upload: {path}")

    content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return _store_image_in_backblaze(
        file_bytes=path.read_bytes(),
        original_filename=path.name,
        content_type=content_type,
        object_prefix=object_prefix,
    )


def _store_image_locally(
    *,
    file_bytes: bytes,
    original_filename: str | None,
    content_type: str | None,
) -> StoredImage:
    upload_dir = Path(
        os.getenv("LOCAL_UPLOAD_DIR", DEFAULT_LOCAL_UPLOAD_DIR).strip()
        or DEFAULT_LOCAL_UPLOAD_DIR
    )
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_name = _build_file_name(original_filename, content_type)
    file_path = upload_dir / file_name
    file_path.write_bytes(file_bytes)

    return StoredImage(
        provider="local",
        file_name=file_name,
        reference=str(file_path.resolve()),
    )


def _store_image_in_backblaze(
    *,
    file_bytes: bytes,
    original_filename: str | None,
    content_type: str | None,
    object_prefix: str | None = None,
) -> StoredImage:
    config = _load_backblaze_config()
    file_name = _build_file_name(original_filename, content_type)
    object_key = _build_object_key(
        file_name=file_name,
        object_prefix=object_prefix or config.object_prefix,
    )
    mime_type = content_type or mimetypes.guess_type(file_name)[0] or "application/octet-stream"

    client = boto3.client(
        "s3",
        endpoint_url=config.endpoint_url,
        aws_access_key_id=config.key_id,
        aws_secret_access_key=config.application_key,
        region_name=config.region,
        config=Config(signature_version="s3v4"),
    )

    try:
        client.put_object(
            Bucket=config.bucket_name,
            Key=object_key,
            Body=file_bytes,
            ContentType=mime_type,
        )
    except Exception as error:
        raise StorageError("Nao foi possivel enviar a imagem ao Backblaze B2.") from error

    public_url = f"{config.public_base_url.rstrip('/')}/{quote(object_key, safe='/')}"
    return StoredImage(
        provider="backblaze",
        file_name=file_name,
        reference=public_url,
        object_key=object_key,
    )


def _resolve_storage_provider() -> str:
    provider = (os.getenv("IMAGE_STORAGE_PROVIDER", "auto").strip().lower() or "auto")
    if provider not in SUPPORTED_PROVIDERS:
        raise StorageError(
            "IMAGE_STORAGE_PROVIDER invalido. Use auto, local ou backblaze."
        )

    if provider == "auto":
        return "backblaze" if _has_backblaze_config() else "local"

    return provider


def _has_backblaze_config() -> bool:
    required_values = [
        os.getenv("BACKBLAZE_ENDPOINT_URL", "").strip(),
        os.getenv("BACKBLAZE_BUCKET_NAME", "").strip(),
        os.getenv("BACKBLAZE_KEY_ID", "").strip(),
        os.getenv("BACKBLAZE_APPLICATION_KEY", "").strip(),
        os.getenv("BACKBLAZE_PUBLIC_BASE_URL", "").strip(),
    ]
    return all(required_values)


def _load_backblaze_config() -> BackblazeConfig:
    missing = [
        name
        for name in (
            "BACKBLAZE_ENDPOINT_URL",
            "BACKBLAZE_BUCKET_NAME",
            "BACKBLAZE_KEY_ID",
            "BACKBLAZE_APPLICATION_KEY",
            "BACKBLAZE_PUBLIC_BASE_URL",
        )
        if not os.getenv(name, "").strip()
    ]
    if missing:
        missing_list = ", ".join(missing)
        raise StorageError(
            f"Configuracao do Backblaze incompleta. Defina: {missing_list}."
        )

    endpoint_url = os.getenv("BACKBLAZE_ENDPOINT_URL", "").strip()
    public_base_url = os.getenv("BACKBLAZE_PUBLIC_BASE_URL", "").strip()

    return BackblazeConfig(
        endpoint_url=endpoint_url,
        region=_get_backblaze_region(endpoint_url),
        bucket_name=os.getenv("BACKBLAZE_BUCKET_NAME", "").strip(),
        key_id=os.getenv("BACKBLAZE_KEY_ID", "").strip(),
        application_key=os.getenv("BACKBLAZE_APPLICATION_KEY", "").strip(),
        public_base_url=public_base_url,
        object_prefix=(
            os.getenv("BACKBLAZE_OBJECT_PREFIX", DEFAULT_OBJECT_PREFIX).strip("/")
            or DEFAULT_OBJECT_PREFIX
        ),
    )


def _get_backblaze_region(endpoint_url: str) -> str:
    explicit_region = os.getenv("BACKBLAZE_REGION", "").strip()
    if explicit_region:
        return explicit_region

    match = _ENDPOINT_REGION_PATTERN.match(endpoint_url)
    if match:
        return match.group(1)

    raise StorageError(
        "Nao foi possivel identificar a regiao do Backblaze. "
        "Defina BACKBLAZE_REGION ou use um BACKBLAZE_ENDPOINT_URL no formato "
        "https://s3.<regiao>.backblazeb2.com."
    )


def _build_object_key(*, file_name: str, object_prefix: str) -> str:
    prefix = object_prefix.strip("/")
    if not prefix:
        return file_name
    return f"{prefix}/{file_name}"


def _build_file_name(
    original_filename: str | None,
    content_type: str | None,
) -> str:
    candidate_name = (original_filename or "").strip()
    candidate_path = Path(candidate_name)
    suffix = candidate_path.suffix.lower()
    if not suffix:
        guessed_suffix = mimetypes.guess_extension(content_type or "")
        suffix = guessed_suffix or ".bin"

    stem = _sanitize_filename(candidate_path.stem or "upload")
    return f"{stem}-{uuid4().hex}{suffix}"


def _sanitize_filename(value: str) -> str:
    sanitized = _FILENAME_SANITIZER.sub("-", value).strip("._-")
    return sanitized or "upload"
