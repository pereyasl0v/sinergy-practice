import React, { useEffect, useMemo, useState } from 'react';
import { facetsFor, modeName } from './catalogFilters.js';

const LIMIT = 500000;
const EXTRA_KEYS = ['housing', 'food', 'transport', 'other', 'materials'];
const allKeys = ['discount', ...EXTRA_KEYS];
const budgetPreset = {
  home: { housing: 0, food: 9000, transport: 3500, other: 2500, materials: 15000 },
  rent: { housing: 25000, food: 16000, transport: 3500, other: 4500, materials: 25000 },
  zero: { housing: 0, food: 0, transport: 0, other: 0, materials: 0 },
};
const currency = (value, unit = 'RUB') => {
  if (value === undefined || value === null) return '—';
  const formatted = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);
  return unit === 'USD' ? `${formatted} USD` : `${formatted} ₽`;
};
const yearsLabel = (months) => {
  const y = Math.floor(months / 12);
  const m = months % 12;
  return `${y} ${y === 1 ? 'год' : y >= 2 && y <= 4 ? 'года' : 'лет'}${m ? ` ${m} мес.` : ''}`;
};
const presetForm = () => {
  const params = new URLSearchParams(window.location.search);
  const result = {};
  for (const key of allKeys) {
    const max = key === 'discount' ? 50 : LIMIT;
    const value = Number(params.get(key) || 0);
    result[key] = Number.isFinite(value) ? Math.max(0, Math.min(max, Math.trunc(value))) : 0;
  }
  return result;
};

function Field({ label, id, options, value, onChange, className = '' }) {
  return <div className={`field ${className}`}>
    <label htmlFor={id}>{label}</label>
    <div className="select-wrap"><select id={id} value={value} onChange={event => onChange(event.target.value)}>
      {options.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
    </select></div>
  </div>;
}
function Extra({ id, label, value, onChange }) {
  return <div className={`field ${id === 'materials' ? 'full' : ''}`}>
    <label htmlFor={id}>{label}</label>
    <input id={id} type="number" min="0" max={LIMIT} value={value} onChange={event => onChange(id, event.target.value)} inputMode="numeric" />
  </div>;
}
function Chart({ years, unit }) {
  const max = Math.max(1, ...years.map(y => y.total));
  return <div className="chart" aria-label="Условное распределение бюджета по годам">
    {years.map(y => <div key={y.label} className="chart-line">
      <span className="chart-year">{y.label}{y.months !== 12 ? ` (${y.months} мес.)` : ''}</span>
      <span className="chart-track"><span className="chart-fill" style={{ width: `${Math.max(1, 100 * y.total / max)}%` }} /></span>
      <span className="chart-amount">{currency(y.total, unit)}</span>
    </div>)}
  </div>;
}
export default function App() {
  const [catalog, setCatalog] = useState(null);
  const [programId, setProgramId] = useState(() => new URLSearchParams(window.location.search).get('program') || '');
  const [duration, setDuration] = useState(() => Number(new URLSearchParams(window.location.search).get('months')) || 0);
  const [employment, setEmployment] = useState(() => new URLSearchParams(window.location.search).get('employment') === 'true');
  const [values, setValues] = useState(presetForm);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showExtras, setShowExtras] = useState(() => EXTRA_KEYS.some(x => Number(new URLSearchParams(window.location.search).get(x) || 0) > 0));

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/catalog', { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('Не удалось загрузить тарифы'); return r.json(); })
      .then(data => {
        setCatalog(data);
        const params = new URLSearchParams(window.location.search);
        const id = params.get('program');
        const p = data.programs.find(x => x.id === id) || data.programs.find(x => x.id === data.default_program) || data.programs[0];
        setProgramId(p.id);
        const selected = p.prices.find(x => x.months === Number(params.get('months'))) || p.prices[0];
        setDuration(selected.months);
        if (!selected.employment_course_price) setEmployment(false);
      })
      .catch(err => { if (err.name !== 'AbortError') setError(err.message); });
    return () => controller.abort();
  }, []);

  const programs = catalog?.programs || [];
  const current = programs.find(p => p.id === programId);
  const level = current?.level || '';
  const area = current?.area || '';
  const levelItems = catalog?.levels || [];
  // The official PDFs use both «Очная» and «Очная форма» for the same form.
  // Select the study variant first so ПКО/ПВО/ПВД are always discoverable.
  const facets = current ? facetsFor(programs, current) : null;
  const mode = facets?.mode || '';
  const form = facets?.format || '';
  const allOfLevel = facets?.byLevel || [];
  const modeItems = facets?.modes || [];
  const allOfMode = facets?.byMode || [];
  const formatItems = facets?.formats || [];
  const allOfFormat = facets?.byFormat || [];
  const areaItems = facets?.areas || [];
  const allOfArea = facets?.byArea || [];
  const currentPrice = current?.prices.find(p => p.months === duration) || current?.prices[0];
  const unit = current?.currency || 'RUB';
  const canEmployment = Boolean(currentPrice?.employment_course_price);
  const source = current && catalog?.source_documents[current.source];

  function selectProgram(p) {
    if (!p) return;
    setProgramId(p.id);
    setDuration(p.prices[0].months);
    setEmployment(false);
    setQuote(null);
    setError('');
    if (p.currency === 'USD') setValues(v => ({ ...v, ...budgetPreset.zero }));
  }
  function editNumber(key, value) {
    const v = Number(value);
    const max = key === 'discount' ? 50 : LIMIT;
    setValues(previous => ({ ...previous, [key]: Number.isFinite(v) ? Math.max(0, Math.min(max, Math.trunc(v))) : 0 }));
  }

  useEffect(() => {
    if (!catalog || !current || !currentPrice) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      const query = new URLSearchParams({ program: current.id, months: String(currentPrice.months), employment: String(employment && canEmployment), ...values });
      try {
        const result = await fetch(`/api/calculate?${query}`, { signal: controller.signal });
        const data = await result.json();
        if (!result.ok) throw new Error(data?.detail || 'Не удалось выполнить расчёт');
        setQuote(data);
        setError('');
        window.history.replaceState(null, '', `${window.location.pathname}?${query}`);
      } catch (err) {
        if (err.name !== 'AbortError') { setError(err.message); setQuote(null); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 125);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [catalog, current, currentPrice, values, employment]);

  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2200); }
    catch { setError('Не удалось скопировать ссылку. Скопируйте адрес страницы из браузера.'); }
  }
  if (!catalog || !current) return <div className="initial-loading" role="status">{error || 'Загрузка калькулятора…'}</div>;

  const sourceName = source?.order || '';
  const priceToShow = quote?.official_course ?? (employment && canEmployment ? currentPrice.employment_course_price : currentPrice.course_price);
  const yearToShow = quote?.official_year_2026 ?? (employment && canEmployment ? currentPrice.employment_year_price : currentPrice.year_price);
  const budgetTotal = quote?.total;
  const months = currentPrice.months;
  return <>
    <header className="topbar"><div className="wrap topbar-inner">
      <a className="wordmark" href="/" aria-label="Калькулятор стоимости обучения"><span className="brand-icon">₽</span><span>Стоимость<span className="wordmark-muted">.обучения</span></span></a>
      <div className="topbar-right"><a className="top-link" href="#sources">Официальные документы ↗</a></div>
    </div></header>
    <main className="wrap">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> СТОИМОСТЬ ОБУЧЕНИЯ · НАБОР 2026/2027</div>
          <h1>Выберите специальность.<br/><span>Узнайте стоимость.</span></h1>
          <p>Узнайте цену по выбранной программе, форме и сроку обучения. Полная стоимость берётся непосредственно из приказа университета.</p>
          <div className="hero-tags"><span>✓ Реальные суммы из приказов</span><span>✓ Разные сроки обучения</span><span>✓ Без регистрации</span></div>
        </div>
        <div className="hero-art" aria-hidden="true"><div className="art-orbit orbit1"/><div className="art-orbit orbit2"/>
          <div className="art-card main-card"><small>Стоимость выбранной программы</small><strong>{currency(priceToShow, unit)}</strong><span><i/>За весь период обучения</span></div>
          <div className="art-card mini-card"><span className="mini-icon">✓</span><span>Данные из официальных<br/>таблиц стоимости</span></div>
        </div>
      </section>
      <div className="section-heading"><div><div className="section-kicker">ПОДБОР ПРОГРАММЫ</div><h2>Сначала выберите направление</h2></div><span className="small-muted">1 — программа · 2 — бюджет</span></div>
      <div className="workspace">
        <div className="form-column">
          <section className="sheet">
            <div className="sheet-head"><div className="number">01</div><div><h3>Стоимость обучения</h3><p>Выбор конкретной специальности, формата и срока</p></div></div>
            <div className="fields">
              <Field id="level" label="Уровень образования" value={level} onChange={v => selectProgram(programs.find(p => p.level === v))} options={levelItems.filter(x => x.count).map(x => ({value:x.id,label:x.name}))}/>
              <Field id="mode" label="Вариант обучения" className="full" value={mode} onChange={v => selectProgram(allOfLevel.find(p=>facetsFor(programs, p).mode===v))} options={modeItems.map(x=>({value:x,label:modeName(x)}))}/>
              <Field id="study_format" label="Форма обучения" value={form} onChange={v => selectProgram(allOfMode.find(p=>facetsFor(programs, p).format===v))} options={formatItems.map(x=>({value:x,label:x}))}/>
              <Field id="area" label={current.generic ? 'Категория тарифа' : 'Специальность / направление подготовки'} className="full" value={area} onChange={v => selectProgram(allOfFormat.find(p=>p.area===v))} options={areaItems.map(x=>({value:x,label:x}))}/>
              <Field id="program" label={current.generic ? 'Опубликованный тариф' : 'Образовательная программа / профиль'} className="full" value={programId} onChange={v => selectProgram(programs.find(p=>p.id===v))} options={allOfArea.map(x=>({value:x.id,label:x.title}))}/>
              <Field id="duration" label="Срок обучения" value={String(months)} onChange={v => { setDuration(Number(v)); setEmployment(false); setQuote(null); }} options={current.prices.map(p=>({value:String(p.months),label:yearsLabel(p.months)}))}/>
              <div className="field"><label>Стоимость 2026 года (в год)</label><div className="readonly-price">{currency(yearToShow, unit)}</div></div>
            </div>
            {canEmployment && <div className="employment-choice"><label htmlFor="employment"><input id="employment" type="checkbox" checked={employment} onChange={e => {setEmployment(e.target.checked);setQuote(null);}}/> <span>Тариф с гарантированным трудоустройством</span></label><p>В приказе для этой программы указана отдельная цена. Выберите вариант, чтобы увидеть итог за весь период.</p></div>}
            <div className="program-strip"><div className="program-badge">✓ Цена опубликована в приказе</div><div className="program-facts">
              <div><span>Срок курса</span><b>{yearsLabel(months)}</b></div>
              <div><span>2026 год, за год</span><b>{currency(yearToShow,unit)}</b></div>
              <div><span>Полный курс</span><b>{currency(priceToShow,unit)}</b></div>
            </div></div>
            {current.duration_source==='derived' && <p className="note-program">Срок {yearsLabel(months)} определён по соотношению годовой и полной стоимости в приказе. Для конкретной образовательной программы подтвердите длительность при заключении договора.</p>}
            {current.generic && <p className="note-program">В дистанционном приказе приведён общий тариф без перечня специальностей. Выбор этого тарифа <b>не подтверждает</b> применимость цены к определённой специальности.</p>}
            <p className="field-help">Источник: <a href={source?.url} target="_blank" rel="noopener noreferrer">{sourceName} ↗</a>, стр. {current.source_page}. Полная стоимость — из приказа.</p>
          </section>
          <section className="sheet">
            <div className="sheet-head"><div className="number">02</div><div><h3>Личный бюджет</h3><p>Дополнительные расходы отдельно от цены вуза</p></div></div>
            <div className="discount-row"><label htmlFor="discount">Скидка</label><div className="discount-pill">{values.discount}%</div></div>
            <input id="discount" type="range" min="0" max="50" step="1" value={values.discount} onChange={e=>editNumber('discount',e.target.value)}/>
            <div className="range-scale"><span>0%</span><span>25%</span><span>50%</span></div>
            {unit === 'USD' ? <p className="note-program">Для валютных программ личные расходы в рублях не суммируются с ценой обучения в USD: курс обмена приказом не установлен.</p> : <details className="extra-details" open={showExtras} onToggle={e=>setShowExtras(e.currentTarget.open)}>
              <summary><span className="summary-icon">+</span><span><strong>Учесть дополнительные расходы</strong><small>Жильё, питание, транспорт и материалы</small></span><span className="chevron">⌄</span></summary>
              <div className="extra-fields">{[
                ['housing','Жильё, ₽/мес.'],['food','Питание, ₽/мес.'],['transport','Транспорт, ₽/мес.'],['other','Прочие расходы, ₽/мес.'],['materials','Материалы и техника, ₽ (один раз)']
              ].map(([id,label])=><Extra key={id} id={id} label={label} value={values[id]} onChange={editNumber}/>)}</div>
              <div className="preset-row"><span>Примеры:</span>{Object.entries({home:'Живу дома',rent:'Снимаю жильё',zero:'Сбросить'}).map(([key,label])=><button key={key} className="ghost-chip" type="button" onClick={()=>setValues(v=>({...v,...budgetPreset[key]}))}>{label}</button>)}</div>
              <p className="field-help">Все дополнительные расходы вводите вы. Суммы из этого блока не являются тарифами университета.</p>
            </details>}
          </section>
        </div>
        <aside id="result" className={`result-panel ${loading?'is-loading':''}`} aria-live="polite">
          <div className="result-header"><div className="result-header-icon">₽</div><div><span className="result-kicker">ПО ДАННЫМ ПРИКАЗА</span><h3>Стоимость выбранной программы</h3></div><span className="live-indicator">●</span></div>
          <div className="result-body">
            <div className="result-summary-label">Цена обучения за весь курс</div>
            <div className="main-total">{currency(priceToShow,unit)}</div>
            <div className="main-total-note">{yearsLabel(months)} · {current.title}</div>
            <div className="result-divider"/>
            <div className="result-rows"><div><span>Первый год (цена 2026)</span><strong>{currency(yearToShow,unit)}</strong></div><div><span>Вариант</span><strong>{employment && canEmployment ? 'С трудоустройством' : 'Стандартный'}</strong></div><div><span>Форма обучения</span><strong>{form}</strong></div></div>
            <div className="budget-month"><div className="budget-month-label">Общий личный бюджет с учётом ваших настроек</div><strong>{currency(budgetTotal,unit)}</strong><div className="budget-month-note">Учёба + личные расходы − скидка</div></div>
            <div className="result-rows budget-extra-rows">
              <div><span>Скидка</span><strong className="save">− {currency(quote?.discount_savings,unit)}</strong></div>
              <div><span>Дополнительные расходы</span><strong>{currency(quote ? quote.living_total + quote.materials : null,unit)}</strong></div>
              <div><span>Средний бюджет в месяц</span><strong>{currency(quote?.average_month,unit)}</strong></div>
            </div>
            <div className="chart-title">Условное распределение бюджета <span>не график платежей вузу</span></div><Chart years={quote?.years || []} unit={unit}/>
            <button type="button" className="primary-button" onClick={copyLink}>{copied?'Ссылка скопирована':'↗ Скопировать ссылку на расчёт'}</button>
            <button type="button" className="secondary-button" onClick={()=>window.print()}>Распечатать расчёт</button>
            {error && <p className="api-error" role="alert">{error}</p>}
          </div>
          <div className="result-foot"><span>ⓘ</span><p>Полная цена взята из указанного приказа для набора 2026/2027. Не включает персональные условия договора и не является офертой.</p></div>
        </aside>
      </div>
      <section id="sources" className="sources-section">
        <div><h2>Официальные документы</h2></div>
        <div className="sources-card">{Object.entries(catalog.source_documents).map(([key,source])=><div className="source-item" key={key}>
          <span className="source-icon">№</span>
          <div className="source-content">
            <strong>{key==='bachelor'?'Бакалавриат':key==='specialist'?'Специалитет':'Обучение с дистанционными технологиями'}</strong>
            <small>{source.order} · стр. {source.pages.join(', ')}</small>
            <a href={source.url} target="_blank" rel="noopener noreferrer" aria-label={`Открыть приказ: ${source.order}`}>
              Открыть приказ (PDF) ↗
            </a>
          </div>
        </div>)}</div>
      </section>
      <footer className="footer"><span>Калькулятор стоимости обучения · цены 2026/2027</span><span>Разработано © Ю. В. Переяслов</span></footer>
    </main>
  </>;
}
