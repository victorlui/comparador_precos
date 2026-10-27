import asyncio
import base64
import json
import os
from time import perf_counter
from uuid import UUID
from uuid import uuid4

import requests
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from app.db.history_store import save_search_history
from app.db.models import SearchSource
from app.image_storage import StorageError
from app.image_storage import store_uploaded_image
from app.modules.users.service import AuthenticatedUser
from app.security.clerk_auth import require_authenticated_user
from app.store_names import normalize_store_name

load_dotenv()

router = APIRouter()

SUPPORTED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/heic", "image/webp"}
OPENROUTER_CHAT_COMPLETIONS_API_URL = "https://openrouter.ai/api/v1/chat/completions"
SERPAPI_SEARCH_API_URL = "https://serpapi.com/search.json"
DEFAULT_OPENROUTER_MODEL = "openai/gpt-4.1-mini"
DEFAULT_OPENROUTER_TIMEOUT_SECONDS = 45.0
DEFAULT_OPENROUTER_RETRY_ATTEMPTS = 2
DEFAULT_OPENROUTER_RETRY_DELAY_SECONDS = 2.0
DEFAULT_SERPAPI_TIMEOUT_SECONDS = 20.0
DEFAULT_SERPAPI_RETRY_ATTEMPTS = 2
DEFAULT_SERPAPI_RETRY_DELAY_SECONDS = 1.5
DEFAULT_SERPAPI_MAX_QUERIES = 3
DEFAULT_SERPAPI_MAX_RESULTS = 10
DEFAULT_SERPAPI_GOOGLE_DOMAIN = "google.com.br"
DEFAULT_SERPAPI_GL = "br"
DEFAULT_SERPAPI_HL = "pt-br"
CANONICAL_PRODUCT_NAME_MAP = {
    "pegador de mao ajustavel": "Handgrip",
    "pegador de mao": "Handgrip",
    "fortalecedor de mao": "Handgrip",
    "hand grip": "Handgrip",
    "handgrip ajustavel": "Handgrip",
    "hand grip ajustavel": "Handgrip",
    "aparelho de exercicio para mao": "Handgrip",
    "notebook apple": "MacBook",
    "mac book": "MacBook",
    "macbook air": "MacBook Air",
    "macbook pro": "MacBook Pro",
}
class ScanProcessingError(Exception):
    def __init__(self, message: str, status_code: int) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class SearchProductRequest(BaseModel):
    query: str


@router.post("/scan", tags=["Scan"])
async def scan_product(
    file: UploadFile = File(...),
    current_user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    started_at = perf_counter()

    try:
        if not file.content_type or file.content_type not in SUPPORTED_IMAGE_TYPES:
            raise HTTPException(
                status_code=415,
                detail="Envie uma imagem JPEG, PNG, HEIC ou WEBP.",
            )

        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="A imagem enviada esta vazia.")

        image_size_kb = len(file_bytes) / 1024
        original_filename = os.path.basename(file.filename or "")
        fallback_filename = original_filename or f"upload-{uuid4().hex}.jpg"

        try:
            stored_image = await asyncio.to_thread(
                store_uploaded_image,
                file_bytes=file_bytes,
                original_filename=fallback_filename,
                content_type=file.content_type,
            )
        except StorageError as error:
            raise ScanProcessingError(str(error), 500) from error

        print(
            (
                f"Imagem recebida e armazenada em: {stored_image.reference} "
                f"(mime={file.content_type}, tamanho={image_size_kb:.1f} KB)"
            ),
            flush=True,
        )

        recognition = await recognize_product_with_openrouter(
            image_bytes=file_bytes,
            mime_type=file.content_type,
        )
        resultados_precos = await search_product_prices_with_serpapi(recognition)

        total_elapsed = perf_counter() - started_at
        print(
            f"Scan finalizado em {total_elapsed:.2f}s com provider=openrouter",
            flush=True,
        )
        response_content = _build_response_content(recognition, resultados_precos)
        await _persist_search_history(
            user_id=current_user.id,
            source_type=SearchSource.IMAGE_SCAN,
            input_query=None,
            product_name=str(recognition["produto_principal"]),
            candidates=_extract_candidates(recognition),
            offers=resultados_precos,
            source_file_name=stored_image.file_name,
            source_file_path=stored_image.reference,
            raw_response=response_content,
        )
        return JSONResponse(content=response_content)
    except ScanProcessingError as error:
        total_elapsed = perf_counter() - started_at
        print(f"Erro no reconhecimento apos {total_elapsed:.2f}s: {error}", flush=True)
        raise HTTPException(status_code=error.status_code, detail=error.message) from error


@router.post("/scan/search", tags=["Scan"])
async def search_product_by_text(
    payload: SearchProductRequest,
    current_user: AuthenticatedUser = Depends(require_authenticated_user),
) -> JSONResponse:
    started_at = perf_counter()

    try:
        product_name = _normalize_product_name(payload.query.strip())
        if not product_name:
            raise HTTPException(
                status_code=400,
                detail="Informe o nome do produto para buscar as ofertas.",
            )

        recognition = {
            "produto_principal": product_name,
            "candidatos": [product_name],
        }
        resultados_precos = await search_product_prices_with_serpapi(recognition)

        total_elapsed = perf_counter() - started_at
        print(
            f"Busca manual finalizada em {total_elapsed:.2f}s para '{product_name}'",
            flush=True,
        )
        response_content = _build_response_content(recognition, resultados_precos)
        await _persist_search_history(
            user_id=current_user.id,
            source_type=SearchSource.TEXT_SEARCH,
            input_query=payload.query.strip(),
            product_name=str(recognition["produto_principal"]),
            candidates=_extract_candidates(recognition),
            offers=resultados_precos,
            source_file_name=None,
            source_file_path=None,
            raw_response=response_content,
        )
        return JSONResponse(content=response_content)
    except ScanProcessingError as error:
        total_elapsed = perf_counter() - started_at
        print(f"Erro na busca manual apos {total_elapsed:.2f}s: {error}", flush=True)
        raise HTTPException(status_code=error.status_code, detail=error.message) from error


def _build_response_content(
    recognition: dict[str, object],
    resultados_precos: list[dict[str, str]],
) -> dict[str, object]:
    return {
        "status": "sucesso",
        "produto": recognition["produto_principal"],
        "produto_principal": recognition["produto_principal"],
        "candidatos": recognition["candidatos"],
        "precos": resultados_precos,
    }


def _extract_candidates(recognition: dict[str, object]) -> list[str]:
    candidates = recognition.get("candidatos")
    if not isinstance(candidates, list):
        return []

    return [str(candidate) for candidate in candidates if str(candidate).strip()]


async def _persist_search_history(
    *,
    user_id: UUID,
    source_type: SearchSource,
    input_query: str | None,
    product_name: str,
    candidates: list[str],
    offers: list[dict[str, str]],
    source_file_name: str | None,
    source_file_path: str | None,
    raw_response: dict[str, object],
) -> None:
    try:
        await asyncio.to_thread(
            save_search_history,
            user_id=user_id,
            source_type=source_type,
            input_query=input_query,
            product_name=product_name,
            candidates=candidates,
            offers=offers,
            source_file_name=source_file_name,
            source_file_path=source_file_path,
            raw_response=raw_response,
        )
    except Exception as error:
        print(f"Nao foi possivel salvar o historico da busca: {error}", flush=True)


async def recognize_product_with_openrouter(
    image_bytes: bytes,
    mime_type: str,
) -> dict[str, object]:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise ScanProcessingError(
            "OpenRouter nao configurado. Defina OPENROUTER_API_KEY.",
            500,
        )

    model = os.getenv("OPENROUTER_MODEL", DEFAULT_OPENROUTER_MODEL).strip()
    timeout_seconds = _get_float_env(
        "OPENROUTER_TIMEOUT_SECONDS",
        DEFAULT_OPENROUTER_TIMEOUT_SECONDS,
        minimum=1.0,
    )
    retry_attempts = _get_int_env(
        "OPENROUTER_RETRY_ATTEMPTS",
        DEFAULT_OPENROUTER_RETRY_ATTEMPTS,
        minimum=1,
    )
    retry_delay_seconds = _get_float_env(
        "OPENROUTER_RETRY_DELAY_SECONDS",
        DEFAULT_OPENROUTER_RETRY_DELAY_SECONDS,
        minimum=0.0,
    )
    referer = os.getenv("OPENROUTER_HTTP_REFERER", "").strip()
    title = os.getenv("OPENROUTER_APP_TITLE", "").strip()

    image_size_kb = len(image_bytes) / 1024
    print(
        f"Chamando OpenRouter com modelo={model} timeout={timeout_seconds}s...",
        flush=True,
    )
    print(
        f"Preparando payload da imagem para OpenRouter ({image_size_kb:.1f} KB)...",
        flush=True,
    )

    payload = _build_openrouter_payload(
        model=model,
        mime_type=mime_type,
        image_bytes=image_bytes,
    )

    response_payload: dict[str, object] | None = None
    inference_elapsed = 0.0
    last_error: Exception | None = None

    for attempt in range(1, retry_attempts + 1):
        try:
            print(
                f"Tentativa {attempt}/{retry_attempts} de analise no OpenRouter...",
                flush=True,
            )
            started_at = perf_counter()
            response_payload = await asyncio.wait_for(
                asyncio.to_thread(
                    _create_openrouter_response,
                    api_key,
                    timeout_seconds,
                    referer,
                    title,
                    payload,
                ),
                timeout=timeout_seconds,
            )
            inference_elapsed = perf_counter() - started_at
            break
        except TimeoutError as error:
            raise ScanProcessingError(
                "A analise da imagem demorou mais do que o esperado no OpenRouter.",
                504,
            ) from error
        except Exception as error:
            last_error = error
            if attempt == retry_attempts or not _is_retryable_openrouter_error(error):
                break

            print(
                _describe_openrouter_error(
                    error,
                    prefix=(
                        f"OpenRouter indisponivel na tentativa {attempt}/{retry_attempts}."
                    ),
                ),
                flush=True,
            )
            print(
                (
                    f"Nova tentativa em {retry_delay_seconds:.1f}s..."
                ),
                flush=True,
            )
            await asyncio.sleep(retry_delay_seconds)

    if response_payload is None:
        _raise_openrouter_error(last_error)

    print(f"OpenRouter respondeu em {inference_elapsed:.2f}s", flush=True)
    output_text = _extract_openrouter_output_text(response_payload)
    parsed = _parse_openrouter_output(output_text)
    print(
        f"Produto identificado pelo OpenRouter: {parsed['produto_principal']}",
        flush=True,
    )
    return parsed


async def search_product_prices_with_serpapi(
    recognition: dict[str, object],
) -> list[dict[str, str]]:
    api_key = os.getenv("SERPAPI_API_KEY")
    if not api_key:
        raise ScanProcessingError(
            "SerpApi nao configurada. Defina SERPAPI_API_KEY.",
            500,
        )

    timeout_seconds = _get_float_env(
        "SERPAPI_TIMEOUT_SECONDS",
        DEFAULT_SERPAPI_TIMEOUT_SECONDS,
        minimum=1.0,
    )
    retry_attempts = _get_int_env(
        "SERPAPI_RETRY_ATTEMPTS",
        DEFAULT_SERPAPI_RETRY_ATTEMPTS,
        minimum=1,
    )
    retry_delay_seconds = _get_float_env(
        "SERPAPI_RETRY_DELAY_SECONDS",
        DEFAULT_SERPAPI_RETRY_DELAY_SECONDS,
        minimum=0.0,
    )
    max_queries = _get_int_env(
        "SERPAPI_MAX_QUERIES",
        DEFAULT_SERPAPI_MAX_QUERIES,
        minimum=1,
    )
    max_results = _get_int_env(
        "SERPAPI_MAX_RESULTS",
        DEFAULT_SERPAPI_MAX_RESULTS,
        minimum=1,
    )
    google_domain = os.getenv("SERPAPI_GOOGLE_DOMAIN", DEFAULT_SERPAPI_GOOGLE_DOMAIN).strip()
    gl = os.getenv("SERPAPI_GL", DEFAULT_SERPAPI_GL).strip()
    hl = os.getenv("SERPAPI_HL", DEFAULT_SERPAPI_HL).strip()
    location = os.getenv("SERPAPI_LOCATION", "").strip()

    queries = _build_price_search_queries(recognition, max_queries=max_queries)
    if not queries:
        return []

    print(
        f"Buscando precos na SerpApi para {len(queries)} consulta(s)...",
        flush=True,
    )

    aggregated_results: list[dict[str, object]] = []

    for query_index, query in enumerate(queries):
        params: dict[str, object] = {
            "engine": "google_shopping",
            "q": query,
            "api_key": api_key,
            "google_domain": google_domain or DEFAULT_SERPAPI_GOOGLE_DOMAIN,
            "gl": gl or DEFAULT_SERPAPI_GL,
            "hl": hl or DEFAULT_SERPAPI_HL,
        }
        if location:
            params["location"] = location

        response_payload: dict[str, object] | None = None
        last_error: Exception | None = None

        for attempt in range(1, retry_attempts + 1):
            try:
                print(
                    (
                        f"Consultando SerpApi para '{query}' "
                        f"({attempt}/{retry_attempts})..."
                    ),
                    flush=True,
                )
                response_payload = await asyncio.wait_for(
                    asyncio.to_thread(
                        _create_serpapi_response,
                        timeout_seconds,
                        params,
                    ),
                    timeout=timeout_seconds,
                )
                break
            except TimeoutError as error:
                raise ScanProcessingError(
                    "A busca de precos demorou mais do que o esperado na SerpApi.",
                    504,
                ) from error
            except Exception as error:
                last_error = error
                if attempt == retry_attempts or not _is_retryable_serpapi_error(error):
                    break

                print(
                    _describe_serpapi_error(
                        error,
                        prefix=(
                            f"SerpApi indisponivel na tentativa {attempt}/{retry_attempts}."
                        ),
                    ),
                    flush=True,
                )
                print(
                    f"Nova tentativa em {retry_delay_seconds:.1f}s...",
                    flush=True,
                )
                await asyncio.sleep(retry_delay_seconds)

        if response_payload is None:
            _raise_serpapi_error(last_error)

        raw_items = _extract_serpapi_shopping_results(response_payload)
        aggregated_results.extend(
            _normalize_serpapi_price_results(
                raw_items,
                query=query,
                query_index=query_index,
            )
        )

        if len(_deduplicate_price_results(aggregated_results)) >= max_results:
            break

    ranked_results = _deduplicate_price_results(aggregated_results)
    ranked_results.sort(key=_serpapi_price_sort_key)

    final_results: list[dict[str, str]] = []
    for item in ranked_results[:max_results]:
        serialized = {
            "loja": str(item["loja"]),
            "titulo": str(item["titulo"]),
            "preco": str(item["preco"]),
            "link": str(item["link"]),
        }
        frete = item.get("frete")
        if isinstance(frete, str) and frete:
            serialized["frete"] = frete
        imagem = item.get("imagem")
        if isinstance(imagem, str) and imagem:
            serialized["imagem"] = imagem
        final_results.append(serialized)

    print(
        f"SerpApi retornou {len(final_results)} oferta(s) apos consolidacao.",
        flush=True,
    )
    return final_results


def _create_serpapi_response(
    timeout_seconds: float,
    params: dict[str, object],
) -> dict[str, object]:
    response = requests.get(
        SERPAPI_SEARCH_API_URL,
        params=params,
        timeout=timeout_seconds,
    )
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, dict):
        raise ScanProcessingError(
            "A SerpApi nao retornou um payload JSON valido.",
            502,
        )

    error_message = data.get("error")
    if isinstance(error_message, str) and error_message.strip():
        raise ScanProcessingError(
            f"Erro retornado pela SerpApi: {error_message.strip()}",
            502,
        )

    return data


def _create_openrouter_response(
    api_key: str,
    timeout_seconds: float,
    referer: str,
    title: str,
    payload: dict[str, object],
) -> dict[str, object]:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if referer:
        headers["HTTP-Referer"] = referer
    if title:
        headers["X-OpenRouter-Title"] = title

    response = requests.post(
        OPENROUTER_CHAT_COMPLETIONS_API_URL,
        headers=headers,
        json=payload,
        timeout=timeout_seconds,
    )
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, dict):
        raise ScanProcessingError(
            "O OpenRouter nao retornou um payload JSON valido.",
            502,
        )
    return data


def _build_openrouter_payload(
    model: str,
    mime_type: str,
    image_bytes: bytes,
) -> dict[str, object]:
    base64_image = base64.b64encode(image_bytes).decode("utf-8")
    data_uri = f"data:{mime_type};base64,{base64_image}"
    return {
        "model": model,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "system",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Voce e um especialista em reconhecimento visual de produtos. "
                            "Responda somente em JSON valido, sem markdown. "
                            "Retorne o objeto com as chaves produto_principal e candidatos. "
                            "produto_principal deve ser o melhor nome comercial para busca do produto principal da imagem. "
                            "Se marca, linha ou modelo estiverem claramente visiveis no proprio produto ou na embalagem, inclua isso no nome. "
                            "Exemplos bons: 'MacBook Air', 'Garrafa termica Stanley', 'Caneca de ceramica', 'Handgrip'. "
                            "Se a marca nao estiver visivel, use o nome canonico mais comum no mercado e evite descricoes funcionais ou literais. "
                            "Exemplos ruins: 'notebook', 'pegador de mao ajustavel', 'objeto metalico', 'equipamento eletronico'. "
                            "candidatos deve ser uma lista curta de 1 a 5 alternativas de nomes comerciais uteis para busca, "
                            "ordenadas da mais provavel para a menos provavel. "
                            "Nao invente marca se ela nao estiver visivel. "
                            "Nao invente modelo tecnico se ele nao puder ser lido ou inferido com alta confianca. "
                            "Prefira termos canonicos de ecommerce, inclusive emprestimos comuns como 'Handgrip' e 'Mouse gamer', quando forem mais naturais que a traducao literal. "
                            "Se houver varios objetos, priorize o item central da imagem."
                        ),
                    }
                ],
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Analise a imagem e identifique o produto principal. "
                            "Retorne nomes uteis para busca comercial. "
                            "Tente reconhecer marca e modelo visiveis; se isso nao for possivel, retorne o nome padrao comercial mais conhecido. "
                            "Exemplos esperados: 'MacBook Air', 'Handgrip', 'Caneca de ceramica', 'Monitor LG', 'Garrafa termica Stanley'."
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": data_uri},
                    },
                ],
            },
        ],
    }


def _extract_openrouter_output_text(payload: dict[str, object]) -> str:
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise ScanProcessingError(
            "O OpenRouter nao retornou texto para a imagem enviada.",
            502,
        )

    first_choice = choices[0]
    if not isinstance(first_choice, dict):
        raise ScanProcessingError(
            "O OpenRouter nao retornou texto para a imagem enviada.",
            502,
        )

    message = first_choice.get("message")
    if not isinstance(message, dict):
        raise ScanProcessingError(
            "O OpenRouter nao retornou uma mensagem valida.",
            502,
        )

    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        raise ScanProcessingError(
            "O OpenRouter nao retornou texto para a imagem enviada.",
            502,
        )

    return content.strip()


def _parse_openrouter_output(output_text: str) -> dict[str, object]:
    parsed_json = _try_parse_json_object(output_text)
    if parsed_json is None:
        product_name = _normalize_product_name(output_text.strip())
        if not product_name:
            raise ScanProcessingError(
                "O OpenRouter nao retornou um nome de produto valido.",
                502,
            )
        return {
            "produto_principal": product_name,
            "candidatos": [product_name],
        }

    product_name = _normalize_product_name(str(parsed_json.get("produto_principal", "")).strip())
    raw_candidates = parsed_json.get("candidatos", [])
    candidates = _normalize_candidates(raw_candidates, fallback=product_name)

    if not product_name:
        product_name = candidates[0] if candidates else ""

    if not product_name:
        raise ScanProcessingError(
            "O OpenRouter nao retornou um nome de produto valido.",
                502,
            )

    if product_name not in candidates:
        candidates.insert(0, product_name)

    return {
        "produto_principal": product_name,
        "candidatos": candidates[:5],
    }


def _build_price_search_queries(
    recognition: dict[str, object],
    max_queries: int,
) -> list[str]:
    results: list[str] = []
    seen: set[str] = set()

    raw_queries: list[object] = [recognition.get("produto_principal")]
    raw_candidates = recognition.get("candidatos", [])
    if isinstance(raw_candidates, list):
        raw_queries.extend(raw_candidates)

    for raw_query in raw_queries:
        if not isinstance(raw_query, str):
            continue
        candidate = _normalize_product_name(raw_query.strip())
        if not candidate:
            continue
        key = candidate.lower()
        if key in seen:
            continue
        seen.add(key)
        results.append(candidate)
        if len(results) >= max_queries:
            break

    return results


def _extract_serpapi_shopping_results(payload: dict[str, object]) -> list[dict[str, object]]:
    results: list[dict[str, object]] = []

    for key in ("shopping_results", "inline_shopping_results"):
        items = payload.get(key)
        if isinstance(items, list):
            results.extend(item for item in items if isinstance(item, dict))

    categorized_results = payload.get("categorized_shopping_results")
    if isinstance(categorized_results, list):
        for category in categorized_results:
            if not isinstance(category, dict):
                continue
            category_items = category.get("shopping_results")
            if isinstance(category_items, list):
                results.extend(item for item in category_items if isinstance(item, dict))

    return results


def _normalize_serpapi_price_results(
    raw_items: list[dict[str, object]],
    query: str,
    query_index: int,
) -> list[dict[str, object]]:
    normalized_results: list[dict[str, object]] = []

    for item in raw_items:
        title = str(item.get("title", "")).strip()
        if not title:
            continue

        price_value = _get_numeric_price(item.get("extracted_price"))
        if price_value is None:
            price_value = _extract_money_value(str(item.get("price", "")).strip())
        if price_value is None:
            continue

        store_name = normalize_store_name(item.get("source"), default="Loja")
        link = _pick_first_non_empty_string(
            item.get("link"),
            item.get("product_link"),
            item.get("tracking_link"),
        )
        if not link:
            continue

        delivery_text = str(item.get("delivery", "")).strip()
        shipping_value = _extract_shipping_value(delivery_text)
        shipping_label = _format_shipping_text(delivery_text, shipping_value)
        total_price = price_value + shipping_value if shipping_value is not None else price_value

        normalized_results.append(
            {
                "titulo": title,
                "loja": store_name,
                "preco": _format_brl(price_value),
                "preco_valor": price_value,
                "preco_total": total_price,
                "frete_valor": shipping_value,
                "frete": shipping_label,
                "link": link,
                "imagem": _pick_first_non_empty_string(
                    item.get("thumbnail"),
                    item.get("serpapi_thumbnail"),
                ),
                "consulta": query,
                "consulta_indice": query_index,
            }
        )

    return normalized_results


def _deduplicate_price_results(
    items: list[dict[str, object]],
) -> list[dict[str, object]]:
    deduplicated_by_offer: dict[str, dict[str, object]] = {}

    for item in items:
        link = str(item.get("link", "")).strip().lower()
        store_name = str(item.get("loja", "")).strip().lower()
        title = str(item.get("titulo", "")).strip().lower()
        key = link or f"{store_name}|{title}"
        existing = deduplicated_by_offer.get(key)
        if existing is None or _serpapi_price_sort_key(item) < _serpapi_price_sort_key(existing):
            deduplicated_by_offer[key] = item

    deduplicated_by_price: dict[str, dict[str, object]] = {}
    for item in deduplicated_by_offer.values():
        price_key = _build_price_dedup_key(item)
        existing = deduplicated_by_price.get(price_key)
        if existing is None or _serpapi_price_sort_key(item) < _serpapi_price_sort_key(existing):
            deduplicated_by_price[price_key] = item

    return list(deduplicated_by_price.values())


def _build_price_dedup_key(item: dict[str, object]) -> str:
    price_value = _get_numeric_price(item.get("preco_valor"))
    if price_value is not None:
        return f"price:{price_value:.2f}"

    price_label = str(item.get("preco", "")).strip().lower()
    if price_label:
        return f"label:{price_label}"

    link = str(item.get("link", "")).strip().lower()
    return f"fallback:{link}"


def _serpapi_price_sort_key(item: dict[str, object]) -> tuple[float, int, int, str]:
    total_price = _get_numeric_price(item.get("preco_total")) or 0.0
    shipping_missing = 1 if item.get("frete_valor") is None else 0
    query_index = int(item.get("consulta_indice", 0))
    store_name = str(item.get("loja", "")).lower()
    return (total_price, shipping_missing, query_index, store_name)


def _pick_first_non_empty_string(*values: object) -> str:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _get_numeric_price(value: object) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    return None


def _extract_money_value(value: str) -> float | None:
    if not value:
        return None

    text = value.strip()
    digits = "".join(char for char in text if char.isdigit() or char in ",.")
    if not digits:
        return None

    if "," in digits and "." in digits:
        digits = digits.replace(".", "").replace(",", ".")
    elif "," in digits:
        digits = digits.replace(",", ".")

    try:
        return float(digits)
    except ValueError:
        return None


def _extract_shipping_value(delivery_text: str) -> float | None:
    if not delivery_text:
        return None

    normalized = delivery_text.lower()
    if "free" in normalized or "gratis" in normalized or "grátis" in normalized:
        return 0.0

    return _extract_money_value(delivery_text)


def _format_shipping_text(
    delivery_text: str,
    shipping_value: float | None,
) -> str | None:
    if shipping_value == 0:
        return "Frete Grátis"
    if shipping_value is not None:
        return _format_brl(shipping_value)
    if delivery_text:
        return delivery_text
    return None


def _format_brl(value: float) -> str:
    integer_part, decimal_part = f"{value:.2f}".split(".")
    reversed_digits = integer_part[::-1]
    grouped = ".".join(
        reversed_digits[index : index + 3]
        for index in range(0, len(reversed_digits), 3)
    )[::-1]
    return f"R$ {grouped},{decimal_part}"


def _try_parse_json_object(output_text: str) -> dict[str, object] | None:
    text = output_text.strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        start_index = text.find("{")
        end_index = text.rfind("}")
        if start_index == -1 or end_index == -1 or end_index <= start_index:
            return None
        try:
            parsed = json.loads(text[start_index : end_index + 1])
        except json.JSONDecodeError:
            return None

    if isinstance(parsed, dict):
        return parsed
    return None


def _normalize_candidates(raw_candidates: object, fallback: str) -> list[str]:
    results: list[str] = []
    seen: set[str] = set()
    items = raw_candidates if isinstance(raw_candidates, list) else []

    for item in items:
        if not isinstance(item, str):
            continue
        candidate = _normalize_product_name(item.strip())
        if not candidate:
            continue
        key = candidate.lower()
        if key in seen:
            continue
        results.append(candidate)
        seen.add(key)
        if len(results) >= 5:
            return results

    if fallback:
        fallback = _normalize_product_name(fallback)
        fallback_key = fallback.lower()
        if fallback_key not in seen:
            results.insert(0, fallback)

    return results[:5]


def _normalize_product_name(product_name: str) -> str:
    candidate = " ".join(product_name.split()).strip(" .,:;")
    if not candidate:
        return ""

    normalized_key = (
        candidate.lower()
        .replace("mão", "mao")
        .replace("ã", "a")
        .replace("â", "a")
        .replace("á", "a")
        .replace("é", "e")
        .replace("ê", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ô", "o")
        .replace("õ", "o")
        .replace("ú", "u")
        .replace("-", " ")
    )
    normalized_key = " ".join(normalized_key.split())

    if normalized_key in CANONICAL_PRODUCT_NAME_MAP:
        return CANONICAL_PRODUCT_NAME_MAP[normalized_key]

    if "macbook" in normalized_key and "air" in normalized_key:
        return "MacBook Air"
    if "macbook" in normalized_key and "pro" in normalized_key:
        return "MacBook Pro"
    if normalized_key == "macbook":
        return "MacBook"
    if (
        "handgrip" in normalized_key
        or "hand grip" in normalized_key
        or "pegador de mao" in normalized_key
        or "fortalecedor de mao" in normalized_key
    ):
        return "Handgrip"
    if normalized_key == "notebook":
        return "Notebook"

    return candidate


def _raise_openrouter_error(error: Exception | None) -> None:
    if error is None:
        raise ScanProcessingError(
            "Erro interno ao processar a imagem com OpenRouter.",
            500,
        )

    if isinstance(error, ScanProcessingError):
        raise error

    if isinstance(error, requests.Timeout):
        raise ScanProcessingError(
            "A analise da imagem demorou mais do que o esperado no OpenRouter.",
            504,
        ) from error

    if isinstance(error, requests.HTTPError):
        status_code = error.response.status_code if error.response is not None else 500
        error_text = error.response.text if error.response is not None else str(error)
        lowered_error = error_text.lower()
        print(
            _describe_openrouter_error(error, prefix="Erro HTTP do OpenRouter."),
            flush=True,
        )

        if status_code == 401:
            print(
                (
                    "Detalhe de autenticacao do OpenRouter: "
                    f"{_extract_openrouter_error_message(error_text)}"
                ),
                flush=True,
            )
            raise ScanProcessingError(
                "A chave do OpenRouter e invalida ou nao tem permissao para este recurso.",
                500,
            ) from error
        if status_code == 404 or ("model" in lowered_error and "not found" in lowered_error):
            raise ScanProcessingError(
                "O modelo OpenRouter configurado nao esta disponivel para esta conta.",
                502,
            ) from error
        if status_code == 429:
            raise ScanProcessingError(
                "O OpenRouter recusou a requisicao por limite de uso, cota ou credito. Verifique sua conta e tente novamente.",
                503,
            ) from error
        if status_code in {408, 500, 502, 503, 504}:
            raise ScanProcessingError(
                "O OpenRouter esta indisponivel ou com alta demanda no momento. Tente novamente em instantes.",
                503,
            ) from error

    if isinstance(error, requests.RequestException):
        print(
            _describe_openrouter_error(
                error,
                prefix="Erro de rede ao chamar o OpenRouter.",
            ),
            flush=True,
        )
        raise ScanProcessingError(
            "O OpenRouter esta indisponivel no momento. Tente novamente em instantes.",
            503,
        ) from error

    raise ScanProcessingError(
        "Erro interno ao processar a imagem com OpenRouter.",
        500,
    ) from error


def _raise_serpapi_error(error: Exception | None) -> None:
    if error is None:
        raise ScanProcessingError(
            "Erro interno ao consultar precos na SerpApi.",
            500,
        )

    if isinstance(error, ScanProcessingError):
        raise error

    if isinstance(error, requests.Timeout):
        raise ScanProcessingError(
            "A busca de precos demorou mais do que o esperado na SerpApi.",
            504,
        ) from error

    if isinstance(error, requests.HTTPError):
        status_code = error.response.status_code if error.response is not None else 500
        print(
            _describe_serpapi_error(error, prefix="Erro HTTP da SerpApi."),
            flush=True,
        )

        if status_code == 401:
            raise ScanProcessingError(
                "A chave da SerpApi e invalida ou nao tem permissao para este recurso.",
                500,
            ) from error
        if status_code == 429:
            raise ScanProcessingError(
                "A SerpApi recusou a requisicao por limite de uso, cota ou credito.",
                503,
            ) from error
        if status_code in {408, 500, 502, 503, 504}:
            raise ScanProcessingError(
                "A SerpApi esta indisponivel ou com alta demanda no momento. Tente novamente em instantes.",
                503,
            ) from error

    if isinstance(error, requests.RequestException):
        print(
            _describe_serpapi_error(
                error,
                prefix="Erro de rede ao chamar a SerpApi.",
            ),
            flush=True,
        )
        raise ScanProcessingError(
            "A SerpApi esta indisponivel no momento. Tente novamente em instantes.",
            503,
        ) from error

    raise ScanProcessingError(
        "Erro interno ao consultar precos na SerpApi.",
        500,
    ) from error


def _is_retryable_openrouter_error(error: Exception) -> bool:
    if isinstance(error, requests.HTTPError) and error.response is not None:
        return error.response.status_code in {408, 409, 429, 500, 502, 503, 504}

    return isinstance(error, (requests.Timeout, requests.ConnectionError))


def _is_retryable_serpapi_error(error: Exception) -> bool:
    if isinstance(error, requests.HTTPError) and error.response is not None:
        return error.response.status_code in {408, 409, 429, 500, 502, 503, 504}

    return isinstance(error, (requests.Timeout, requests.ConnectionError))


def _describe_openrouter_error(error: Exception, prefix: str) -> str:
    if isinstance(error, requests.HTTPError) and error.response is not None:
        response_text = error.response.text.strip().replace("\n", " ")
        if len(response_text) > 500:
            response_text = f"{response_text[:500]}..."
        return (
            f"{prefix} status={error.response.status_code} "
            f"body={response_text or '<vazio>'}"
        )

    return f"{prefix} detalhe={error}"


def _describe_serpapi_error(error: Exception, prefix: str) -> str:
    if isinstance(error, requests.HTTPError) and error.response is not None:
        response_text = error.response.text.strip().replace("\n", " ")
        if len(response_text) > 500:
            response_text = f"{response_text[:500]}..."
        return (
            f"{prefix} status={error.response.status_code} "
            f"body={response_text or '<vazio>'}"
        )

    return f"{prefix} detalhe={error}"


def _extract_openrouter_error_message(response_text: str) -> str:
    text = response_text.strip()
    if not text:
        return "<vazio>"

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return text[:500]

    if not isinstance(parsed, dict):
        return text[:500]

    error = parsed.get("error")
    if isinstance(error, dict):
        message = error.get("message")
        code = error.get("code")
        if isinstance(message, str) and isinstance(code, (str, int)):
            return f"code={code} message={message}"
        if isinstance(message, str):
            return message

    message = parsed.get("message")
    if isinstance(message, str):
        return message

    return text[:500]


def _get_float_env(
    key: str,
    default: float,
    minimum: float | None = None,
) -> float:
    value = os.getenv(key)
    if not value:
        return default

    try:
        parsed = float(value)
    except ValueError:
        return default

    if minimum is not None:
        return max(minimum, parsed)
    return parsed


def _get_int_env(
    key: str,
    default: int,
    minimum: int | None = None,
) -> int:
    value = os.getenv(key)
    if not value:
        return default

    try:
        parsed = int(value)
    except ValueError:
        return default

    if minimum is not None:
        return max(minimum, parsed)
    return parsed
