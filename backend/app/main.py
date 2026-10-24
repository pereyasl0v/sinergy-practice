"""FastAPI backend plus built React assets served from one origin."""
from __future__ import annotations
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from .calculator import CATALOG, DEFAULT_PROGRAM, calculate

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DIST_DIR = PROJECT_ROOT / "frontend" / "dist"
app = FastAPI(title="Калькулятор стоимости обучения", version="2.0.0")

@app.get("/api/catalog")
def catalog() -> dict:
    return {**CATALOG, "default_program": DEFAULT_PROGRAM}

@app.get("/api/calculate")
def quote(
    program: str = DEFAULT_PROGRAM,
    months: int | None = Query(default=None, ge=1, le=120),
    employment: bool = False,
    discount: int = Query(0, ge=0, le=50),
    housing: int = Query(0, ge=0, le=500000),
    food: int = Query(0, ge=0, le=500000),
    transport: int = Query(0, ge=0, le=500000),
    other: int = Query(0, ge=0, le=500000),
    materials: int = Query(0, ge=0, le=500000),
):
    try:
        return calculate(program, months, employment, discount, housing, food, transport, other, materials)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

if (DIST_DIR / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

@app.get("/{path:path}", include_in_schema=False)
def frontend(path: str):
    if path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    index_file = DIST_DIR / "index.html"
    if not index_file.is_file():
        raise HTTPException(status_code=503, detail="Сначала выполните npm run build в frontend/")
    if path and "/" not in path and path != "index.html":
        candidate = DIST_DIR / path
        if candidate.is_file():
            return FileResponse(candidate)
    return FileResponse(index_file)
