import { formatPrice, verdictOf } from '../utils/format';
import Disclaimer from './Disclaimer';

/** 실거래가 vs AI 예상가 비교 */
export default function PriceCompare({ actual, predicted, loading, error, onRetry, source }) {
  let body;
  if (loading) {
    body = (
      <div className="compare-loading">
        <span className="spinner" aria-hidden="true" />
        AI가 이 매물의 적정가를 계산하는 중…
      </div>
    );
  } else if (error) {
    body = (
      <div className="compare-error">
        <p>{error}</p>
        {onRetry && <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>다시 시도</button>}
      </div>
    );
  } else if (predicted == null) {
    // 예상가가 아직 없을 때(첫 렌더) — 여기서 verdict 가 null 이라 페이지 전체가 죽던 버그 수정
    body = <div className="compare-loading"><span className="spinner" aria-hidden="true" />AI 예상가 준비 중…</div>;
  } else {
    const verdict = verdictOf(actual, predicted);
    const max = Math.max(actual, predicted);
    // 게이지: -20% ~ +20% 범위를 0~100% 위치로
    const pos = Math.min(Math.max(((verdict.gap + 20) / 40) * 100, 0), 100);

    body = (
      <>
        <div className={`verdict verdict-${verdict.kind}`}>{verdict.label}</div>
        <div className="bars">
          <Bar label="실거래가" value={actual} ratio={actual / max} kind="actual" />
          <Bar label="AI 예상가" value={predicted} ratio={predicted / max} kind="predicted" />
        </div>
        <div className="gauge" aria-hidden="true">
          <div className="gauge-track">
            <span className="gauge-zone low">저렴</span>
            <span className="gauge-zone fair">적정 ±5%</span>
            <span className="gauge-zone high">비쌈</span>
          </div>
          <div className="gauge-needle" style={{ left: `${pos}%` }} />
        </div>
        <p className="muted small">실거래가와 예상가 차이 {formatPrice(Math.abs(actual - predicted))}</p>
      </>
    );
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">AI 가격 판단</h2>
        <span className="tag-ai">AI</span>
      </div>
      {body}
      <Disclaimer source={source} />
    </section>
  );
}

function Bar({ label, value, ratio, kind }) {
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <div className="bar-track">
        <div className={`bar-fill bar-${kind}`} style={{ transform: `scaleX(${Math.max(ratio, 0.04)})` }} />
      </div>
      <span className="bar-value">{formatPrice(value)}</span>
    </div>
  );
}
