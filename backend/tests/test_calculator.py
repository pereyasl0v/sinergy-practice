from fastapi.testclient import TestClient

from app.calculator import CATALOG, calculate
from app.main import app

client = TestClient(app)


def test_catalog():
    result = client.get("/api/catalog")
    assert result.status_code == 200
    assert len(result.json()["programs"]) == len(CATALOG["programs"])


def test_default_price():
    price = calculate("b-dev")
    assert price["total"] == price["official_course"] == 1_520_000
    assert sum(x["total"] for x in price["years"]) == price["total"]


def test_personal_budget_and_discount():
    result = calculate("b-dev", discount=10, housing=20_000, materials=5_000)
    assert result["discount_savings"] == 152_000
    assert result["total"] == 1_368_000 + 20_000 * 48 + 5_000
    assert sum(x["total"] for x in result["years"]) == result["total"]


def test_bad_program_and_range():
    assert client.get("/api/calculate?program=not-found").status_code == 400
    assert client.get("/api/calculate?discount=70").status_code == 422


def test_built_asset_or_message():
    resp = client.get("/")
    assert resp.status_code in (200, 503)
