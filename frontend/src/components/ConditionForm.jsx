import { useState } from 'react';
import { REGIONS } from '../constants/regions';

const CURRENT_YEAR = new Date().getFullYear();

/** 맞춤 추천 조건 입력 */
export default function ConditionForm({ onSubmit, loading, initial }) {
  // initial: 마이페이지 선호 조건으로 미리 채움 (로그인 시)
  const [form, setForm] = useState({ gu: '', maxPrice: '', minArea: '', minBuiltYear: '', ...initial });
  const [error, setError] = useState('');

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.maxPrice || Number(form.maxPrice) <= 0) {
      setError('예산(최대 가격)을 입력해 주세요.');
      return;
    }
    if (form.minBuiltYear && (form.minBuiltYear < 1960 || form.minBuiltYear > CURRENT_YEAR)) {
      setError(`준공연도는 1960 ~ ${CURRENT_YEAR} 사이로 입력해 주세요.`);
      return;
    }
    setError('');
    onSubmit(form);
  };

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <h2 className="card-title">내 조건</h2>
      <label className="field">
        <span>예산(최대 가격, 만원) *</span>
        <input type="number" name="maxPrice" min="0" step="1000" placeholder="예: 80000 (8억)" value={form.maxPrice} onChange={change} />
      </label>
      <label className="field">
        <span>희망 지역</span>
        <select name="gu" value={form.gu} onChange={change}>
          <option value="">상관없음</option>
          {REGIONS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </label>
      <label className="field">
        <span>최소 전용면적 (㎡)</span>
        <input type="number" name="minArea" min="0" step="1" placeholder="예: 59" value={form.minArea} onChange={change} />
      </label>
      <label className="field">
        <span>준공연도 (이후)</span>
        <input type="number" name="minBuiltYear" min="1960" max={CURRENT_YEAR} placeholder="예: 2005" value={form.minBuiltYear} onChange={change} />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
        {loading ? '추천 중…' : '추천 받기'}
      </button>
    </form>
  );
}
