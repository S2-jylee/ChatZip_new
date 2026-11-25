import { useState } from 'react';
import css from './favorites.css?inline';
import usePageStyle from './usePageStyle';
import Icon from '../../components/Icon';

/*
 * 김미정 favorites.html 을 React 로 옮긴 것 (내용 · 동작 그대로)
 * - 원본 상단 헤더(top-nav)는 뺌 → 사이트 공통 헤더 사용
 * - CSS 가 사이트 다른 부분과 부딪히지 않게 전체를 <div className="mp-favorites"> 로 감싸고, CSS 선택자 앞에 .mp-favorites 를 붙임
 * - class → className, onclick → onClick
 * - 하트(toggleFavorite) · 개수(updateCount) · 정렬은 DOM 을 직접 바꾸던 것을 state 로 같은 결과가 나오게 함
 * - 페이지 이동: index.html → /mypage, profile.html → /mypage/profile
 * - 원본 그대로 둔 것: logout 의 window.local.href 오타, 쓰이지 않는 deleteFavorite · addFavorite
 */

const properties = [
    {
        price: 16,
        image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=500",
        alt: "광교자이더클래스 아파트",
        name: "광교자이더클래스",
        location: "수원시 영통구",
        details: ["34평 84㎡", "총 1,200세대", "준공 2014년"],
        priceText: "16억 원",
    },
    {
        price: 14,
        image: "https://images.unsplash.com/photo-1460317442991-0ec209397118?w=500",
        alt: "연현마을 LG 아파트",
        name: "연현마을 LG",
        location: "용인시 기흥구",
        details: ["30평 84㎡", "총 850세대", "준공 2011년"],
        priceText: "14억 원",
    },
    {
        price: 25,
        image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=500",
        alt: "한교푸르지오그랑블 아파트",
        name: "한교푸르지오그랑블",
        location: "성남시 분당구",
        details: ["40평 114㎡", "총 970세대", "준공 2013년"],
        priceText: "25억 원",
    },
];

const recentViews = [
    {
        image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=200",
        name: "마포래미안푸르지오",
        address: "마포구 아현동, 아파트",
        tags: ["전용 84㎡", "14층", "2014년"],
        price: "14억 2,000",
        date: "조회 2026.11.23",
    },
    {
        image: "https://images.unsplash.com/photo-1460317442991-0ec209397118?w=200",
        name: "e편한세상 신촌",
        address: "서대문구 북아현동, 아파트",
        tags: ["전용 84㎡", "3층", "2017년"],
        price: "12억 9,000",
        date: "조회 2026.11.22",
    },
    {
        image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=200",
        name: "DMC파크뷰자이",
        address: "서대문구 남가좌동, 아파트",
        tags: ["전용 59㎡", "11층", "2015년"],
        price: "8억 7,000",
        date: "조회 2026.11.21",
    },
];

/* 로그 아웃 */
function logout(){
  const result = confirm("로그아웃하시겠습니까?");
   if(result){
    //로그인 페이지로 이동
    window.local.href = "login.html";
   }else{
    //현재 페이지 유지
    return;
   }
}

//관심매물 삭제 (원본: 화면에서 쓰이지 않음)
// eslint-disable-next-line no-unused-vars
function deleteFavorite(button) {

    const result = confirm(
        "관심매물에서 삭제하시겠습니까?"
    );

    if (!result) {
        return;
    }

    // 선택한 매물 찾기
    const item = button.closest(".favorite-item");

    if (!item) {
        return;
    }

    // 관심매물 삭제
    item.remove();

    // 카운트 자동 갱신
    // eslint-disable-next-line no-undef
    updateFavoriteCount();
}
// 관심매물 추가시 카운트 증가 (원본: 화면에서 쓰이지 않음)
// eslint-disable-next-line no-unused-vars
function addFavorite(propertyHTML) {

    const favoriteList = document.querySelector(
        ".content-box #favoriteList"
    );

    // 새 매물 HTML 추가
    favoriteList.insertAdjacentHTML(
        "beforeend",
        propertyHTML
    );

    // 카운트 갱신
    // eslint-disable-next-line no-undef
    updateFavoriteCount();
}

// 상세보기
function showDetail(name) {
    alert(name + " 상세정보 페이지로 이동합니다.");
}

function openRecentProperty(propertyName) {

    alert(propertyName + " 상세정보로 이동합니다.");

    // 실제 서비스에서는 해당 매물의 상세 페이지 URL로 이동하도록 연결
}

export default function MypageFavorites() {
    usePageStyle(css);

    // 하트 꺼진 매물 (원본: button.classList "off")
    const [off, setOff] = useState(() => new Set());
    // 정렬 (원본: select#sort change → 카드 순서 바꿈. "최근 등록순"으로 돌아가도 순서는 그대로)
    const [order, setOrder] = useState(properties);

    // 관심매물 하트 버튼
    function toggleFavorite(name) {
        setOff((prev) => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name); else next.add(name);
            return next;
        });
    }

    // 관심매물 개수 (updateCount)
    const count = properties.length - off.size;

    // 가격 정렬
    function sortChange(e) {
        const value = e.target.value;
        const cards = [...order];

        if (value === "high") {
            cards.sort((a, b) => Number(b.price) - Number(a.price));
        }

        if (value === "low") {
            cards.sort((a, b) => Number(a.price) - Number(b.price));
        }

        setOrder(cards);
    }

    return (
        <div className="mp-favorites">
            <div className="container">

                {/* 왼쪽 메뉴 */}
                <aside className="sidebar">

                    <div className="logo">마이페이지</div>

                    <div className="profile">
                        <div className="profile-icon">C</div>
                        <div className="profile-name">Chatzip 님</div>
                    </div>

                    <button className="profile-edit" href="/mypage/profile">회원정보 수정</button>

                    <div className="menu">
                        <a className="menu-item" href="/mypage"><Icon name="home" className="icon-lead" />마이페이지 홈</a>
                        <a className="menu-item active"><Icon name="heart" filled className="icon-lead" />관심매물</a>
                        <a className="menu-item" onClick={() => logout()}>⇥ 로그아웃</a>
                    </div>

                </aside>

                <main className="main">

                    <div className="header1">
                        <div>
                            <div className="header-title">
                                <span className="heart-title"><Icon name="heart" filled size={20} /></span>
                                <h2>관심매물</h2>
                                <span className="count" id="count">{count + "건"}</span>
                            </div>
                            <p className="description">
                                관심 있는 매물을 한눈에 확인하고 비교해보세요.
                            </p>
                        </div>

                        <select className="sort" id="sort" defaultValue="default" onChange={sortChange}>
                            <option value="default">최근 등록순</option>
                            <option value="high">높은 가격순</option>
                            <option value="low">낮은 가격순</option>
                        </select>
                    </div>

                    <div className="property-list" id="propertyList">

                        {order.map((p) => (
                            <div className="property-card" data-price={p.price} key={p.name}>
                                <img className="property-image"
                                     src={p.image}
                                     alt={p.alt} />

                                <div className="property-info">
                                    <div className="property-title">
                                        <span className="tag">아파트</span>
                                        <span className="property-name">{p.name}</span>
                                    </div>

                                    <div className="location"><Icon name="pin" className="icon-lead" />{p.location}</div>

                                    <div className="details">
                                        {p.details.map((d) => <span key={d}>{d}</span>)}
                                    </div>
                                </div>

                                <div className="price-area">
                                    <div className="price-label">매매가격</div>
                                    <div className="price">{p.priceText}</div>

                                    <div className="card-actions">
                                        <button className={`favorite${off.has(p.name) ? ' off' : ''}`} onClick={() => toggleFavorite(p.name)} aria-pressed={!off.has(p.name)} aria-label={off.has(p.name) ? '찜하기' : '찜 해제'}>
                                            <Icon name="heart" filled={!off.has(p.name)} size={18} />
                                        </button>
                                        <button className="detail-btn"
                                            onClick={() => showDetail(p.name)}>
                                            상세보기
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                    </div>
                    {/* 최근 조회한 매물 */}
                    <div className="recent-view-section">

                        <div className="recent-view-header">
                            <h3>최근 조회한 매물</h3>
                            <span>최근 조회 24건</span>
                        </div>

                        <div className="recent-view-list">

                            {recentViews.map((r) => (
                                <div className="recent-view-item" key={r.name}>

                                    <div className="recent-view-image">
                                        <img src={r.image}
                                             alt={r.name} />
                                    </div>

                                    <div className="recent-view-info">
                                        <div className="recent-view-name">
                                            {r.name}
                                        </div>

                                        <div className="recent-view-address">
                                            {r.address}
                                        </div>

                                        <div className="recent-view-tags">
                                            {r.tags.map((t) => <span key={t}>{t}</span>)}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="recent-view-price">{r.price}</div>
                                        <div className="recent-view-date">{r.date}</div>
                                    </div>

                                    <button className="recent-view-button"
                                        onClick={() => openRecentProperty(r.name)}>
                                        상세보기
                                    </button>

                                </div>
                            ))}

                        </div>

                    </div>

                </main>
            </div>
        </div>
    );
}
