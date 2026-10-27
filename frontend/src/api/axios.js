import axios from 'axios';

const api = axios.create({
  // The production frontend and API share one origin on Vercel. Never bake a
  // developer's localhost API URL into a production bundle.
  baseURL: import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL || '/api'),
  timeout: 30000,
  withCredentials: true,
});

const isPublicAuth = (url = '') => /\/auth\/(login|register|google)\/?$/.test(url);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isPublicAuth(error.config?.url)) window.dispatchEvent(new Event('audit:auth-expired'));
    return Promise.reject(error);
  }
);

export default api;
