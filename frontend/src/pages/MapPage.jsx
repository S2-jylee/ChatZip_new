import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import FilterBar from '../components/FilterBar';
import MapView from '../components/map/MapView';
import ListingModal from '../components/detail/ListingModal';
import MapControls from '../components/map/MapControls';
import MapTooltip from '../components/map/MapTooltip';
import PriceLegend from '../components/map/PriceLegend';
import AptListItem from '../components/AptListItem';
import { Empty, ErrorBox, Loading } from '../components/Status';
import { getBoundary, getBoundaryIds, searchApartments } from '../api/apartments';
import { searchPlaces } from '../api/places';
import { errorMessage } from '../api/client';
import { cleanParams } from '../utils/format';
import { useViewed } from '../utils/viewed';
import { DEFAULT_TYPE, FILTER_KEYS, PROPERTY_TYPES, dealTabsOf, defaultDealOf } from '../constants/propertyTypes';
import { EXTRA_KINDS_BY_TYPE, placeKind } from '../constants/placeKinds';

const KEYS = FILTER_KEYS;

// 매물 종류 탭 아이콘 (선 아이콘, currentColor)
const TYPE_ICONS = {
  apt: <><path d="M4 21V5l7-2v18" /><path d="M11 21V8l9 3v10" /><path d="M7 8h1M7 12h1M7 16h1M14 13h2M14 17h2" /><path d="M2 21h20" /></>,
  villa: <><path d="M3 21V10l9-6 9 6v11" /><path d="M9 21v-6h6v6" /><path d="M2 21h20" /></>,
  oneroom: <><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 21v-4h6v4" /><path d="M8 8h3v3H8zM13 8h3v3h-3z" /></>,
  officetel: <><rect x="5" y="2" width="14" height="19" rx="1" /><path d="M9 6h2M13 6h2M9 10h2M13 10h2M9 14h2M13 14h2" /><path d="M10 21v-3h4v3" /></>,
  store: <><path d="M3 9l1.5-5h15L21 9" /><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /><path d="M5 12v9h14v-9" /><path d="M10 21v-5h4v5" /></>,
};

const SORTS = {
  recent: { label: '최신 거래순', fn: (a, b) => String(b.dealDate).localeCompare(String(a.dealDate)) },
  // 월세는 월세 → 보증금 순으로 비교 (매매·전세는 rent 가 없어 가격만)
  priceAsc: { label: '낮은 가격순', fn: (a, b) => (a.rent ?? 0) - (b.rent ?? 0) || a.price - b.price },
  priceDesc: { label: '높은 가격순', fn: (a, b) => (b.rent ?? 0) - (a.rent ?? 0) || b.price - a.price },
  area: { label: '넓은 면적순', fn: (a, b) => b.areaM2 - a.areaM2 },
  newest: { label: '신축순', fn: (a, b) => b.builtYear - a.builtYear },
};


const inBounds =(a, b) => a.lat >= b.south && a.lat <= b.north && a.lng >= b.west && a.lng <= b.east;

export default function MapPage({ type = DEFAULT_TYPE }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [apartments, setApartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [activeId, setActiveId] = useState(null); // 목록 hover
  const [bounds, setBounds] = useState(null);
  const [onlyInView, setOnlyInView] = useState(true);
  const [sort, setSort] = useState('recent');

  const [sideOpen, setSideOpen] = useState(true); // 왼쪽 사이드바 접기 → 지도 넓게
  const [mapType, setMapType] = useState('road'); // road | satellite
  const [placeKinds, setPlaceKinds] = useState([]); // 켜 둔 주변 시설 종류
  const [places, setPlaces] = useState([]);
  const viewedIds = useViewed();
  const [boundaryIds, setBoundaryIds] = useState(null); // 테두리가 있는 매물 → 분홍 마커
  useEffect(() => { getBoundaryIds().then(setBoundaryIds); }, []);

  // 지도 사용법 안내: 처음 몇 초만 잠깐 보이고 사라짐. 마커를 한 번이라도 눌러 봤으면 다시 안 보임
  const [hintOn, setHintOn] = useState(() => {
    try { return !localStorage.getItem('mapHintDone'); } catch { return true; }
  });
  useEffect(() => {
    if (!hintOn) return undefined;
    const t = setTimeout(() => setHintOn(false), 4000);
    return () => clearTimeout(t);
  }, [hintOn]);
  const hintDone = () => {
    setHintOn(false);
    try { localStorage.setItem('mapHintDone', '1'); } catch { /* 저장 안 돼도 무시 */ }
  };

  // 필터는 URL 쿼리에 저장 → 새로고침·뒤로가기·홈 검색창과 연결 (detail 은 모달용이라 제외)
  const filterString = KEYS.map((k) => searchParams.get(k) ?? '').join('|');
  const filters = useMemo(
    () => Object.fromEntries(KEYS.map((k) => [k, searchParams.get(k) ?? ''])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterString],
  );
  // 검색어(?q=): 단지명 · 동 · 구 · 주소 — 필터와 따로 두어 필터를 바꿔도 유지
  const q = searchParams.get('q') ?? '';
  const [qInput, setQInput] = useState(q);
  useEffect(() => { setQInput(q); }, [q]);
  const setQuery = (text) => setSearchParams((prev) => {
    const p = new URLSearchParams(prev);
    const v = text.trim();
    if (v) p.set('q', v); else p.delete('q');
    p.delete('detail');
    return p;
  });
  const query = useMemo(() => ({ ...filters, type, q }), [filters, type, q]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setHovered(null);
    searchApartments(query)
      .then((data) => { if (!cancelled) setApartments(data); })
      .catch((err) => { if (!cancelled) setError(errorMessage(err, '매물을 불러오지 못했습니다.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query, reloadKey]);

  // 주변 시설: 지도 이동이 멈추고 0.3초 뒤 검색
  // 종류마다 보이는 확대 수준이 다름 (지하철은 넓게, 버스·편의시설은 확대해야)
  const span = bounds ? bounds.north - bounds.south : Infinity;
  const shownKinds = placeKinds.filter((k) => span <= placeKind(k).maxSpan);
  const hiddenKinds = placeKinds.filter((k) => !shownKinds.includes(k));
  const shownKey = shownKinds.join(',');
  useEffect(() => {
    const kinds = shownKey ? shownKey.split(',') : [];
    if (!kinds.length || !bounds) { setPlaces([]); return undefined; }
    let cancelled = false;
    const t = setTimeout(() => {
      searchPlaces(kinds, bounds)
        .then((list) => { if (!cancelled) setPlaces(list); })
        .catch(() => { if (!cancelled) setPlaces([]); });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [shownKey, bounds]);

  // 마우스 올림 → 말풍선(hovered) / 클릭·상세 보기 → 왼쪽 사이드 패널(?detail=id) + 단지 영역 테두리로 확대
  const [hovered, setHovered] = useState(null);
  const [boundary, setBoundary] = useState(null);
  const detailId = searchParams.get('detail');

  // 모바일 목록·상세 = 아래쪽 시트: 위로 스와이프 → 전체 화면, 맨 위에서 빠르게 아래로 → 원래대로(지도 보임)
  const [sheetFull, setSheetFull] = useState(false);
  const sideRef = useRef(null);
  const swipe = useRef(null);
  useEffect(() => { setSheetFull(false); }, [detailId]);
  // 시트를 펼치면 지도 높이가 0 → 그때 바뀐 지도 영역은 무시 (목록이 '영역 안 0건'이 되지 않게)
  const sheetFullRef = useRef(false);
  sheetFullRef.current = sheetFull;
  const onBounds = (b) => { if (!sheetFullRef.current) setBounds(b); };
  const sheetOn = () => window.matchMedia('(max-width: 1000px)').matches;
  const scrollerTop = () => (sideRef.current?.querySelector('.listing-side') ?? sideRef.current)?.scrollTop ?? 0;
  const onSheetTouchStart = (e) => {
    if (!sheetOn() || e.touches.length !== 1) { swipe.current = null; return; }
    swipe.current = { y: e.touches[0].clientY, t: Date.now(), atTop: scrollerTop() <= 0 };
  };
  const onSheetTouchEnd = (e) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dy = e.changedTouches[0].clientY - s.y; // + 아래로, - 위로
    const speed = Math.abs(dy) / Math.max(Date.now() - s.t, 1); // px/ms
    if (!sheetFull && dy < -40) setSheetFull(true);
    else if (sheetFull && s.atTop && dy > 60 && (speed > 0.5 || dy > 160)) setSheetFull(false);
  };
  const selected = useMemo(
    () => apartments.find((a) => String(a.aptId) === detailId) ?? null,
    [apartments, detailId],
  );
  useEffect(() => {
    setBoundary(null);
    if (!detailId) return undefined;
    let cancelled = false;
    getBoundary(detailId).then((b) => { if (!cancelled) setBoundary(b); }).catch(() => {});
    return () => { cancelled = true; };
  }, [detailId]);
  const setDetail = (id) => setSearchParams((prev) => {
    const p = new URLSearchParams(prev);
    if (id == null) p.delete('detail'); else p.set('detail', id);
    return p;
  });
  const hoverTimer = useRef(null);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);
  // 터치 화면(태블릿·휴대폰)엔 마우스 올림이 없음 → 1번 탭 = 요약 말풍선, 같은 마커 2번째 탭(또는 말풍선의 '상세 보기') = 상세
  const isTouch = useMemo(() => window.matchMedia('(hover: none)').matches, []);
  const openDetail = (apt) => { setHovered(null); setDetail(apt.aptId); hintDone(); };
  const handleHover = (apt) => {
    if (isTouch) return; // 탭할 때 따라오는 가짜 mouseenter 무시
    clearTimeout(hoverTimer.current);
    if (apt) setHovered(apt);
    else hoverTimer.current = setTimeout(() => setHovered(null), 250); // 말풍선(하트)으로 옮겨갈 시간
  };
  const handleSelect = (apt) => { // 마커 클릭 → 상세 패널. 빈 곳 클릭(null)은 말풍선만 닫음
    if (!apt) { setHovered(null); return; }
    if (isTouch && hovered?.aptId !== apt.aptId) { setHovered(apt); return; }
    openDetail(apt);
  };

  // 종류 전용 버튼(원룸 대학교)은 다른 화면으로 가면 끔
  useEffect(() => {
    const extra = new Set((EXTRA_KINDS_BY_TYPE[type] ?? []).map((k) => k.key));
    setPlaceKinds((ks) => ks.filter((k) => k !== 'univ' || extra.has(k)));
  }, [type]);

  const togglePlace =(key) => setPlaceKinds((ks) => (ks.includes(key) ? ks.filter((k) => k !== key) : [...ks, key]));

  const visible = useMemo(() => {
    const list = onlyInView && bounds ? apartments.filter((a) => inBounds(a, bounds)) : [...apartments];
    return list.sort(SORTS[sort].fn);
  }, [apartments, bounds, onlyInView, sort]);

  // 필터를 바꿔도 매물 종류(?type)는 유지
  const updateFilters = (next) => {
    const p = cleanParams(next);
    if (type !== DEFAULT_TYPE) p.type = type;
    if (q) p.q = q;
    setSearchParams(p);
  };
  // 종류를 바꾸면 가격대 · 거래 종류가 달라 필터는 비움 (지역만 유지)
  const pickType = (t) => setSearchParams(cleanParams({ type: t === DEFAULT_TYPE ? '' : t, gu: filters.gu, q }));

  // 거래 종류 탭 (빌라·원룸) — 필터 맨 위라 필터를 접어도 바로 바꿀 수 있음
  const dealTabs = dealTabsOf(type);
  const deal = filters.deal || defaultDealOf(type);
  // 거래 종류를 바꾸면 가격 조건은 단위가 달라 비움
  const pickDeal = (key) => updateFilters({ ...filters, deal: key, minPrice: '', maxPrice: '', minRent: '', maxRent: '' });

  let list;
  if (loading) list = <Loading />;
  else if (error) list = <ErrorBox message={error} onRetry={() => setReloadKey((k) => k + 1)} />;
  else if (!apartments.length) list = <Empty>조건을 조금 넓혀서 다시 검색해 보세요.</Empty>;
  else if (!visible.length) list = <Empty title="지도 영역 안에 매물이 없어요">지도를 움직이거나 축소해 보세요.</Empty>;
  else {
    list = (
      <ul className="apt-list">
        {visible.map((apt) => (
          <AptListItem
            key={apt.aptId}
            apt={apt}
            active={apt.aptId === activeId || apt.aptId === selected?.aptId}
            onHover={setActiveId}
          />
        ))}
      </ul>
    );
  }

  const viewedCount = apartments.filter((a) => viewedIds.has(a.aptId)).length;

  return (
    <div className={`map-page${sideOpen ? '' : ' side-closed'}${detailId ? ' has-detail' : ''}${sheetFull ? ' sheet-full' : ''}`}>
      <aside className="map-side" ref={sideRef} onTouchStart={onSheetTouchStart} onTouchEnd={onSheetTouchEnd}>
        {/* 모바일 목록·상세 시트 손잡이: 눌러도 펼치기/접기 */}
        <button
          type="button"
          className="sheet-handle"
          onClick={() => setSheetFull((v) => !v)}
          aria-label={sheetFull ? '접고 지도 보기' : '전체 화면으로 보기'}
        >
          <span aria-hidden="true" />
        </button>
        {/* 상세 보기 중엔 필터·목록을 숨기고(스크롤 위치 유지) 그 자리에 상세 표시 */}
        {detailId && <ListingModal key={detailId} id={detailId} variant="side" onClose={() => setDetail(null)} />}
        <div style={{ display: detailId ? 'none' : 'contents' }}>
        {/* 매물 종류 탭 */}
        <div className="type-tabs" role="tablist" aria-label="매물 종류">
          {PROPERTY_TYPES.map((t) => (
            <button
              key={t.type}
              type="button"
              role="tab"
              aria-selected={type === t.type}
              className={`type-tab${type === t.type ? ' on' : ''}`}
              onClick={() => pickType(t.type)}
            >
              <span className="type-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {TYPE_ICONS[t.type]}
                </svg>
              </span>
              <span>{t.label.replace(', ', '·')}</span>
            </button>
          ))}
        </div>
        {/* 검색창 — 종류 탭 아래 (단지명 · 동 · 구) */}
        <div className="map-top">
        <form className="map-search" role="search" onSubmit={(e) => { e.preventDefault(); setQuery(qInput); }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <input
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="단지명, 지역(구, 동)으로 검색"
            aria-label="매물 검색"
            enterKeyHint="search"
          />
          {qInput && (
            <button type="button" className="map-search-clear" onClick={() => { setQInput(''); setQuery(''); }} aria-label="검색어 지우기">×</button>
          )}
        </form>
        </div>
        {/* 거래 종류 탭 (빌라·원룸) — 필터 맨 위: 접어도 항상 보임 */}
        {dealTabs.length > 0 && (
          <div
            className="deal-tabs"
            role="tablist"
            aria-label="거래 종류"
            style={{ '--n': dealTabs.length, '--i': Math.max(0, dealTabs.findIndex((d) => d.key === deal)) }}
          >
            {/* 선택 표시(흰 배경)가 탭 사이를 옆으로 미끄러지듯 이동 */}
            <span className="deal-thumb" aria-hidden="true" />
            {dealTabs.map((d) => (
              <button
                key={d.key}
                type="button"
                role="tab"
                aria-selected={deal === d.key}
                className={`deal-tab${deal === d.key ? ' on' : ''}`}
                onClick={() => pickDeal(d.key)}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}
        {/* 필터: 한 줄 버튼 → 누르면 그 항목만 펼침 (목록을 밀어내지 않음) */}
        <FilterBar value={filters} onSubmit={updateFilters} type={type} />
        <div className="map-side-head">
          {/* 건수는 윗줄, 부가 정보는 아랫줄 고정 → 정보 길이와 상관없이 정렬 상자 위치가 같음 */}
          <div className="msh-info">
            <div><strong className="count">{loading ? '…' : visible.length.toLocaleString()}</strong><span className="msh-unit">건</span></div>
            <small className="msh-meta">
              {onlyInView ? '지도 영역 안, ' : ''}전체 {apartments.length}건{viewedCount > 0 ? `, 본 매물 ${viewedCount}` : ''}
            </small>
          </div>
          <select className="select select-sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="정렬">
            {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={onlyInView} onChange={(e) => setOnlyInView(e.target.checked)} />
          <span>지도에 보이는 매물만 목록에 표시</span>
        </label>
        <div className="map-side-list">{list}</div>
        </div>
      </aside>

      <section className="map-main">
        <button
          type="button"
          className="side-toggle"
          onClick={() => setSideOpen((v) => !v)}
          aria-expanded={sideOpen}
          title={sideOpen ? '목록 접기' : '목록 펼치기'}
        >
          <span aria-hidden="true">{sideOpen ? '‹' : '›'}</span>
        </button>
        <MapView
          className={span > 0.1 ? 'zoom-far' : ''}
          apartments={apartments}
          activeId={activeId}
          selectedId={hovered?.aptId ?? selected?.aptId}
          boundary={boundary}
          onSelect={handleSelect}
          onHover={handleHover}
          onBoundsChange={onBounds}
          mapType={mapType}
          places={places}
          viewedIds={viewedIds}
          boundaryIds={boundaryIds}
          popup={hovered && (
            <MapTooltip
              apt={hovered}
              onEnter={() => clearTimeout(hoverTimer.current)}
              onLeave={() => handleHover(null)}
              onDetail={isTouch ? () => openDetail(hovered) : undefined}
            />
          )}
        />
        <MapControls
          mapType={mapType}
          onMapType={setMapType}
          placeKinds={placeKinds}
          onTogglePlace={togglePlace}
          onClearPlaces={() => setPlaceKinds([])}
          placeCount={places.length}
          hiddenKinds={hiddenKinds}
          isSample={places.some((p) => p.isSample)}
          extraKinds={EXTRA_KINDS_BY_TYPE[type]}
        />
        <PriceLegend />
        {hintOn && !detailId && !hovered && !loading && apartments.length > 0 && (
          <div className="map-hint">
            {/* 터치 화면엔 마우스 올림이 없어 짧은 문구 */}
            <span className="hint-mouse">마커에 마우스를 올리면 요약, 클릭하면 상세 정보와 단지 영역</span>
            <span className="hint-touch">마커를 누르면 요약, 한 번 더 누르면 상세 정보</span>
          </div>
        )}
      </section>
    </div>
  );
}
