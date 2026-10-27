import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'audit-theme';

function getInitialTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);
  const switching = useRef(false);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Keep the selected theme for this session when storage is unavailable.
    }
  }, [theme]);

  function toggleTheme(event) {
    if (switching.current) return;
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    const rect = event?.currentTarget?.getBoundingClientRect?.();

    if (rect) {
      root.style.setProperty('--theme-origin-x', `${rect.left + rect.width / 2}px`);
      root.style.setProperty('--theme-origin-y', `${rect.top + rect.height / 2}px`);
    }

    const applyTheme = () => flushSync(() => setTheme(nextTheme));
    if (typeof document.startViewTransition !== 'function'
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      applyTheme();
      return;
    }

    switching.current = true;
    root.dataset.themeTransitioning = 'true';
    const transition = document.startViewTransition(applyTheme);
    const finish = () => {
      delete root.dataset.themeTransitioning;
      switching.current = false;
    };
    transition.finished.then(finish, finish);
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
