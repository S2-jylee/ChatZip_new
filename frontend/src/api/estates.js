import { api } from './client';
import { itemsOf } from './adapt';

/**
 * 실서버(백엔드 Swagger 192.168.0.30:8080) 단지·실거래 API 연결 — .env 의 VITE_LIVE_API 에 estates / stats 가 있을 때만 사용
 *  백엔드는 아직 "등록 매물"이 없고 단지(estate) + 실거래(sold)만 있음 →
 *  단지 1개 = 화면 매물 1개(아파트 매매)로 보고, 가격·면적·층은 그 단지의 가장 최근 실거래로 채움
 *  사용 API: GET /api/estates · /api/estates/{estIdx} · /api/trades?estIdx= · /api/stats/regions
 *  금액 만원, 면적 ㎡, gpsX = 경도 · gpsY = 위도
 */

// 모의 매물 번호(1 ~ 1만대)와 겹치지 않게 화면용 번호를 띄움 → 번호만 보고 실서버/모의 어느 쪽인지 구분
export const LIVE_ID_BASE = 1_000_000;
export const isLiveId = (id) => Number(id) >= LIVE_ID_BASE;
const toEstIdx = (id) => Number(id) - LIVE_ID_BASE;

const guOf = (e) => [e.city, e.district].filter(Boolean).join(' ');

/** 서버 실거래(sold) → 화면 거래 */
export const toLiveTrade = (t, estate) => ({
  aptId: LIVE_ID_BASE + t.estIdx,
  name: t.estName ?? estate?.estName,
  type: 'apt',
  dealType: 'sale',
  gu: estate ? guOf(estate) : undefined,
  dong: estate?.dong,
  builtYear: estate?.builtYear ?? undefined,
  price: t.soldPrice,
  areaM2: t.soldArea,
  floor: t.soldFloor,
  dealDate: t.soldDate,
});

/** 서버 단지(estate) + 최근 실거래 → 화면 매물 */
export function toLiveListing(e, latest) {
  return {
    aptId: LIVE_ID_BASE + e.estIdx,
    estIdx: e.estIdx,
    live: true,
    name: e.estName,
    type: 'apt',
    dealType: 'sale',
    address: e.estAddress,
    gu: guOf(e),
    dong: e.dong,
    builtYear: e.builtYear ?? undefined,
    lat: e.gpsY,
    lng: e.gpsX,
    price: latest?.soldPrice ?? null,
    areaM2: latest?.soldArea ?? null,
    floor: latest?.soldFloor ?? null,
    dealDate: latest?.soldDate ?? null,
  };
}

const byDateDesc = (a, b) => String(b.soldDate).localeCompare(String(a.soldDate));

// 단지 전체 + 실거래 전체를 한 번에 받아 30초 동안 재사용 (지도·매물찾기·지역별분석이 같이 씀)
// TODO 백엔드: 단지 목록에 최근 거래가·면적을 넣어 주면 실거래 전체 조회는 없앨 수 있음
let cache = null;
export async function loadAll() {
  if (cache && Date.now() - cache.at < 30_000) return cache.data;
  const promise = Promise.all([
    api.get('/api/estates'),
    api.get('/api/trades', { params: { page: 0, size: 5000 } }),
  ]).then(([es, ts]) => {
    const estates = itemsOf(es.data);
    const trades = itemsOf(ts.data).sort(byDateDesc);
    const estateById = new Map(estates.map((e) => [e.estIdx, e]));
    const latestByEst = new Map();
    trades.forEach((t) => { if (!latestByEst.has(t.estIdx)) latestByEst.set(t.estIdx, t); });
    return {
      estateById,
      trades,
      listings: estates.map((e) => toLiveListing(e, latestByEst.get(e.estIdx))),
    };
  });
  cache = { at: Date.now(), data: promise };
  promise.catch(() => { cache = null; });
  return promise;
}

const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

/** 화면 검색 조건으로 걸러내기 (백엔드에 아직 조건 검색이 없어서 화면에서 처리) */
export async function searchLive(f = {}) {
  const { listings } = await loadAll();
  const q = String(f.q ?? '').trim();
  return listings.filter((a) =>
    (!f.gu || a.gu === f.gu)
    && (!q || [a.name, a.address, a.gu, a.dong].some((x) => x?.includes(q)))
    && (num(f.minPrice) == null || (a.price ?? 0) >= num(f.minPrice))
    && (num(f.maxPrice) == null || (a.price ?? Infinity) <= num(f.maxPrice))
    && (num(f.minArea) == null || (a.areaM2 ?? 0) >= num(f.minArea))
    && (num(f.maxArea) == null || (a.areaM2 ?? Infinity) <= num(f.maxArea))
    && (num(f.minBuiltYear) == null || (a.builtYear ?? 0) >= num(f.minBuiltYear)));
}

const PY = 3.3058;
const ppy = (a) => (a.price && a.areaM2 ? a.price / (a.areaM2 / PY) : 0);
const SORTS = {
  recent: (a, b) => String(b.dealDate).localeCompare(String(a.dealDate)),
  priceAsc: (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity),
  priceDesc: (a, b) => (b.price ?? -1) - (a.price ?? -1),
  ppyAsc: (a, b) => ppy(a) - ppy(b),
  areaDesc: (a, b) => (b.areaM2 ?? 0) - (a.areaM2 ?? 0),
};

/** 매물찾기 — 정렬 + 페이지도 화면에서. extra = 같이 보여 줄 모의 매물 */
export async function searchPagedLive(f = {}, extra = []) {
  const list = [...(await searchLive(f)), ...extra].sort(SORTS[f.sort] ?? SORTS.recent);
  const size = Number(f.size) || 10;
  const totalPages = Math.max(1, Math.ceil(list.length / size));
  const page = Math.min(Number(f.page) || 0, totalPages - 1);
  return { content: list.slice(page * size, page * size + size), totalElements: list.length, totalPages, page, size };
}

/** GET /api/estates/{estIdx} + 최근 실거래 */
export async function getLive(id) {
  const estIdx = toEstIdx(id);
  const [{ data: e }, trades] = await Promise.all([api.get(`/api/estates/${estIdx}`), getLiveTrades(id)]);
  return toLiveListing(e, trades[0]);
}

/** GET /api/trades?estIdx= — 최신순 */
export async function getLiveTrades(id, { startDate, minArea, maxArea } = {}) {
  const { data } = await api.get('/api/trades', {
    params: { estIdx: toEstIdx(id), startDate, minArea, maxArea, page: 0, size: 500 },
  });
  return itemsOf(data).sort(byDateDesc);
}
