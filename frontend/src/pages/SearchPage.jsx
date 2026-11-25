import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AptListItem from '../components/AptListItem';
import { Empty, ErrorBox, Loading } from '../components/Status';
import { searchPaged } from '../api/apartments';
import { errorMessage } from '../api/client';
import { ALL_REGIONS_LABEL, REGIONS } from '../constants/regions';
import RecommendPage from './RecommendPage';

const FILTER_KEYS = ['q', 'gu', 'minPrice', 'maxPrice', 'minArea', 'maxArea', 'minBuiltYear', 'maxWalk'];
const SORTS = [
  ['recent', '최신 거래순'],
  ['priceAsc', '낮은 가격순'],
  ['priceDesc', '높은 가격순'],
  ['ppyAsc', '평당가 낮은순'],
  ['areaDesc', '넓은 면적순'],
];
const TABS = [
  ['search', '조건 검색'],
  ['recommend', '맞춤 추천'],
];

const pick = (params) => Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? '']));

/** 조건 검색 — 필터 · 정렬 · 페이지가 모두 주소(?gu=…&sort=…&page=…)에 남아 새로고침 · 공유해도 그대로 */
function ConditionSearch() {
  const [params, setParams] = useSearchParams();
  const applied = pick(params);
  const sort = params.get('sort') || 'recent';
  const page = Number(params.get('page')) || 0;
  const [form, setForm] = useState(applied);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const key = params.toString();

  useEffect(() => { setForm(pick(params)); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError('');
    searchPaged({ ...pick(params), sort, page, size: 10 })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => { if (!cancelled) setError(errorMessage(err, '매물을 불러오지 못했습니다.')); });
    return () => { cancelled = true; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (next) => {
    const p = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => { if (v !== '' && v != null && !(k === 'page' && !v) && !(k === 'sort' && v === 'recent')) p.set(k, v); });
    setParams(p);
  };
  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const submit = (e) => { e.preventDefault(); update({ ...form, sort, page: 0 }); };
  const reset = () => update({ sort });
  const goPage = (n) => { update({ ...applied, sort, page: n }); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  let content;
  if (error) content = <ErrorBox message={error} onRetry={() => update({ ...applied, sort, page })} />;
  else if (!data) content = <Loading />;
  else if (!data.content.length) content = <Empty title="조건에 맞는 매물이 없습니다">조건을 넓혀 다시 검색해 보세요.</Empty>;
  else {
    content = (
      <>
        <ul className="apt-list">
          {data.content.map((apt) => <AptListItem key={apt.aptId} apt={apt} />)}
        </ul>
        {data.totalPages > 1 && (
          <nav className="pager" aria-label="페이지">
            <button type="button" disabled={data.page === 0} onClick={() => goPage(data.page - 1)} aria-label="이전 페이지">‹</button>
            {Array.from({ length: data.totalPages }, (_, i) => (
              <button key={i} type="button" className={i === data.page ? 'on' : ''} aria-current={i === data.page ? 'page' : undefined} onClick={() => goPage(i)}>{i + 1}</button>
            ))}
            <button type="button" disabled={data.page >= data.totalPages - 1} onClick={() => goPage(data.page + 1)} aria-label="다음 페이지">›</button>
          </nav>
        )}
      </>
    );
  }

  return (
    <div className="two-col">
      <form className="card form" onSubmit={submit}>
        <h2 className="card-title">검색 조건</h2>
        <label className="field"><span>단지명 또는 동</span>
          <input name="q" value={form.q} onChange={change} placeholder="예: 래미안, 아현동" />
        </label>
        <label className="field"><span>지역</span>
          <select name="gu" value={form.gu} onChange={change}>
            <option value="">{ALL_REGIONS_LABEL}</option>
            {REGIONS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <div className="field"><span>가격 (만원)</span>
          <div className="range">
            <input type="number" name="minPrice" min="0" step="1000" placeholder="최소" value={form.minPrice} onChange={change} />~
            <input type="number" name="maxPrice" min="0" step="1000" placeholder="최대" value={form.maxPrice} onChange={change} />
          </div>
        </div>
        <div className="field"><span>전용면적 (㎡)</span>
          <div className="range">
            <input type="number" name="minArea" min="0" placeholder="최소" value={form.minArea} onChange={change} />~
            <input type="number" name="maxArea" min="0" placeholder="최대" value={form.maxArea} onChange={change} />
          </div>
        </div>
        <label className="field"><span>준공연도 (이후)</span>
          <input type="number" name="minBuiltYear" min="1960" max="2030" placeholder="예: 2010" value={form.minBuiltYear} onChange={change} />
        </label>
        <label className="field"><span>역세권</span>
          <select name="maxWalk" value={form.maxWalk} onChange={change}>
            <option value="">상관없음</option>
            {[5, 10, 15].map((m) => <option key={m} value={m}>지하철역 도보 {m}분 이내</option>)}
          </select>
        </label>
        {/* 한 줄: [초기화] [검색 ────] — 지도 상세 조건 창(선택 해제 · 적용하기)과 같은 배치 */}
        <div className="search-actions">
          <button type="button" className="btn btn-ghost" onClick={reset}>초기화</button>
          <button type="submit" className="btn btn-primary">검색</button>
        </div>
      </form>

      <section>
        <div className="search-head">
          <h2 className="list-title">{data ? <>검색 결과 <b>{data.totalElements.toLocaleString()}</b>건</> : '검색 결과'}</h2>
          <select className="select" value={sort} onChange={(e) => update({ ...applied, sort: e.target.value, page: 0 })} aria-label="정렬">
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {content}
      </section>
    </div>
  );
}

/** 매물찾기 — 조건 검색(GET /api/apartments/search) · 맞춤 추천(GET /api/recommend) */
export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'recommend' ? 'recommend' : 'search';

  return (
    <div className="container section">
      <header className="page-head">
        <h1>매물찾기</h1>
        <p className="muted">성남, 용인, 수원 아파트 매물을 조건으로 검색하거나, 예산에 맞춰 추천받으세요.</p>
      </header>
      <div className="page-tabs" role="tablist" aria-label="찾는 방법">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            className={`page-tab${tab === k ? ' on' : ''}`}
            onClick={() => setParams(k === 'search' ? {} : { tab: k })}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'search' ? <ConditionSearch /> : <RecommendPage embedded />}
    </div>
  );
}
