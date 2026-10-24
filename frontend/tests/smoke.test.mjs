import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

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
