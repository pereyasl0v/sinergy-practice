/** The original spelling of modes and forms varies across the three price orders. */
const MODE_NAMES = {
  'ПКО': 'Классическое обучение (ПКО)',
  'ПВО': 'Вечернее обучение (ПВО)',
  'ПВД': 'Программа выходного дня (ПВД)',
  'СКО': 'Сокращённое классическое обучение (СКО)',
  'СОВ': 'СОВ',
  'СОВ/СОД': 'СОВ/СОД',
  'ДОТ': 'Обучение с дистанционными технологиями',
};
const MODE_SEQUENCE = ['ПКО', 'ПВО', 'ПВД', 'СКО', 'СОВ', 'СОВ/СОД', 'ДОТ'];
const unique = items => [...new Set(items)];

export function modeKey(raw = '') {
  const value = raw.trim();
  const code = value.match(/\((ПКО|ПВО|ПВД|СКО)\)/);
  if (code) return code[1];
  if (value === 'СОВ/СОД' || value === 'СОВ') return value;
  if (/дистанционн/i.test(value)) return 'ДОТ';
  return value;
}
export function modeName(key) {
  return MODE_NAMES[key] ?? key;
}
export function normalizeFormat(raw = '') {
  const normalized = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  if (normalized.includes('дистанционн')) return 'Очно-заочная (дистанционные технологии)';
  if (/очно-\s*заочная/.test(normalized)) return 'Очно-заочная';
  if (/^очная( форма)?$/.test(normalized)) return 'Очная';
  return raw.trim();
}
export function facetsFor(programs, selected) {
  const byLevel = programs.filter(p => p.level === selected.level);
  const mode = modeKey(selected.training_mode);
  const modes = unique(byLevel.map(p => modeKey(p.training_mode)))
    .sort((a, b) => MODE_SEQUENCE.indexOf(a) - MODE_SEQUENCE.indexOf(b));
  const byMode = byLevel.filter(p => modeKey(p.training_mode) === mode);
  const format = normalizeFormat(selected.study_format);
  const formats = unique(byMode.map(p => normalizeFormat(p.study_format)));
  const byFormat = byMode.filter(p => normalizeFormat(p.study_format) === format);
  const areas = unique(byFormat.map(p => p.area));
  const byArea = byFormat.filter(p => p.area === selected.area);
  return { mode, format, modes, formats, areas, byLevel, byMode, byFormat, byArea };
}
