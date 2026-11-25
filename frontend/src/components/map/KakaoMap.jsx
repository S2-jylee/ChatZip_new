import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { loadKakaoMap } from '../../utils/kakaoLoader';
import { tierOf } from '../../utils/format';
import { pinClass, pinHtml, placeEl } from './markerEls';
import { attachTouchFallback } from './touchFallback';
import { SERVICE_CENTER } from '../../constants/regions';

const CENTER = SERVICE_CENTER;

/** 카카오맵 — VectorMap · LeafletMap 과 같은 props 를 받습니다. 로드 실패 시 onFail 호출 */
export default function KakaoMap({
  apartments, activeId, selectedId, onSelect, onBoundsChange, interactive = true, onFail, popup, onPinHover,
  mapType = 'road', places = [], viewedIds, boundaryIds, boundary, boundaryPadding,
}) {
  const elRef = useRef(null);
  const [popupEl] = useState(() => {
    const el = document.createElement('div');
    el.className = 'map-popup-kakao';
    // 팝업 안 클릭/스크롤이 지도로 전달되지 않게
    ['mousedown', 'touchstart', 'wheel', 'click'].forEach((t) => el.addEventListener(t, (e) => e.stopPropagation()));
    return el;
  });
  const mapRef = useRef(null);
  const overlaysRef = useRef(new Map()); // aptId → { overlay, el }
  const placeOverlaysRef = useRef([]);
  const cbRef = useRef({});
  cbRef.current = { onSelect, onBoundsChange, onFail, onPinHover };
  const [ready, setReady] = useState(false);

  // 1) SDK 로드 후 지도 생성
  useEffect(() => {
    let cancelled = false;
    let ro;
    let detachTouch;
    loadKakaoMap()
      .then((kakao) => {
        if (cancelled || !elRef.current) return;
        elRef.current.innerHTML = ''; // 이전 지도(코드 수정 시 자동 갱신으로 남은 것)가 겹치지 않게 비우고 생성
        const map = new kakao.maps.Map(elRef.current, {
          center: new kakao.maps.LatLng(CENTER.lat, CENTER.lng),
          level: 8,
          draggable: interactive,
          scrollwheel: interactive,
          disableDoubleClickZoom: !interactive,
        });
        // 확대/축소: 카카오 기본 컨트롤 대신 오른쪽 세로 버튼(map-rail)과 같은 줄에 맞춘 자체 버튼 사용 (아래 map-zoom)
        kakao.maps.event.addListener(map, 'idle', () => {
          const b = map.getBounds();
          const sw = b.getSouthWest();
          const ne = b.getNorthEast();
          cbRef.current.onBoundsChange?.({ south: sw.getLat(), west: sw.getLng(), north: ne.getLat(), east: ne.getLng() });
        });
        kakao.maps.event.addListener(map, 'click', () => cbRef.current.onSelect?.(null)); // 빈 곳 클릭 → 팝업 닫기
        kakao.maps.event.addListener(map, 'dragstart', () => cbRef.current.onPinHover?.(null)); // 드래그 시작 → 미리보기 닫기
        mapRef.current = map;
        // 태블릿 웨일(PC 버전 접속) 등 카카오가 손가락 드래그를 안 받는 기기 보완
        if (interactive) detachTouch = attachTouchFallback(kakao, map, elRef.current);
        // 웨일 PC: 지도 타일(img)을 마우스로 끌면 웨일 "슈퍼 드래그"(끌어서 검색·열기)가 브라우저 기본 끌기를 시작해
        // 카카오가 마우스 움직임을 못 받음 → 지도 안에서 시작되는 기본 끌기·글자 선택을 아예 막음 (카카오 드래그는 마우스 이벤트라 영향 없음)
        const el = elRef.current;
        const stopNative = (e) => e.preventDefault();
        el.addEventListener('dragstart', stopNative, true);
        el.addEventListener('selectstart', stopNative, true);
        const prevDetach = detachTouch;
        detachTouch = () => { prevDetach?.(); el.removeEventListener('dragstart', stopNative, true); el.removeEventListener('selectstart', stopNative, true); };
        // 컨테이너 크기가 바뀌면(사이드바 접기 등) 지도 다시 맞춤 — 카카오는 자동으로 안 함
        ro = new ResizeObserver(() => map.relayout());
        ro.observe(elRef.current);
        setReady(true);
      })
      .catch(() => { if (!cancelled) cbRef.current.onFail?.(); });
    return () => {
      cancelled = true;
      ro?.disconnect();
      detachTouch?.();
      // 카카오맵은 지도 삭제 기능이 없어 DOM 을 직접 비움 → 다시 만들 때 지도가 여러 겹 쌓이지 않음
      if (elRef.current) elRef.current.innerHTML = '';
      mapRef.current = null;
      overlaysRef.current.clear();
      placeOverlaysRef.current = [];
      setReady(false);
    };
  }, [interactive]);

  // 일반 / 위성(스카이뷰 + 도로·지명) 지도
  useEffect(() => {
    if (!ready) return;
    const { MapTypeId } = window.kakao.maps;
    mapRef.current.setMapTypeId(mapType === 'satellite' ? MapTypeId.HYBRID : MapTypeId.ROADMAP);
  }, [mapType, ready]);

  // 주변 시설 아이콘
  useEffect(() => {
    if (!ready) return;
    const { kakao } = window;
    placeOverlaysRef.current.forEach((o) => o.setMap(null));
    placeOverlaysRef.current = places.map((p) => {
      const content = placeEl(p);
      const o = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(p.lat, p.lng), content, yAnchor: 1, zIndex: 0 });
      // 겹쳐 있을 때 마우스를 올린 것이 맨 앞으로
      content.addEventListener('mouseenter', () => o.setZIndex(30));
      content.addEventListener('mouseleave', () => o.setZIndex(0));
      o.setMap(mapRef.current);
      return o;
    });
  }, [places, ready]);

  // 2) 마커(가격 말풍선) 다시 그리기
  useEffect(() => {
    if (!ready) return;
    const { kakao } = window;
    const map = mapRef.current;
    overlaysRef.current.forEach(({ overlay }) => overlay.setMap(null));
    overlaysRef.current.clear();
    if (!apartments.length) return;

    const bounds = new kakao.maps.LatLngBounds();
    apartments.forEach((apt) => {
      // 주의: LatLng(위도 lat ≈ 37, 경도 lng ≈ 127) 순서 (기획서 11.2)
      const position = new kakao.maps.LatLng(apt.lat, apt.lng);
      const el = document.createElement('div');
      el.className = pinClass(tierOf(apt.price), false, apt.live);
      el.title = apt.name;
      el.innerHTML = pinHtml(apt);
      const wrap = document.createElement('div');
      wrap.className = 'pin-k'; // 아래 여백 = 꼬리 높이 → yAnchor 1 이면 꼬리 끝이 좌표
      wrap.appendChild(el);
      el.addEventListener('click', () => cbRef.current.onSelect?.(apt));
      el.addEventListener('mouseenter', (e) => { if (!e.buttons) cbRef.current.onPinHover?.(apt); }); // 마우스 올리면 팝업 (드래그 중엔 X)
      el.addEventListener('mouseleave', () => cbRef.current.onPinHover?.(null));
      const overlay = new kakao.maps.CustomOverlay({ position, content: wrap, yAnchor: 1, clickable: true });
      overlay.setMap(map);
      // 겹쳐 있을 때 마우스를 올린 것이 맨 앞으로 (벗어나면 원래 순서)
      el.addEventListener('mouseenter', () => overlay.setZIndex(40));
      el.addEventListener('mouseleave', () => overlay.setZIndex(el.classList.contains('active') ? 10 : 1));
      overlaysRef.current.set(apt.aptId, { overlay, el });
      bounds.extend(position);
    });
    if (apartments.length === 1) {
      map.setLevel(3);
      map.setCenter(bounds.getSouthWest());
    } else {
      map.setBounds(bounds);
    }
  }, [apartments, ready]);

  // 3) 강조 표시 + 본 매물
  useEffect(() => {
    overlaysRef.current.forEach(({ overlay, el }, id) => {
      const on = id === activeId || id === selectedId;
      el.classList.toggle('active', on);
      el.classList.toggle('viewed', Boolean(viewedIds?.has(id)));
      el.classList.toggle('has-boundary', Boolean(boundaryIds?.has(String(id))));
      overlay.setZIndex(on ? 10 : 1);
    });
  }, [activeId, selectedId, apartments, ready, viewedIds, boundaryIds]);

  // 단지 영역 테두리 (클릭한 매물) + 그 영역으로 확대
  useEffect(() => {
    if (!ready || !boundary) return undefined;
    const { kakao } = window;
    const ring = boundary.coordinates[0]; // GeoJSON: [경도, 위도]
    const path = ring.map(([lng, lat]) => new kakao.maps.LatLng(lat, lng));
    const polygon = new kakao.maps.Polygon({
      path, strokeWeight: 2.5, strokeColor: '#F47B20', strokeOpacity: 0.95, fillColor: '#F47B20', fillOpacity: 0.1,
    });
    polygon.setMap(mapRef.current);
    const b = new kakao.maps.LatLngBounds();
    path.forEach((p) => b.extend(p));
    const pad = boundaryPadding ?? { top: 120, right: 80, bottom: 80, left: 80 };
    mapRef.current.setBounds(b, pad.top, pad.right, pad.bottom, pad.left);
    return () => polygon.setMap(null);
  }, [boundary, ready]);

  // 선택한 매물 위치에 팝업 (마커 바로 위)
  const hasPopup = Boolean(popup);
  useEffect(() => {
    const map = mapRef.current;
    const apt = apartments.find((a) => a.aptId === selectedId);
    if (!ready || !map || !apt || !hasPopup) return undefined;
    const { kakao } = window;
    const position = new kakao.maps.LatLng(apt.lat, apt.lng);
    const overlay = new kakao.maps.CustomOverlay({ position, content: popupEl, yAnchor: 1, clickable: true, zIndex: 100 });
    overlay.setMap(map);
    // 카카오가 감싸는 바깥 div 도 마우스 통과 (마커를 덮어 깜빡이는 문제 방지) — DOM 이 붙은 다음 프레임에 지정
    const raf = requestAnimationFrame(() => {
      if (popupEl.parentElement) popupEl.parentElement.style.pointerEvents = 'none';
    });
    return () => { cancelAnimationFrame(raf); overlay.setMap(null); };
  }, [selectedId, apartments, ready, hasPopup, popupEl]);

  return (
    <>
      <div ref={elRef} className="map" />
      {!ready && <div className="map-loading">지도를 불러오는 중…</div>}
      {interactive && ready && (
        <div className="map-zoom" role="group" aria-label="지도 확대/축소">
          <button type="button" className="rail-btn" title="확대" aria-label="확대"
            onClick={() => mapRef.current?.setLevel(mapRef.current.getLevel() - 1, { animate: true })}>+</button>
          <button type="button" className="rail-btn" title="축소" aria-label="축소"
            onClick={() => mapRef.current?.setLevel(mapRef.current.getLevel() + 1, { animate: true })}>−</button>
        </div>
      )}
      {popup && selectedId != null && createPortal(<div className="map-popup-body">{popup}</div>, popupEl)}
    </>
  );
}
