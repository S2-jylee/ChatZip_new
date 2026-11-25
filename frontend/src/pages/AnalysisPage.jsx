import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Empty, ErrorBox, Loading } from '../components/Status';
import { getGuDetail, getGuStats } from '../api/stats';
import { errorMessage } from '../api/client';
import { DATA_SOURCE } from '../constants/regions';
import { MAP_PATH } from '../constants/menus';
import { formatDate, formatPrice, formatPriceCompact } from '../utils/format';
import { useDetailHref } from '../utils/detailLink';
import './AnalysisPage.css';

const RANK_SORTS = [
  ['avgPerPyeong', '평당가순'],
  ['avgPrice', '평균가순'],
  ['count', '거래량순'],
];

/** 가로 막대 한 줄 (값은 텍스트로도 표시 — 색만으로 구분하지 않음) */
function Bar({ label, value, max, text, sub }) {
  return (
    <div className="an-bar">
      <span className="an-bar-label">{label}</span>
      <div className="an-bar-track"><div style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} /></div>
      <span className="an-bar-value">{text}{sub && <small>{sub}</small>}</span>
    </div>
  );
}

function GuDetail({ gu }) {
  const detailHref = useDetailHref();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setD(null);
    setError('');
    getGuDetail(gu)
      .then((x) => { if (!cancelled) setD(x); })
      .catch((err) => { if (!cancelled) setError(errorMessage(err, '통계를 불러오지 못했습니다.')); });
    return () => { cancelled = true; };
  }, [gu]);

  if (error) return <ErrorBox message={error} />;
  if (!d) return <Loading />;

  const gap = Math.round(((d.avgPerPyeong - d.seoulAvgPerPyeong) / d.seoulAvgPerPyeong) * 100);
  const maxArea = Math.max(...d.byArea.map((b) => b.avgPerPyeong));
  const maxAge = Math.max(...d.byAge.map((b) => b.avgPerPyeong));

  return (
    <div className="an-detail">
      <div className="an-detail-head">
        <div>
          <h2>{d.gu} 아파트 시세</h2>
        </div>
        <Link to={`${MAP_PATH}?gu=${encodeURIComponent(d.gu)}`} className="btn btn-ghost btn-sm">지도에서 보기</Link>
      </div>

      <div className="an-kpis">
        <div className="an-kpi"><span>평균 평당가</span><strong>{formatPriceCompact(d.avgPerPyeong)}</strong>
          <small className={gap >= 0 ? 'up' : 'down'}>전체 지역 평균 대비 {gap >= 0 ? '+' : ''}{gap}%</small></div>
        <div className="an-kpi"><span>평균 거래가</span><strong>{formatPriceCompact(d.avgPrice)}</strong>
          <small>{formatPriceCompact(d.minPrice)} ~ {formatPriceCompact(d.maxPrice)}</small></div>
        <div className="an-kpi"><span>거래 건수</span><strong>{d.count.toLocaleString()}<em>건</em></strong><small>최근 12개월</small></div>
        <div className="an-kpi"><span>평당가 순위</span><strong>{d.rank}<em>위</em></strong><small>{d.totalGu}개 구 중</small></div>
      </div>

      <div className="an-split">
        <section>
          <h3>면적대별 평균 평당가</h3>
          {d.byArea.map((b) => (
            <Bar key={b.label} label={b.label} value={b.avgPerPyeong} max={maxArea}
              text={b.count ? formatPriceCompact(b.avgPerPyeong) : '거래 없음'} sub={b.count ? `${b.count}건` : ''} />
          ))}
        </section>
        <section>
          <h3>준공 연식별 평균 평당가</h3>
          {d.byAge.map((b) => (
            <Bar key={b.label} label={b.label} value={b.avgPerPyeong} max={maxAge}
              text={b.count ? formatPriceCompact(b.avgPerPyeong) : '거래 없음'} sub={b.count ? `${b.count}건` : ''} />
          ))}
          <p className="muted small">평균 준공연도 {d.avgBuiltYear ? `${d.avgBuiltYear}년` : '정보 없음'}</p>
        </section>
      </div>

      <section>
        <h3>최근 거래</h3>
        <ol className="recent-list">
          {d.recent.map((apt, i) => {
            const row = (
              <>
                <span className="recent-rank">{i + 1}</span>
                <span className="recent-info">
                  <strong>{apt.name}</strong>
                  <span className="muted small">{apt.dong}, 전용 {Math.round(apt.areaM2)}㎡, {apt.floor}층</span>
                </span>
                <span className="recent-date muted small">{formatDate(apt.dealDate)}</span>
                <span className="recent-price">{formatPrice(apt.price)}</span>
              </>
            );
            // 실거래는 등록 매물이 아닐 수 있음 → 매물 번호가 있을 때만 상세로 이동
            return (
              <li key={`${apt.aptId ?? ''}-${apt.dealDate}-${i}`}>
                {apt.aptId != null
                  ? <Link to={detailHref(apt.aptId)} className="recent-row">{row}</Link>
                  : <div className="recent-row">{row}</div>}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

/** 지역별분석 — 구별 시세 랭킹(GET /api/stats/gu) + 선택한 구 상세(GET /api/stats/gu/{gu}) */
export default function AnalysisPage() {
  const [params, setParams] = useSearchParams();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState('avgPerPyeong');

  const load = () => {
    setError('');
    setStats(null);
    getGuStats().then(setStats).catch((err) => setError(errorMessage(err, '구별 통계를 불러오지 못했습니다.')));
  };
  useEffect(load, []);

  const sorted = useMemo(() => [...(stats ?? [])].sort((a, b) => b[sortKey] - a[sortKey]), [stats, sortKey]);
  const max = sorted[0]?.[sortKey] ?? 1;
  const selected = params.get('gu') || stats?.[0]?.gu;
  const select = (gu) => {
    setParams({ gu }, { replace: true });
    if (window.matchMedia('(max-width: 1000px)').matches) {
      document.querySelector('.an-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  const valueText = (s) => (sortKey === 'count' ? `${s.count}건` : formatPriceCompact(s[sortKey]));

  let content;
  if (error) content = <ErrorBox message={error} onRetry={load} />;
  else if (!stats) content = <Loading />;
  else if (!stats.length) content = <Empty title="통계 데이터가 없습니다" />;
  else {
    content = (
      <div className="an-grid">
        <aside className="card an-rank">
          <div className="an-rank-head">
            <h2>구별 순위</h2>
            <div
              className="an-seg"
              role="tablist"
              aria-label="순위 기준"
              style={{ '--i': Math.max(0, RANK_SORTS.findIndex(([k]) => k === sortKey)) }}
            >
              {/* 지도 매매 · 전세 · 월세 탭처럼 주황 선택 표시가 옆으로 미끄러짐 */}
              <span className="an-seg-thumb" aria-hidden="true" />
              {RANK_SORTS.map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={sortKey === k} className={sortKey === k ? 'on' : ''} onClick={() => setSortKey(k)}>{l}</button>
              ))}
            </div>
          </div>
          <ol className="an-rank-list">
            {sorted.map((s, i) => (
              <li key={s.gu}>
                <button type="button" className={`an-rank-row${s.gu === selected ? ' on' : ''}`} onClick={() => select(s.gu)} aria-pressed={s.gu === selected}>
                  <span className="an-rank-no">{i + 1}</span>
                  <span className="an-rank-gu">{s.gu}</span>
                  <span className="an-rank-bar"><span style={{ width: `${(s[sortKey] / max) * 100}%` }} /></span>
                  <span className="an-rank-val">{valueText(s)}</span>
                </button>
              </li>
            ))}
          </ol>
        </aside>
        <div className="card an-main">{selected && <GuDetail gu={selected} />}</div>
      </div>
    );
  }

  return (
    <div className="container section">
      <header className="page-head">
        <h1>지역별분석</h1>
        <p className="muted">성남, 용인, 수원 구별 아파트 실거래 시세를 비교하고, 구를 골라 면적과 연식별 시세를 확인하세요.</p>
      </header>
      {content}
      <p className="muted small source">데이터 출처: {DATA_SOURCE}. 평당가 = 거래가 ÷ (전용면적 ÷ 3.3058)</p>
    </div>
  );
}
