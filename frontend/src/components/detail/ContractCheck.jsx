import Icon from '../Icon';
// 빌라 계약 전 확인 — 위반건축물 여부(건축물대장) + 체크리스트와 공식 발급 링크
// 링크는 공공기관 공식 사이트만. 등기부 열람·발급 수수료는 사용자가 인터넷등기소에서 직접 냄 (우리 비용 없음)
const CHECKS = [
  { title: '등기부등본', desc: '소유자가 계약하는 사람과 같은지, 근저당·압류·가압류가 있는지', href: 'https://www.iros.go.kr', site: '인터넷등기소' },
  { title: '건축물대장', desc: '위반건축물 표시, 용도(주택인지), 전용면적이 계약서와 같은지', href: 'https://www.gov.kr', site: '정부24' },
  { title: '전입세대 확인서', desc: '다가구·다세대: 이미 살고 있는 세입자가 몇 명인지 (선순위 보증금)', href: 'https://www.gov.kr', site: '정부24 · 주민센터' },
  { title: '확정일자 부여 현황', desc: '다가구: 먼저 들어온 세입자들의 보증금 합계', href: 'https://www.iros.go.kr', site: '인터넷등기소 · 주민센터' },
  { title: '전세보증금반환보증', desc: '가입 가능한 집인지 미리 확인 (위반건축물·높은 전세가율이면 거절될 수 있음)', href: 'https://www.khug.or.kr', site: '주택도시보증공사' },
];

const VIOLATION = {
  true: { kind: 'danger', label: '위반건축물로 등록됨', desc: '전세대출과 전세보증금반환보증 가입이 어려울 수 있습니다. 계약 전 꼭 확인하세요.' },
  false: { kind: 'ok', label: '위반건축물 아님', desc: '건축물대장 기준입니다. 계약 직전에 다시 확인하세요.' },
  null: { kind: 'unknown', label: '확인 불가', desc: '건축물대장에서 찾지 못했습니다. 정부24에서 직접 확인하세요.' },
};

export default function ContractCheck({ violation }) {
  const v = VIOLATION[String(violation ?? null)];
  return (
    <section className="modal-section">
      <h3 className="modal-h">계약 전 확인</h3>
      {violation !== undefined && (
        <div className={`violation violation-${v.kind}`}>
          <strong>{v.kind === 'danger' && <Icon name="alert" className="icon-lead" />}{v.label}</strong>
          <span>{v.desc}</span>
        </div>
      )}
      <ul className="check-list">
        {CHECKS.map((c) => (
          <li key={c.title}>
            <div>
              <strong>{c.title}</strong>
              <span className="muted small">{c.desc}</span>
            </div>
            <a href={c.href} target="_blank" rel="noopener noreferrer" className="check-link">{c.site} ↗</a>
          </li>
        ))}
      </ul>
      <p className="source">출처: 국토교통부 건축물대장 (위반건축물 여부)</p>
    </section>
  );
}
