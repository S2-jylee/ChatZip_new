import { useEffect, useRef } from 'react';
import FavoriteButton from '../FavoriteButton';
import { dealLabel, formatArea, formatDate, formatDealPrice, stationText } from '../../utils/format';

/**
 * 마커에 마우스를 올리면 뜨는 말풍선 — 매물 요약 + 찜(하트) 버튼
 * onEnter/onLeave: 말풍선 위로 마우스를 옮겨도 닫히지 않게 (하트를 누를 수 있도록)
 *   ※ 카카오맵이 지도 위 마우스 이벤트를 막아 React onMouseEnter 가 안 오므로 브라우저 이벤트를 직접 연결
 */
export default function MapTooltip({ apt, onEnter, onLeave, onDetail }) {
  const ref = useRef(null);
  const cb = useRef({});
  cb.current = { onEnter, onLeave };

  useEffect(() => {
    const el = ref.current;
    const enter = () => cb.current.onEnter?.();
    const leave = () => cb.current.onLeave?.();
    el.addEventListener('mouseenter', enter);
    el.addEventListener('mouseleave', leave);
    return () => { el.removeEventListener('mouseenter', enter); el.removeEventListener('mouseleave', leave); };
  }, []);

  return (
    <div className="map-tip" ref={ref}>
      <div className="map-tip-head">
        <span className="map-tip-region">{apt.gu} {apt.dong}</span>
        <FavoriteButton aptId={apt.aptId} icon />
      </div>
      <strong className="map-tip-name">{apt.name}</strong>
      <span className="map-tip-meta">{formatArea(apt.areaM2)}, {apt.floor}층, {apt.builtYear}년 준공</span>
      {apt.nearestStation && <span className="map-tip-meta">{stationText(apt.nearestStation)}</span>}
      <div className="map-tip-price">
        <span>{apt.dealType && apt.dealType !== 'sale' ? dealLabel(apt.dealType) : '실거래가'} <small>{formatDate(apt.dealDate)}</small></span>
        <strong>{formatDealPrice(apt)}</strong>
      </div>
      {/* 터치 화면용: 말풍선에서 바로 상세로 */}
      {onDetail && (
        <button type="button" className="map-tip-more" onClick={onDetail}>상세 정보 보기</button>
      )}
    </div>
  );
}
