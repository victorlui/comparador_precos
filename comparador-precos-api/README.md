# Comparador de Precos API

Backend inicial em Python com FastAPI.

## Requisitos

- Python 3.11+

## Instalar dependencias

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Configurar armazenamento de imagens

O projeto agora suporta dois modos de armazenamento:

- `local`: continua gravando em `uploads/`
- `backblaze`: envia a imagem para o bucket Backblaze B2
- `auto`: usa Backblaze quando as variaveis estiverem completas no `.env`; caso contrario, faz fallback para `local`

Variaveis novas no `.env`:

```bash
IMAGE_STORAGE_PROVIDER=auto
LOCAL_UPLOAD_DIR=uploads
BACKBLAZE_ENDPOINT_URL=https://s3.us-west-004.backblazeb2.com
BACKBLAZE_REGION=
BACKBLAZE_BUCKET_NAME=seu-bucket
BACKBLAZE_KEY_ID=sua_key_id
BACKBLAZE_APPLICATION_KEY=sua_application_key
BACKBLAZE_PUBLIC_BASE_URL=https://f005.backblazeb2.com/file/seu-bucket
BACKBLAZE_OBJECT_PREFIX=scans
```

Notas:

- `BACKBLAZE_ENDPOINT_URL` deve usar o endpoint S3 compativel da sua regiao
- `BACKBLAZE_PUBLIC_BASE_URL` deve ser a base publica real do bucket para montar a URL final do arquivo
- se `BACKBLAZE_REGION` ficar vazio, a API tenta derivar a regiao a partir do endpoint

Para migrar os arquivos ja existentes em `uploads/` para o bucket:

```bash
python -m scripts.upload_existing_uploads_to_backblaze
```

## Rodar em desenvolvimento

```bash
uvicorn app.main:app --reload
```

## Postgres com Docker

1. Copie o `.env.example` para `.env` se ainda nao tiver feito isso.
2. Suba somente o banco:

```bash
docker compose up -d postgres
```

3. Para derrubar o container:

```bash
docker compose down
```

O banco sobe com volume persistente `postgres_data` e expoe a porta definida em `POSTGRES_PORT` (padrao `5432`).

Ao iniciar a API, as tabelas de historico sao criadas automaticamente:

- `search_history`: item escaneado ou buscado por texto
- `search_history_offer`: ofertas consolidadas de cada busca
- `favorite_product`: favoritos persistidos para revisita rapida

Organizacao em modulos:

- `app/modules/history/`: schemas, router e service do historico
- `app/modules/favorites/`: schemas, router e service dos favoritos

Exemplo de consulta do historico:

```bash
curl "http://localhost:8000/history?limit=20&offset=0"
```

Exemplo de consulta de um item especifico:

```bash
curl "http://localhost:8000/history/SEU_HISTORY_ID"
```

Exemplo para excluir um item do historico:

```bash
curl -X DELETE "http://localhost:8000/history/SEU_HISTORY_ID"
```

Exemplo para limpar todo o historico:

```bash
curl -X DELETE "http://localhost:8000/history"
```

Exemplo para salvar ou atualizar um favorito:

```bash
curl -X PUT "http://localhost:8000/favorites" \
  -H "Content-Type: application/json" \
  -d '{
    "source_type": "text_search",
    "result": {
      "produto_principal": "MacBook Air",
      "precos": [
        {
          "loja": "Loja Exemplo",
          "preco": "R$ 7.999,00",
          "imagem": "https://exemplo.com/macbook.jpg"
        }
      ]
    }
  }'
```

Exemplo para listar favoritos:

```bash
curl "http://localhost:8000/favorites?limit=20&offset=0"
```

Exemplo para remover um favorito:

```bash
curl -X DELETE "http://localhost:8000/favorites/macbook%20air"
```

## Rotas iniciais

- `GET /`
- `GET /health`
- `GET /favorites`
- `GET /favorites/{product_key}`
- `PUT /favorites`
- `DELETE /favorites/{product_key}`
- `GET /history`
- `GET /history/{history_id}`
- `DELETE /history`
- `DELETE /history/{history_id}`
- `POST /scan`
- `POST /scan/search`

## Documentacao automatica

- Swagger UI: `http://192.168.1.35:8000/docs`
- ReDoc: `http://192.168.1.35:8000/redoc`
