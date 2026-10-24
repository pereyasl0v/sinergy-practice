import { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT = 'b-dev';
const LIMIT = 500000;
const NUMERIC = ['discount', 'housing', 'food', 'transport', 'other', 'materials'];
const BUDGET_FIELDS = ['housing', 'food', 'transport', 'other', 'materials'];
const rub = (value = 0) => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)} ₽`;

function urlInitial() {
  const q = new URLSearchParams(window.location.search);
  const obj = { program: q.get('program') || DEFAULT };
  for (const field of NUMERIC) {
    const parsed = Number(q.get(field) ?? 0);
    obj[field] = Number.isFinite(parsed)
      ? Math.max(0, Math.min(field === 'discount' ? 50 : LIMIT, Math.trunc(parsed))) : 0;
  }
  return obj;
}

const PRESETS = {
  home: { housing: 0, food: 9000, transport: 3500, other: 2500, materials: 15000 },
  rent: { housing: 25000, food: 16000, transport: 3500, other: 4500, materials: 25000 },
  zero: { housing: 0, food: 0, transport: 0, other: 0, materials: 0 },
};

function ExpenseInput({ id, label, value, onChange }) {
  return <div className={`field ${id === 'materials' ? 'full' : ''}`}>
    <label htmlFor={id}>{label}</label>
    <input id={id} type="number" min="0" max={LIMIT} inputMode="numeric" value={value}
      onChange={event => onChange(id, event.target.value)} />
  </div>;
}

function YearChart({ years }) {
  const largest = Math.max(1, ...years.map(row => row.total));
  return <div id="year-chart" className="chart">
    {years.map(row => <div key={row.label} className="chart-line">
      <div className="chart-year">{row.label}</div>
      <div className="chart-track"><div className="chart-fill" style={{ width: `${row.total * 100 / largest}%` }} /></div>
      <div className="chart-amount">{rub(row.total)}</div>
    </div>)}
  </div>;
}

export default function App() {
  const [catalog, setCatalog] = useState(null);
  const [values, setValues] = useState(urlInitial);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showExtras, setShowExtras] = useState(() => { const q = new URLSearchParams(window.location.search); return BUDGET_FIELDS.some(id => Number(q.get(id) || 0) > 0); });
  const [level, setLevel] = useState('bachelor');
  const [studyFormat, setStudyFormat] = useState('Очная');
  const mainRef = useRef(null);

  useEffect(() => {
    const abort = new AbortController();
    fetch('/api/catalog', { signal: abort.signal })
      .then(response => {
        if (!response.ok) throw new Error('Не удалось загрузить список программ');
        return response.json();
      })
      .then(data => {
        setCatalog(data);
        const selected = data.programs.find(p => p.id === values.program) || data.programs[0];
        setLevel(selected.level);
        setStudyFormat(selected.study_format);
        if (selected.id !== values.program) setValues(current => ({ ...current, program: selected.id }));
      })
      .catch(err => { if (err.name !== 'AbortError') setError(err.message); });
    return () => abort.abort();
  }, []); // initial catalog request only

  const programs = catalog?.programs || [];
  const currentProgram = useMemo(() => programs.find(p => p.id === values.program), [programs, values.program]);
  const formats = useMemo(() => [...new Set(programs.filter(p => p.level === level).map(p => p.study_format))], [programs, level]);
  const availablePrograms = useMemo(() => programs.filter(p => p.level === level && p.study_format === studyFormat), [programs, level, studyFormat]);
  const grouped = useMemo(() => {
    const map = new Map();
    for (const program of availablePrograms) {
      if (!map.has(program.area)) map.set(program.area, []);
      map.get(program.area).push(program);
    }
    return [...map.entries()];
  }, [availablePrograms]);

  useEffect(() => {
    if (!catalog || !currentProgram) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const query = new URLSearchParams(values);
      try {
        const response = await fetch(`/api/calculate?${query}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Не удалось пересчитать стоимость');
        setQuote(await response.json());
        setError('');
        window.history.replaceState(null, '', `${window.location.pathname}?${query.toString()}`);
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 130);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [catalog, currentProgram, values]);

  function updateValue(name, value) {
    if (name === 'program') { setValues(current => ({ ...current, program: value })); return; }
    const num = Number(value);
    const normalized = Number.isFinite(num) ? Math.max(0, Math.min(name === 'discount' ? 50 : LIMIT, Math.trunc(num))) : 0;
    setValues(current => ({ ...current, [name]: normalized }));
  }

  function updateLevel(next) {
    const matching = programs.filter(p => p.level === next);
    const nextFormat = matching.some(p => p.study_format === studyFormat) ? studyFormat : matching[0]?.study_format;
    const selected = matching.find(p => p.study_format === nextFormat);
    setLevel(next); setStudyFormat(nextFormat ?? '');
    if (selected) updateValue('program', selected.id);
  }

  function updateFormat(next) {
    setStudyFormat(next);
    const first = programs.find(p => p.level === level && p.study_format === next);
    if (first) updateValue('program', first.id);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2300);
    } catch {
      setError('Не удалось скопировать ссылку — скопируйте адрес страницы вручную.');
    }
  }

  if (!catalog) {
    return <div className="initial-loading" role="status">{error || 'Загрузка калькулятора…'}</div>;
  }

  const duration = quote?.months || currentProgram?.months || 48;
  const years = quote?.years || [];
  const extras = values.housing + values.food + values.transport + values.other + values.materials;
  const selectedCount = catalog.catalog_total;

  return <>
    <header className="topbar">
      <div className="wrap topbar-inner">
        <a className="wordmark" href="/" aria-label="Калькулятор стоимости обучения, на главную">
          <span className="brand-icon" aria-hidden="true">₽</span>
          <span>Стоимость<span className="wordmark-muted">.обучения</span></span>
        </a>
        <div className="topbar-right"><a href="#sources" className="top-link">Источники данных <span aria-hidden="true">↗</span></a></div>
      </div>
    </header>

    <main className="wrap" ref={mainRef}>
      <section className="hero" aria-labelledby="heading">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> ПЛАНИРОВАНИЕ ОБУЧЕНИЯ · 2026/27</div>
          <h1 id="heading">Узнайте, во сколько<br /><span>обойдётся обучение</span></h1>
          <p>Выберите программу, проверьте опубликованную стоимость и рассчитайте бюджет на весь период — с учётом своих расходов.</p>
          <div className="hero-tags"><span>✓ Тарифы из приказов</span><span>✓ Расчёт за весь срок</span><span>✓ Без регистрации</span></div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-orbit orbit1" /><div className="art-orbit orbit2" />
          <div className="art-card main-card"><small>Ваш бюджет на обучение</small><strong>{rub(quote?.total ?? 1520000)}</strong><span><i />Стоимость за весь курс</span></div>
          <div className="art-card mini-card"><span className="mini-icon">↗</span><span>Контролируйте<br />расходы заранее</span></div>
        </div>
      </section>

      <div className="catalog-strip" aria-label="Количество программ в каталоге университета">
        <div className="catalog-main"><small>В каталоге университета</small><div><strong>{new Intl.NumberFormat('ru-RU').format(selectedCount)}</strong> <span>программа</span></div></div>
        {['bachelor', 'master', 'college', 'specialist'].map(id => {
          const item = catalog.levels.find(l => l.id === id);
          return <div className="catalog-stat" key={id}><strong>{item?.count}</strong><span>{item?.name?.toLowerCase()}</span></div>;
        })}
        <a className="strip-link" href={catalog.sources.catalog} target="_blank" rel="noopener noreferrer">Каталог ↗</a>
      </div>

      <div className="section-heading"><div><div className="section-kicker">РАСЧЁТ СТОИМОСТИ</div><h2>Соберите свой план расходов</h2></div><div className="small-muted">Шаг 1 из 2 · выбор обучения</div></div>

      <div className="workspace">
        <div className="form-column">
          <section className="sheet">
            <div className="sheet-head"><div className="number">01</div><div><h3>Выберите обучение</h3><p>Программы и тарифы из открытых документов университета</p></div></div>
            <div className="fields">
              <div className="field"><label htmlFor="level">Уровень образования</label><div className="select-wrap">
                <select id="level" value={level} onChange={event => updateLevel(event.target.value)}>
                  {catalog.levels.filter(x => ['college', 'bachelor', 'specialist', 'master'].includes(x.id) && programs.some(p => p.level === x.id)).map(x => <option value={x.id} key={x.id}>{x.name}</option>)}
                </select></div></div>
              <div className="field"><label htmlFor="study_format">Форма обучения</label><div className="select-wrap">
                <select id="study_format" value={studyFormat} onChange={event => updateFormat(event.target.value)}>
                  {formats.map(format => <option key={format} value={format}>{format}</option>)}
                </select></div></div>
              <div className="field full"><label htmlFor="program">Программа или тариф</label><div className="select-wrap">
                <select id="program" value={values.program} onChange={event => updateValue('program', event.target.value)}>
                  {grouped.map(([area, items]) => <optgroup label={area} key={area}>
                    {items.map(p => <option value={p.id} key={p.id}>{p.title}</option>)}
                  </optgroup>)}
                </select></div><p className="field-help">В калькулятор включена выборка проверенных тарифных позиций — не все {selectedCount} программ каталога.</p></div>
            </div>
            <div className="program-strip">
              <div className="program-badge">✓ <span>{quote?.program?.generic ? 'Общий тариф (без привязки к специальности)' : 'Стоимость по опубликованному приказу'}</span></div>
              <div className="program-facts">
                <div><span>Период</span><b>{new Intl.NumberFormat('ru-RU').format(duration / 12)} года</b></div>
                <div><span>В 2026 году</span><b>{rub(quote?.official_year_2026 ?? currentProgram.year_price)}</b></div>
                <div><span>Полный курс</span><b>{rub(quote?.official_course ?? currentProgram.course_price)}</b></div>
              </div>
            </div>
            {quote?.program?.generic && <p className="note note-program">Этот тариф относится к формату обучения в целом и не подтверждает цену конкретной специальности.</p>}
          </section>

          <section className="sheet">
            <div className="sheet-head"><div className="number">02</div><div><h3>Уточните личный бюджет</h3><p>Необязательно: оцените скидку и дополнительные расходы</p></div></div>
            <div className="discount-row"><div><label htmlFor="discount">Скидка на обучение</label><p>Можно смоделировать возможное предложение</p></div><div className="discount-pill">{values.discount}%</div></div>
            <input type="range" id="discount" min="0" max="50" step="1" value={values.discount} onChange={event => updateValue('discount', event.target.value)} />
            <div className="range-scale"><span>0%</span><span>25%</span><span>50%</span></div>
            <p className="inline-caution">Скидка — сценарий расчёта, а не обещание университета.</p>
            <details className="extra-details" open={showExtras} onToggle={event => setShowExtras(event.currentTarget.open)}>
              <summary><span className="summary-icon">+</span><span><strong>Добавить расходы на жизнь</strong><small>Жильё, питание, дорога и учебные материалы</small></span><span className="chevron">⌄</span></summary>
              <div className="extra-fields">
                {[
                  ['housing', 'Жильё, ₽/мес.'], ['food', 'Питание, ₽/мес.'],
                  ['transport', 'Транспорт, ₽/мес.'], ['other', 'Другие расходы, ₽/мес.'],
                  ['materials', 'Материалы и техника, ₽ один раз'],
                ].map(([id, label]) => <ExpenseInput key={id} id={id} label={label} value={values[id]} onChange={updateValue} />)}
              </div>
              <div className="preset-row"><span>Быстро заполнить:</span>
                {Object.entries({ home: 'Живу дома', rent: 'Снимаю жильё', zero: 'Сбросить' }).map(([key, label]) => <button key={key} type="button" className="ghost-chip" onClick={() => setValues(current => ({ ...current, ...PRESETS[key] }))}>{label}</button>)}
              </div>
              <p className="field-help">Расходы указываете вы. Расчёт предполагает одинаковые расходы каждый месяц.</p>
            </details>
          </section>
        </div>

        <aside className={`result-panel ${loading ? 'is-loading' : ''}`} id="result" aria-live="polite">
          <div className="result-header"><div className="result-header-icon">₽</div><div><span className="result-kicker">ВАШ РАСЧЁТ</span><h3>Стоимость обучения</h3></div><span className="live-indicator">●</span></div>
          <div className="result-body">
            <div className="result-summary-label">Итого с выбранными расходами</div>
            <div className="main-total">{rub(quote?.total)}</div>
            <div className="main-total-note">За {duration} месяцев · оценочный бюджет</div>
            <div className="result-divider" />
            <div className="result-rows">
              <div><span>Обучение по приказу</span><strong>{rub(quote?.official_course)}</strong></div>
              <div><span>Сценарная скидка</span><strong className="save">− {rub(quote?.discount_savings)}</strong></div>
              <div><span>Дополнительные расходы</span><strong>{rub((quote?.living_total || 0) + (quote?.materials || 0))}</strong></div>
            </div>
            <div className="budget-month"><div className="budget-month-label">Средний бюджет в месяц <span title="Условное деление общих расходов на количество месяцев, а не график платежей вузу.">ⓘ</span></div><strong>{rub(quote?.average_month)}</strong><div className="budget-month-note">Для планирования, не сумма ежемесячного платежа</div></div>
            <div className="chart-title">Расходы по годам <span>прогноз</span></div>
            <YearChart years={years} />
            <button type="button" className="primary-button" onClick={copyLink}><span aria-hidden="true">↗</span>{copied ? 'Ссылка скопирована' : 'Скопировать ссылку на расчёт'}</button>
            <button type="button" className="secondary-button" onClick={() => window.print()}>Распечатать расчёт</button>
            {error && <p className="api-error" role="alert">{error}</p>}
          </div>
          <div className="result-foot"><span>ⓘ</span><p>Расчёт предварительный и не является офертой. Итоговая стоимость и условия оплаты определяются договором с университетом.</p></div>
        </aside>
      </div>

      <section id="sources" className="sources-section">
        <div><div className="section-kicker">ПРОИСХОЖДЕНИЕ ДАННЫХ</div><h2>Откуда взяты цены?</h2><p>Используются опубликованные суммы на 2026/2027 учебный год. Итог может зависеть от программы, формы обучения и индивидуальных условий договора.</p></div>
        <div className="sources-card">
          {[
            ['catalog', 'Официальный каталог программ', 'Число программ по уровням образования', 'Открыть'],
            ['bachelor', 'Приказ о стоимости бакалавриата', 'Очная форма, 1 курс, 2026/27', 'PDF'],
            ['specialist', 'Приказ о стоимости специалитета', 'Очная форма, 1 курс, 2026/27', 'PDF'],
            ['distance', 'Приказ о тарифах с ДОТ', 'Базовые варианты, 2026/27', 'PDF'],
          ].map(([id, name, info, label]) => <div className="source-item" key={id}><span className="source-icon">↗</span><div><strong>{name}</strong><small>{info}</small></div><a href={catalog.sources[id]} target="_blank" rel="noopener noreferrer">{label}</a></div>)}
        </div>
      </section>
      <footer className="footer"><span>Калькулятор стоимости обучения · 2026</span><span>Разработано © Ю. В. Переяслов</span></footer>
    </main>
  </>;
}
