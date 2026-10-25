import { createContext, useContext, useEffect, useState } from 'react';
const LanguageContext = createContext(null);
export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => localStorage.getItem('audit-language') === 'en' ? 'en' : 'id');
  const locale = language === 'en' ? 'en-GB' : 'id-ID';
  useEffect(() => { localStorage.setItem('audit-language', language); document.documentElement.lang = language; }, [language]);
  const t = (id, en) => language === 'en' ? (en ?? id) : id;
  function formatDate(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
    if (!value) return '—';
    const normalized = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T12:00:00`
      : typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:/.test(value)
        ? `${value.replace(' ', 'T')}Z`
        : value;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(locale, options);
  }
  return <LanguageContext.Provider value={{ language, setLanguage, locale, t, formatDate }}>{children}</LanguageContext.Provider>;
}
export const useLanguage = () => useContext(LanguageContext);
