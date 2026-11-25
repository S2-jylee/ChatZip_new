import { useState } from 'react';
import Icon from '../../components/Icon';
import css from './profile.css?inline';
import usePageStyle from './usePageStyle';

/*
 * 김미정 profile.html 을 React 로 옮긴 것 (내용 · 동작 그대로)
 * - 원본 상단 헤더(top-nav)는 뺌 → 사이트 공통 헤더 사용
 * - CSS 가 사이트 다른 부분과 부딪히지 않게 전체를 <div className="mp-profile"> 로 감싸고, CSS 선택자 앞에 .mp-profile 를 붙임
 * - class → className, for → htmlFor, onclick/onchange → onClick/onChange, value → defaultValue
 * - 비밀번호 칸 보이기/숨기기는 style.display 대신 state 로 같은 결과
 * - 페이지 이동: index.html → /mypage, favorites.html → /mypage/favorites, profile.html → /mypage/profile
 *   (그 외 settings.html · account.html · mypage.html 은 원본 그대로)
 */

// 비밀번호 보이기 / 숨기기 (원본: 화면에서 쓰이지 않음)
// eslint-disable-next-line no-unused-vars
function toggleVisibility(id) {
    const input = document.getElementById(id);

    input.type = input.type === "password"
        ? "text"
        : "password";
}

// 취소
function cancelEdit() {
    if (confirm("회원정보 수정을 취소하시겠습니까?")) {
        window.location.href = "mypage.html";
    }
}

// 계정 관리 페이지 이동
function logout() {
    if (confirm("계정 관리 페이지로 이동하시겠습니까?")) {
        window.location.href = "account.html";
    }
}

export default function MypageProfile() {
    usePageStyle(css);

    const [changePassword, setChangePassword] = useState(true);

    // 회원정보 수정 (화면 예제)
    function handleSubmit(event) {
        event.preventDefault();

        const nickname =
            document.getElementById("nickname").value.trim();

        const password =
            document.getElementById("newPassword").value;

        const confirmPassword =
            document.getElementById("confirmPassword").value;

        if (!nickname) {
            alert("닉네임을 입력해주세요.");
            return;
        }

        if (changePassword) {
            if (password.length < 8) {
                alert("비밀번호는 8자 이상 입력해주세요.");
                return;
            }

            if (password !== confirmPassword) {
                alert("비밀번호가 일치하지 않습니다.");
                return;
            }
        }

        alert("입력값 검사가 완료되었습니다. 실제 저장은 서버 연결이 필요합니다.");
    }

    return (
        <div className="mp-profile">
            <div className="layout">

                {/* 왼쪽 메뉴 */}
                <aside className="sidebar">
                    <div className="profile">
                        <div className="user-circle">C</div>
                        <div>
                            <strong>Chatzip 님</strong>
                            <small>일반회원</small>
                        </div>
                    </div>

                    <nav className="side-menu">
                        <a href="/mypage"><Icon name="home" className="icon-lead" />마이페이지 홈</a>
                        <a href="/mypage/favorites"><Icon name="heart" className="icon-lead" />관심매물</a>
                        <a href="/mypage/profile" className="active">
                            <Icon name="user" className="icon-lead" />회원정보 수정
                        </a>

                        <div className="divider"></div>
                        <a href="settings.html"><Icon name="bell" className="icon-lead" />알림 설정</a>
                        <a href="#" onClick={() => logout()}><Icon name="logout" className="icon-lead" />계정 관리</a>
                    </nav>
                </aside>

                {/* 오른쪽 콘텐츠 */}
                <main className="main">

                    <div className="breadcrumb">
                        <Icon name="home" className="icon-lead" />마이페이지 &gt; 회원정보 수정
                    </div>

                    <section className="content-card">

                        <div className="content-header">
                            <div>
                                <h2>회원정보 수정</h2>
                                <p>본인 확인이 완료되었습니다.</p>
                            </div>
                            <span className="verified">✓ 인증 완료</span>
                        </div>

                        <form id="profileForm" onSubmit={handleSubmit}>

                            <div className="form-row">
                                <label htmlFor="userId">아이디</label>
                                <input
                                    type="text"
                                    id="userId"
                                    defaultValue="chatzip_user"
                                    disabled
                                />
                            </div>

                            <div className="form-row">
                                <label htmlFor="nickname">닉네임 <span className="required">*</span></label>
                                <input
                                    type="text"
                                    id="nickname"
                                    defaultValue="chatzip_user"
                                    required
                                />
                            </div>

                            <div className="form-row">
                                <label htmlFor="email">이메일</label>
                                <input
                                    type="email"
                                    id="email"
                                    defaultValue="user@example.com"
                                    disabled
                                />
                            </div>

                            <div className="info-text">
                                <Icon name="info" className="icon-lead" />이메일 변경은 별도 인증 절차가 필요합니다.
                            </div>

                            {/* 비밀번호 변경 */}
                            <div className="password-box">

                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        id="changePassword"
                                        checked={changePassword}
                                        onChange={(e) => setChangePassword(e.target.checked)}
                                    />
                                    비밀번호 변경하기
                                </label>

                                <div id="passwordSection" style={{ display: changePassword ? 'block' : 'none' }}>

                                    <div className="password-row">
                                        <label htmlFor="newPassword">
                                            새 비밀번호 <span className="required">*</span>
                                        </label>

                                        <div className="password-field">
                                            <input
                                                type="password"
                                                id="newPassword"
                                                placeholder="새 비밀번호 입력"
                                                autoComplete="new-password"
                                            />

                                        </div>
                                    </div>

                                    <p className="password-help">
                                        영문, 숫자, 특수문자 조합 8자 이상
                                    </p>

                                    <div className="password-row">
                                        <label htmlFor="confirmPassword">
                                            새 비밀번호 확인{' '}
                                            <span className="required">*</span>
                                        </label>

                                        <div className="password-field">
                                            <input
                                                type="password"
                                                id="confirmPassword"
                                                placeholder="새 비밀번호 재입력"
                                                autoComplete="new-password"
                                            />

                                        </div>
                                    </div>

                                </div>
                            </div>

                            {/* 버튼 */}
                            <div className="button-area">
                                <button
                                    type="button"
                                    className="btn btn-cancel"
                                    onClick={() => cancelEdit()}
                                >
                                    취소
                                </button>

                                <button type="submit" className="btn btn-save">
                                    변경사항 저장
                                </button>
                            </div>

                        </form>
                    </section>
                </main>
            </div>
        </div>
    );
}
