import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import BrandMark from './BrandMark';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="border-b border-white/[0.07] bg-[#052659]/90 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-[1180px] mx-auto px-6 h-[72px] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandMark size={40} />
          <div>
            <span className="block font-semibold text-white text-[15px] tracking-tight">SIGAP</span>
            <span className="block max-w-[180px] text-[10px] leading-4 text-blue-100/75 mt-0.5">Sistem Informasi Gerak Audit Progresif</span>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <button
            onClick={() => navigate(isAdmin ? '/admin' : '/member')}
            className={`hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${location.pathname.includes('upload') || location.pathname.includes('submissions') ? 'text-gray-400 hover:text-white' : 'bg-white/[0.06] text-white'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10.5 12 3l9 7.5M5.5 9v11h13V9M9 20v-6h6v6" /></svg>
            Dashboard
          </button>
          <div className="hidden sm:block h-8 w-px bg-white/10" />
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#052659]/25 to-[#052659]/15 border border-[#C2E8FF]/20 flex items-center justify-center text-[#C2E8FF] font-semibold text-sm">
            {user?.name?.trim()?.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="text-left hidden md:block min-w-28">
            <p className="text-[13px] font-medium text-white leading-4">{user?.name}</p>
            <p className="text-[11px] text-gray-500 capitalize mt-1">{isAdmin ? 'Administrator' : 'Member'}</p>
          </div>
          <button onClick={handleLogout} className="btn-secondary text-xs px-3 py-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M18 15l3-3m0 0-3-3m3 3H9" /></svg>
            Keluar
          </button>
        </div>
      </div>
    </nav>
  );
}
