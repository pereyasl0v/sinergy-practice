"""FastAPI JSON backend and React production bundle hosting."""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .calculator import CATALOG, DEFAULT_PROGRAM, calculate

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DIST_DIR = PROJECT_ROOT / "frontend" / "dist"

app = FastAPI(title="Калькулятор стоимости обучения", version="1.0.0")


@app.get("/api/catalog")
def catalog() -> dict:
    return CATALOG


@app.get("/api/calculate")
def budget(
    program: str = DEFAULT_PROGRAM,
    discount: int = Query(0, ge=0, le=50),
    housing: int = Query(0, ge=0, le=500_000),
    food: int = Query(0, ge=0, le=500_000),
    transport: int = Query(0, ge=0, le=500_000),
    other: int = Query(0, ge=0, le=500_000),
    materials: int = Query(0, ge=0, le=500_000),
):
    try:
        return calculate(program, discount, housing, food, transport, other, materials)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


# Build-generated assets; `dist/` is not tracked in git.
if (DIST_DIR / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")


@app.get("/{path:path}", include_in_schema=False)
def frontend(path: str):
    """Single-page app fallback, without intercepting API paths."""
    if path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    index_file = DIST_DIR / "index.html"
    if not index_file.is_file():
        raise HTTPException(
            status_code=503,
            detail="React frontend has not been built. Run `npm run build` in frontend/.",
        )
    # Only Vite public output at dist root; no user-controlled directory traversal.
    if path and "/" not in path and path != "index.html":
        candidate = DIST_DIR / path
        if candidate.is_file():
            return FileResponse(candidate)
    return FileResponse(index_file)
