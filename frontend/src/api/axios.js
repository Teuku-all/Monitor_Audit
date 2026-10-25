import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 30000,
});

const isPublicAuth = (url = '') => /\/auth\/(login|register)\/?$/.test(url);

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && !isPublicAuth(config.url)) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Keep invalid-login errors on the form and ignore responses from an old session.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const token = localStorage.getItem('token');
    if (error.response?.status === 401 && !isPublicAuth(error.config?.url)
      && token && error.config?.headers?.Authorization === `Bearer ${token}`) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('audit:auth-expired'));
    }
    return Promise.reject(error);
  }
);

export default api;
