import { useEffect } from 'react';

/**
 * 김미정 원본 CSS 를 고치지 않고 그대로 쓰기 위한 도우미
 * 이 화면에 있는 동안에만 <style> 로 넣고, 화면을 떠나면 뺌 (다른 화면에 남지 않게)
 * 사용: import css from './index.css?inline'; usePageStyle(css);
 */
export default function usePageStyle(cssText) {
  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = cssText;
    document.head.appendChild(el);
    return () => el.remove();
  }, [cssText]);
}
