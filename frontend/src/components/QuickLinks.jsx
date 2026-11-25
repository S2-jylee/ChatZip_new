import { Link } from 'react-router-dom';
import Icon from './Icon';

const LINKS = [
  {
    to: '/map', no: '01', step: '찾기', icon: 'map',
    title: '지도에서 매물 찾기', desc: '지역·가격·면적으로 좁히고, 가격 마커를 눌러 바로 확인',
  },
  {
    to: '/predict', no: '02', step: '판단하기', icon: 'chart',
    title: 'AI 가격 예측', desc: '면적·층·준공연도만 넣으면 AI 예상가와 구 평균을 비교',
  },
  {
    to: '/search?tab=recommend', no: '03', step: '모으기', icon: 'sparkles',
    title: '조건 맞춤 추천', desc: '예산과 조건 한 번 입력으로 추천 매물 10건, 마음에 들면 저장',
  },
];

export default function QuickLinks() {
  return (
    <div className="quicklinks">
      {LINKS.map((l) => (
        <Link key={l.to} to={l.to} className="quicklink">
          <div className="quicklink-top">
            <span className="quicklink-icon" aria-hidden="true"><Icon name={l.icon} size={22} /></span>
            <span className="quicklink-no">{l.step}</span>
          </div>
          <strong>{l.title}</strong>
          <p>{l.desc}</p>
          <span className="quicklink-arrow">바로가기</span>
        </Link>
      ))}
    </div>
  );
}
