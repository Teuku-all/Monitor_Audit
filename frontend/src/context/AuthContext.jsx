import { createContext, useContext, useEffect, useRef, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Verify the role with the server instead of trusting localStorage.
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const generation = useRef(0);

  useEffect(() => {
    const expire = () => {
      generation.current += 1;
      setUser(null);
      setLoading(false);
      setAuthError(false);
    };
    window.addEventListener('audit:auth-expired', expire);
    return () => window.removeEventListener('audit:auth-expired', expire);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      localStorage.removeItem('user');
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const requestGeneration = generation.current;
    setLoading(true);
    setAuthError(false);
    api.get('/auth/profile', { signal: controller.signal })
      .then(({ data }) => {
        if (generation.current !== requestGeneration || localStorage.getItem('token') !== token) return;
        setUser(data);
        localStorage.setItem('user', JSON.stringify(data));
      })
      .catch((error) => {
        if (controller.signal.aborted || generation.current !== requestGeneration) return;
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        } else {
          // Keep the token during connection failures to allow retrying.
          setAuthError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && generation.current === requestGeneration) setLoading(false);
      });
    return () => controller.abort();
  }, [sessionAttempt]);

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email: email.trim(), password });
    generation.current += 1;
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    setAuthError(false);
    setLoading(false);
    return data.user;
  }

  async function loginWithGoogle(credential) {
    const { data } = await api.post('/auth/google', { credential });
    generation.current += 1;
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    setAuthError(false);
    setLoading(false);
    return data.user;
  }

  function logout() {
    generation.current += 1;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setLoading(false);
    setAuthError(false);
  }

  return (
    <AuthContext.Provider value={{ user, login, loginWithGoogle, logout, loading, authError, retrySession: () => setSessionAttempt(value => value + 1) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
