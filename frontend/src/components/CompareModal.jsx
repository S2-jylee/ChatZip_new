import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import Disclaimer from './Disclaimer';
import { predictPrice } from '../api/predict';
import { dataSourceOf, typeInfo } from '../constants/propertyTypes';
import { formatArea, formatDate, formatPrice, perPyeong, verdictOf } from '../utils/format';
import './detail/ListingModal.css';
import './CompareModal.css';
import { lockScroll } from '../utils/scrollLock';

const THIS_YEAR = new Date().getFullYear();

/**
 * 관심 매물 비교 (2~3개) — 항목별로 나란히 보여주고, 가장 유리한 값에 표시
 * apartments: Apartment[]
 */
export default function CompareModal({ apartments, onClose }) {
  const [preds, setPreds] = useState({}); // aptId → { loading, value, error }
  const ref = useRef(null);

  // ESC 로 닫기 · 뒤 화면 스크롤 막기
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const unlock = lockScroll();
    ref.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); unlock(); };
  }, [onClose]);

  // 각 매물의 AI 예상가
  useEffect(() => {
    let cancelled = false;
    setPreds(Object.fromEntries(apartments.map((a) => [a.aptId, { loading: true }])));
    apartments.forEach((a) => {
      predictPrice({ gu: a.gu, areaM2: a.areaM2, floor: a.floor, builtYear: a.builtYear })
        .then((value) => { if (!cancelled) setPreds((p) => ({ ...p, [a.aptId]: { value } })); })
        .catch(() => { if (!cancelled) setPreds((p) => ({ ...p, [a.aptId]: { error: true } })); });
    });
    return () => { cancelled = true; };
  }, [apartments]);

  // 항목별 "가장 유리한" 매물 id (값이 모두 같으면 표시 안 함)
  const bestOf = (fn, pick) => {
    const vals = apartments.map((a) => [a.aptId, fn(a)]).filter(([, v]) => v != null);
    if (vals.length < 2 || new Set(vals.map(([, v]) => v)).size === 1) return null;
    return vals.reduce((b, cur) => (pick(cur[1], b[1]) ? cur : b))[0];
  };
  const lower = (a, b) => a < b;
  const higher = (a, b) => a > b;
  const gapOf = (a) => {
    const v = preds[a.aptId]?.value;
    return v ? ((a.price - v) / v) * 100 : null;
  };

  const best = {
    price: bestOf((a) => a.price, lower),
    perPy: bestOf((a) => perPyeong(a.price, a.areaM2), lower),
    area: bestOf((a) => Number(a.areaM2), higher),
    built: bestOf((a) => a.builtYear, higher),
    gap: bestOf(gapOf, lower), // 예상가보다 가장 싸게 거래된 매물
  };

  const rows = [
    { label: '지역', render: (a) => `${a.gu} ${a.dong}` },
    { label: '주소', render: (a) => a.address, small: true },
    { label: '종류', render: (a) => typeInfo(a.type).label },
    { label: '실거래가', key: 'price', tag: '최저가', render: (a) => <b className="cmp-price">{formatPrice(a.price)}</b> },
    { label: '평당가', key: 'perPy', tag: '최저', render: (a) => formatPrice(perPyeong(a.price, a.areaM2)) },
    { label: '전용면적', key: 'area', tag: '최대', render: (a) => formatArea(a.areaM2) },
    { label: '층', render: (a) => `${a.floor}층` },
    { label: '준공연도', key: 'built', tag: '최신', render: (a) => `${a.builtYear}년 (${THIS_YEAR - a.builtYear}년차)` },
    { label: '거래일', render: (a) => formatDate(a.dealDate) },
    {
      label: 'AI 예상가',
      render: (a) => {
        const p = preds[a.aptId] ?? {};
        if (p.loading) return <span className="muted">계산 중…</span>;
        if (p.error) return <span className="muted">불러오지 못함</span>;
        return <span className="text-accent">{formatPrice(p.value)}</span>;
      },
    },
    {
      label: 'AI 판단',
      key: 'gap',
      tag: '가장 저렴',
      render: (a) => {
        const v = verdictOf(a.price, preds[a.aptId]?.value);
        return v ? <span className={`verdict verdict-${v.kind} cmp-verdict`}>{v.label}</span> : <span className="muted">—</span>;
      },
    },
  ];

  const sources = [...new Set(apartments.map((a) => dataSourceOf(a.type)))].join(', ');

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal cmp-modal" role="dialog" aria-modal="true" aria-label="관심 매물 비교" tabIndex={-1} ref={ref}>
        <header className="modal-head">
          <div>
            <h2 className="modal-title">관심 매물 비교 <small className="muted">{apartments.length}개</small></h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">×</button>
        </header>

        <div className="cmp-scroll">
          <table className="cmp-table" style={{ '--cols': apartments.length }}>
            <thead>
              <tr>
                <th scope="col" className="cmp-label-col"><span className="sr-only">항목</span></th>
                {apartments.map((a) => (
                  <th key={a.aptId} scope="col">
                    <strong className="cmp-name">{a.name}</strong>
                    <Link to={`/favorites?detail=${a.aptId}`} className="cmp-link" onClick={onClose}>상세 보기</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  {apartments.map((a) => {
                    const isBest = r.key && best[r.key] === a.aptId;
                    return (
                      <td key={a.aptId} className={`${isBest ? 'is-best' : ''}${r.small ? ' cmp-small' : ''}`}>
                        {r.render(a)}
                        {isBest && <span className="cmp-badge">{r.tag}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="cmp-foot">
          <Disclaimer source={sources} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
