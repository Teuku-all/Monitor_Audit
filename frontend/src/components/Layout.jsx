import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import Icon from './Icon';
import BrandMark from './BrandMark';
import ThemeToggle from './ThemeToggle';
export function LanguageSwitch() {
  const { language, setLanguage, t } = useLanguage();
  return <div className="language-switch" role="group" aria-label={t('Pilih bahasa', 'Choose language')}><Icon name="globe" size={16} /><span className="language-switch-label">{t('Bahasa', 'Language')}</span>{['id','en'].map(code => <button key={code} type="button" aria-pressed={language === code} onClick={() => setLanguage(code)} className={language === code ? 'selected' : ''}>{code.toUpperCase()}</button>)}</div>;
}
export default function Layout() {
  const { user, logout } = useAuth();
  const { t, formatDate } = useLanguage();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const admin = user?.role === 'admin';
  const base = admin ? '/admin' : '/member';
  const items = [
    { to: base, end: true, icon: 'grid', label: t('Ringkasan', 'Overview') },
    { to: `${base}/targets`, icon: 'target', label: t('Target kerja', 'Work targets') },
    { to: `${base}/submissions`, icon: 'file', label: t('Dokumen audit', 'Audit documents') },
    ...(admin ? [{to:'/admin/members',icon:'users',label:t('Anggota tim','Team members')}] : [{to:'/member/upload',icon:'upload',label:t('Kirim dokumen','Upload document')}]),
  ];
  const current = items.find(item => item.end ? pathname === item.to : pathname.startsWith(item.to)) || items[0];
  return <div className="app-frame">
    {open && <button className="sidebar-overlay" aria-label={t('Tutup navigasi', 'Close navigation')} onClick={() => setOpen(false)} />}
    <aside className={`sidebar ${open ? 'is-open' : ''}`}>
      <NavLink to={base} className="brand" onClick={() => setOpen(false)}><span className="brand-symbol"><BrandMark size={42} /></span><span>Audit<span className="brand-light">Monitor</span><small>TEAM WORKSPACE</small></span></NavLink>
      <div className="sidebar-caption">{t('Menu utama', 'Main menu')}</div>
      <nav aria-label={t('Navigasi utama', 'Main navigation')}>{items.map(item => <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)} className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}><span className="nav-item-icon"><Icon name={item.icon} size={17} /></span><span className="nav-item-label">{item.label}</span></NavLink>)}</nav>
      <div className="sidebar-tip"><div className="tip-icon"><Icon name="target" size={24}/></div><strong>{t('Satu tim. Satu arah.', 'One team. One direction.')}</strong><p>{t('Target yang jelas membuat setiap langkah lebih berarti.', 'Clear targets make every step count.')}</p><NavLink to={`${base}/targets`} onClick={() => setOpen(false)}>{t('Lihat target', 'Explore targets')}<Icon name="arrow" size={15}/></NavLink></div>
      <div className="sidebar-profile"><span className="avatar">{user?.name?.charAt(0).toUpperCase()}</span><div><strong>{user?.name}</strong><small>{admin ? t('Administrator','Administrator') : t('Anggota tim','Team member')}</small></div><button title={t('Keluar', 'Sign out')} aria-label={t('Keluar', 'Sign out')} onClick={logout}><Icon name="logout" size={18}/></button></div>
    </aside>
    <div className="workspace"><header className="workspace-header"><div className="header-context"><button className="mobile-menu icon-button" onClick={() => setOpen(!open)} aria-label={open ? t('Tutup navigasi','Close navigation') : t('Buka navigasi','Open navigation')} aria-expanded={open}><Icon name={open ? 'close' : 'menu'}/></button><div key={pathname} className="workspace-header-route"><span className="header-home">{t('Ruang kerja','Workspace')}</span><Icon name="chevron" size={13}/><strong><span className="header-current-icon"><Icon name={current.icon} size={15}/></span><span>{current.label}</span></strong></div></div><div className="header-actions"><span className="header-date"><span className="header-date-icon"><Icon name="calendar" size={16}/></span><span className="header-date-copy"><small>{t('Hari ini','Today')}</small><strong>{formatDate(new Date(),{day:'numeric',month:'short',year:'numeric'})}</strong></span></span><ThemeToggle /><LanguageSwitch /></div></header><main className="workspace-content"><div key={pathname} className="page-transition"><Outlet /></div></main><footer className="workspace-footer"><span>Audit Monitor</span><span>{t('Setiap progres, tercatat.', 'Every step, accounted for.')}</span></footer></div>
  </div>;
}
