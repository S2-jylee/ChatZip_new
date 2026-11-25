import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { addFavorite, getFavorites, removeFavorite } from '../api/favorites';
import { errorMessage, statusOf } from '../api/client';
import Icon from './Icon';

/** 관심 매물 저장/해제 토글. 비로그인이면 로그인 페이지로 보냄. compact = 지도 미리보기용 작은 버튼 */
export default function FavoriteButton({ aptId, compact = false, icon = false }) {
  const { user, openAuth } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user) { setSaved(false); return undefined; }
    let cancelled = false;
    getFavorites()
      .then((list) => { if (!cancelled) setSaved(list.some((f) => f.apartment.aptId === aptId)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, aptId]);

  // 비로그인 → 로그인 모달, 로그인되면 바로 저장까지 이어서
  const goLogin = () => openAuth('login', {
    onSuccess: () => addFavorite(aptId).then(() => setSaved(true)).catch((err) => { if (statusOf(err) === 409) setSaved(true); }),
  });

  const toggle = async () => {
    if (!user) { goLogin(); return; }
    setBusy(true);
    setMessage('');
    try {
      if (saved) {
        await removeFavorite(aptId);
        setSaved(false);
      } else {
        await addFavorite(aptId);
        setSaved(true);
      }
    } catch (err) {
      if (statusOf(err) === 409) setSaved(true); // 이미 저장됨 → 상태만 맞춤
      else if (statusOf(err) === 401) goLogin();
      else setMessage(errorMessage(err, '관심 매물 처리에 실패했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  // 하트 아이콘만 (지도 말풍선용 찜 버튼)
  if (icon) {
    return (
      <button
        type="button"
        className={`heart-btn${saved ? ' on' : ''}`}
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        disabled={busy}
        aria-pressed={saved}
        aria-label={saved ? '찜 해제' : '찜하기'}
        title={saved ? '찜 해제' : '찜하기 (관심 매물)'}
      >
        {/* 아래 꼭지점 · 가운데 홈이 또렷하게 직선으로 모이는 하트 (모서리는 둥글게 이음) */}
        <svg viewBox="0 0 24 24" width="20" height="20" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" />
        </svg>
      </button>
    );
  }

  const button = (
    <button
      type="button"
      className={`btn ${compact ? 'btn-sm btn-fav-compact ' : 'btn-lg '}${saved ? 'btn-saved' : compact ? 'btn-ghost' : 'btn-accent'}`}
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      title={saved ? '관심 매물에서 빼기' : '관심 매물에 저장'}
    >
      <Icon name="heart" filled={saved} />{compact ? (saved ? '저장됨' : '저장') : (saved ? '관심 매물 저장됨' : '관심 매물 저장')}
    </button>
  );

  if (compact) return button;
  return (
    <div className="fav">
      {button}
      {!user && <p className="muted small">로그인 후 저장할 수 있어요.</p>}
      {message && <p className="form-error">{message}</p>}
    </div>
  );
}
