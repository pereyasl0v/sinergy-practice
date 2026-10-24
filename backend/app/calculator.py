"""Pure tuition and living-expense budget calculations."""
from __future__ import annotations

import json
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

CATALOG = json.loads((Path(__file__).parent / "catalog.json").read_text(encoding="utf-8"))
PROGRAMS = {item["id"]: item for item in CATALOG["programs"]}
DEFAULT_PROGRAM = "b-dev"


def calculate(
    program: str,
    discount: int = 0,
    housing: int = 0,
    food: int = 0,
    transport: int = 0,
    other: int = 0,
    materials: int = 0,
) -> dict:
    if program not in PROGRAMS:
        raise ValueError("Программа не найдена")
    if not 0 <= discount <= 50:
        raise ValueError("Скидка должна быть от 0 до 50%")
    extras = (housing, food, transport, other, materials)
    if any(not isinstance(amount, int) or not 0 <= amount <= 500_000 for amount in extras):
        raise ValueError("Расходы должны быть от 0 до 500 000 ₽")

    item = PROGRAMS[program]
    months = item["months"]
    original = item["course_price"]
    saving = int((Decimal(original) * discount / 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    tuition = original - saving
    monthly_extra = housing + food + transport + other
    living_total = monthly_extra * months
    total = tuition + living_total + materials

    years = []
    distributed = 0
    for year, start in enumerate(range(0, months, 12), start=1):
        end = min(start + 12, months)
        # Integer-based allocation keeps the total exact.
        cumulative_fee = (tuition * end * 2 + months) // (2 * months)
        yearly_tuition = cumulative_fee - distributed
        distributed = cumulative_fee
        yearly_living = monthly_extra * (end - start)
        one_time = materials if year == 1 else 0
        years.append({
            "label": f"{year}-й год", "months": end - start,
            "tuition": yearly_tuition, "living": yearly_living,
            "extra_one_time": one_time,
            "total": yearly_tuition + yearly_living + one_time,
        })
    assert sum(row["total"] for row in years) == total
    return {
        "program": item,
        "official_course": original,
        "official_year_2026": item["year_price"],
        "discount_pct": discount,
        "discount_savings": saving,
        "tuition": tuition,
        "monthly_extra": monthly_extra,
        "living_total": living_total,
        "materials": materials,
        "total": total,
        "average_month": (total * 2 + months) // (2 * months),
        "months": months,
        "years": years,
        "source_url": CATALOG["sources"][item["source"]],
        "source_page": item["page"],
    }
