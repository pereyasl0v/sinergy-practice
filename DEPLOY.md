# Deploy checklist

1. Установить Node.js 20+, Python 3.11+ и Poetry на сборочном сервере.
2. `cd frontend && npm install && npm run build`
3. `cd ../backend && poetry install --only main`
4. Запустить `poetry run uvicorn app.main:app --host 127.0.0.1 --port 8000` (в сервисе systemd или аналогичном supervisor).
5. Настроить HTTPS reverse proxy на `127.0.0.1:8000`.
6. После изменений интерфейса обновить код и повторить `npm install && npm run build`; restart сервера нужен только если менялся backend или процесс кеширует ресурсы (Vite отдаёт хешированные ассеты).

Для CI можно настроить `npm install && npm run build` как этап сборки артефакта. В Git хранятся исходники, не `dist`.
