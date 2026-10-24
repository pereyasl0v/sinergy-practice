import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { facetsFor, modeKey, normalizeFormat } from '../src/catalogFilters.js';

const catalog = JSON.parse(readFileSync(new URL('../../backend/app/catalog.json', import.meta.url), 'utf8'));
const programs = catalog.programs;

test('all published variants can be selected directly after choosing the education level', () => {
  const expected = {
    bachelor: ['ПКО', 'ПВО', 'ПВД', 'СКО', 'СОВ', 'СОВ/СОД', 'ДОТ'],
    specialist: ['ПКО', 'ПВО', 'СКО', 'СОВ/СОД'],
    college: ['ДОТ'],
    master: ['ДОТ'],
  };
  for (const [level, variants] of Object.entries(expected)) {
    const selected = programs.find(p => p.level === level);
    assert.ok(selected, 'No program for ' + level);
    assert.deepEqual(facetsFor(programs, selected).modes, variants, level);
  }
});

test('all original price rows remain reachable through the full filter chain', () => {
  assert.equal(programs.length, 176);
  const ids = new Set();
  for (const program of programs) {
    const f = facetsFor(programs, program);
    assert.ok(f.modes.includes(modeKey(program.training_mode)), program.id + ': mode');
    assert.ok(f.formats.includes(normalizeFormat(program.study_format)), program.id + ': form');
    assert.ok(f.areas.includes(program.area), program.id + ': area');
    assert.ok(f.byArea.some(x => x.id === program.id), program.id + ': profile');
    assert.ok(!ids.has(program.id), program.id + ': duplicate ID');
    ids.add(program.id);
    assert.ok(program.prices.length >= 1 && program.prices.every(x => x.months > 0), program.id + ': duration');
  }
});

test('form synonyms and spelling variants are treated as the same option', () => {
  assert.equal(normalizeFormat('Очная'), normalizeFormat('Очная форма'));
  assert.equal(normalizeFormat('Очно- заочная'), normalizeFormat('Очно- заочная форма'));
  assert.equal(modeKey('Программа вечеренего обучения (ПВО)'), modeKey('Программа вечернего обучения (ПВО)'));
});

test('ПКО covers full-time bachelor tuition rows from both pages of the price order', () => {
  const entries = programs.filter(p => p.level === 'bachelor' && modeKey(p.training_mode) === 'ПКО');
  assert.equal(entries.length, 73);
  assert.deepEqual([...new Set(entries.map(x => x.source_page))].sort(), [3, 4]);
  const fullstack = entries.find(x => x.title.includes('Full-stack'));
  assert.ok(fullstack);
  assert.equal(fullstack.prices[0].course_price, 1560000);
});
