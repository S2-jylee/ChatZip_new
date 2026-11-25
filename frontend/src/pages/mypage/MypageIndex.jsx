import { useState } from 'react';
import css from './index.css?inline';
import usePageStyle from './usePageStyle';
import Icon from '../../components/Icon';

/*
 * 김미정 index.html 을 React 로 옮긴 것 (내용 · 동작 그대로)
 * - 원본 상단 헤더(top-nav)는 뺌 → 사이트 공통 헤더 사용
 * - CSS 가 사이트 다른 부분과 부딪히지 않게 전체를 <div className="mp-index"> 로 감싸고, CSS 선택자 앞에 .mp-index 를 붙임
 * - class → className, onclick → onClick, style 문자열 → 객체
 * - innerHTML 로 그리던 목록은 같은 마크업을 JSX 로 그림
 * - 페이지 이동: index.html → /mypage, favorites.html → /mypage/favorites, profile.html → /mypage/profile
 *   (그 외 edit-profile.html · login.html · my-properties.html 은 원본 그대로)
 * - 원본의 짝 없는 </section> 은 JSX 에서 쓸 수 없어 뺌
 */

// 예시 데이터
const registeredProperties = [
    {
        name: "광교자이더클래스",
        address: "수원시 영통구 광교호수로 15",
        area: "84.9㎡",
        floor: "32층",
        price: "16억 4,000",
        status: "게시중",
        statusClass: "active",
        image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=200"
    },
    {
        name: "광교중흥S클래스",
        address: "수원시 영통구 광교중앙로 120",
        area: "84.8㎡",
        floor: "28층",
        price: "19억 8,000",
        status: "승인대기",
        statusClass: "pending",
        image: "https://images.unsplash.com/photo-1460317442991-0ec209397118?w=200"
    },
    {
        name: "연원마을 LG",
        address: "용인시 기흥구 마북로 154",
        area: "59.8㎡",
        floor: "21층",
        price: "14억 2,000",
        status: "반려",
        statusClass: "closed",
        image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=200"
    }
];

const defaultFavorites = [
    {
        id: 1,
        name: "래미안 마포리버웰",
        address: "마포구 상수동",
        area: "84㎡",
        floor: "12층",
        year: "2016년",
        station: "상수역 도보 6분",
        price: "13억 5,000",
        deal: "2026.10.28",
        saved: "2026.11.15",
        ai: "AI 적정가",
        aiClass: "ai-good"
    },
    {
        id: 2,
        name: "힐스테이트 신촌",
        address: "서대문구 북아현동",
        area: "59㎡",
        floor: "15층",
        year: "2022년",
        station: "아현역 도보 5분",
        price: "10억 8,000",
        deal: "2026.11.02",
        saved: "2026.11.12",
        ai: "AI 저평가",
        aiClass: "ai-low"
    },
    {
        id: 3,
        name: "신촌숲 아이파크",
        address: "마포구 신수동",
        area: "59㎡",
        floor: "8층",
        year: "2019년",
        station: "서강대역 도보 7분",
        price: "11억 2,000",
        deal: "2026.10.19",
        saved: "2026.11.08",
        ai: "AI 고평가",
        aiClass: "ai-high"
    }
];

const defaultRecent = [
    {
        id: 101,
        region: "마포구",
        name: "마포래미안푸르지오",
        detail: "84㎡, 14층, 2014년",
        price: "14억 2,000",
        unit: "평당 5,580만",
        date: "2026.11.19"
    },
    {
        id: 102,
        region: "서대문구",
        name: "e편한세상 신촌",
        detail: "84㎡, 3층, 2017년",
        price: "12억 9,000",
        unit: "평당 5,070만",
        date: "2026.11.19"
    },
    {
        id: 103,
        region: "서대문구",
        name: "DMC파크뷰자이",
        detail: "59㎡, 11층, 2015년",
        price: "8억 7,000",
        unit: "평당 4,870만",
        date: "2026.11.18"
    }
];

// localStorage
function loadData(key, fallback) {
    try {
        const stored = localStorage.getItem(key);
        return stored === null ? fallback : JSON.parse(stored);
    } catch {
        return fallback;
    }
}

export default function MypageIndex() {
    usePageStyle(css);

    const [favorites, setFavorites] = useState(() => loadData("chatzipFavorites", defaultFavorites));
    const [recentViews] = useState(() => loadData("chatzipRecentViews", defaultRecent));

    // 관심매물 삭제
    function deleteFavorite(id) {
        if (!confirm("관심매물에서 삭제하시겠습니까?")) {
            return;
        }

        const next = favorites.filter(p => p.id !== id);

        localStorage.setItem(
            "chatzipFavorites",
            JSON.stringify(next)
        );

        setFavorites(next);
    }

    // 로그아웃
    function logout() {
        if (confirm("로그아웃하시겠습니까?")) {
            window.location.href = "login.html";
        }
    }

    return (
        <div className="mp-index">

            <div className="page">
                                <h1>마이페이지</h1>

                <div className="layout">

                    {/* 왼쪽 */}
                    <aside className="sidebar">
                        <div className="profile">
                            <div className="profile-avatar">C</div>
                            <h2>Chatzip 님</h2>
                            <p>Chatzip@gmail.com, 2026.03 가입</p>
                            <button className="profile-edit"
                                onClick={() => { window.location.href = 'edit-profile.html'; }}>
                                프로필 편집
                            </button>
                        </div>

                        <div className="side-divider"></div>

                        <div className="condition-title">
                            <span>선호 조건</span>
                            <span className="ai-badge">맞춤추천에 사용</span>
                        </div>

                        <div className="condition-row">
                            <span>매물 종류</span>
                            <strong>아파트 매매</strong>
                        </div>
                        <div className="condition-row">
                            <span>지역</span>
                            <strong>마포, 서대문</strong>
                        </div>
                        <div className="condition-row">
                            <span>예산</span>
                            <strong>9~12억</strong>
                        </div>
                        <div className="condition-row">
                            <span>면적</span>
                            <strong>60~85㎡</strong>
                        </div>
                        <div className="condition-row">
                            <span>역세권</span>
                            <strong>도보 10분</strong>
                        </div>

                        <button className="condition-btn"
                            onClick={() => alert('조건 수정 페이지를 연결해주세요.')}>
                            조건 수정
                        </button>

                        <div className="side-divider"></div>

                        <a href="edit-profile.html" className="side-link">
                            회원정보와 비밀번호
                        </a>

                        <button className="logout" onClick={() => logout()}>
                            로그아웃
                        </button>
                    </aside>

                    {/* 오른쪽 */}
                    <main className="main">

                        {/* 요약 */}
                        <div className="stats">
                            <div className="stat-card">
                                <div className="stat-label">관심 매물</div>
                                <div className="stat-number">
                                    <span id="favoriteCount">{favorites.length}</span><small>건</small>
                                </div>
                            </div>
                        </div>

                        <div className="stats">
                            <div className="stat-card">
                                <div className="stat-label">최근 조회 한 매물</div>
                                <div className="stat-number">
                                    <span id="favoriteCount">12</span><small>건</small>
                                </div>
                            </div>
                        </div>

                        {/* 등록매물 렌더링 */}
                        <div id="registeredList">
                            {registeredProperties.map(p => (
                                <div className="registered-item" key={p.name}>
                                    <img className="registered-image"
                                         src={p.image}
                                         alt={p.name} />

                                    <div>
                                        <div className="property-name">{p.name}</div>
                                        <div className="property-address">{p.address}</div>
                                        <div className="property-tags">
                                            <span>아파트</span>
                                            <span>전용 {p.area}</span>
                                            <span>{p.floor}</span>
                                        </div>
                                    </div>

                                    <div className="registered-price">
                                        <small>매매</small>{p.price}
                                    </div>

                                    <span className={`status ${p.statusClass}`}>
                                        {p.status}
                                    </span>

                                    <button className="more-btn"
                                        aria-label="매물 관리"
                                        onClick={() => { window.location.href = 'my-properties.html'; }}>
                                        ⋯
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* 관심매물 */}
                        <section className="section">
                            <div className="section-header">
                                <h3>
                                    관심 매물
                                    <span id="favoriteSectionCount">{favorites.length + "건"}</span>
                                </h3>

                                <button className="btn-outline"
                                    onClick={() => { window.location.href = '/mypage/favorites'; }}>
                                    전체 보기
                                </button>
                            </div>

                            <div id="favoriteList">
                                {favorites.length === 0 ? (
                                    <p className="empty">등록된 관심매물이 없습니다.</p>
                                ) : favorites.slice(0, 3).map(p => (
                                    <div className="favorite-item" key={p.id}>
                                        <h4>
                                            {p.name}
                                            <span className={p.aiClass}>{p.ai}</span>
                                        </h4>

                                        <p>
                                            {p.address}, {p.area},
                                            {' '}{p.floor}, {p.year}
                                        </p>

                                        <p><Icon name="train" className="icon-lead" />{p.station}</p>

                                        <div className="favorite-price">
                                            {p.price}
                                            <small>거래 {p.deal}</small>
                                        </div>

                                        <div className="favorite-right">
                                            <small>저장 {p.saved}</small>
                                            <button className="delete-btn"
                                                onClick={() => deleteFavorite(p.id)}>
                                                삭제
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* 최근 본 매물 */}
                        <section className="recent-section">
                            <div className="section-header">
                                <h3>최근 본 매물</h3>
                                <span style={{ color: 'var(--gray)', fontSize: '11px' }}>
                                    이 기기에서 본 매물{' '}
                                    <span id="recentCount">{recentViews.length}</span>건
                                </span>
                            </div>

                            <div className="recent-grid" id="recentList">
                                {!recentViews.length ? (
                                    <p className="empty">최근 조회한 매물이 없습니다.</p>
                                ) : recentViews.slice(0, 3).map(p => (
                                    <div className="recent-card" key={p.id}>
                                        <div className="recent-top">
                                            <span className="region-badge">{p.region}</span>
                                            <span className="recent-date">{p.date}</span>
                                        </div>

                                        <div className="recent-name">{p.name}</div>
                                        <div className="recent-detail">{p.detail}</div>

                                        <div className="recent-bottom">
                                            <span className="recent-price">{p.price}</span>
                                            <span className="recent-unit">{p.unit}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                    </main>
                </div>
            </div>
        </div>
    );
}
