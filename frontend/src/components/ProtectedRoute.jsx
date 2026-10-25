import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function ProtectedRoute({ children, role }) {
  const { user, loading, authError, retrySession, logout } = useAuth();
  const { t } = useLanguage();

  if (loading) return <div role="status" className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">{t('Memverifikasi sesi Anda...', 'Verifying your session...')}</div>;
  if (authError) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="panel max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold text-[#052659]">{t('Koneksi belum tersedia', 'Unable to connect')}</h1>
        <p role="alert" className="mt-3 text-sm leading-6 text-slate-500">{t('Sesi Anda belum dapat diverifikasi. Periksa koneksi dan coba lagi.', 'We could not verify your session. Check your connection and try again.')}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={retrySession} className="btn-primary">{t('Coba lagi', 'Try again')}</button>
          <button type="button" onClick={logout} className="btn-secondary">{t('Ke halaman masuk', 'Back to sign in')}</button>
        </div>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/member'} replace />;
  return children;
}
