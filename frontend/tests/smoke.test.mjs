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

test('Tuition discount is the last control in section 01 and absent from section 02', () => {
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const section01 = src.split('<div className="number">01</div>')[1]?.split('<div className="number">02</div>')[0];
  const section02 = src.split('<div className="number">02</div>')[1]?.split('</section>')[0];
  assert.ok(section01, 'Tuition section not found');
  assert.ok(section02, 'Personal budget section not found');
  assert.match(section01, /className="discount-control"/);
  assert.match(section01, /id="discount"/);
  assert.ok(section01.indexOf('className="discount-control"') > section01.indexOf('className="program-strip"'));
  assert.doesNotMatch(section02, /id="discount"|className="discount-control"/);
  assert.equal((src.match(/id="discount"/g) || []).length, 1);
});
