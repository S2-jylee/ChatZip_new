import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './LeafletMap.css';
import { tierOf } from '../../utils/format';
import { pinClass, pinHtml, placeHtml } from './markerEls';
import { SERVICE_CENTER } from '../../constants/regions';

// WebGL 이 안 될 때 쓰는 예비 지도 (Esri 타일, 키 불필요 · 한글 지명 표시)
// ※ CARTO 타일은 API 키가 필요해져서("API KEY REQUIRED") 사용하지 않음
// ※ Esri 타일 주소는 {z}/{y}/{x} 순서 (y 가 먼저)
const ROAD_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
const SAT_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ATTRIBUTION = 'Tiles &copy; <a href="https://www.esri.com/">Esri</a>';
const CENTER = [SERVICE_CENTER.lat, SERVICE_CENTER.lng];

export default function LeafletMap({
  apartments, activeId, selectedId, onSelect, onBoundsChange, interactive = true, maxZoom = 15, popup, onPinHover,
  mapType = 'road', places = [], viewedIds, boundaryIds, boundary, boundaryPadding,
}) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const tileRef = useRef(null);
  const placeLayerRef = useRef(null);
  const [popupEl] = useState(() => document.createElement('div'));
  const cbRef = useRef({});
  cbRef.current = { onSelect, onBoundsChange, onPinHover, viewedIds };
  const [ready, setReady] = useState(false);

  const reportBounds = () => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    cbRef.current.onBoundsChange?.({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });
  };

  // 지도 생성 (한 번)
  useEffect(() => {
    const map = L.map(elRef.current, {
      center: CENTER,
      zoom: 11,
      zoomControl: interactive,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
      keyboard: interactive,
    });
    if (interactive) map.zoomControl.setPosition('bottomright');
    placeLayerRef.current = L.layerGroup().addTo(map);
    map.on('moveend', reportBounds);
    map.on('click', () => cbRef.current.onSelect?.(null)); // 빈 곳 클릭 → 팝업 닫기
    map.on('dragstart', () => cbRef.current.onPinHover?.(null)); // 드래그 시작 → 미리보기 닫기
    mapRef.current = map;
    setReady(true);

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(elRef.current);
    return () => {
      ro.disconnect();
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive]);

  // 일반 / 위성 지도
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    tileRef.current?.remove();
    tileRef.current = mapType === 'satellite'
      ? L.tileLayer(SAT_URL, { attribution: ATTRIBUTION, maxZoom: 19 })
      : L.tileLayer(ROAD_URL, { attribution: ATTRIBUTION, maxZoom: 19, className: 'map-tiles-soft' });
    tileRef.current.addTo(map).bringToBack();
  }, [mapType, ready]);

  // 주변 시설 아이콘
  useEffect(() => {
    const layer = placeLayerRef.current;
    if (!ready || !layer) return;
    layer.clearLayers();
    places.forEach((p) => {
      const icon = L.divIcon({ className: 'place-anchor', html: placeHtml(p), iconSize: null });
      L.marker([p.lat, p.lng], { icon, keyboard: false, zIndexOffset: -500, riseOnHover: true }).addTo(layer);
    });
  }, [places, ready]);

  // 매물 마커 다시 그리기 + 전체가 보이도록 맞춤
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();
    if (!apartments.length) return;

    apartments.forEach((apt) => {
      const icon = L.divIcon({
        className: 'pin-anchor',
        html: `<div class="${pinClass(tierOf(apt.price), cbRef.current.viewedIds?.has(apt.aptId), apt.live)}">${pinHtml(apt)}</div>`,
        iconSize: null,
      });
      const marker = L.marker([apt.lat, apt.lng], { icon, title: apt.name, riseOnHover: true }).addTo(map);
      marker.on('click', () => cbRef.current.onSelect?.(apt));
      marker.on('mouseover', (e) => { if (!e.originalEvent?.buttons) cbRef.current.onPinHover?.(apt); }); // 마우스 올리면 팝업 (드래그 중엔 X)
      marker.on('mouseout', () => cbRef.current.onPinHover?.(null));
      markersRef.current.set(apt.aptId, marker);
    });
    map.fitBounds(L.latLngBounds(apartments.map((a) => [a.lat, a.lng])), { padding: [48, 48], maxZoom });
    reportBounds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apartments, maxZoom, ready]);

  // 강조 표시 (목록 hover · 선택된 매물) + 본 매물
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const on = id === activeId || id === selectedId;
      const pin = marker.getElement()?.querySelector('.map-pin');
      pin?.classList.toggle('active', on);
      pin?.classList.toggle('viewed', Boolean(viewedIds?.has(id)));
      pin?.classList.toggle('has-boundary', Boolean(boundaryIds?.has(String(id))));
      marker.setZIndexOffset(on ? 1000 : 0);
    });
  }, [activeId, selectedId, apartments, viewedIds, boundaryIds, ready]);

  // 단지 영역 테두리 (클릭한 매물) + 그 영역으로 확대
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !boundary) return undefined;
    const latlngs = boundary.coordinates[0].map(([lng, lat]) => [lat, lng]);
    const poly = L.polygon(latlngs, { color: '#F47B20', weight: 2.5, fillColor: '#F47B20', fillOpacity: 0.12 }).addTo(map);
    map.fitBounds(poly.getBounds(), { paddingTopLeft: [boundaryPadding?.left ?? 80, boundaryPadding?.top ?? 140], paddingBottomRight: [boundaryPadding?.right ?? 80, boundaryPadding?.bottom ?? 80], maxZoom: 18 });
    return () => poly.remove();
  }, [boundary, ready]);

  // 선택한 매물 위치에 팝업
  const hasPopup = Boolean(popup);
  useEffect(() => {
    const map = mapRef.current;
    const apt = apartments.find((a) => a.aptId === selectedId);
    if (!ready || !map || !apt || !hasPopup) return undefined;
    const p = L.popup({
      closeButton: false, closeOnClick: false, autoPan: false,
      maxWidth: 400, offset: [0, -34], className: 'map-popup-leaflet',
    })
      .setLatLng([apt.lat, apt.lng])
      .setContent(popupEl)
      .openOn(map);
    return () => { p.remove(); };
  }, [selectedId, apartments, hasPopup, popupEl, ready]);

  return (
    <>
      <div ref={elRef} className="map" />
      {popup && selectedId != null && createPortal(<div className="map-popup-body">{popup}</div>, popupEl)}
    </>
  );
}
