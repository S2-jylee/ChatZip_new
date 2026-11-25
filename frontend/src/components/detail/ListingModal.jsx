import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import DealChart from './DealChart';
import JeonseRatio from './JeonseRatio';
import HousingCost from './HousingCost';
import ContractCheck from './ContractCheck';
import PriceCompare from '../PriceCompare';
import FavoriteButton from '../FavoriteButton';
import { ErrorBox, Loading } from '../Status';
import { getApartment, getDeals } from '../../api/apartments';
import { predictPrice } from '../../api/predict';
import { errorMessage, statusOf } from '../../api/client';
import { dataSourceOf, dealInfo, typeInfo } from '../../constants/propertyTypes';
import { formatArea, formatDate, formatDealPrice, stationText } from '../../utils/format';
import { markViewed } from '../../utils/viewed';
import './ListingModal.css';
import { lockScroll } from '../../utils/scrollLock';

/**
 * 매물 상세 — ?detail={id} 로 열림.
 * variant: 'modal'(기본, 일반 화면) | 'side'(지도 화면 왼쪽 사이드바 안)
 */
export default function ListingModal({ id, onClose, variant = 'modal' }) {
  const [apt, setApt] = useState(null);
  const [state, setState] = useState('loading'); // loading | ok | notfound | error
  const [error, setError] = useState('');
  const [deals, setDeals] = useState({ loading: true, data: null, error: '' });
  const [pred, setPred] = useState({ loading: true, value: null, error: '' });
  const dialogRef = useRef(null);

  // ESC 로 닫기 · 뒤 화면 스크롤 막기 · 포커스 이동
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const unlock = variant === 'modal' ? lockScroll() : () => {}; // 패널일 땐 스크롤 그대로
    dialogRef.current?.focus({ preventScroll: true });
    return () => { document.removeEventListener('keydown', onKey); unlock(); };
  }, [onClose, variant]);

  const load = useCallback(() => {
    let cancelled = false;
    setState('loading');
    getApartment(id)
      .then((data) => {
        if (cancelled) return;
        setApt(data);
        setState('ok');
        markViewed(data.aptId); // 이미 본 매물로 기록
      })
      .catch((err) => {
        if (cancelled) return;
        if (statusOf(err) === 404) setState('notfound');
        else { setError(errorMessage(err, '매물 정보를 불러오지 못했습니다.')); setState('error'); }
      });
    return () => { cancelled = true; };
  }, [id]);
  useEffect(() => load(), [load]);

  // 최근 1년 실거래
  useEffect(() => {
    if (!apt) return undefined;
    let cancelled = false;
    setDeals({ loading: true, data: null, error: '' });
    getDeals(apt.aptId, 12)
      .then((data) => { if (!cancelled) setDeals({ loading: false, data, error: '' }); })
      .catch((err) => { if (!cancelled) setDeals({ loading: false, data: null, error: errorMessage(err, '실거래 내역을 불러오지 못했습니다.') }); });
    return () => { cancelled = true; };
  }, [apt]);

  // AI 예상가
  // AI 예상가 — 매매 가격 모델이라 매매 거래에서만
  const loadPred = useCallback(() => {
    if (!apt) return undefined;
    if (apt.dealType && apt.dealType !== 'sale') { setPred({ loading: false, value: null, error: '' }); return undefined; }
    let cancelled = false;
    setPred({ loading: true, value: null, error: '' });
    predictPrice({ gu: apt.gu, areaM2: apt.areaM2, floor: apt.floor, builtYear: apt.builtYear })
      .then((value) => { if (!cancelled) setPred({ loading: false, value, error: '' }); })
      .catch((err) => { if (!cancelled) setPred({ loading: false, value: null, error: errorMessage(err, 'AI 예상가를 불러오지 못했습니다.') }); });
    return () => { cancelled = true; };
  }, [apt]);
  useEffect(() => loadPred(), [loadPred]);

  let body;
  if (state === 'loading') body = <Loading />;
  else if (state === 'notfound') body = <div className="modal-pad"><p>존재하지 않는 매물입니다.</p></div>;
  else if (state === 'error') body = <div className="modal-pad"><ErrorBox message={error} onRetry={load} /></div>;
  else {
    const deal = apt.dealType ?? 'sale';
    const isSale = deal === 'sale';
    const source = dataSourceOf(apt.type, deal);
    const priceLabel = dealInfo(deal).priceLabel;
    const rows = [
      ['단지명', apt.name],
      ['주소', apt.address],
      ['지역', `경기도 ${apt.gu} ${apt.dong}`],
      ['전용면적', formatArea(apt.areaM2)],
      ['층', `${apt.floor}층`],
      ['준공연도', `${apt.builtYear}년 (${new Date().getFullYear() - apt.builtYear}년차)`],
      apt.landAreaM2 != null && ['대지권 면적', formatArea(apt.landAreaM2)],
      [priceLabel, formatDealPrice(apt)],
      ['거래일', formatDate(apt.dealDate)],
      apt.nearestStation && ['가까운 역', stationText(apt.nearestStation)],
    ].filter(Boolean);
    const chartTitle = { sale: '최근 1년 실거래가', jeonse: '최근 1년 전세 보증금', monthly: '최근 1년 월세' }[deal];
    body = (
      <div className="modal-body">
        <section className="modal-section">
          <h3 className="modal-h">기본 정보</h3>
          <dl className="modal-info">
            {rows.map(([k, v]) => (
              <div key={k} className={k === priceLabel ? 'is-price' : ''}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </section>

        <section className="modal-section">
          <div className="modal-h-row">
            <h3 className="modal-h">{chartTitle}</h3>
            {deals.data && <span className="muted small">기준일 {formatDate(deals.data.baseDate)}</span>}
          </div>
          {deals.loading && <Loading />}
          {deals.error && <ErrorBox message={deals.error} />}
          {deals.data && (
            <DealChart deals={deals.data.deals} baseDate={deals.data.baseDate} predicted={isSale ? pred.value : null} dealType={deal} />
          )}
          <p className="source">출처: {source}</p>
        </section>

        {isSale && (
          <section className="modal-section modal-compare">
            <PriceCompare
              actual={apt.price}
              predicted={pred.value}
              loading={pred.loading}
              error={pred.error}
              onRetry={loadPred}
              source={source}
            />
          </section>
        )}

        {apt.type === 'villa' && deal !== 'monthly' && (
          <JeonseRatio aptId={apt.aptId} source={dataSourceOf('villa', 'sale').replace('매매)', '매매, 전월세)')} />
        )}
        {apt.type === 'oneroom' && deal !== 'sale' && <HousingCost apt={apt} />}
        {apt.type === 'villa' && <ContractCheck violation={apt.violation} />}
      </div>
    );
  }

  const isSide = variant === 'side';
  const head = (
    <header className="modal-head">
      <div>
        {isSide && <button type="button" className="side-back" onClick={onClose}>← 목록</button>}
        {apt && <span className="eyebrow">{typeInfo(apt.type).label}, {apt.gu} {apt.dong}</span>}
        <h2 className="modal-title">{apt?.name ?? '매물 상세'}</h2>
      </div>
      <div className="modal-head-actions">
        {apt && <FavoriteButton aptId={apt.aptId} compact />}
        {apt && !isSide && <Link to={`/apartments/${apt.aptId}`} className="btn btn-ghost btn-sm">전체 화면</Link>}
        {!isSide && <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">×</button>}
      </div>
    </header>
  );

  // 지도 화면: 왼쪽 사이드바(map-side) 안에서 필터·목록 자리를 대신해 표시
  if (isSide) {
    return (
      <section className="listing-side" aria-label="매물 상세" tabIndex={-1} ref={dialogRef}>
        {head}
        {body}
      </section>
    );
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="매물 상세" tabIndex={-1} ref={dialogRef}>
        {head}
        {body}
      </div>
    </div>,
    document.body,
  );
}
