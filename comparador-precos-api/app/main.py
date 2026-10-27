from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.favorites import router as favorites_router
from app.api.routes.health import router as health_router
from app.api.routes.history import router as history_router
from app.api.routes.legal import router as legal_router
from app.api.routes.scan import router as scan_router
from app.db import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        init_db()
        print("Banco de dados inicializado com sucesso.", flush=True)
    except Exception as error:
        print(f"Nao foi possivel inicializar o banco de dados: {error}", flush=True)

    yield


app = FastAPI(
    title="Comparador de Precos API",
    version="0.1.0",
    description="Backend inicial em FastAPI para o projeto Comparador de Precos.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
) 

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(favorites_router)
app.include_router(history_router)
app.include_router(legal_router)
app.include_router(scan_router)



@app.get("/", tags=["Root"])
def read_root() -> dict[str, str]:
    return {"message": "Comparador de Precos API online"}
