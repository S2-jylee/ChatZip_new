import { api, isLive, USE_MOCK } from './client';
import { itemsOf, monthsAgo, pick, toPropertyType, toTrade, toTransactionType, ymd } from './adapt';
import * as mock from './mock';
import { loadAll, toLiveTrade } from './estates';

const PY = 3.3058;
const avg = (xs) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0);
const perPyeong = (price, areaM2) => price / (areaM2 / PY);
// 아파트 매매 · 최근 12개월 (메인 · 지역별분석 기준)
const period = () => ({
  propertyType: toPropertyType('apt'),
  transactionType: toTransactionType('sale'),
  startDate: monthsAgo(12),
  endDate: ymd(new Date()),
});

/**
 * GET /api/stats/regions  — 지역별 통계 (Spring 에서 DB 집계)
 * 요청: 지역 · 기간 · 지표 → 응답: 지역별 평균 · 표본 수 · 단위
 * 반환: [{ gu, count, avgPrice, avgPerPyeong, minPrice, maxPrice }]   (만원, 평당가 = 가격 ÷ (전용㎡ ÷ 3.3058))
 */
export async function getGuStats() {
  if (isLive('stats')) {
    const real = await liveGuStats();
    if (!USE_MOCK) return real;
    // 실서버에 없는 구는 모의 통계로 채움
    const fake = (await mock.getGuStats()).filter((m) => !real.some((r) => r.gu === m.gu));
    return [...real.map((r) => ({ ...r, live: true })), ...fake].sort((x, y) => y.avgPerPyeong - x.avgPerPyeong);
  }
  if (USE_MOCK) return mock.getGuStats();
  const { data } = await api.get('/api/stats/regions', { params: period() });
  return itemsOf(data)
    .map((r) => ({
      gu: pick(r, 'district', 'region', 'regionName', 'gu'),
      count: pick(r, 'count', 'sampleCount') ?? 0,
      avgPrice: pick(r, 'avgPrice', 'average'),
      avgPerPyeong: pick(r, 'avgPerPyeong') ?? Math.round((pick(r, 'avgPricePerM2') ?? 0) * PY),
      minPrice: pick(r, 'minPrice', 'min'),
      maxPrice: pick(r, 'maxPrice', 'max'),
    }))
    .sort((x, y) => y.avgPerPyeong - x.avgPerPyeong);
}

const AREA_BANDS = [['60㎡ 이하', 0, 60], ['60~85㎡', 60, 85], ['85~102㎡', 85, 102], ['102㎡ 초과', 102, Infinity]];
const AGE_BANDS = [['5년 이내', 0, 5], ['6~10년', 6, 10], ['11~20년', 11, 20], ['20년 초과', 21, Infinity]];

/**
 * 한 구의 상세 통계 — GET /api/stats/regions (순위 · 전체 지역 평균) + GET /api/trades?district= (구간별 · 최근 거래)
 * 반환: {
 *   gu, count, avgPrice, avgPerPyeong, avgBuiltYear, seoulAvgPerPyeong, rank, totalGu,  // rank = 평당가 순위 (1 = 가장 비쌈)
 *   byArea:  [{ label: '60㎡ 이하', count, avgPrice, avgPerPyeong }],          // 소형 · 중소형 · 중형 · 대형
 *   byAge:   [{ label: '5년 이내', count, avgPerPyeong }],                     // 준공 경과연수 구간
 *   recent:  최근 거래 5건
 * }  · 없는 구면 404
 */
export async function getGuDetail(gu) {
  if (isLive('stats')) {
    try {
      return await liveGuDetail(gu);
    } catch (err) {
      if (!USE_MOCK || err?.response?.status !== 404) throw err;
    }
  }
  if (USE_MOCK) return mock.getGuDetail(gu);
  const [all, { data }] = await Promise.all([
    getGuStats(),
    api.get('/api/trades', { params: { ...period(), district: gu, sort: 'dealDate,desc', page: 0, size: 1000 } }),
  ]);
  const row = all.find((s) => s.gu === gu);
  if (!row) {
    throw Object.assign(new Error('해당 구의 거래가 없습니다.'), { response: { status: 404, data: { message: '해당 구의 거래가 없습니다.' } } });
  }
  const trades = itemsOf(data).map(toTrade).filter((t) => t.price && t.areaM2);
  const year = new Date().getFullYear();
  const band = (rows, value) => rows.map(([label, lo, hi]) => {
    const xs = trades.filter((t) => value(t) >= lo && value(t) <= hi);
    return { label, count: xs.length, avgPrice: avg(xs.map((t) => t.price)), avgPerPyeong: avg(xs.map((t) => perPyeong(t.price, t.areaM2))) };
  });
  const total = all.reduce((s, r) => s + r.count, 0);
  return {
    ...row,
    rank: all.indexOf(row) + 1,
    totalGu: all.length,
    avgBuiltYear: avg(trades.filter((t) => t.builtYear).map((t) => t.builtYear)),
    seoulAvgPerPyeong: total ? Math.round(all.reduce((s, r) => s + r.avgPerPyeong * r.count, 0) / total) : 0,
    byArea: band(AREA_BANDS, (t) => t.areaM2),
    byAge: band(AGE_BANDS, (t) => (t.builtYear ? year - t.builtYear : -1)),
    recent: trades.slice(0, 5),
  };
}

// ---- 실서버 (VITE_LIVE_API 에 stats) ----
// GET /api/stats/regions 는 { city, district, tradeCount, averagePrice } 뿐(면적 없음) →
// 평당가 · 최저/최고 · 구간별 통계는 실거래 전체(GET /api/trades)를 단지(GET /api/estates)와 이어서 화면에서 계산
async function liveTrades() {
  const { estateById, trades } = await loadAll();
  return trades.map((t) => toLiveTrade(t, estateById.get(t.estIdx))).filter((t) => t.gu && t.price && t.areaM2);
}

async function liveGuStats() {
  const [{ data }, trades] = await Promise.all([api.get('/api/stats/regions'), liveTrades()]);
  return itemsOf(data)
    .map((r) => {
      const gu = [r.city, r.district].filter(Boolean).join(' ');
      const xs = trades.filter((t) => t.gu === gu);
      const prices = xs.map((t) => t.price);
      return {
        gu,
        count: r.tradeCount ?? xs.length,
        avgPrice: Math.round(r.averagePrice ?? avg(prices)),
        avgPerPyeong: avg(xs.map((t) => perPyeong(t.price, t.areaM2))),
        minPrice: prices.length ? Math.min(...prices) : null,
        maxPrice: prices.length ? Math.max(...prices) : null,
      };
    })
    .sort((x, y) => y.avgPerPyeong - x.avgPerPyeong);
}

async function liveGuDetail(gu) {
  const [all, trades] = await Promise.all([getGuStats(), liveTrades()]);
  const row = all.find((s) => s.gu === gu);
  const list = trades.filter((t) => t.gu === gu);
  if (!row || !list.length) {
    throw Object.assign(new Error('해당 구의 거래가 없습니다.'), { response: { status: 404, data: { message: '해당 구의 거래가 없습니다.' } } });
  }
  const year = new Date().getFullYear();
  const band = (rows, value) => rows.map(([label, lo, hi]) => {
    const xs = list.filter((t) => value(t) >= lo && value(t) <= hi);
    return { label, count: xs.length, avgPrice: avg(xs.map((t) => t.price)), avgPerPyeong: avg(xs.map((t) => perPyeong(t.price, t.areaM2))) };
  });
  return {
    ...row,
    rank: all.indexOf(row) + 1,
    totalGu: all.length,
    avgBuiltYear: avg(list.filter((t) => t.builtYear).map((t) => t.builtYear)),
    // 전체 지역 평균 = 화면 순위에 나온 모든 구(모의 포함)의 거래 수 가중 평균
    seoulAvgPerPyeong: Math.round(all.reduce((s, r) => s + r.avgPerPyeong * r.count, 0) / (all.reduce((s, r) => s + r.count, 0) || 1)),
    byArea: band(AREA_BANDS, (t) => t.areaM2),
    byAge: band(AGE_BANDS, (t) => (t.builtYear ? year - t.builtYear : -1)),
    recent: list.slice(0, 5),
  };
}
