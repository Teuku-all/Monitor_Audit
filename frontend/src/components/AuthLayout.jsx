import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import BrandMark from './BrandMark';
import ThemeToggle from './ThemeToggle';

export default function AuthLayout({ children, transitionOut = false }) {
  const { language, setLanguage, t } = useLanguage();
  const { pathname } = useLocation();
  return (
    <main className={`auth-layout ${pathname === '/login' ? 'auth-layout--login' : ''} ${transitionOut ? 'auth-login--success' : ''} flex min-h-screen items-center justify-center bg-[#FFFFFF] p-4 sm:p-8`}>
      <div className={`auth-card ${pathname === '/login' ? 'auth-card--login' : ''} grid w-full max-w-[1120px] overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_24px_80px_rgba(5,38,89,0.1)] lg:min-h-[720px] lg:grid-cols-[0.95fr_1.05fr]`}>
        <section className="auth-visual relative hidden flex-col justify-between overflow-hidden bg-[#052659] p-12 text-white lg:flex">
          <div className="pointer-events-none absolute -right-40 top-28 h-[480px] w-[480px] rounded-full border border-[#C2E8FF]/20"/>
          <div className="pointer-events-none absolute -right-24 top-44 h-[350px] w-[350px] rounded-full border border-[#C2E8FF]/20"/>
          <Link to="/login" className="relative flex items-center gap-3"><BrandMark size={42}/><span className="text-lg font-semibold tracking-tight">Audit Monitor<span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-[#C2E8FF]/70">{t('Ruang kerja tim', 'Team workspace')}</span></span></Link>
          <div className="relative py-12">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#C2E8FF]/30 bg-[#052659]/20 px-3 py-1.5 text-[11px] font-medium text-[#C2E8FF]"><span className="h-1.5 w-1.5 rounded-full bg-[#C2E8FF]"/>{t('Satu tim. Tujuan yang sama.', 'One team. Shared goals.')}</span>
            <h1 className="mt-6 text-[42px] font-semibold leading-[1.15] tracking-[-0.04em]">{t('Kerja lebih terarah.', 'Work with direction.')}<span className="mt-1 block text-[#C2E8FF]">{t('Hasil lebih terukur.', 'Progress you can see.')}</span></h1>
            <p className="mt-5 max-w-sm text-sm leading-7 text-[#C2E8FF]/75">{t('Kelola target, kirim dokumen, dan selesaikan tindak lanjut audit bersama tim dalam satu tempat.', 'Manage targets, submit documents, and complete audit follow-ups with your team in one place.')}</p>
            <div className="mt-9 rounded-2xl border border-[#C2E8FF]/25 bg-[#052659]/35 p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#C2E8FF]/60">{t('Alur kerja yang jelas', 'A clear path forward')}</p>
              <div className="mt-5 grid grid-cols-3 gap-4">
                {[[t('Target', 'Assign'), t('Tentukan tujuan', 'Set a goal')], [t('Kerjakan', 'Deliver'), t('Bagikan progres', 'Share progress')], [t('Tinjau', 'Review'), t('Selesaikan bersama', 'Finish together')]].map(([title, description], index) => <div key={index}><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#C2E8FF]/10 text-xs text-[#C2E8FF]">0{index + 1}</span><p className="mt-3 text-xs font-semibold">{title}</p><p className="mt-1 text-[10px] leading-4 text-[#C2E8FF]/65">{description}</p></div>)}
              </div>
            </div>
          </div>
          <p className="relative text-xs text-[#C2E8FF]/60">{t('Kemajuan tim dimulai dari satu langkah.', 'Team progress starts with a single step.')}</p>
        </section>
        <section className="auth-form-panel flex flex-col px-6 py-6 sm:px-10 lg:px-14">
          <div className="mb-7 flex items-center justify-between gap-3 lg:justify-end">
            <Link to="/login" className="flex items-center gap-2 text-sm font-semibold text-[#052659] lg:hidden"><BrandMark size={36}/><span>Audit Monitor</span></Link>
            <div className="auth-header-controls">
              <ThemeToggle />
              <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1" aria-label={t('Pilih bahasa', 'Choose language')}>
                <button type="button" onClick={() => setLanguage('id')} aria-pressed={language === 'id'} aria-label="Bahasa Indonesia" className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${language === 'id' ? 'bg-white text-[#052659] shadow-sm' : 'text-slate-500 hover:text-[#052659]'}`}>ID</button>
                <button type="button" onClick={() => setLanguage('en')} aria-pressed={language === 'en'} aria-label="English" className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${language === 'en' ? 'bg-white text-[#052659] shadow-sm' : 'text-slate-500 hover:text-[#052659]'}`}>EN</button>
              </div>
            </div>
          </div>
          <div key={pathname} className={`auth-route-transition ${pathname === '/login' ? 'auth-login-transition' : ''} mx-auto flex w-full max-w-[390px] flex-1 flex-col justify-center py-5`}>{children}</div>
          <p className="mt-7 text-center text-[11px] text-slate-400">Audit Monitor &middot; {t('Ruang kerja audit yang terorganisir', 'Your organized audit workspace')}</p>
        </section>
      </div>
      {transitionOut && <div className="auth-exit-curtain" aria-hidden="true" />}
    </main>
  );
}
