import { api, isLive, USE_MOCK } from './client';
import { cleanParams } from '../utils/format';
import { itemsOf, monthsAgo, pick, toListing, toPage, toSalesParams, toTrade, toTransactionType, ymd } from './adapt';
import * as mock from './mock';
import * as live from './estates';

// 실서버 단지 API 는 아파트 매매만 있음 → 그 외 종류는 계속 모의 데이터
const liveAptSale = (f = {}) => isLive('estates') && (f.type || 'apt') === 'apt' && (f.deal || 'sale') === 'sale';
const liveId = (id) => isLive('estates') && live.isLiveId(id);

// 지도·목록 한 번에 받을 최대 건수 (수천 건이면 지도가 느려짐)
const MAP_LIMIT = 500;

/**
 * GET /api/sales  — 등록 매물 목록·검색 (1120 정리본)
 * 화면 조건 type · deal · q · gu · minPrice … 는 adapt.toSalesParams 에서
 * propertyType · transactionType · keyword · district · 매매가/보증금 범위로 바꿔 보냄
 * 응답: { items, totalCount } → 화면 매물 배열
 *  빌라·원룸 추가 필드:
 *   rent?: 월세 만원 (monthly 일 때)
 *   nearestStation?: { name: "망원역", distanceM: 540 }  — 공공 역 좌표 데이터로 서버에서 직선거리 계산 (카카오 길찾기 쓰지 않음)
 *   landAreaM2?: 대지권 면적 (빌라 매매, 연립다세대 실거래 자료)
 *   violation?: true | false | null  — 위반건축물 여부 (건축물대장, null = 확인 불가)
 */
export async function searchApartments(filters = {}) {
  if (liveAptSale(filters) && USE_MOCK) { // 실서버 단지(노란 마커) + 모의 매물 같이
    const [real, fake] = await Promise.all([live.searchLive(cleanParams(filters)), mock.searchApartments(cleanParams(filters))]);
    return [...real, ...fake];
  }
  if (liveAptSale(filters)) return live.searchLive(cleanParams(filters));
  if (USE_MOCK) return mock.searchApartments(cleanParams(filters));
  const { data } = await api.get('/api/sales', { params: toSalesParams({ ...filters, page: 0, size: MAP_LIMIT }) });
  return itemsOf(data).map(toListing);
}

/** GET /api/sales/{salesIdx}  — 없으면 404 */
export async function getApartment(id) {
  if (liveId(id)) return live.getLive(id);
  if (USE_MOCK) return mock.getApartment(id);
  const { data } = await api.get(`/api/sales/${id}`);
  return toListing(data);
}

/**
 * GET /api/trades?estIdx=&transactionType=&startDate=&endDate=&minArea=&maxArea=  — 같은 단지·비슷한 면적의 실거래
 * (정리본 "상세→거래": 등록 매물은 salesIdx, 과거 거래는 estIdx 로 조회 — 매물가와 계약가를 구분)
 * 반환: { baseDate: "YYYY-MM-DD", deals: [{ dealDate, price, rent?, floor }] }  (가격 만원, 날짜 오름차순)
 *  매매: price = 매매가 · 전세: price = 보증금 · 월세: price = 보증금, rent = 월세
 */
export async function getDeals(id, months = 12) {
  if (liveId(id)) {
    const apt = await getApartment(id);
    const trades = await live.getLiveTrades(id, {
      startDate: monthsAgo(months),
      minArea: apt.areaM2 ? Math.floor(apt.areaM2 - 1) : undefined,
      maxArea: apt.areaM2 ? Math.ceil(apt.areaM2 + 1) : undefined,
    });
    const deals = trades.map((t) => ({ dealDate: t.soldDate, price: t.soldPrice, floor: t.soldFloor })).reverse();
    return { baseDate: ymd(new Date()), deals };
  }
  if (USE_MOCK) return mock.getDeals(id, months);
  const apt = await getApartment(id);
  const deals = await getEstateTrades(apt, apt.dealType, months);
  return { baseDate: ymd(new Date()), deals };
}

async function getEstateTrades(apt, deal, months) {
  const { data } = await api.get('/api/trades', {
    params: cleanParams({
      estIdx: apt.estIdx,
      transactionType: toTransactionType(deal),
      startDate: monthsAgo(months),
      endDate: ymd(new Date()),
      minArea: apt.areaM2 ? Math.floor(apt.areaM2 - 1) : undefined,
      maxArea: apt.areaM2 ? Math.ceil(apt.areaM2 + 1) : undefined,
      page: 0,
      size: 500,
    }),
  });
  return itemsOf(data)
    .map(toTrade)
    .map(({ dealDate, price, rent, floor }) => ({ dealDate, price, ...(rent != null ? { rent } : {}), floor }))
    .sort((a, b) => String(a.dealDate).localeCompare(String(b.dealDate)));
}

/**
 * 빌라 전세가율 — 같은 단지·비슷한 면적의 최근 1년 매매 · 전세 실거래 중간값 (GET /api/trades 두 번)
 * 반환: { salePrice, jeonsePrice, ratio: 82.5, saleCount, jeonseCount, baseDate }  · 비교할 거래가 없으면 404
 */
export async function getJeonseRatio(id) {
  if (liveId(id)) { // 실서버엔 아직 전세 실거래가 없음
    throw Object.assign(new Error('전세가율을 계산할 거래가 없습니다.'), { response: { status: 404, data: { message: '전세가율을 계산할 거래가 없습니다.' } } });
  }
  if (USE_MOCK) return mock.getJeonseRatio(id);
  const apt = await getApartment(id);
  const [sales, jeonses] = await Promise.all([getEstateTrades(apt, 'sale', 12), getEstateTrades(apt, 'jeonse', 12)]);
  if (!sales.length || !jeonses.length) {
    throw Object.assign(new Error('전세가율을 계산할 거래가 없습니다.'), { response: { status: 404, data: { message: '전세가율을 계산할 거래가 없습니다.' } } });
  }
  const median = (xs) => {
    const s = xs.map((x) => x.price).sort((a, b) => a - b);
    return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
  };
  const salePrice = median(sales);
  const jeonsePrice = median(jeonses);
  return {
    salePrice,
    jeonsePrice,
    ratio: Math.round((jeonsePrice / salePrice) * 1000) / 10,
    saleCount: sales.length,
    jeonseCount: jeonses.length,
    baseDate: ymd(new Date()),
  };
}

/**
 * 단지 영역(필지) 테두리 — 서버 없이 정적 파일 public/data/boundaries.json 에서 읽음 (MOCK · 실서버 공통)
 * 파일: scripts/build_boundaries.py 가 연속지적도(V-World SHP)에서 매물 좌표가 속한 필지만 뽑아 만든 것 → 매물이 바뀌면 다시 실행
 * 반환: GeoJSON Polygon { type: "Polygon", coordinates: [[[경도, 위도], ...]], pnu, jibun }  · 없으면 404 (지도는 테두리 없이 표시)
 */
let boundaryFile;
const loadBoundaries = () => {
  boundaryFile ??= fetch(`${import.meta.env.BASE_URL}data/boundaries.json`)
    .then((res) => (res.ok ? res.json() : {}))
    .catch(() => ({}));
  return boundaryFile;
};
/** 테두리가 있는 매물 id 목록 (문자열 Set) — 지도에서 분홍 마커로 표시 */
export async function getBoundaryIds() {
  return new Set(Object.keys(await loadBoundaries()));
}
export async function getBoundary(id) {
  const data = (await loadBoundaries())[id];
  if (!data) {
    throw Object.assign(new Error('단지 테두리 정보가 없습니다.'), { response: { status: 404, data: { message: '단지 테두리 정보가 없습니다.' } } });
  }
  return data;
}

/**
 * POST /api/recommendations  — 맞춤 추천 (React → Spring → FastAPI /recommend)
 * 요청: { maxPrice, district, minArea, minBuiltYear }  (조건 이름 확정 필요)
 * 응답: 공개 매물 ID · 점수 · 추천 이유 → 매물 정보가 없으면 GET /api/sales/{salesIdx} 로 채움
 * 반환: (매물 & { score, reason })[] 상위 10건
 */
export async function getRecommendations(conditions = {}) {
  if (USE_MOCK) return mock.getRecommendations(cleanParams(conditions));
  const { gu, ...rest } = conditions;
  const { data } = await api.post('/api/recommendations', cleanParams({ ...rest, district: gu }));
  return Promise.all(itemsOf(data).slice(0, 10).map(async (r) => {
    const id = pick(r, 'salesIdx', 'aptId');
    const apt = r.price == null && id != null ? await getApartment(id) : toListing(r);
    return { ...apt, score: pick(r, 'score'), reason: pick(r, 'reason') };
  }));
}

/**
 * GET /api/sales/popular?limit=5  — 인기 매물 (메인 TOP 5)
 * 기준: 공개 매물만 관심 등록 수 내림차순, 동률은 매물 번호 순
 */
export async function getPopular(limit = 5) {
  if (USE_MOCK) return mock.getPopular(limit);
  const { data } = await api.get('/api/sales/popular', { params: { limit } });
  return itemsOf(data).map(toListing);
}

/**
 * GET /api/sales  — 매물찾기 (조건 검색 + 정렬 + 페이지, 아파트 매매)
 * 쿼리: adapt.toSalesParams 결과 + minBuiltYear, sort, page(0부터), size
 *  sort: recent(최신순) | priceAsc | priceDesc | ppyAsc(평당가 낮은순) | areaDesc  (서버 정렬 이름 확정 필요)
 * 응답: { items, totalCount } → { content, totalElements, totalPages, page, size }
 */
export async function searchPaged(params = {}) {
  if (isLive('estates')) { // MOCK 이면 모의 매물도 같이 섞어서 정렬·페이지
    const fake = USE_MOCK ? (await mock.searchPaged({ ...cleanParams(params), page: 0, size: 100000 })).content : [];
    return live.searchPagedLive(cleanParams(params), fake);
  }
  if (USE_MOCK) return mock.searchPaged(cleanParams(params));
  const { page = 0, size = 10 } = params;
  const { data } = await api.get('/api/sales', { params: toSalesParams({ ...params, type: 'apt', deal: 'sale', page, size }) });
  return toPage(data, { page, size });
}
