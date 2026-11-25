import { placeKind } from '../../constants/placeKinds';
import { shortDealPrice } from '../../utils/format';

// 세 지도(카카오 · 벡터 · Leaflet)가 같이 쓰는 마커 DOM

const esc = (s) => String(s).replace(/[<>&"]/g, '');

// 흰색 선 아이콘 (24×24) — 이모티콘 대신 지도 앱에서 흔히 쓰는 기호
const svg = (d, fill = false) => `<svg viewBox="0 0 24 24" width="14" height="14" fill="${fill ? '#fff' : 'none'}" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  // 지하철: 전동차 정면
  subway: svg('<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14"/><circle cx="8.5" cy="14" r=".6" fill="#fff"/><circle cx="15.5" cy="14" r=".6" fill="#fff"/><path d="M8 21l2-4M16 21l-2-4"/>'),
  // 버스: 옆모습 (창문 줄 + 바퀴 2개)
  bus: svg('<path d="M3 16V7a2 2 0 012-2h12.5a2 2 0 011.9 1.4L21 11v5z"/><path d="M3 11h18M8 5v6M13 5v6"/><circle cx="7.5" cy="17.5" r="1.8" fill="#fff"/><circle cx="16.5" cy="17.5" r="1.8" fill="#fff"/>'),
  // 약국: 알약(캡슐) — 반쪽은 채움
  pharmacy: svg('<g transform="rotate(-45 12 12)"><rect x="3" y="8.5" width="18" height="7" rx="3.5"/><path d="M12 8.5H6.5a3.5 3.5 0 000 7H12z" fill="#fff"/></g>'),
  // 유치원·어린이집: 쌓기 블록 (아래 2개 + 위 1개)
  kids: svg('<rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/><rect x="8" y="4" width="8" height="8" rx="1"/>'),
  // 마트: 장바구니 카트
  mart: svg('<path d="M3 4h2.5l2.2 10.5h10.6L20.5 7H7"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>'),
  // 카페: 컵
  cafe: svg('<path d="M4 9h12v5a5 5 0 01-5 5H9a5 5 0 01-5-5V9z"/><path d="M16 10h2a2.5 2.5 0 010 5h-2"/><path d="M8 3v3M12 3v3"/>'),
  // 음식점: 포크와 나이프
  food: svg('<path d="M7 3v7a2 2 0 002 2v9M11 3v7a2 2 0 01-2 2M7 3v4M11 3v4"/><path d="M17 3c-2 2-2 6 0 8v10"/>'),
  // 병원: 십자
  hospital: svg('<path d="M12 5v14M5 12h14" stroke-width="3.4"/>'),
  // 학원: 펼친 책
  academy: svg('<path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1z"/><path d="M12 6v14"/>'),
  // 문화시설: 기둥 있는 건물 (박물관·공연장)
  culture: svg('<path d="M3 9.5L12 4l9 5.5z"/><path d="M5 20h14M6 10v8M10 10v8M14 10v8M18 10v8"/>'),
};
// 한 글자 표시 (한국 지도에서 익숙한 약칭)
const TEXT = { store: '24', bank: '₩', univ: '대' };

/** 학교 이름 → 초·중·고·대 (네이버 지도처럼) */
function schoolChar(name) {
  if (/초등/.test(name)) return '초';
  if (/중학/.test(name)) return '중';
  if (/고등|고교/.test(name)) return '고';
  if (/대학/.test(name)) return '대';
  return '학';
}
const SCHOOL_COLORS = { 초: '#16A34A', 중: '#0EA5E9', 고: '#2563EB', 대: '#7C3AED', 학: '#64748B' };

/** 엠블럼 안의 기호 (svg 또는 글자) + 색 */
export function emblemOf(kindKey, name = '') {
  const kind = placeKind(kindKey);
  if (kindKey === 'school') {
    const ch = schoolChar(name);
    return { html: `<b>${ch}</b>`, color: SCHOOL_COLORS[ch] };
  }
  if (ICONS[kindKey]) return { html: ICONS[kindKey], color: kind?.color };
  return { html: `<b>${TEXT[kindKey] ?? kind?.label?.[0] ?? '•'}</b>`, color: kind?.color };
}

// 박스 안에 이름까지 보여줄 종류 (나머지는 아이콘만, 이름은 마우스 올리면)
const LABELED = new Set(['subway', 'school', 'univ']);

/** 학교 이름 줄이기: 서울도성초등학교 → 도성초, 진선여자고등학교 → 진선여고 (네이버 지도 방식) */
function shortSchool(name) {
  let n = String(name).replace(/^서울(특별시)?/, '').replace(/\s.*$/, '');
  n = n.replace(/여자고등학교$/, '여고').replace(/여자중학교$/, '여중')
    .replace(/초등학교$/, '초').replace(/중학교$/, '중').replace(/고등학교$/, '고').replace(/대학교$/, '대');
  return n.length > 8 ? `${n.slice(0, 7)}…` : n;
}

/** 주변 시설 표시 — 매물 가격 마커와 같은 형식(색 박스 + 아래 꼬리) */
export function placeHtml(place) {
  const name = esc(place.name);
  const { html, color } = emblemOf(place.kind, place.name);
  let inner;
  if (place.kind === 'school') inner = `<span class="place-label">${esc(shortSchool(place.name))}</span>`; // 이름 끝 초·중·고로 구분
  else if (LABELED.has(place.kind)) inner = `<span class="place-ico">${html}</span><span class="place-label">${name}</span>`;
  else if (place.kind === 'bus') inner = `<span class="place-ico">${html}</span>`; // 버스(예시 데이터)는 이름 말풍선 없음
  else inner = `<span class="place-ico">${html}</span><em>${name}</em>`; // 아이콘만 있는 것은 마우스 올리면 이름
  return `<div class="place-pin place-${place.kind}" style="--pc:${color ?? '#475569'}">${inner}</div>`;
}

export function placeEl(place) {
  const wrap = document.createElement('div');
  wrap.className = 'place-anchor';
  wrap.innerHTML = placeHtml(place);
  return wrap;
}

/** 가격 마커 클래스 — 본 매물은 viewed, 실서버(백엔드)에서 온 매물은 is-live (노란색) */
export const pinClass = (tier, viewed, live) => `map-pin tier-${tier}${viewed ? ' viewed' : ''}${live ? ' is-live' : ''}`;

/** 가격 마커 내용: 위 "35평"(전용면적 기준) · 아래 "10.3억" (월세는 "500/45") */
export function pinHtml(apt) {
  const py = Math.round(Number(apt.areaM2) / 3.3058);
  return `<span class="pin-py">${py}평</span><span class="pin-price">${shortDealPrice(apt)}</span>`;
}
