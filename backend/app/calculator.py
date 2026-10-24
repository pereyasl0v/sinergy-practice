"""Exact-source tuition estimates and separately modelled personal budgets.

Quoted tuition amounts are read from the source table, not re-derived by
multiplying first-year fees by an assumed number of years.
"""
from __future__ import annotations

import json
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

CATALOG = json.loads((Path(__file__).parent / "catalog.json").read_text(encoding="utf-8"))
PROGRAMS = {item["id"]: item for item in CATALOG["programs"]}
DEFAULT_PROGRAM = next(p["id"] for p in CATALOG["programs"] if p["source"] == "bachelor" and p["title"] == "Разработка программного обеспечения (Full-stack разработка)" and "классического" in p["training_mode"])


def _money_discount(price: int, pct: int) -> int:
    return int((Decimal(price) * pct / 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def calculate(
    program: str = DEFAULT_PROGRAM,
    months: int | None = None,
    employment: bool = False,
    discount: int = 0,
    housing: int = 0,
    food: int = 0,
    transport: int = 0,
    other: int = 0,
    materials: int = 0,
) -> dict:
    item = PROGRAMS.get(program)
    if not item:
        raise ValueError("Такой тариф не найден в каталоге")
    if not isinstance(discount, int) or not 0 <= discount <= 50:
        raise ValueError("Скидка для моделирования должна быть от 0 до 50%")
    expenses = (housing, food, transport, other, materials)
    if any(type(x) is not int or not 0 <= x <= 500_000 for x in expenses):
        raise ValueError("Расходы должны быть целыми числами от 0 до 500 000")
    variants = item["prices"]
    if months is None:
        if len(variants) != 1:
            raise ValueError("Выберите срок обучения из вариантов приказа")
        selected = variants[0]
    else:
        selected = next((option for option in variants if option["months"] == months), None)
        if selected is None:
            raise ValueError("Указанный срок для этого тарифа отсутствует в приказе")

    if employment and selected["employment_course_price"] is None:
        raise ValueError("Тариф с гарантированным трудоустройством для этой программы не предусмотрен")
    if item["currency"] != "RUB" and any(expenses):
        raise ValueError("Нельзя суммировать расходы в рублях со стоимостью в USD без курса валют")

    annual = selected["employment_year_price"] if employment else selected["year_price"]
    official = selected["employment_course_price"] if employment else selected["course_price"]
    duration = selected["months"]
    saving = _money_discount(official, discount)
    scenario_tuition = official - saving
    living_monthly = housing + food + transport + other
    living_total = living_monthly * duration
    total = scenario_tuition + living_total + materials

    years = []
    prev_fee = 0
    for year_index, start in enumerate(range(0, duration, 12), start=1):
        end = min(start + 12, duration)
        # This is only a visual budget allocation; it is NOT a payment schedule.
        cumulative_fee = (scenario_tuition * end * 2 + duration) // (2 * duration)
        year_fee = cumulative_fee - prev_fee
        prev_fee = cumulative_fee
        year_living = living_monthly * (end - start)
        one_time = materials if year_index == 1 else 0
        years.append({"label": f"{year_index}-й год", "months": end - start,
                      "tuition": year_fee, "living": year_living,
                      "extra_one_time": one_time, "total": year_fee + year_living + one_time})
    assert sum(p["total"] for p in years) == total

    return {
        "program": item,
        "months": duration,
        "duration_source": item["duration_source"],
        "currency": item["currency"],
        "employment": employment,
        "employment_available": selected["employment_course_price"] is not None,
        "official_year_2026": annual,
        "official_course": official,
        "official_course_without_employment": selected["course_price"],
        "official_course_with_employment": selected["employment_course_price"],
        "discount_pct": discount,
        "discount_savings": saving,
        "tuition": scenario_tuition,
        "monthly_extra": living_monthly,
        "living_total": living_total,
        "materials": materials,
        "total": total,
        "average_month": (total * 2 + duration) // (2 * duration),
        "years": years,
        "source": CATALOG["source_documents"][item["source"]],
        "source_page": item["source_page"],
        "price_explanation": "Полная стоимость взята непосредственно из приказа. Распределение по годам является условным, не графиком оплаты.",
    }
