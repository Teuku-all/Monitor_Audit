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
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return <div className="route-stage"><div key={pathname} className={`page-transition${reducedMotion ? '' : ` route-page-enter${homeClass}`}`}>{outlet}</div></div>;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { t, formatDate } = useLanguage();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const menuButton = useRef(null);
  const closeButton = useRef(null);
  const navigation = useRef(null);
  const menuOpener = useRef(null);
  const admin = user?.role === 'admin';
  const base = admin ? '/admin' : '/member';
  const items = [
    { to: base, end: true, icon: 'grid', label: t('Ringkasan', 'Overview') },
    { to: `${base}/targets`, icon: 'target', label: t('Target kerja', 'Work targets') },
    { to: `${base}/submissions`, icon: 'file', label: t('Dokumen audit', 'Audit documents') },
    ...(admin ? [{ to: '/admin/program', icon: 'target', label: t('Program audit', 'Audit program') }, { to: '/admin/members', icon: 'users', label: t('Pemantauan tugas', 'Task monitoring') }] : [{ to: '/member/upload', icon: 'upload', label: t('Kirim dokumen', 'Upload document') }]),
    { to: `${base}/coaching`, icon: 'message', label: t('Coaching', 'Coaching') },
    { to: `${base}/audit-guide`, icon: 'file', label: t('Panduan audit', 'Audit guide') },
  ];
  const current = items.find(item => item.end ? pathname === item.to : pathname.startsWith(item.to)) || items[0];

  useEffect(() => {
    let focusFrame;
    function focusMenuControl() {
      const destination = open ? closeButton.current : menuOpener.current;
      if (!destination?.getClientRects().length) return;
      if (getComputedStyle(destination).visibility !== 'visible') {
        if (open) focusFrame = requestAnimationFrame(focusMenuControl);
        return;
      }
      destination.focus({ preventScroll: true });
    }
    focusFrame = requestAnimationFrame(focusMenuControl);
    if (!open) return () => cancelAnimationFrame(focusFrame);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
      if (event.key === 'Tab') {
        const controls = [...navigation.current.querySelectorAll('a[href], button:not(:disabled)')].filter(element => element.getClientRects().length);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 761px)');
    const onResize = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener('change', onResize);
    return () => desktop.removeEventListener('change', onResize);
  }, []);

  function openMenu(event) {
    menuOpener.current = event.currentTarget;
    setOpen(true);
  }

  function closeMenu() {
    setOpen(false);
  }

  return <><a className="skip-link" href="#workspace-main">{t('Langsung ke konten', 'Skip to content')}</a><div className="app-frame">
    {open && <button className="sidebar-overlay" aria-label={t('Tutup navigasi', 'Close navigation')} onClick={closeMenu} />}
    <aside ref={navigation} id="mobile-navigation" className={`sidebar ${open ? 'is-open' : ''}`} role={open ? 'dialog' : undefined} aria-modal={open ? true : undefined} aria-label={t('Menu navigasi', 'Navigation menu')}>
      <div className="sidebar-heading">
        <NavLink to={base} className="brand" onClick={() => setOpen(false)}><span className="brand-symbol"><BrandMark size={42} /></span><span className="brand-copy">SIGAP<small className="brand-description">Sistem Informasi Gerak Audit Progresif</small></span></NavLink>
        <button ref={closeButton} className="sidebar-close" type="button" aria-label={t('Tutup menu', 'Close menu')} onClick={closeMenu}><Icon name="close" size={19} /></button>
      </div>
      <div className="sidebar-caption">{t('Menu utama', 'Main menu')}</div>
      <nav aria-label={t('Navigasi utama', 'Main navigation')}>{items.map(item => <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><span className="nav-item-icon"><Icon name={item.icon} size={17} /></span><span className="nav-item-label">{item.label}</span></NavLink>)}</nav>
      <div className="sidebar-tip"><div className="tip-icon"><Icon name="target" size={24} /></div><strong>{t('Satu tim. Satu arah.', 'One team. One direction.')}</strong><p>{t('Target yang jelas membuat setiap langkah lebih berarti.', 'Clear targets make every step count.')}</p><NavLink to={`${base}/targets`} onClick={() => setOpen(false)}>{t('Lihat target', 'Explore targets')}<Icon name="arrow" size={15} /></NavLink></div>
      <div className="sidebar-profile"><span className="avatar">{user?.name?.charAt(0).toUpperCase()}</span><div><strong>{user?.name}</strong><small>{admin ? t('Administrator', 'Administrator') : t('Anggota tim', 'Team member')}</small></div><button title={t('Keluar', 'Sign out')} aria-label={t('Keluar', 'Sign out')} onClick={logout}><Icon name="logout" size={18} /></button></div>
    </aside>
    <div className="workspace" inert={open ? '' : undefined}>
      <header className="workspace-header">
        <div className="header-context"><button ref={menuButton} className="mobile-menu icon-button" onClick={openMenu} aria-label={t('Buka navigasi', 'Open navigation')} aria-expanded={open} aria-controls="mobile-navigation"><Icon name="menu" /></button><div key={pathname} className="workspace-header-route"><span className="header-home">{t('Ruang kerja', 'Workspace')}</span><Icon name="chevron" size={13} /><strong><span className="header-current-icon"><Icon name={current.icon} size={15} /></span><span>{current.label}</span></strong></div></div>
        <div className="header-actions"><span className="header-date"><span className="header-date-icon"><Icon name="calendar" size={16} /></span><span className="header-date-copy"><small>{t('Hari ini', 'Today')}</small><strong>{formatDate(new Date(), { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span></span><ThemeToggle /><LanguageSwitch /></div>
      </header>
      <main id="workspace-main" tabIndex={-1} className="workspace-content"><AnimatedOutlet /></main>
      <footer className="workspace-footer"><span>SIGAP &middot; Sistem Informasi Gerak Audit Progresif</span><span>{t('Setiap progres, tercatat.', 'Every step, accounted for.')}</span></footer>
    </div>
  </div><nav className="mobile-bottom-nav" inert={open ? '' : undefined} aria-label={t('Navigasi cepat', 'Quick navigation')}>
    {items.slice(0, 3).map((item, index) => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `mobile-bottom-item${isActive ? ' active' : ''}`}><Icon name={item.icon} size={21} /><span>{[t('Ringkasan', 'Overview'), t('Tugas', 'Tasks'), t('Dokumen', 'Documents')][index]}</span></NavLink>)}
    <button type="button" className={`mobile-bottom-item${items.slice(3).some(item => pathname.startsWith(item.to)) ? ' active' : ''}`} aria-label={t('Buka menu lainnya', 'Open more options')} aria-expanded={open} aria-controls="mobile-navigation" onClick={openMenu}><Icon name="menu" size={21} /><span>{t('Lainnya', 'More')}</span></button>
  </nav></>;
}
