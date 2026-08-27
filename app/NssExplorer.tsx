'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CahLevel, DataManifest, ProviderDataset, SubjectCatalog, SubjectLevel, SubjectResult, ThemeKey, UniversityIndexItem } from './types';

const themes: Array<{ key: ThemeKey; zh: string; en: string }> = [
  { key: 'teaching', zh: '课程教学', en: 'Teaching on my course' },
  { key: 'learning_opportunities', zh: '学习机会', en: 'Learning opportunities' },
  { key: 'assessment_feedback', zh: '考核与反馈', en: 'Assessment and feedback' },
  { key: 'academic_support', zh: '学术支持', en: 'Academic support' },
  { key: 'organisation_management', zh: '组织与管理', en: 'Organisation and management' },
  { key: 'learning_resources', zh: '学习资源', en: 'Learning resources' },
  { key: 'student_voice', zh: '学生声音', en: 'Student voice' },
];

const levelNames: Record<SubjectLevel, string> = {
  All: 'All subjects · 学校整体', CAH1: 'CAH1 · 学科大类', CAH2: 'CAH2 · 中层学科', CAH3: 'CAH3 · 最细学科',
};
const levelRank: Record<string, number> = { 'All subjects': 0, CAH1: 1, CAH2: 2, CAH3: 3 };
const dataUrl = (path: string) => `${import.meta.env.BASE_URL}data/${path}`;

function display(value: number | null, digits = 1) { return value == null ? '—' : value.toFixed(digits); }
function resultLevel(result: SubjectResult): SubjectLevel { return result.subject_level === 'All subjects' ? 'All' : result.subject_level; }
function allProviderResults(provider: ProviderDataset): SubjectResult[] {
  return [...(provider.overall ? [provider.overall] : []), ...provider.subjects.CAH1, ...provider.subjects.CAH2, ...provider.subjects.CAH3];
}
function selectInitialResult(provider: ProviderDataset, requestedLevel?: string | null, requestedCode?: string | null) {
  if (requestedLevel === 'All' || requestedCode === 'ALL') return provider.overall;
  if (requestedLevel && ['CAH1', 'CAH2', 'CAH3'].includes(requestedLevel)) {
    const match = provider.subjects[requestedLevel as CahLevel].find((item) => item.subject_code === requestedCode);
    if (match) return match;
  }
  return provider.overall;
}
function parentCodes(code: string) {
  const parts = code.split('-');
  return { CAH1: parts[0], CAH2: parts.length > 1 ? parts.slice(0, 2).join('-') : null };
}

function UniversityPicker({ universities, selected, onSelect }: { universities: UniversityIndexItem[]; selected: UniversityIndexItem | null; onSelect: (item: UniversityIndexItem) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const normalized = query.trim().toLocaleLowerCase();
  const filtered = universities.filter((item) => !normalized || item.provider_name.toLocaleLowerCase().includes(normalized)).slice(0, 14);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!containerRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="combobox" ref={containerRef}>
      <label htmlFor="university-search">第一步 · 选择大学</label>
      <div className="combobox-input-wrap">
        <span aria-hidden="true">⌕</span>
        <input id="university-search" role="combobox" aria-expanded={open} aria-controls="university-options" aria-autocomplete="list"
          aria-activedescendant={open && filtered[activeIndex] ? `university-option-${filtered[activeIndex].UKPRN}` : undefined}
          value={open ? query : selected?.provider_name ?? query} placeholder="输入大学英文名称…"
          onFocus={() => { setQuery(''); setActiveIndex(0); setOpen(true); }}
          onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); setOpen(true); }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(index + 1, filtered.length - 1)); }
            if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
            if (event.key === 'Enter' && open && filtered[activeIndex]) { event.preventDefault(); onSelect(filtered[activeIndex]); setQuery(''); setOpen(false); }
            if (event.key === 'Escape') setOpen(false);
          }} />
        {selected && <span className="selected-check" aria-hidden="true">✓</span>}
      </div>
      {open && <ul id="university-options" role="listbox" className="combobox-list">
        {filtered.map((item, index) => <li id={`university-option-${item.UKPRN}`} key={item.UKPRN} role="option"
          className={index === activeIndex ? 'active' : ''} aria-selected={item.UKPRN === selected?.UKPRN}
          onMouseDown={(event) => { event.preventDefault(); onSelect(item); setQuery(''); setOpen(false); }}>
          <span>{item.provider_name}</span><small>UKPRN {item.UKPRN} · {item.record_count}条结果</small>
        </li>)}
        {!filtered.length && <li className="no-option">没有匹配的大学</li>}
      </ul>}
    </div>
  );
}

function SubjectPicker({ provider, catalog, selected, onSelect }: { provider: ProviderDataset; catalog: SubjectCatalog; selected: SubjectResult | null; onSelect: (result: SubjectResult) => void }) {
  const [mode, setMode] = useState<'search' | 'tree'>('search');
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return allProviderResults(provider)
      .filter((item) => !normalized || item.subject_name.toLocaleLowerCase().includes(normalized) || item.subject_code.toLocaleLowerCase().includes(normalized))
      .sort((a, b) => levelRank[b.subject_level] - levelRank[a.subject_level] || a.subject_name.localeCompare(b.subject_name)).slice(0, 60);
  }, [provider, query]);
  const byCode = useMemo(() => new Map(allProviderResults(provider).map((item) => [item.subject_code, item])), [provider]);
  const catalogNames = useMemo(() => new Map([...catalog.CAH1, ...catalog.CAH2, ...catalog.CAH3].map((item) => [item.code, item.name])), [catalog]);
  const availableCah1Codes = useMemo(() => {
    const codes = new Set<string>();
    for (const item of allProviderResults(provider)) if (item.subject_code !== 'ALL') codes.add(parentCodes(item.subject_code).CAH1);
    return [...codes].sort();
  }, [provider]);
  const choose = (item: SubjectResult) => { onSelect(item); setQuery(''); };

  return <div className="subject-picker">
    <div className="subject-picker-title"><span>第二步 · 选择已发布学科</span><div className="mode-switch" aria-label="学科选择方式">
      <button type="button" className={mode === 'search' ? 'active' : ''} onClick={() => setMode('search')}>搜索</button>
      <button type="button" className={mode === 'tree' ? 'active' : ''} onClick={() => setMode('tree')}>层级浏览</button>
    </div></div>
    {mode === 'search' ? <div className="subject-search">
      <div className="subject-input-wrap"><span aria-hidden="true">⌕</span><input aria-label="搜索该校已发布的CAH学科" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如 Computer science、CAH11…" /></div>
      <div className="subject-results" role="listbox" aria-label="学科搜索结果">
        {results.map((item) => <button key={`${item.subject_level}-${item.subject_code}`} type="button" role="option"
          aria-selected={item.subject_code === selected?.subject_code && item.subject_level === selected.subject_level}
          className={item.subject_code === selected?.subject_code && item.subject_level === selected.subject_level ? 'selected' : ''} onClick={() => choose(item)}>
          <span><strong>{item.subject_name}</strong><small>{item.subject_code === 'ALL' ? provider.provider_name : `${parentCodes(item.subject_code).CAH1} / ${item.subject_code}`}</small></span>
          <em>{levelNames[resultLevel(item)].split(' · ')[0]}</em>
        </button>)}
      </div>
    </div> : <div className="subject-tree" aria-label="CAH学科层级">
      {provider.overall && <button type="button" className="overall-option" onClick={() => choose(provider.overall!)}><span><strong>All subjects</strong><small>学校整体</small></span><em>ALL</em></button>}
      {availableCah1Codes.map((cah1Code) => {
        const cah1Record = byCode.get(cah1Code);
        const cah2Codes = catalog.CAH2.filter((item) => item.parent_code === cah1Code).map((item) => item.code)
          .filter((code) => byCode.has(code) || provider.subjects.CAH3.some((item) => parentCodes(item.subject_code).CAH2 === code));
        return <details key={cah1Code}><summary><span>{catalogNames.get(cah1Code)}</span><small>{cah1Code}</small></summary><div className="tree-branch">
          {cah1Record && <button type="button" onClick={() => choose(cah1Record)}>查看CAH1大类结果</button>}
          {cah2Codes.map((cah2Code) => {
            const cah2Record = byCode.get(cah2Code);
            const cah3Records = provider.subjects.CAH3.filter((item) => parentCodes(item.subject_code).CAH2 === cah2Code);
            return <div className="tree-cah2" key={cah2Code}><div><strong>{catalogNames.get(cah2Code)}</strong><small>{cah2Code}</small>
              {cah2Record && <button type="button" onClick={() => choose(cah2Record)}>查看CAH2结果</button>}</div>
              {cah3Records.map((item) => <button type="button" className="tree-leaf" key={item.subject_code} onClick={() => choose(item)}><span>{item.subject_name}</span><small>{item.subject_code}</small></button>)}
            </div>;
          })}
        </div></details>;
      })}
    </div>}
  </div>;
}

function ThemeChart({ result }: { result: SubjectResult }) {
  return <section className="theme-card" aria-labelledby="themes-heading">
    <div className="section-heading"><div><p className="kicker">7 OFFICIAL NSS THEMES</p><h3 id="themes-heading">七项学生体验</h3></div>
      <div className="legend"><span><i className="legend-fill" />Positivity</span><span><i className="legend-marker" />Benchmark</span></div></div>
    <div className="metric-list">{themes.map((theme) => { const metric = result.metrics[theme.key]; return <div className="metric-row" key={theme.key}>
      <div className="metric-name"><strong>{theme.zh}</strong><span>{theme.en}</span></div>
      <div className="metric-track" role="img" aria-label={`${theme.zh} positivity ${display(metric.positivity)}，benchmark ${display(metric.benchmark)}`}>
        <span className="metric-fill" style={{ width: `${metric.positivity ?? 0}%` }} />
        {metric.benchmark != null && <span className="benchmark-marker" style={{ left: `${metric.benchmark}%` }} />}
      </div><strong className="metric-value">{display(metric.positivity)}</strong>
    </div>; })}</div>
  </section>;
}

function DetailTable({ result }: { result: SubjectResult }) {
  return <section className="detail-card" aria-labelledby="detail-heading"><div className="section-heading"><div><p className="kicker">EXACT VALUES</p><h3 id="detail-heading">精确数值</h3></div></div>
    <div className="table-scroll"><table><thead><tr><th>Theme</th><th>Positivity</th><th>Benchmark</th><th>差值</th><th>95% CI</th><th>Theme responses FPE</th></tr></thead>
      <tbody>{themes.map((theme) => { const metric = result.metrics[theme.key]; return <tr key={theme.key}>
        <th><strong>{theme.zh}</strong><span>{theme.en}</span></th><td>{display(metric.positivity)}</td><td>{display(metric.benchmark)}</td>
        <td>{metric.difference_from_benchmark_ppt == null ? '—' : `${metric.difference_from_benchmark_ppt > 0 ? '+' : ''}${display(metric.difference_from_benchmark_ppt)}`}</td>
        <td>{metric.confidence_interval_95_lower == null || metric.confidence_interval_95_upper == null ? '—' : `${display(metric.confidence_interval_95_lower)}–${display(metric.confidence_interval_95_upper)}`}</td>
        <td>{display(metric.responses_fpe)}</td></tr>; })}</tbody></table></div>
  </section>;
}

function EmptyState() {
  return <section className="empty-state" aria-labelledby="empty-heading"><div><p className="kicker">START HERE</p><h2 id="empty-heading">先选择一所大学</h2><p>然后搜索具体学科，或沿着CAH层级从大类浏览到最细的已发布结果。</p></div>
    <div className="cah-explainer"><div><span>CAH1</span><strong>Engineering and technology</strong><small>学科大类</small></div><i aria-hidden="true">→</i>
      <div><span>CAH2</span><strong>Engineering</strong><small>中层学科</small></div><i aria-hidden="true">→</i>
      <div><span>CAH3</span><strong>Mechanical engineering</strong><small>最细学科</small></div></div></section>;
}

function OverallUnavailable({ provider }: { provider: ProviderDataset }) {
  return <section className="empty-state unavailable-state" aria-labelledby="unavailable-heading"><div>
    <p className="kicker">ALL SUBJECTS · NOT PUBLISHED</p>
    <h2 id="unavailable-heading">官方未发布该校整体结果</h2>
    <p>{provider.provider_name}仍保留{provider.subjects.CAH1.length + provider.subjects.CAH2.length + provider.subjects.CAH3.length}条已发布学科结果。请在上方搜索或浏览学科。</p>
  </div><div className="unavailable-note"><strong>这不等于结果被抑制</strong><p>当前数据无法确认该校是否应有All subjects记录，因此只陈述“官方未发布”，不推断原因，也不自行补算。</p></div></section>;
}

export default function NssExplorer() {
  const [universities, setUniversities] = useState<UniversityIndexItem[]>([]);
  const [catalog, setCatalog] = useState<SubjectCatalog | null>(null);
  const [manifest, setManifest] = useState<DataManifest | null>(null);
  const [selectedUniversity, setSelectedUniversity] = useState<UniversityIndexItem | null>(null);
  const [provider, setProvider] = useState<ProviderDataset | null>(null);
  const [result, setResult] = useState<SubjectResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [providerLoading, setProviderLoading] = useState(false);
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');

  const updateUrl = (ukprn: string, selectedResult: SubjectResult | null) => {
    const url = new URL(window.location.href); url.searchParams.set('provider', ukprn);
    if (selectedResult) { url.searchParams.set('level', resultLevel(selectedResult)); url.searchParams.set('subject', selectedResult.subject_code); }
    else { url.searchParams.delete('level'); url.searchParams.delete('subject'); }
    window.history.replaceState({}, '', url);
  };
  const loadProvider = async (item: UniversityIndexItem, requestedLevel?: string | null, requestedCode?: string | null) => {
    setProviderLoading(true); setError('');
    try {
      const response = await fetch(dataUrl(`providers/${item.UKPRN}.json`)); if (!response.ok) throw new Error('Provider data unavailable');
      const data: ProviderDataset = await response.json(); const initialResult = selectInitialResult(data, requestedLevel, requestedCode);
      setSelectedUniversity(item); setProvider(data); setResult(initialResult); updateUrl(item.UKPRN, initialResult);
    } catch { setError('暂时无法读取这所大学的数据，请稍后重试。'); } finally { setProviderLoading(false); }
  };

  useEffect(() => {
    let active = true;
    Promise.all([fetch(dataUrl('universities.json')).then((r) => r.json()), fetch(dataUrl('subjects.json')).then((r) => r.json()), fetch(dataUrl('manifest.json')).then((r) => r.json())])
      .then(([universityData, catalogData, manifestData]: [UniversityIndexItem[], SubjectCatalog, DataManifest]) => {
        if (!active) return; setUniversities(universityData); setCatalog(catalogData); setManifest(manifestData); setLoading(false);
        const params = new URLSearchParams(window.location.search); const ukprn = params.get('provider');
        const initialUniversity = universityData.find((item) => item.UKPRN === ukprn);
        if (initialUniversity) loadProvider(initialUniversity, params.get('level'), params.get('subject'));
      }).catch(() => { if (active) { setError('数据索引加载失败，请刷新页面。'); setLoading(false); } });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseResult = (selectedResult: SubjectResult) => { setResult(selectedResult); if (provider) updateUrl(provider.UKPRN, selectedResult); document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const breadcrumb = useMemo(() => {
    if (!result || !catalog || !provider) return '';
    if (result.subject_code === 'ALL') return 'All subjects';
    const names = new Map([...catalog.CAH1, ...catalog.CAH2, ...catalog.CAH3].map((item) => [item.code, item.name]));
    const parents = parentCodes(result.subject_code); const pieces = [names.get(parents.CAH1)];
    if (parents.CAH2 && parents.CAH2 !== result.subject_code) pieces.push(names.get(parents.CAH2));
    if (result.subject_code !== parents.CAH1) pieces.push(result.subject_name);
    return pieces.filter(Boolean).join(' / ');
  }, [catalog, provider, result]);
  const copyLink = async () => { await navigator.clipboard.writeText(window.location.href); setCopyStatus('链接已复制'); window.setTimeout(() => setCopyStatus(''), 1800); };
  const hasBk = result?.suppression_flags.includes('BK');

  return <main><header className="site-header"><a className="brand" href="#top" aria-label="NSS 2026 查询器首页"><span className="brand-mark" aria-hidden="true">N</span><span>NSS 2026 查询器</span></a>
    <nav aria-label="页面导航"><a href="#methodology">数据说明</a><a href="#about">关于指标</a></nav></header>
    <section className="hero" id="top"><div className="hero-copy"><p className="eyebrow">UK NATIONAL STUDENT SURVEY · 2026</p><h1>查一所大学，<br />看一个学科的真实学习体验。</h1>
      <p className="hero-intro">基于英国NSS官方发布结果，查看课程教学、学习机会、反馈、学术支持等七项学生体验。</p>
      <div className="hero-stats" aria-label="数据规模"><span><strong>{manifest?.university_count ?? 167}</strong>所大学</span><span><strong>{manifest?.record_count.toLocaleString() ?? '10,386'}</strong>条结果</span><span><strong>CAH3</strong>最细学科</span></div></div>
      <div className="query-panel" aria-busy={loading || providerLoading}>
        {loading ? <p className="loading-line" role="status">正在载入大学索引…</p> : <UniversityPicker universities={universities} selected={selectedUniversity} onSelect={(item) => loadProvider(item)} />}
        {provider && catalog ? <SubjectPicker provider={provider} catalog={catalog} selected={result} onSelect={chooseResult} /> : <div className="subject-disabled"><span>第二步 · 选择学科</span><p>选择大学后，这里会显示该校已发布的CAH学科。</p></div>}
        {providerLoading && <p className="panel-status" role="status">正在读取该校数据…</p>}{error && <p className="panel-error" role="alert">{error}</p>}
        <p className="panel-footnote">只展示NSS官方已发布数据 · 不估算被抑制结果</p></div></section>
    <div id="results" className="results-anchor" />
    {!provider ? <EmptyState /> : !result ? <OverallUnavailable provider={provider} /> : <section className="results-section" aria-live="polite"><div className="result-heading"><div><p className="breadcrumb">{provider.provider_name} / {breadcrumb}</p><h2>{result.subject_name}</h2></div>
      <div className="heading-actions"><span className="level-badge">{levelNames[resultLevel(result)]}</span><button type="button" className="share-button" onClick={copyLink}>{copyStatus || '复制结果链接'}</button></div></div>
      {!provider.overall && result.subject_code !== 'ALL' && <div className="info-banner">该校没有NSS官方发布的All subjects整体结果；当前仅展示已发布学科数据。</div>}
      {result.respondents != null && result.respondents < 30 && <div className="warning-banner"><strong>样本量较小</strong><span>本结果共有{result.respondents}名respondents，请谨慎参考。</span></div>}
      {hasBk && <div className="warning-banner benchmark-warning"><strong>Benchmark被官方抑制</strong><span>BK表示部分benchmark因未知benchmarking factors过多而未发布；positivity仍为官方结果。</span></div>}
      <div className="score-grid"><article className="score-card"><p>学生体验综合分</p><div><strong>{display(result.experience_score_calculated, 2)}</strong><span>/100</span></div><small>七项官方Theme positivity等权平均</small><em>自行计算 · 非NSS官方综合分或排名</em></article>
        <article className="sample-card"><div className="sample-intro"><p>本次结果样本</p><span>Publication figures</span></div><dl>
          <div><dt>Respondents</dt><dd>{result.respondents?.toLocaleString() ?? '—'}</dd><small>发布用回复人数</small></div>
          <div><dt>Response rate</dt><dd>{result.response_rate == null ? '—' : `${display(result.response_rate)}%`}</dd><small>官方发布回复率</small></div>
          <div><dt>Eligible population</dt><dd>{result.eligible_population_fpe?.toLocaleString() ?? '—'}</dd><small>Full person equivalence</small></div>
        </dl></article></div><ThemeChart result={result} /><DetailTable result={result} /></section>}
    <section className="methodology" id="methodology"><div className="methodology-heading"><p className="eyebrow">HOW TO READ THE DATA</p><h2>透明、克制地使用NSS结果。</h2></div>
      <div className="method-grid"><article><span>01</span><h3>CAH是什么？</h3><p>CAH是NSS官方学科分类。CAH1是大类，CAH2是中层，CAH3是最细层级。这里仅提供该校实际发布的层级。</p></article>
        <article><span>02</span><h3>官方发布门槛</h3><p>结果至少需要10名respondents且response rate达到50%。缺失记录不会被重新计算或估算。</p></article>
        <article><span>03</span><h3>Respondents</h3><p>采用PUB_RESPONSE_HEADCOUNT，即整份调查的发布用回复人数，包括选择“This does not apply to me”的学生。</p></article>
        <article id="about"><span>04</span><h3>综合分不是排名</h3><p>综合分是七项Theme positivity的等权平均。任何一项缺失则不计算，且不代表NSS官方评价或大学排名。</p></article></div>
      <details className="method-detail"><summary>查看完整数据口径</summary><div><p>数据范围：Taught、All modes、All undergraduates；学科体系采用CAH v1.3.4。</p><p>Benchmark是根据学科、学习层级、年龄、性别、族裔、残障和学习方式调整后的sector average。95% CI为官方positivity区间。</p><p>当前版本不接入课程目录，因此不会把某个未发布CAH3解释为该校开设但被抑制，也不会自动替换为更宽学科。</p></div></details></section>
    <footer><div className="brand"><span className="brand-mark" aria-hidden="true">N</span><span>NSS 2026 查询器</span></div><p>数据来源：National Student Survey 2026 · 本工具不提供大学或学科排名</p></footer>
  </main>;
}
