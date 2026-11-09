import csv
from collections import Counter
from pathlib import Path

from app.calculator import CATALOG

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CSV_PATH = PROJECT_ROOT / 'docs' / 'source_price_audit.csv'


def test_catalog_counts_ids_sources_and_price_variants():
    programs = CATALOG['programs']
    assert len(programs) == 176
    assert len({program['id'] for program in programs}) == len(programs)
    assert Counter(program['level'] for program in programs) == {
        'bachelor': 143,
        'specialist': 24,
        'college': 5,
        'master': 4,
    }
    assert sum(len(program['prices']) for program in programs) == 188


def test_every_program_has_a_verifiable_pdf_source_and_consistent_prices():
    documents = CATALOG['source_documents']
    assert set(documents) == {'bachelor', 'specialist', 'distance'}
    for document in documents.values():
        assert document['url'].startswith('https://')
        assert document['url'].endswith('.pdf')
        assert document['filename'].endswith('.pdf')
        assert document['pages']

    for program in CATALOG['programs']:
        source = documents[program['source']]
        assert program['source_page'] in source['pages'], program['id']
        assert program['currency'] in {'RUB', 'USD'}
        for price in program['prices']:
            assert price['months'] > 0
            assert price['year_price'] > 0
            assert price['course_price'] > 0
            assert price['year_price'] * price['months'] == price['course_price'] * 12, program['id']
            has_employment_year = price['employment_year_price'] is not None
            has_employment_course = price['employment_course_price'] is not None
            assert has_employment_year == has_employment_course, program['id']
            if has_employment_year:
                assert price['employment_year_price'] * price['months'] == price['employment_course_price'] * 12, program['id']


def test_price_audit_csv_matches_every_catalog_variant():
    with CSV_PATH.open(encoding='utf-8-sig', newline='') as csv_file:
        actual = list(csv.DictReader(csv_file))

    expected = []
    for program in CATALOG['programs']:
        source = CATALOG['source_documents'][program['source']]
        for price in program['prices']:
            expected.append({
                'ID': program['id'],
                'Уровень': program['level'],
                'Вариант обучения': program['training_mode'],
                'Форма': program['study_format'],
                'Специальность / направление': program['area'],
                'Программа': program['title'],
                'Длительность, мес.': str(price['months']),
                'Стоимость за год': str(price['year_price']),
                'Полная стоимость': str(price['course_price']),
                'Год с трудоустройством': '' if price['employment_year_price'] is None else str(price['employment_year_price']),
                'Курс с трудоустройством': '' if price['employment_course_price'] is None else str(price['employment_course_price']),
                'Валюта': program['currency'],
                'Имя PDF': source['filename'],
                'Номер приказа': source['order'],
                'Страница': str(program['source_page']),
                'Срок в источнике': program['duration_source'],
            })

    assert actual == expected
