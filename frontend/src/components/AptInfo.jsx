import { formatArea, formatDate, formatPrice, perPyeong } from '../utils/format';

/** 매물 기본 정보. guAvg = 같은 구 평균 평당가 (없으면 비교 생략) */
export default function AptInfo({ apt, guAvg }) {
  const myPerPyeong = perPyeong(apt.price, apt.areaM2);
  const vsGu = guAvg ? ((myPerPyeong - guAvg) / guAvg) * 100 : null;

  const rows = [
    ['주소', apt.address],
    ['전용면적', formatArea(apt.areaM2)],
    ['층', `${apt.floor}층`],
    ['준공연도', `${apt.builtYear}년 (${new Date().getFullYear() - apt.builtYear}년차)`],
    ['거래일', formatDate(apt.dealDate)],
  ];

  return (
    <section className="card">
      <span className="eyebrow">{apt.gu} {apt.dong}</span>
      <h1 className="detail-title">{apt.name}</h1>

      <div className="detail-kpis">
        <div className="kpi kpi-main">
          <span>실거래가</span>
          <strong>{formatPrice(apt.price)}</strong>
        </div>
        <div className="kpi">
          <span>평당가</span>
          <strong>{formatPrice(myPerPyeong)}</strong>
        </div>
        <div className="kpi">
          <span>{apt.gu} 평균 대비</span>
          <strong className={vsGu === null ? '' : vsGu > 0 ? 'text-up' : 'text-down'}>
            {vsGu === null ? '—' : `${vsGu > 0 ? '+' : ''}${vsGu.toFixed(1)}%`}
          </strong>
        </div>
      </div>

      <dl className="info-list">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
