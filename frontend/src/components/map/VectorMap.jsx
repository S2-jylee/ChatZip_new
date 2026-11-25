import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './VectorMap.css';
import { tierOf } from '../../utils/format';
import { pinClass, pinHtml, placeEl } from './markerEls';
import { SERVICE_CENTER } from '../../constants/regions';

// 카카오 키가 없을 때 쓰는 단순화된 지도 (OpenFreeMap 벡터 타일, 키 불필요)
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
// 위성 사진 (Esri World Imagery, 키 불필요) — 도로·지명 라벨은 위에 그대로 표시
const SAT_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const CENTER = [SERVICE_CENTER.lng, SERVICE_CENTER.lat]; // [경도, 위도] 순서 주의

// 지도를 단순하게: 숨길 레이어 (가게 아이콘 · 3D 건물 · 도로 번호 · 일방통행 화살표 등)
const HIDE = /^(poi_|building-3d|natural_earth|highway-shield|road_shield|road_one_way|.*hatching|road_area_pattern)/;

// 네이버 지도 느낌의 밝은 색
const PAINT = {
  background: { 'background-color': '#f8f7f4' },
  landuse_residential: { 'fill-color': '#f3f1ec', 'fill-opacity': 1 },
  park: { 'fill-color': '#dcefd6', 'fill-opacity': 1 },
  landcover_grass: { 'fill-color': '#e2f1dc', 'fill-opacity': 1 },
  landcover_wood: { 'fill-color': '#d3eacb', 'fill-opacity': 1 },
  water: { 'fill-color': '#c4e0f7' },
  waterway_river: { 'line-color': '#c4e0f7' },
  building: { 'fill-color': '#eceae5', 'fill-outline-color': '#e2dfd8' },
};

function simplifyStyle(map) {
  const label = ['coalesce', ['get', 'name:ko'], ['get', 'name:nonlatin'], ['get', 'name']];
  const layers = map.getStyle().layers;
  layers.forEach((layer) => {
    if (HIDE.test(layer.id)) {
      map.setLayoutProperty(layer.id, 'visibility', 'none');
      return;
    }
    // 라벨을 한글 이름으로
    const text = layer.layout?.['text-field'];
    if (text && JSON.stringify(text).includes('name')) map.setLayoutProperty(layer.id, 'text-field', label);
    Object.entries(PAINT[layer.id] ?? {}).forEach(([k, v]) => map.setPaintProperty(layer.id, k, v));
  });
  // 위성 레이어: 첫 라벨 레이어 바로 아래에 넣어 두고 visibility 로 켜고 끔
  if (!map.getSource('sat')) {
    map.addSource('sat', { type: 'raster', tiles: [SAT_TILES], tileSize: 256, maxzoom: 19, attribution: 'Imagery © Esri' });
    const firstSymbol = layers.find((l) => l.type === 'symbol')?.id;
    map.addLayer({ id: 'sat', type: 'raster', source: 'sat', layout: { visibility: 'none' } }, firstSymbol);
  }
}

/** LeafletMap · KakaoMap 과 같은 props. WebGL 미지원 등으로 실패하면 onFail 호출 */
export default function VectorMap({
  apartments, activeId, selectedId, onSelect, onBoundsChange, interactive = true, maxZoom = 15, onFail, popup, onPinHover,
  mapType = 'road', places = [], viewedIds, boundaryIds, boundary, boundaryPadding,
}) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const [popupEl] = useState(() => document.createElement('div'));
  const markersRef = useRef(new Map()); // aptId → { marker, pin, wrap }
  const placeMarkersRef = useRef([]);
  const cbRef = useRef({});
  cbRef.current = { onSelect, onBoundsChange, onFail, onPinHover };
  const [ready, setReady] = useState(false);
  const [styleReady, setStyleReady] = useState(false);

  // 지도 생성
  useEffect(() => {
    let map;
    try {
      map = new maplibregl.Map({
        container: elRef.current,
        style: STYLE_URL,
        center: CENTER,
        zoom: 10.5,
        interactive,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        localIdeographFontFamily: "'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif",
      });
    } catch {
      cbRef.current.onFail?.();
      return undefined;
    }
    if (interactive) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.touchZoomRotate?.disableRotation();
    map.on('style.load', () => { simplifyStyle(map); setStyleReady(true); });
    map.on('click', () => cbRef.current.onSelect?.(null)); // 빈 곳 클릭 → 팝업 닫기
    map.on('dragstart', () => cbRef.current.onPinHover?.(null)); // 드래그 시작 → 미리보기 닫기
    map.on('moveend', () => {
      const b = map.getBounds();
      cbRef.current.onBoundsChange?.({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });
    });
    mapRef.current = map;
    setReady(true);

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(elRef.current);
    return () => {
      ro.disconnect();
      markersRef.current.clear();
      placeMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
      setReady(false);
      setStyleReady(false);
    };
  }, [interactive]);

  // 일반 / 위성 지도
  useEffect(() => {
    const map = mapRef.current;
    if (!styleReady || !map?.getLayer('sat')) return;
    map.setLayoutProperty('sat', 'visibility', mapType === 'satellite' ? 'visible' : 'none');
  }, [mapType, styleReady]);

  // 주변 시설 아이콘
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    placeMarkersRef.current.forEach((m) => m.remove());
    placeMarkersRef.current = places.map((p) => new maplibregl.Marker({ element: placeEl(p), anchor: 'bottom' })
      .setLngLat([p.lng, p.lat])
      .addTo(map));
  }, [places, ready]);

  // 가격 마커 다시 그리기 + 전체가 보이도록 맞춤
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current.clear();
    if (!apartments.length) return;

    const bounds = new maplibregl.LngLatBounds();
    apartments.forEach((apt) => {
      const wrap = document.createElement('div');
      wrap.className = 'pin-ml';
      const pin = document.createElement('div');
      pin.className = pinClass(tierOf(apt.price), false, apt.live);
      pin.title = apt.name;
      pin.innerHTML = pinHtml(apt);
      wrap.appendChild(pin);
      wrap.addEventListener('click', (e) => { e.stopPropagation(); cbRef.current.onSelect?.(apt); });
      wrap.addEventListener('mouseenter', (e) => { if (!e.buttons) cbRef.current.onPinHover?.(apt); }); // 마우스 올리면 팝업 (드래그 중엔 X)
      wrap.addEventListener('mouseleave', () => cbRef.current.onPinHover?.(null));

      const marker = new maplibregl.Marker({ element: wrap, anchor: 'bottom', offset: [0, -6] })
        .setLngLat([apt.lng, apt.lat]) // 주의: [경도, 위도]
        .addTo(map);
      markersRef.current.set(apt.aptId, { marker, pin, wrap });
      bounds.extend([apt.lng, apt.lat]);
    });
    map.fitBounds(bounds, { padding: 56, maxZoom, duration: 0 });
  }, [apartments, ready, maxZoom]);

  // 강조 표시 (목록 hover · 선택된 매물) + 본 매물
  useEffect(() => {
    markersRef.current.forEach(({ pin, wrap }, id) => {
      const on = id === activeId || id === selectedId;
      pin.classList.toggle('active', on);
      pin.classList.toggle('viewed', Boolean(viewedIds?.has(id)));
      pin.classList.toggle('has-boundary', Boolean(boundaryIds?.has(String(id))));
      wrap.style.zIndex = on ? '10' : '1';
    });
  }, [activeId, selectedId, apartments, ready, viewedIds, boundaryIds]);

  // 단지 영역 테두리 (클릭한 매물) + 그 영역으로 확대
  useEffect(() => {
    const map = mapRef.current;
    if (!styleReady || !map) return undefined;
    const data = boundary ? { type: 'Feature', geometry: boundary, properties: {} } : { type: 'FeatureCollection', features: [] };
    if (map.getSource('boundary')) map.getSource('boundary').setData(data);
    else {
      map.addSource('boundary', { type: 'geojson', data });
      map.addLayer({ id: 'boundary-fill', type: 'fill', source: 'boundary', paint: { 'fill-color': '#F47B20', 'fill-opacity': 0.12 } });
      map.addLayer({ id: 'boundary-line', type: 'line', source: 'boundary', paint: { 'line-color': '#F47B20', 'line-width': 2.5 } });
    }
    if (boundary) {
      const b = new maplibregl.LngLatBounds();
      boundary.coordinates[0].forEach((c) => b.extend(c));
      map.fitBounds(b, { padding: boundaryPadding ?? { top: 140, bottom: 80, left: 80, right: 80 }, maxZoom: 18, duration: 600 });
    }
    return undefined;
  }, [boundary, styleReady]);

  // 선택한 매물 위치에 팝업. anchor 를 지정하지 않으면 화면 공간에 맞춰 위/아래/좌/우를 자동 선택
  const hasPopup = Boolean(popup);
  useEffect(() => {
    const map = mapRef.current;
    const apt = apartments.find((a) => a.aptId === selectedId);
    if (!ready || !map || !apt || !hasPopup) return undefined;
    const p = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: 'none',
      className: 'map-popup',
      // 마커(가격 말풍선) 높이만큼 띄우기
      offset: {
        bottom: [0, -46], top: [0, 6], left: [22, -24], right: [-22, -24],
        'bottom-left': [8, -46], 'bottom-right': [-8, -46], 'top-left': [8, 6], 'top-right': [-8, 6],
      },
    })
      .setLngLat([apt.lng, apt.lat])
      .setDOMContent(popupEl)
      .addTo(map);
    return () => { p.remove(); };
  }, [selectedId, apartments, ready, hasPopup, popupEl]);

  return (
    <>
      <div ref={elRef} className="map" />
      {popup && selectedId != null && createPortal(<div className="map-popup-body">{popup}</div>, popupEl)}
    </>
  );
}
