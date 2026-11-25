import { useState } from 'react';
import { AMENITY_KINDS, TRANSIT_KINDS, placeKind } from '../../constants/placeKinds';
import { emblemOf } from './markerEls';

// 지도 표시와 같은 모양의 작은 엠블럼 (고정된 SVG/글자라 innerHTML 안전)
function Emblem({ kind }) {
  const { html, color } = emblemOf(kind);
  // eslint-disable-next-line react/no-danger
  return <span className="mc-emblem" style={{ '--pc': color }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** 지도 오른쪽 세로 버튼: 위성 · 지하철 · 버스 · 학교 · 편의시설(업종 필터 패널) */
export default function MapControls({
  mapType, onMapType, placeKinds, onTogglePlace, onClearPlaces, placeCount, hiddenKinds = [], isSample, extraKinds = [],
}) {
  const [open, setOpen] = useState(false); // 업종 필터 패널
  const amenityOn = AMENITY_KINDS.filter((k) => placeKinds.includes(k.key)).length;

  // 상태 안내: 몇 곳 표시 중 + 축소돼서 안 보이는 종류
  let status = null;
  if (placeKinds.length) {
    const parts = [];
    if (hiddenKinds.length < placeKinds.length) parts.push(`주변 시설 ${placeCount}곳${isSample ? ' (예시)' : ''}`);
    if (hiddenKinds.length) parts.push(`${hiddenKinds.map((k) => placeKind(k).label).join('·')}: 더 확대하면 표시`);
    status = parts.join(', ');
  }

  return (
    <>
      <div className="map-rail" role="toolbar" aria-label="지도 보기 설정">
        <button
          type="button"
          className={`rail-btn${mapType === 'satellite' ? ' on' : ''}`}
          aria-pressed={mapType === 'satellite'}
          onClick={() => onMapType(mapType === 'satellite' ? 'road' : 'satellite')}
          title={mapType === 'satellite' ? '일반지도로 보기' : '위성지도로 보기'}
        >
          위성
        </button>

        {[...TRANSIT_KINDS, ...extraKinds].map((k) => (
          <button
            key={k.key}
            type="button"
            className={`rail-btn${placeKinds.includes(k.key) ? ' on' : ''}`}
            aria-pressed={placeKinds.includes(k.key)}
            onClick={() => onTogglePlace(k.key)}
            title={`${k.label} 표시`}
          >
            {k.short ?? (k.key === 'subway' ? '지하철' : k.key === 'bus' ? '버스' : k.label)}
          </button>
        ))}

        <div className="rail-wrap">
          <button
            type="button"
            className={`rail-btn${open || amenityOn ? ' on' : ''}`}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            title="업종별 편의시설"
          >
            편의
            {amenityOn > 0 && <span className="rail-count">{amenityOn}</span>}
          </button>
          {open && (
            <div className="mc-panel">
              <div className="mc-panel-head">
                <strong>업종별 편의시설</strong>
                <button type="button" className="mc-close" onClick={() => setOpen(false)} aria-label="닫기">×</button>
              </div>
              <div className="mc-chips">
                {AMENITY_KINDS.map((k) => (
                  <button
                    key={k.key}
                    type="button"
                    className={`mc-chip${placeKinds.includes(k.key) ? ' on' : ''}`}
                    aria-pressed={placeKinds.includes(k.key)}
                    onClick={() => onTogglePlace(k.key)}
                  >
                    <Emblem kind={k.key} />{k.label}
                  </button>
                ))}
              </div>
              {placeKinds.length > 0 && (
                <button type="button" className="mc-link" onClick={onClearPlaces}>모두 끄기</button>
              )}
            </div>
          )}
        </div>
      </div>
      {status && <div className="mc-status">{status}</div>}
    </>
  );
}
