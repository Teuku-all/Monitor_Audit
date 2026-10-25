import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import Icon from './Icon';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const dark = theme === 'dark';
  const label = dark ? t('Ganti ke tema terang', 'Switch to light theme') : t('Ganti ke tema gelap', 'Switch to dark theme');

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={dark}
      title={label}
    >
      <span className="theme-toggle-icon"><Icon name={dark ? 'sun' : 'moon'} size={17} /></span>
      <span className="theme-toggle-label">{dark ? t('Terang', 'Light') : t('Gelap', 'Dark')}</span>
    </button>
  );
}
