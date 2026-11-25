import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MAIN_MENUS } from '../constants/menus';

// 메뉴 = 기능 단위 (홈 · 매물찾기 · 지역별분석 · 지도 · AI가격예측 · 관심매물) — constants/menus.js

// 로그인 이름(○○님) 드롭다운 메뉴 항목
const USER_LINKS = [
  { to: '/mypage', label: '마이페이지' },
  { to: '/favorites', label: '관심 매물' },
  { to: '/search?tab=recommend', label: '맞춤 추천' },
];

const navClass = (base) => ({ isActive }) => `${base}${isActive ? ' active' : ''}`;

export default function Header() {
  const { user, checking, logout, openAuth } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false); // 모바일 전체 메뉴(오른쪽 패널)
  const [userOpen, setUserOpen] = useState(false); // PC: 이름 누르면 드롭다운
  const userRef = useRef(null);
  useEffect(() => { setUserOpen(false); }, [pathname]);
  useEffect(() => {
    if (!userOpen) return undefined;
    const onDown = (e) => { if (!userRef.current?.contains(e.target)) setUserOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setUserOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [userOpen]);
  const navRef = useRef(null);
  // 모바일 메뉴 줄: 양 끝에 더 볼 메뉴가 있으면 ‹ › 버튼 표시
  const [edge, setEdge] = useState({ left: false, right: false });
  const updateEdge = () => {
    const nav = navRef.current;
    if (!nav) return;
    const max = nav.scrollWidth - nav.clientWidth;
    setEdge({ left: nav.scrollLeft > 4, right: nav.scrollLeft < max - 4 });
  };
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    updateEdge();
    nav.addEventListener('scroll', updateEdge, { passive: true });
    window.addEventListener('resize', updateEdge);
    return () => { nav.removeEventListener('scroll', updateEdge); window.removeEventListener('resize', updateEdge); };
  }, []);
  const scrollNav = (dir) => {
    const nav = navRef.current;
    nav?.scrollBy({ left: dir * nav.clientWidth * 0.6, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/');
  };

  // 페이지 이동하면 메뉴 닫고, 모바일 메뉴 줄에서 선택된 탭이 보이게 가운데로 스크롤
  useEffect(() => {
    setMenuOpen(false);
    const nav = navRef.current;
    const el = nav?.querySelector('.nav-link.active');
    if (nav && el && nav.scrollWidth > nav.clientWidth) {
      nav.scrollTo({ left: el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' });
    }
  }, [pathname]);

  // 매물 종류 탭 줄 좌우 스와이프: 터치는 브라우저 기본 스크롤, 마우스(PC 모바일 미리보기 등)는 끌어서 스크롤
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    let startX = 0;
    let startLeft = 0;
    let dragging = false;
    let moved = false;
    const onDown = (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || nav.scrollWidth <= nav.clientWidth) return;
      dragging = true; moved = false; startX = e.clientX; startLeft = nav.scrollLeft;
    };
    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 4) { moved = true; nav.classList.add('dragging'); }
      if (moved) nav.scrollLeft = startLeft - dx;
    };
    const onUp = () => { dragging = false; nav.classList.remove('dragging'); };
    // 끌었으면 손 뗄 때 링크가 눌리지 않게
    const onClick = (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } };
    nav.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    nav.addEventListener('click', onClick, true);
    nav.addEventListener('dragstart', (e) => e.preventDefault()); // 링크 끌기(이미지·URL 드래그) 방지
    return () => {
      nav.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      nav.removeEventListener('click', onClick, true);
    };
  }, []);

  // 메뉴 열렸을 때 Esc 로 닫기
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  let authArea = null;
  if (!checking && user) {
    authArea = (
      // 로그인하면 이름 알약 → 누르면 드롭다운 메뉴 (휴대폰은 ☰ 메뉴)
      <div className="user-menu-wrap" ref={userRef}>
        <button
          type="button"
          className={`user-pill${userOpen ? ' active' : ''}`}
          aria-haspopup="menu"
          aria-expanded={userOpen}
          onClick={() => setUserOpen((v) => !v)}
        >
          <span className="user-avatar" aria-hidden="true">{user.name?.[0] ?? '?'}</span>
          <span className="user-pill-name"><b>{user.name}</b>님</span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: userOpen ? 'rotate(180deg)' : 'none' }}><path d="M6 9l6 6 6-6" /></svg>
        </button>
        {userOpen && (
          <div className="user-menu" role="menu">
            <div className="user-menu-head">
              <span className="user-avatar lg" aria-hidden="true">{user.name?.[0] ?? '?'}</span>
              <div>
                <strong>{user.name}님</strong>
                <small>{user.provider === 'kakao' ? '카카오 로그인' : (user.email || user.loginId)}</small>
              </div>
            </div>
            {USER_LINKS.map((l) => (
              <Link key={l.to} to={l.to} role="menuitem" className="user-menu-item" onClick={() => setUserOpen(false)}>{l.label}</Link>
            ))}
            <button type="button" role="menuitem" className="user-menu-item user-menu-logout" onClick={() => { setUserOpen(false); handleLogout(); }}>로그아웃</button>
          </div>
        )}
      </div>
    );
  } else if (!checking) {
    // 로그인 전: 사람 아이콘 하나 → 로그인 모달 (회원가입은 모달 안에서 전환)
    authArea = (
      <button type="button" className="login-icon" onClick={() => openAuth('login')} aria-label="로그인 또는 회원가입" title="로그인 · 회원가입">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
        </svg>
      </button>
    );
  }

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="logo" aria-label="ChatZip 홈">
          <span className="logo-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11l9-7 9 7" />
              <path d="M5 10v10h14V10" />
              <path d="M10 20v-5h4v5" />
            </svg>
          </span>
          Chat<span className="logo-accent">Zip</span>
        </Link>
        {/* PC: 메뉴 한 줄 · 모바일: 둘째 줄 알약 모양 탭 (가로 스크롤) */}
        <div className={`nav-wrap${edge.left ? ' can-left' : ''}${edge.right ? ' can-right' : ''}`}>
          <button type="button" className="nav-arrow left" onClick={() => scrollNav(-1)} aria-label="이전 메뉴" tabIndex={-1} hidden={!edge.left}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <nav className="nav" ref={navRef} aria-label="주 메뉴">
            {MAIN_MENUS.map((m) => (
              <NavLink key={m.to} to={m.to} end={m.end} state={{ menu: true }} className={navClass('nav-link')}>{m.label}</NavLink>
            ))}
          </nav>
          <button type="button" className="nav-arrow right" onClick={() => scrollNav(1)} aria-label="다음 메뉴" tabIndex={-1} hidden={!edge.right}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>
        <div className="header-auth">{authArea}</div>
        <button
          type="button"
          className="menu-btn"
          aria-label="전체 메뉴"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>

      {/* 모바일 전체 메뉴: 주 메뉴 + 설명 · 로그인 · 마이페이지 */}
      {menuOpen && (
        <div className="menu-overlay" onClick={() => setMenuOpen(false)}>
          <div className="menu-panel" role="dialog" aria-label="전체 메뉴" onClick={(e) => e.stopPropagation()}>
            <div className="menu-head">
              {user ? <span><b>{user.name}</b>님</span> : <span>로그인하고 관심매물을 저장하세요</span>}
              <button type="button" className="menu-close" onClick={() => setMenuOpen(false)} aria-label="닫기">×</button>
            </div>
            {!checking && !user && (
              <div className="menu-auth">
                <button type="button" className="btn btn-ghost" onClick={() => { setMenuOpen(false); openAuth('login'); }}>로그인</button>
                <button type="button" className="btn btn-primary" onClick={() => { setMenuOpen(false); openAuth('signup'); }}>회원가입</button>
              </div>
            )}
            <div className="menu-section">메뉴</div>
            {MAIN_MENUS.map((m) => (
              <NavLink key={m.to} to={m.to} end={m.end} state={{ menu: true }} className={navClass('menu-link')}>
                {m.label}{m.desc && <small>{m.desc}</small>}
              </NavLink>
            ))}
            {user && <div className="menu-section">내 계정</div>}
            {user && <button type="button" className="menu-link menu-logout" onClick={handleLogout}>로그아웃</button>}
          </div>
        </div>
      )}
    </header>
  );
}
