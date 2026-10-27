import re
import unicodedata


TEMP_EMAIL_DOMAINS = {
    "10minutemail.com",
    "10minutemail.net",
    "20minutemail.com",
    "disposablemail.com",
    "dispostable.com",
    "emailnator.com",
    "emailondeck.com",
    "fakeinbox.com",
    "getnada.com",
    "grr.la",
    "guerrillamail.biz",
    "guerrillamail.com",
    "guerrillamailblock.com",
    "harakirimail.com",
    "jetable.org",
    "mail.tm",
    "maildrop.cc",
    "mailinator.com",
    "mailnesia.com",
    "mintemail.com",
    "moakt.com",
    "muellmail.com",
    "mytemp.email",
    "nada.email",
    "secmail.com",
    "sharklasers.com",
    "spamgourmet.com",
    "spambox.us",
    "temp-mail.io",
    "temp-mail.org",
    "temp-mail.ru",
    "tempmail.com",
    "tempmail.dev",
    "tempmailo.com",
    "throwawaymail.com",
    "tmpmail.org",
    "trashmail.com",
    "trashmail.de",
    "yopmail.com",
}

EMAIL_PATTERN = re.compile(
    r"^(?=.{6,254}$)(?=.{1,64}@)"
    r"[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@"
    r"[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?"
    r"(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$",
    re.IGNORECASE,
)

SUSPICIOUS_NAME_FRAGMENTS = (
    "http://",
    "https://",
    "www.",
    "<",
    ">",
    "@",
    "--",
    "/*",
    "*/",
    "select ",
    "insert ",
    "delete ",
    "drop ",
    "union ",
)


class InvalidUserProfileError(ValueError):
    pass


def normalize_email(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = value.strip().lower()
    return normalized or None


def normalize_name(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = " ".join(value.strip().split())
    return normalized or None


def validate_user_profile(
    *,
    email: str | None,
    first_name: str | None,
    last_name: str | None,
) -> None:
    if email is not None:
        _validate_email(email)

    if first_name is not None:
        _validate_name_part(first_name, field_label="nome")

    if last_name is not None:
        _validate_name_part(last_name, field_label="sobrenome")


def _validate_email(email: str) -> None:
    if not EMAIL_PATTERN.fullmatch(email):
        raise InvalidUserProfileError("Digite um e-mail valido.")

    local_part, _, domain = email.partition("@")
    if (
        not local_part
        or not domain
        or local_part.startswith(".")
        or local_part.endswith(".")
        or ".." in local_part
        or ".." in domain
    ):
        raise InvalidUserProfileError("Digite um e-mail valido.")

    if _is_temporary_email_domain(domain):
        raise InvalidUserProfileError(
            "Use um e-mail permanente. E-mails temporarios nao sao aceitos."
        )


def _validate_name_part(value: str, *, field_label: str) -> None:
    if len(value) > 80:
        raise InvalidUserProfileError(f"O campo de {field_label} esta muito longo.")

    lowered_value = value.casefold()
    if any(fragment in lowered_value for fragment in SUSPICIOUS_NAME_FRAGMENTS):
        raise InvalidUserProfileError(
            f"Digite um {field_label} valido, sem links ou caracteres suspeitos."
        )

    letters_count = 0
    first_letter_seen = False

    for character in value:
        if _is_letter(character):
            letters_count += 1
            first_letter_seen = True
            continue

        if character in {" ", "-", "'"} and first_letter_seen:
            continue

        raise InvalidUserProfileError(
            f"Digite um {field_label} valido usando apenas letras."
        )

    if letters_count < 2:
        raise InvalidUserProfileError(
            f"Digite um {field_label} valido usando apenas letras."
        )

    if not _is_letter(value[0]) or not _is_letter(value[-1]):
        raise InvalidUserProfileError(
            f"Digite um {field_label} valido usando apenas letras."
        )


def _is_temporary_email_domain(domain: str) -> bool:
    return any(
        domain == blocked_domain or domain.endswith(f".{blocked_domain}")
        for blocked_domain in TEMP_EMAIL_DOMAINS
    )


def _is_letter(character: str) -> bool:
    category = unicodedata.category(character)
    return category.startswith("L") or category == "Mn"
