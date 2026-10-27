from __future__ import annotations

import argparse
from pathlib import Path

from dotenv import load_dotenv

from app.image_storage import StorageError
from app.image_storage import upload_existing_local_file_to_backblaze

load_dotenv()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Envia os arquivos locais de uploads para o bucket Backblaze B2.",
    )
    parser.add_argument(
        "--directory",
        default="uploads",
        help="Diretorio local que contem os arquivos a serem enviados.",
    )
    parser.add_argument(
        "--prefix",
        default=None,
        help="Prefixo opcional para sobrescrever BACKBLAZE_OBJECT_PREFIX.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    directory = Path(args.directory)
    if not directory.exists():
        print(f"Diretorio nao encontrado: {directory}")
        return 1

    files = sorted(path for path in directory.iterdir() if path.is_file())
    if not files:
        print(f"Nenhum arquivo encontrado em {directory}")
        return 0

    success_count = 0
    for file_path in files:
        try:
            stored_image = upload_existing_local_file_to_backblaze(
                file_path,
                object_prefix=args.prefix,
            )
            print(f"{file_path.name} -> {stored_image.reference}")
            success_count += 1
        except StorageError as error:
            print(f"Falha ao enviar {file_path.name}: {error}")

    print(f"Upload concluido: {success_count}/{len(files)} arquivo(s) enviados.")
    return 0 if success_count == len(files) else 1


if __name__ == "__main__":
    raise SystemExit(main())
