import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import FavoriteButton from '../components/FavoriteButton';
import { Loading } from '../components/Status';
import { getPopular, searchApartments } from '../api/apartments';
import { DATA_SOURCE } from '../constants/regions';
import { formatDate, formatPrice, statsByGu } from '../utils/format';
import { useDetailHref } from '../utils/detailLink';
import { photoOf } from '../utils/photo';


export default function HomePage() {
  const detailHref = useDetailHref();
  const [apartments, setApartments] = useState(null);
  const [popular, setPopular] = useState(null);

  useEffect(() => {
    let cancelled = false;
    searchApartments({})
      .then((data) => { if (!cancelled) setApartments(data); })
      .catch(() => { if (!cancelled) setApartments([]); });
    getPopular(5)
      .then((data) => { if (!cancelled) setPopular(data); })
      .catch(() => { if (!cancelled) setPopular([]); });
    return () => { cancelled = true; };
  }, []);

  const guStats = useMemo(() => statsByGu(apartments ?? []), [apartments]);
  const recent = useMemo(
    () => [...(apartments ?? [])].sort((a, b) => String(b.dealDate).localeCompare(String(a.dealDate))).slice(0, 5),
    [apartments],
  );
  const maxAvg = guStats[0]?.avgPerPyeong ?? 1;

  return (
    <>
      {/* ---------- 히어로: 통합 검색 ---------- */}
      <section className="hero">
        <div className="container hero-wide">
          <div className="hero-copy">
                        <h1 className="hero-title">
              찾고, 비교하고, 한눈에 보는 Chat Zip
            </h1>
            <p className="hero-sub">실거래가, 시세, 조건 맞춤 추천까지. 부동산 탐색을 더 쉽고 똑똑하게</p>
            <SearchBar />
          </div>
        </div>
      </section>

      {/* ---------- 실시간 인기 매물 TOP 5 ---------- */}
      <section className="container section">
        <div className="section-head row">
          <div>
            <h2>실시간 인기 매물 TOP 5</h2>
            <p className="muted">지금 가장 많이 보고 있는 매물을 확인해보세요.</p>
          </div>
          <Link to="/search" className="btn btn-ghost btn-sm">전체 매물 보기</Link>
        </div>
        {!popular ? <Loading /> : (
          <ol className="pop-grid">
            {popular.map((apt, i) => (
              <li key={apt.aptId} className="pop-card">
                <Link to={detailHref(apt.aptId)} className="pop-link">
                  <div className="pop-thumb">
                    <img src={photoOf(apt, i)} alt="" className="pop-art" loading="lazy" />
                    <span className={`pop-rank${i === 0 ? ' first' : ''}`}>{i + 1}</span>
                  </div>
                  <div className="pop-body">
                    <strong className="pop-name">{apt.name}</strong>
                    <span className="muted small">{apt.gu} {apt.dong}, 아파트</span>
                    <span className="muted small">전용 {Math.round(apt.areaM2)}㎡, {apt.floor}층</span>
                    <div className="pop-bottom">
                      <span className="pop-price">{formatPrice(apt.price)}</span>
                      <span className="deal-chip">매매</span>
                    </div>
                  </div>
                </Link>
                <div className="pop-fav"><FavoriteButton aptId={apt.aptId} icon /></div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* ---------- 최근 실거래 TOP 5 | 구별 평균 평당가 (PC 좌우, 휴대폰 위아래) ---------- */}
      <section className="section section-tinted market-section">
        <div className="container market-row">
          <div className="market-col">
            <div className="section-head row">
              <div>
                <h2>최근 실거래 TOP 5</h2>
                <p className="muted">가장 최근에 거래된 주요 매물 시세를 확인하세요.</p>
              </div>
              <Link to="/search" className="btn btn-ghost btn-sm">전체 보기</Link>
            </div>
            {!apartments ? <Loading /> : (
              <ol className="recent-list">
                {recent.map((apt, i) => (
                  <li key={apt.aptId}>
                    <Link to={detailHref(apt.aptId)} className="recent-row">
                      <span className="recent-rank">{i + 1}</span>
                      <span className="recent-info">
                        <strong>{apt.name}</strong>
                        <span className="muted small">{apt.gu} {apt.dong}, 전용 {Math.round(apt.areaM2)}㎡</span>
                      </span>
                      <span className="recent-date muted small">{formatDate(apt.dealDate)}</span>
                      <span className="recent-price">{formatPrice(apt.price)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="market-col">
            <div className="section-head">
              <h2>구별 평균 평당가</h2>
              <p className="muted">구를 누르면 지역별분석에서 자세한 시세를 볼 수 있어요.</p>
            </div>
            {!apartments ? <Loading /> : (
              <div className="gu-grid compact">
                {guStats.map((s, i) => (
                  <Link key={s.gu} to={`/analysis?gu=${encodeURIComponent(s.gu)}`} className="gu-card">
                    <div className="gu-card-top">
                      <span className="gu-rank">{i + 1}</span>
                      <strong>{s.gu}</strong>
                      <span className="muted small">{s.count}건</span>
                    </div>
                    <p className="gu-price">평당 {formatPrice(s.avgPerPyeong)}</p>
                    <div className="gu-bar"><div style={{ width: `${(s.avgPerPyeong / maxAvg) * 100}%` }} /></div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
        <p className="container muted small source">데이터 출처: {DATA_SOURCE}</p>
      </section>

      {/* ---------- 아파트 비교 ---------- */}
      <section className="container section compare-section">
        <div className="compare-cta">
          {/* 지도 화면 매물 종류 탭 아이콘과 같은 선 아이콘 (저울) */}
          <span className="compare-cta-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4v16M8 20h8M5 7h14" />
              <path d="M5 7l-3 6a3 3 0 0 0 6 0L5 7zM19 7l-3 6a3 3 0 0 0 6 0l-3-6z" />
            </svg>
          </span>
          <div className="compare-cta-text">
            <strong>아파트 비교하기</strong>
            <span className="muted small">관심 매물 중 2~3개를 골라 실거래가, 평당가, 준공연도 등을 한눈에 비교해보세요.</span>
          </div>
          <Link to="/favorites" className="btn btn-primary btn-sm">비교하러 가기</Link>
        </div>
      </section>
    </>
  );
}
