import { useEffect, useState } from 'react';
import { getJeonseRatio } from '../../api/apartments';
import { errorMessage, statusOf } from '../../api/client';
import { formatDate, formatPrice } from '../../utils/format';
import { ErrorBox, Loading } from '../Status';
import Icon from '../Icon';

// 전세가율 구간: 70% 미만 보통 · 70~80% 높은 편 · 80% 이상 깡통전세 주의
function levelOf(ratio) {
  if (ratio >= 80) return { kind: 'danger', label: '깡통전세 주의', desc: '매매가 대비 전세가가 높아, 집값이 떨어지면 보증금을 돌려받기 어려울 수 있습니다.' };
  if (ratio >= 70) return { kind: 'warn', label: '높은 편', desc: '계약 전에 등기부의 근저당과 전세보증금반환보증 가입 가능 여부를 꼭 확인하세요.' };
  return { kind: 'ok', label: '보통', desc: '그래도 계약 전에 등기부와 건축물대장은 확인하세요.' };
}

/** 빌라 전세가율 — 같은 건물·비슷한 면적의 최근 1년 매매 · 전세 실거래 비교 */
export default function JeonseRatio({ aptId, source }) {
  const [s, setS] = useState({ loading: true, data: null, error: '', none: false });

  useEffect(() => {
    let cancelled = false;
    setS({ loading: true, data: null, error: '', none: false });
    getJeonseRatio(aptId)
      .then((data) => { if (!cancelled) setS({ loading: false, data, error: '', none: false }); })
      .catch((err) => {
        if (cancelled) return;
        if (statusOf(err) === 404) setS({ loading: false, data: null, error: '', none: true });
        else setS({ loading: false, data: null, error: errorMessage(err, '전세가율을 불러오지 못했습니다.'), none: false });
      });
    return () => { cancelled = true; };
  }, [aptId]);

  return (
    <section className="modal-section">
      <div className="modal-h-row">
        <h3 className="modal-h">전세가율</h3>
        {s.data && <span className="muted small">기준일 {formatDate(s.data.baseDate)}</span>}
      </div>
      {s.loading && <Loading />}
      {s.error && <ErrorBox message={s.error} />}
      {s.none && <p className="muted small">같은 건물에 비교할 매매·전세 거래가 없어 계산하지 못했습니다.</p>}
      {s.data && <RatioBody data={s.data} />}
      <p className="source">출처: {source}. 참고용이며, 실제 시세와 다를 수 있습니다.</p>
    </section>
  );
}

function RatioBody({ data }) {
  const lv = levelOf(data.ratio);
  const pos = Math.min(100, Math.max(0, data.ratio));
  return (
    <div className={`ratio ratio-${lv.kind}`}>
      <div className="ratio-head">
        <strong className="ratio-num">{data.ratio.toFixed(1)}%</strong>
        <span className="ratio-badge">{lv.kind === 'danger' && <Icon name="alert" className="icon-lead" />}{lv.label}</span>
      </div>
      <div className="ratio-bar" role="img" aria-label={`전세가율 ${data.ratio.toFixed(1)}%, ${lv.label}`}>
        <span className="ratio-zone z-ok" style={{ width: '70%' }} />
        <span className="ratio-zone z-warn" style={{ width: '10%' }} />
        <span className="ratio-zone z-danger" style={{ width: '20%' }} />
        <i className="ratio-mark" style={{ left: `${pos}%` }} />
      </div>
      <div className="ratio-scale" aria-hidden="true"><span>0%</span><span style={{ left: '70%' }}>70%</span><span style={{ left: '80%' }}>80%</span><span>100%</span></div>
      <dl className="ratio-rows">
        <div><dt>매매 중간값</dt><dd>{formatPrice(data.salePrice)} <small>({data.saleCount}건)</small></dd></div>
        <div><dt>전세 중간값</dt><dd>{formatPrice(data.jeonsePrice)} <small>({data.jeonseCount}건)</small></dd></div>
      </dl>
      <p className="ratio-desc">{lv.desc}</p>
    </div>
  );
}
