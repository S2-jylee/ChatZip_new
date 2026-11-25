import axios from 'axios';

// 서버 주소는 .env 한 곳에서만 관리합니다. (기획서 11.1)
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

/**
 * 부분 연결: MOCK 이어도 여기 적은 기능만 실서버 사용 (예: VITE_LIVE_API=estates,stats)
 *  estates = 지도 · 매물찾기 · 상세 · 실거래 (아파트 매매만) / stats = 지역별분석
 */
const LIVE = new Set(String(import.meta.env.VITE_LIVE_API ?? '').split(',').map((s) => s.trim()).filter(Boolean));
export const isLive = (feature) => LIVE.has(feature);
export const LIVE_APIS = [...LIVE];

/**
 * Spring Boot (:8080) — 세션 쿠키를 보내야 하므로 withCredentials 필수
 * CSRF: Spring CookieCsrfTokenRepository 의 XSRF-TOKEN 쿠키를 X-XSRF-TOKEN 헤더로 (포트가 달라도 보내도록 withXSRFToken)
 * AI(FastAPI)는 Spring 을 거쳐서만 호출 (정리본 "추천·예측")
 */
export const api = axios.create({
  // 비워 두면 같은 주소(/api…)로 요청 → 개발 중엔 Vite 프록시(VITE_PROXY_TARGET)가 백엔드로 넘겨 줌 (CORS 없이)
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080',
  withCredentials: true,
  withXSRFToken: true,
  timeout: 10000,
});

export function statusOf(err) {
  return err?.response?.status ?? null;
}

/** 사용자에게 보여줄 오류 문구 */
export function errorMessage(err, fallback = '요청 중 오류가 발생했습니다.') {
  const data = err?.response?.data;
  if (typeof data === 'string' && data) return data;
  if (data?.message) return data.message;
  if (typeof data?.detail === 'string') return data.detail; // FastAPI 기본 오류 형식
  if (err?.code === 'ERR_NETWORK') return '서버에 연결할 수 없습니다. 서버가 켜져 있는지 확인해 주세요.';
  if (err?.code === 'ECONNABORTED') return '응답이 너무 늦습니다. 잠시 후 다시 시도해 주세요.';
  return fallback;
}
