import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';

test('React renders the initial page without a runtime error', async t => {
  const previousWindow = globalThis.window;
  globalThis.window = { location: { search: '' } };
  t.after(() => { globalThis.window = previousWindow; });

  const vite = await createServer({
    configFile: false,
    server: { middlewareMode: true },
    appType: 'custom',
  });
  t.after(async () => { await vite.close(); });

  const { default: App } = await vite.ssrLoadModule('/src/App.jsx');
  const html = renderToStaticMarkup(React.createElement(App));
  assert.match(html, /Загрузка калькулятора/);
});

test('The interface shows concise discount controls and clickable PDF sources', () => {
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(src, /<label htmlFor="discount">Скидка<\/label>/);
  assert.match(src, /<h2>Официальные документы<\/h2>/);
  assert.match(src, /href=\{source\.url\}/);
  assert.doesNotMatch(src, /Гипотетическая скидка|Проверенных тарифных позиций|Три приказа университета/);
  const catalog = JSON.parse(readFileSync(new URL('../../backend/app/catalog.json', import.meta.url), 'utf8'));
  for (const document of Object.values(catalog.source_documents)) {
    assert.match(document.url, /^https:\/\/.+\.pdf$/);
  }
});
