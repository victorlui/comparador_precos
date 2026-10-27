import re


_WHITESPACE_PATTERN = re.compile(r"\s+")
_DOMAIN_PREFIX_PATTERN = re.compile(r"^(?:https?://)?(?:www\d?\.)?", re.IGNORECASE)
_STORE_ALIASES = {
    "amazon": "Amazon",
    "americanas": "Americanas",
    "casasbahia": "Casas Bahia",
    "carrefour": "Carrefour",
    "fastshop": "Fast Shop",
    "kabum": "Kabum",
    "magalu": "Magalu",
    "magazineluiza": "Magazine Luiza",
    "mercadolivre": "Mercado Livre",
    "pontofrio": "Ponto Frio",
    "shopee": "Shopee",
}


def normalize_store_name(value: object, *, default: str = "Loja") -> str:
    if not isinstance(value, str):
        return default

    text = value.strip()
    if not text:
        return default

    text = _DOMAIN_PREFIX_PATTERN.sub("", text)
    text = text.split("/", 1)[0].split("?", 1)[0].split("#", 1)[0].strip()

    # When SerpApi returns a domain like amazon.com.br, keep only the brand label.
    if "." in text and " " not in text:
        text = text.split(".", 1)[0]

    text = text.replace("-", " ").replace("_", " ")
    text = _WHITESPACE_PATTERN.sub(" ", text).strip()
    if not text:
        return default

    alias_key = "".join(char for char in text.lower() if char.isalnum())
    alias_value = _STORE_ALIASES.get(alias_key)
    if alias_value:
        return alias_value

    return " ".join(part[:1].upper() + part[1:].lower() for part in text.split(" "))


def normalize_result_store_names(result: dict[str, object]) -> dict[str, object]:
    normalized_result = dict(result)
    offers = normalized_result.get("precos")
    if not isinstance(offers, list):
        return normalized_result

    normalized_offers: list[object] = []
    for offer in offers:
        if not isinstance(offer, dict):
            normalized_offers.append(offer)
            continue

        normalized_offer = dict(offer)
        normalized_offer["loja"] = normalize_store_name(
            normalized_offer.get("loja"),
            default="Loja",
        )
        normalized_offers.append(normalized_offer)

    normalized_result["precos"] = normalized_offers
    return normalized_result
