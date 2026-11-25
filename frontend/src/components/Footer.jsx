import { Link, useLocation } from 'react-router-dom';
import { MAIN_MENUS, MAP_PATH } from '../constants/menus';

const FIND_LINKS = MAIN_MENUS.filter((m) => ['/search', '/analysis', MAP_PATH].includes(m.to));
const SERVICE_LINKS = [
  { to: '/search?tab=recommend', label: '맞춤 추천' },
  ...MAIN_MENUS.filter((m) => ['/predict', '/favorites'].includes(m.to)),
];

/** 사이트 하단 — 지도 화면은 지도가 화면 전체를 쓰므로 표시하지 않음 */
export default function Footer() {
  const { pathname } = useLocation();
  if (pathname === MAP_PATH) return null;

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Link to="/" className="footer-logo" aria-label="ChatZip 홈">
            Chat<span className="logo-accent">Zip</span>
          </Link>
          <p>경기도 성남, 용인, 수원의 매물 검색과 지역 분석, AI 예상가 서비스</p>
        </div>

        <nav className="footer-links" aria-label="하단 메뉴">
          <div>
            <strong>찾기와 분석</strong>
            {FIND_LINKS.map((l) => <Link key={l.to} to={l.to}>{l.label}</Link>)}
          </div>
          <div>
            <strong>서비스</strong>
            {SERVICE_LINKS.map((l) => <Link key={l.to} to={l.to}>{l.label}</Link>)}
          </div>
        </nav>
      </div>

      <div className="footer-bottom">
        <p>
          데이터 출처: 국토교통부 실거래가 공개시스템, 공공데이터포털.
          AI 예상가는 <b>참고용</b> 추정치이며 실제 시세와 다를 수 있습니다.
        </p>
        <p>© {new Date().getFullYear()} ChatZip</p>
      </div>
    </footer>
  );
}
