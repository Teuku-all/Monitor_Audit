import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useOutlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import Icon from './Icon';
import BrandMark from './BrandMark';
import ThemeToggle from './ThemeToggle';

export function LanguageSwitch() {
  const { language, setLanguage, t } = useLanguage();
  return <div className="language-switch" role="group" aria-label={t('Pilih bahasa', 'Choose language')}><Icon name="globe" size={16} /><span className="language-switch-label">{t('Bahasa', 'Language')}</span>{['id', 'en'].map(code => <button key={code} type="button" aria-pressed={language === code} onClick={() => setLanguage(code)} className={language === code ? 'selected' : ''}>{code.toUpperCase()}</button>)}</div>;
}

function AnimatedOutlet() {
  const { pathname } = useLocation();
  const homeClass = pathname === '/admin' || pathname === '/member' ? ' home-page-enter' : '';
  const outlet = useOutlet();
  const previous = useRef({ pathname, outlet });
  const latestOutlet = useRef(outlet);
  const [settledPath, setSettledPath] = useState(pathname);
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  latestOutlet.current = outlet;

  useEffect(() => {
    if (settledPath === pathname) return undefined;
    const timer = window.setTimeout(() => {
      previous.current = { pathname, outlet: latestOutlet.current };
      setSettledPath(pathname);
    }, reducedMotion ? 0 : 340);
    return () => window.clearTimeout(timer);
  }, [pathname, settledPath, reducedMotion]);

  if (settledPath === pathname) {
    previous.current = { pathname, outlet };
    return <div className="route-stage"><div key={pathname} className={`page-transition${homeClass}`}>{outlet}</div></div>;
  }

  if (reducedMotion) return <div className="route-stage"><div key={pathname} className={`page-transition${homeClass}`}>{outlet}</div></div>;

  return <div className="route-stage">
    <div key={settledPath} className="page-transition route-page-exit" aria-hidden="true" inert="">{previous.current.outlet}</div>
    <div key={pathname} className={`page-transition route-page-enter${homeClass}`}>{outlet}</div>
  </div>;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { t, formatDate } = useLanguage();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const menuButton = useRef(null);
  const closeButton = useRef(null);
  const admin = user?.role === 'admin';
  const base = admin ? '/admin' : '/member';
  const enteredOnHome = useRef(pathname === base);
  const [showHomeCurtain, setShowHomeCurtain] = useState(() => enteredOnHome.current && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const items = [
    { to: base, end: true, icon: 'grid', label: t('Ringkasan', 'Overview') },
    { to: `${base}/targets`, icon: 'target', label: t('Target kerja', 'Work targets') },
    { to: `${base}/submissions`, icon: 'file', label: t('Dokumen audit', 'Audit documents') },
    ...(admin ? [{ to: '/admin/members', icon: 'users', label: t('Anggota tim', 'Team members') }] : [{ to: '/member/upload', icon: 'upload', label: t('Kirim dokumen', 'Upload document') }]),
    { to: `${base}/coaching`, icon: 'message', label: t('Coaching', 'Coaching') },
    { to: `${base}/audit-guide`, icon: 'file', label: t('Panduan audit', 'Audit guide') },
  ];
  const current = items.find(item => item.end ? pathname === item.to : pathname.startsWith(item.to)) || items[0];

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!showHomeCurtain) return undefined;
    if (pathname !== base) {
      setShowHomeCurtain(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setShowHomeCurtain(false), 1100);
    return () => window.clearTimeout(timer);
  }, [pathname, base, showHomeCurtain]);

  function closeMenu() {
    setOpen(false);
    menuButton.current?.focus();
  }

  return <><div className="app-frame">
    {open && <button className="sidebar-overlay" aria-label={t('Tutup navigasi', 'Close navigation')} onClick={closeMenu} />}
    <aside id="mobile-navigation" className={`sidebar ${open ? 'is-open' : ''}`} aria-label={t('Menu navigasi', 'Navigation menu')}>
      <div className="sidebar-heading">
        <NavLink to={base} className="brand" onClick={() => setOpen(false)}><span className="brand-symbol"><BrandMark size={42} /></span><span>Audit<span className="brand-light">Monitor</span><small>TEAM WORKSPACE</small></span></NavLink>
        <button ref={closeButton} className="sidebar-close" type="button" aria-label={t('Tutup menu', 'Close menu')} onClick={closeMenu}><Icon name="close" size={19} /></button>
      </div>
      <div className="sidebar-caption">{t('Menu utama', 'Main menu')}</div>
      <nav aria-label={t('Navigasi utama', 'Main navigation')}>{items.map(item => <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><span className="nav-item-icon"><Icon name={item.icon} size={17} /></span><span className="nav-item-label">{item.label}</span></NavLink>)}</nav>
      <div className="sidebar-tip"><div className="tip-icon"><Icon name="target" size={24} /></div><strong>{t('Satu tim. Satu arah.', 'One team. One direction.')}</strong><p>{t('Target yang jelas membuat setiap langkah lebih berarti.', 'Clear targets make every step count.')}</p><NavLink to={`${base}/targets`} onClick={() => setOpen(false)}>{t('Lihat target', 'Explore targets')}<Icon name="arrow" size={15} /></NavLink></div>
      <div className="sidebar-profile"><span className="avatar">{user?.name?.charAt(0).toUpperCase()}</span><div><strong>{user?.name}</strong><small>{admin ? t('Administrator', 'Administrator') : t('Anggota tim', 'Team member')}</small></div><button title={t('Keluar', 'Sign out')} aria-label={t('Keluar', 'Sign out')} onClick={logout}><Icon name="logout" size={18} /></button></div>
    </aside>
    <div className="workspace">
      <header className="workspace-header">
        <div className="header-context"><button ref={menuButton} className="mobile-menu icon-button" onClick={() => setOpen(value => !value)} aria-label={open ? t('Tutup navigasi', 'Close navigation') : t('Buka navigasi', 'Open navigation')} aria-expanded={open} aria-controls="mobile-navigation"><Icon name={open ? 'close' : 'menu'} /></button><div key={pathname} className="workspace-header-route"><span className="header-home">{t('Ruang kerja', 'Workspace')}</span><Icon name="chevron" size={13} /><strong><span className="header-current-icon"><Icon name={current.icon} size={15} /></span><span>{current.label}</span></strong></div></div>
        <div className="header-actions"><span className="header-date"><span className="header-date-icon"><Icon name="calendar" size={16} /></span><span className="header-date-copy"><small>{t('Hari ini', 'Today')}</small><strong>{formatDate(new Date(), { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span></span><ThemeToggle /><LanguageSwitch /></div>
      </header>
      <main className="workspace-content"><AnimatedOutlet /></main>
      <footer className="workspace-footer"><span>Audit Monitor</span><span>{t('Setiap progres, tercatat.', 'Every step, accounted for.')}</span></footer>
    </div>
  </div>{showHomeCurtain && <div className="home-entry-curtain" aria-hidden="true" />}</>;
}
