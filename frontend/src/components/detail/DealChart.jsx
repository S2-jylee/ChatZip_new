import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { formatDate, formatDealPrice, shortPrice } from '../../utils/format';

const H = 240;
const PAD = { top: 18, right: 16, bottom: 28, left: 56 };
const toTime = (d) => new Date(`${d}T00:00:00`).getTime();

// 보기 좋은 눈금 (만원 단위)
function niceTicks(min, max, count = 4) {
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v));
  return ticks;
}

/**
 * 최근 1년 실거래가 선 그래프 + AI 예상가 기준선(점선)
 * deals: [{ dealDate, price, rent?, floor }] (오름차순), baseDate: 기준일, predicted: 만원 | null
 * dealType: sale(매매가) | jeonse(보증금) | monthly(월세 금액을 그림, 말풍선에 보증금 / 월세)
 */
const LINE_LABEL = { sale: '실거래가', jeonse: '전세 보증금', monthly: '월세' };
export default function DealChart({ deals, baseDate, predicted, months = 12, dealType = 'sale' }) {
  const monthly = dealType === 'monthly';
  const valueOf = (d) => (monthly ? d.rent : d.price);
  const axisText = (v) => (monthly ? `${v}만` : shortPrice(v));
  const boxRef = useRef(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState(null); // index

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(200, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const g = useMemo(() => {
    const end = toTime(baseDate);
    const startD = new Date(end);
    startD.setMonth(startD.getMonth() - months);
    const start = startD.getTime();
    const values = deals.map(valueOf).concat(predicted ? [predicted] : []);
    const ticks = niceTicks(Math.min(...values) * 0.97, Math.max(...values) * 1.03);
    const y0 = ticks[0];
    const y1 = ticks[ticks.length - 1];
    const iw = width - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const x = (t) => PAD.left + ((t - start) / (end - start)) * iw;
    const y = (v) => PAD.top + (1 - (v - y0) / (y1 - y0 || 1)) * ih;
    // x축: 3개월 간격 월 라벨
    const monthsTicks = [];
    for (let i = 0; i <= months; i += 3) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + i);
      monthsTicks.push({ t: d.getTime(), label: `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}` });
    }
    const pts = deals.map((d) => ({ ...d, cx: x(Math.min(Math.max(toTime(d.dealDate), start), end)), cy: y(valueOf(d)) }));
    return { ticks, monthsTicks, x, y, pts, iw, ih };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals, baseDate, predicted, months, width, monthly]);

  if (!deals.length) return <p className="muted small">최근 {months}개월 동안 거래 내역이 없습니다.</p>;

  const path = g.pts.map((p, i) => `${i ? 'L' : 'M'}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join('');
  const hp = hover != null ? g.pts[hover] : null;

  // 마우스 x 와 가장 가까운 거래 (점보다 넓은 히트 영역)
  const onMove = (e) => {
    // 점 좌표(cx)는 SVG 전체 기준이므로 히트 영역(rect)이 아니라 SVG 기준으로 계산
    const svg = e.currentTarget.ownerSVGElement;
    const rect = svg.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (width / (rect.width || width));
    let best = 0;
    g.pts.forEach((p, i) => { if (Math.abs(p.cx - mx) < Math.abs(g.pts[best].cx - mx)) best = i; });
    setHover(best);
  };

  return (
    <div className="deal-chart" ref={boxRef}>
      <div className="chart-legend" aria-hidden="true">
        <span><i className="lg-line" />{LINE_LABEL[dealType] ?? '실거래가'}</span>
        {predicted != null && <span><i className="lg-dash" />AI 예상가 (참고용)</span>}
      </div>
      <div className="ch-plot">
      <svg width={width} height={H} role="img" aria-label={`최근 ${months}개월 ${LINE_LABEL[dealType] ?? '실거래가'} ${deals.length}건 그래프`}>
        {/* 가로 눈금선 + y축 라벨 */}
        {g.ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={width - PAD.right} y1={g.y(v)} y2={g.y(v)} className="ch-grid" />
            <text x={PAD.left - 8} y={g.y(v)} className="ch-axis" textAnchor="end" dominantBaseline="middle">{axisText(v)}</text>
          </g>
        ))}
        {g.monthsTicks.map((m) => (
          <text key={m.t} x={g.x(m.t)} y={H - 8} className="ch-axis" textAnchor="middle">{m.label}</text>
        ))}

        {/* AI 예상가 기준선 — 직접 라벨 */}
        {predicted != null && (
          <g>
            <line x1={PAD.left} x2={width - PAD.right} y1={g.y(predicted)} y2={g.y(predicted)} className="ch-pred" />
            <text x={width - PAD.right} y={g.y(predicted) - 6} className="ch-pred-label" textAnchor="end">AI 예상가 {shortPrice(predicted)}</text>
          </g>
        )}

        <path d={path} className="ch-line" />
        {g.pts.map((p, i) => (
          <circle key={`${p.dealDate}-${i}`} cx={p.cx} cy={p.cy} r={hover === i ? 6 : 4} className="ch-dot" />
        ))}

        {/* 십자선 */}
        {hp && <line x1={hp.cx} x2={hp.cx} y1={PAD.top} y2={H - PAD.bottom} className="ch-cross" />}

        <rect
          x={PAD.left} y={PAD.top} width={g.iw} height={g.ih} fill="transparent"
          onMouseMove={onMove} onMouseLeave={() => setHover(null)}
        />
      </svg>
      {hp && (
        <div
          className="ch-tip"
          style={{ left: Math.min(Math.max(hp.cx, 70), width - 70), top: Math.max(hp.cy - 12, 0) }}
        >
          <span>{formatDate(hp.dealDate)}, {hp.floor}층</span>
          <strong>{formatDealPrice({ ...hp, dealType })}</strong>
        </div>
      )}
      </div>

      <details className="chart-table">
        <summary>표로 보기 ({deals.length}건)</summary>
        <table>
          <thead><tr><th>거래일</th><th>층</th><th>{monthly ? '보증금 / 월세' : '거래가'}</th></tr></thead>
          <tbody>
            {[...deals].reverse().map((d, i) => (
              <tr key={`${d.dealDate}-${i}`}><td>{formatDate(d.dealDate)}</td><td>{d.floor}층</td><td>{formatDealPrice({ ...d, dealType })}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

