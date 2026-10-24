from fastapi.testclient import TestClient
from app.calculator import CATALOG, PROGRAMS, DEFAULT_PROGRAM, calculate
from app.main import app

client = TestClient(app)

def pick(source, title, mode=None):
    return next(p for p in CATALOG['programs'] if p['source'] == source and p['title'] == title and (mode is None or mode in p['training_mode']))

def test_catalog_covers_three_sources():
    r=client.get('/api/catalog')
    assert r.status_code==200
    catalog=r.json()
    assert len(catalog['programs'])==176
    assert {p['source'] for p in catalog['programs']}=={'bachelor','specialist','distance'}
    assert catalog['default_program']==DEFAULT_PROGRAM

def test_fullstack_exact_official_full_price_and_employment():
    p=pick('bachelor','Разработка программного обеспечения (Full-stack разработка)','классического')
    r=calculate(p['id'])
    assert (r['months'],r['official_year_2026'],r['official_course'])==(48,390_000,1_560_000)
    work=calculate(p['id'],employment=True)
    assert (work['official_year_2026'],work['official_course'])==(430_000,1_720_000)
    assert work['source_page']==3

def test_different_programs_away_from_average():
    p=pick('bachelor','Общий менеджмент','классического')
    assert calculate(p['id'])['official_course']==1_400_000
    p=pick('specialist','Клинический психолог')
    assert (calculate(p['id'])['months'],calculate(p['id'])['official_course'])==(66,1_925_000)
    p=pick('specialist','Врач-лечебник','классического')
    assert (calculate(p['id'])['months'],calculate(p['id'])['official_course'])==(72,4_800_000)

def test_different_modes_for_same_specialization():
    classic=pick('bachelor','Разработка программного обеспечения (Full-stack разработка)','классического')
    evening=pick('bachelor','Разработка программного обеспечения (Full-stack разработка)','вечернего')
    assert calculate(classic['id'])['official_course']==1_560_000
    assert calculate(evening['id'])['official_course']==1_000_000

def test_distance_duration_variants_exact_amounts():
    p=next(x for x in CATALOG['programs'] if x['source']=='distance' and x['level']=='bachelor' and x['generic'] and 'поддержкой' not in x['title'])
    assert calculate(p['id'],months=42)['official_course']==350_000
    assert calculate(p['id'],months=54)['official_course']==450_000
    assert client.get('/api/calculate',params={'program':p['id'],'months':48}).status_code==400
    assert client.get('/api/calculate',params={'program':p['id']}).status_code==400
    assert client.get('/api/calculate',params={'program':p['id'],'months':42}).status_code==200

def test_personal_budget_separate_from_price_and_sum_years():
    r=calculate(discount=10,housing=20_000,materials=5_000)
    assert r['official_course']==1_560_000
    assert r['discount_savings']==156_000
    assert r['total']==1_404_000 + 20_000*48 + 5_000
    assert sum(y['total'] for y in r['years'])==r['total']

def test_optional_employment_not_invented():
    p=pick('specialist','Врач-лечебник','классического')
    assert client.get('/api/calculate',params={'program':p['id'],'employment':'true'}).status_code==400

def test_usd_not_mixed_with_rub():
    p=pick('specialist','Medical doctor')
    assert calculate(p['id'])['official_course']==50_000
    assert calculate(p['id'])['currency']=='USD'
    assert client.get('/api/calculate',params={'program':p['id'],'housing':10000}).status_code==400

def test_invalid_input_and_static_fallback():
    assert client.get('/api/calculate',params={'program':'bogus'}).status_code==400
    assert client.get('/api/calculate',params={'discount':60}).status_code==422
    assert client.get('/api/calculate',params={'months':50}).status_code==400
    assert client.get('/').status_code in (200,503)
