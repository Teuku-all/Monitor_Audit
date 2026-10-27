import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api'),
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
