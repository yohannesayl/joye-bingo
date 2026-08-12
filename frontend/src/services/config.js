// Dynamic Backend API & WebSocket URL Config
export const getBackendUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:5000';

  // 1. Saved custom Render URL in localStorage
  const savedUrl = localStorage.getItem('joye_backend_url');
  if (savedUrl && savedUrl.startsWith('http')) {
    return savedUrl.replace(/\/$/, '');
  }

  // 2. Vite environment variable
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }

  // 3. If running locally on localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }

  // 4. Default for production deployment: Connect to Render backend URL
  return 'https://joye-bingo.onrender.com';
};

export const setBackendUrl = (url) => {
  if (url) {
    localStorage.setItem('joye_backend_url', url.trim().replace(/\/$/, ''));
  } else {
    localStorage.removeItem('joye_backend_url');
  }
};
