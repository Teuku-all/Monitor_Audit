import { createContext, useContext, useEffect, useRef, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // The server verifies the HttpOnly session cookie and returns the current role.
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
    const controller = new AbortController();
    const requestGeneration = generation.current;
    setLoading(true);
    setAuthError(false);
    api.get('/auth/profile', { signal: controller.signal })
      .then(({ data }) => {
        if (generation.current !== requestGeneration) return;
        setUser(data);
      })
      .catch((error) => {
        if (controller.signal.aborted || generation.current !== requestGeneration) return;
        if (error.response?.status === 401) {
          setUser(null);
        } else {
          // Keep the current session during temporary connection failures.
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
    setUser(data.user);
    setAuthError(false);
    setLoading(false);
    return data.user;
  }

  async function loginWithGoogle(credential) {
    const { data } = await api.post('/auth/google', { credential });
    generation.current += 1;
    setUser(data.user);
    setAuthError(false);
    setLoading(false);
    return data.user;
  }

  async function logout() {
    generation.current += 1;
    try { await api.post('/auth/logout'); } catch { /* Clear local state even if the network is unavailable. */ }
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
