import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    // GitHub Pages 배포(https://s2-jylee.github.io/ChatZip/) 때만 하위 경로 사용. 로컬 개발·빌드는 '/'
    base: process.env.VITE_BASE || '/',
    server: {
      // host: true → 같은 와이파이의 휴대폰에서 http://<PC IP>:5173 으로 접속 가능
      port: 5173,
      host: true,
      // 개발 중 /api 요청을 백엔드로 넘김 → 브라우저 CORS 문제 없음 (.env 의 VITE_PROXY_TARGET, 없으면 끔)
      proxy: env.VITE_PROXY_TARGET ? { '/api': { target: env.VITE_PROXY_TARGET, changeOrigin: true } } : undefined,
    },
  };
});
