# Запуск, проверка и обновление каталога

1.Клиент:

```bash
cd frontend
npm install
npm test
npm run build
```

2. Сервер
   ```bash
   cd ../backend
   poetry install
   poetry run pytest -q
   ```
3. Запустить API:
   ```bash
   poetry run uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```

Скрипт `tools/rebuild_catalog.py` формирует оба файла из трёх официальных PDF-приказов: `backend/app/catalog.json` и `docs/source_price_audit.csv`. PDF-файлы в репозитории не хранятся. Перед запуском поместите их в `reference_pdfs/` под следующими именами:

- `prikaz_vo_bak_1kurs.pdf` — [приказ по бакалавриату](https://sys3.ru/synergyuniversity-ru/upload/official_documents/stoimost/2026-2027/prikaz/prikaz_vo_bak_1kurs.pdf);
- `prikaz_vo_spc_1kurs.pdf` — [приказ по специалитету](https://sys3.ru/synergyuniversity-ru/upload/official_documents/stoimost/2026-2027/prikaz/prikaz_vo_spc_1kurs.pdf);
- `prikaz_stoimost_zao_dist.pdf` — [приказ по дистанционным тарифам](https://sys3.ru/synergyuniversity-ru/upload/official_documents/stoimost/2026-2027/prikaz/prikaz_stoimost_zao_dist.pdf).
